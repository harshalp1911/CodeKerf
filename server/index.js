// server/index.js
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const mongoose = require('mongoose');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');
const { v4: uuidv4 } = require('uuid');
const fs   = require('fs').promises;
const os   = require('os');
const path = require('path');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const passport = require('passport');
const jwt = require('jsonwebtoken');

const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const memberRoutes = require('./routes/members');
const containerPool = require('./services/containerPool');
const { JWT_SECRET } = require('./config');

const app = express();
const PORT = process.env.PORT || 5002;

// ── 1) MONGO & REDIS ────────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/online-code-editor';
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ Mongo connected'))
  .catch(e => console.error('❌ Mongo error', e));

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const pubClient = createClient({ url: redisUrl });
const subClient = pubClient.duplicate();

Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
  console.log('✅ Rediss connected');
});

// Import models
const User = require('./models/User');
const Room = require('./models/Room');
const RoomMember = require('./models/RoomMember');
const ChatMessage = require('./models/ChatMessage');
const Whiteboard = require('./models/Whiteboard');

// TTL session schema
const sessionSchema = new mongoose.Schema({
  sessionId: { type: String, unique: true },
  language:  String,
  code:      String,
  updatedAt: Date
});
sessionSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });
const Session = mongoose.model('Session', sessionSchema);

// ── 2) MIDDLEWARE & ROUTES ──────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  methods: ['GET','POST','PUT','DELETE'],
  credentials: true
}));
app.use(express.json());
app.use(passport.initialize());

app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/rooms/:roomId/members', memberRoutes);

// ── 3) REST ───────────────────────────────────────────────────────────────
app.get('/', (_req, res) => res.json({ status: 'ok', service: 'CodeKerf API', version: '1.0.0' }));
app.get('/api/ping', (_req, res) => res.json({ message: 'pong' }));

app.post('/api/run', async (req, res) => {
  const { language, code, stdin } = req.body;
  let fileName, imageName, runCmd;

  if (language === 'cpp') {
    fileName  = 'code.cpp';
    imageName = 'cpp-runner:latest';
    runCmd    = `g++ /workspace/${fileName} -o /workspace/main && timeout 5s /workspace/main < /workspace/stdin.txt`;
  } else if (language === 'python') {
    fileName  = 'code.py';
    imageName = 'python-runner:latest';
    runCmd    = `timeout 5s python3 /workspace/${fileName} < /workspace/stdin.txt`;
  } else if (language === 'java') {
    fileName  = 'Main.java';
    imageName = 'java-runner:latest';
    runCmd    = `cd /workspace && javac ${fileName} && timeout 5s java Main < stdin.txt`;
  } else {
    return res.status(400).json({ stdout:'', stderr:'Unsupported language' });
  }

  const tmp = path.join(os.tmpdir(), `code-run-${uuidv4()}`);
  try {
    await fs.mkdir(tmp);
    await fs.writeFile(path.join(tmp, fileName), code);
    await fs.writeFile(path.join(tmp, 'stdin.txt'), stdin||'');

    // Try container pool first (fast path)
    const container = await containerPool.acquire(language);

    if (container) {
      console.log('🏊 Using pooled container:', container);
      const result = await containerPool.execute(
        container,
        path.join(tmp, fileName), fileName,
        path.join(tmp, 'stdin.txt'),
        runCmd
      );
      containerPool.release(container);
      res.json(result);
    } else {
      // Fallback: create new container (slow path)
      console.log('🐳 Pool busy, using docker run for', language);
      const fallbackRunCmd = language === 'cpp'
        ? `g++ ${fileName} -o main && timeout 5s ./main < stdin.txt`
        : language === 'python'
          ? `timeout 5s python3 ${fileName} < stdin.txt`
          : `javac ${fileName} && timeout 5s java Main < stdin.txt`;

      const cmd = [
        'docker run --rm --network none --memory 128m --cpus 0.5',
        `-v ${tmp}:/workspace`, imageName,
        `bash -c "${fallbackRunCmd}"`
      ].join(' ');

      console.log('▶️', cmd);
      const { stdout, stderr } = await exec(cmd, { timeout: 10000 });
      res.json({ stdout, stderr });
    }
  } catch (err) {
    console.error(err);
    res.json({
      stdout: err.stdout  || '',
      stderr: err.stderr  || err.message
    });
  } finally {
    await fs.rm(tmp, { recursive: true, force: true }).catch(()=>{/*ignore*/});
  }
});

// ── 4) SOCKET.IO ───────────────────────────────────────────────────────────
const httpServer = createServer(app);
const io = new Server(httpServer, {
  path: '/socket.io',
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET','POST'],
    credentials: true
  },
  adapter: createAdapter(pubClient, subClient)
});

// Member routes use this to update open tabs when someone's role changes
app.set('io', io);

const LANGUAGES = ['cpp', 'python', 'java'];
const EDIT_ROLES = ['owner', 'editor'];
const MAX_CHAT_LENGTH = 2000;
const CURSOR_COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'];

// Identify the user from their token. Sockets without a token stay anonymous and can't use rooms.
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next();

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id).select('name');
    if (!user) return next(new Error('Authentication error'));

    socket.userId = user._id.toString();
    socket.userName = user.name;
    socket.cursorColor = CURSOR_COLORS[parseInt(socket.userId.slice(-2), 16) % CURSOR_COLORS.length];
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

// Returns the room ID if this socket has joined `roomId` with one of `roles` (any role when omitted).
// The role comes from the database at join time, never from the client.
const allowedRoom = (socket, roomId, roles) => {
  const current = socket.currentRoomId;
  if (!socket.userId || !current || String(roomId) !== current) return null;
  // Member routes remove sockets from the room when access changes, so check it is still joined
  if (!socket.rooms.has(current)) return null;
  if (roles && !roles.includes(socket.roomRole)) return null;
  return current;
};

io.on('connection', socket => {
  console.log('🔌', socket.id, socket.userId ? `(User: ${socket.userId})` : '(Anonymous)');

  // Lets member routes reach every tab this user has open
  if (socket.userId) socket.join(`user:${socket.userId}`);

  // Wraps async handlers so a bad payload or database error is logged instead of crashing the server
  const on = (event, handler) => {
    socket.on(event, async (payload) => {
      try {
        await handler(payload || {});
      } catch (err) {
        console.error(`❌ ${event} failed:`, err);
      }
    });
  };

  on('joinRoom', async ({ roomId }) => {
    if (!socket.userId) {
      return socket.emit('roomError', { message: 'Log in to join rooms.' });
    }
    if (!mongoose.isValidObjectId(roomId)) {
      return socket.emit('roomError', { message: 'Room not found.' });
    }
    roomId = String(roomId);

    const [room, membership] = await Promise.all([
      Room.findById(roomId),
      RoomMember.findOne({ roomId, userId: socket.userId })
    ]);
    if (!room) return socket.emit('roomError', { message: 'Room not found.' });
    if (!membership) return socket.emit('roomError', { message: 'You are not a member of this room.' });

    if (socket.currentRoomId && socket.currentRoomId !== roomId) {
      socket.leave(socket.currentRoomId);
    }
    socket.join(roomId);
    socket.currentRoomId = roomId;
    socket.roomRole = membership.role;

    socket.emit('roomState', { code: room.code, language: room.language, role: membership.role });
  });

  on('codeChange', async ({ roomId, code }) => {
    const room = allowedRoom(socket, roomId, EDIT_ROLES);
    if (!room || typeof code !== 'string') return;

    socket.to(room).emit('codeUpdate', code);
    await Room.findByIdAndUpdate(room, { code });
  });

  on('languageChange', async ({ roomId, language }) => {
    const room = allowedRoom(socket, roomId, EDIT_ROLES);
    if (!room || !LANGUAGES.includes(language)) return;

    socket.to(room).emit('languageUpdate', language);
    await Room.findByIdAndUpdate(room, { language });
  });

  on('runResult', ({ roomId, stdout, stderr }) => {
    const room = allowedRoom(socket, roomId, EDIT_ROLES);
    if (!room) return;

    socket.to(room).emit('runResult', { stdout: String(stdout ?? ''), stderr: String(stderr ?? '') });
  });

  // Whiteboard events
  on('whiteboardDraw', async ({ roomId, element }) => {
    const room = allowedRoom(socket, roomId, EDIT_ROLES);
    if (!room || !element || typeof element !== 'object') return;

    socket.to(room).emit('whiteboardUpdate', element);
    await Whiteboard.updateOne(
      { roomId: room },
      { $push: { elements: element }, updatedAt: new Date() },
      { upsert: true }
    );
  });

  on('whiteboardObjectModified', ({ roomId, element }) => {
    const room = allowedRoom(socket, roomId, EDIT_ROLES);
    if (!room || !element || typeof element !== 'object') return;

    socket.to(room).emit('whiteboardObjectModified', { element });
  });

  on('whiteboardClear', async ({ roomId }) => {
    const room = allowedRoom(socket, roomId, EDIT_ROLES);
    if (!room) return;

    socket.to(room).emit('whiteboardCleared');
    await Whiteboard.updateOne({ roomId: room }, { $set: { elements: [], updatedAt: new Date() } });
  });

  // Chat events (any member, including viewers)
  on('sendMessage', async ({ roomId, message }) => {
    const room = allowedRoom(socket, roomId);
    if (!room || typeof message !== 'string') return;

    const text = message.trim();
    if (!text || text.length > MAX_CHAT_LENGTH) return;

    const chatMsg = await ChatMessage.create({ roomId: room, userId: socket.userId, message: text });
    await chatMsg.populate('userId', 'name avatar');
    io.to(room).emit('newMessage', chatMsg);
  });

  // Typing indicators use the server's record of who this is, not names sent by the client
  on('typing', ({ roomId }) => {
    const room = allowedRoom(socket, roomId);
    if (!room) return;

    socket.to(room).emit('userTyping', { userId: socket.userId, userName: socket.userName });
  });

  on('stoppedTyping', ({ roomId }) => {
    const room = allowedRoom(socket, roomId);
    if (!room) return;

    socket.to(room).emit('userStoppedTyping', { userId: socket.userId });
  });

  // Code editor cursor tracking
  on('cursorMove', ({ roomId, line, ch }) => {
    const room = allowedRoom(socket, roomId);
    if (!room || !Number.isInteger(line) || !Number.isInteger(ch)) return;

    socket.to(room).emit('cursorMove', {
      userId: socket.userId,
      userName: socket.userName,
      line,
      ch,
      color: socket.cursorColor
    });
  });

  // Whiteboard pointer tracking
  on('whiteboardPointer', ({ roomId, x, y }) => {
    const room = allowedRoom(socket, roomId);
    if (!room || !Number.isFinite(x) || !Number.isFinite(y)) return;

    socket.to(room).emit('whiteboardPointerMove', {
      userId: socket.userId,
      userName: socket.userName,
      x,
      y,
      color: socket.cursorColor
    });
  });

  // Backward compatibility for old session mechanism during transition
  socket.on('joinSession', async sessionId => {
    socket.join(sessionId);
    let s = await Session.findOne({ sessionId });
    if (!s) {
      s = await Session.create({
        sessionId,
        language: 'cpp',
        code:     '',
        updatedAt: new Date()
      });
    }
    socket.emit('initSession', { code: s.code, language: s.language });
  });

  socket.on('disconnect', async () => {
    console.log('❌ Disconnect:', socket.id, 'userId:', socket.userId, 'roomId:', socket.currentRoomId, 'role:', socket.roomRole);
    
    // If user was in a room, check if they're the owner
    if (socket.currentRoomId && socket.userId) {
      try {
        const room = await Room.findById(socket.currentRoomId);
        
        // Check if this user is the room owner
        if (room && room.createdBy.toString() === socket.userId) {
          console.log('🗑️ Owner disconnected, deleting room:', socket.currentRoomId, 'owner:', socket.userId);
          
          // Notify all members BEFORE deleting
          io.to(socket.currentRoomId).emit('roomDeleted', { 
            message: 'Room owner has left. This room has been deleted.' 
          });
          
          // Delete all members
          await RoomMember.deleteMany({ roomId: socket.currentRoomId });
          
          // Delete whiteboard data
          await Whiteboard.deleteOne({ roomId: socket.currentRoomId });
          
          // Delete chat messages
          await ChatMessage.deleteMany({ roomId: socket.currentRoomId });
          
          // Delete the room
          await Room.findByIdAndDelete(socket.currentRoomId);
          
          console.log('✅ Room deleted successfully:', socket.currentRoomId);
        }
      } catch (err) {
        console.error('❌ Error deleting room on owner disconnect:', err);
      }
    }
  });
});

httpServer.listen(PORT, async () => {
  console.log(`🚀 Listening on port ${PORT}`);
  
  // Initialize container pool in background (don't block server start)
  containerPool.init().catch(err => {
    console.error('⚠️ Container pool init failed (falling back to docker run):', err.message);
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await containerPool.shutdown();
  process.exit(0);
});
process.on('SIGINT', async () => {
  await containerPool.shutdown();
  process.exit(0);
});
