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

const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const memberRoutes = require('./routes/members');

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
app.get('/api/ping', (_req, res) => res.json({ message: 'pong' }));

app.post('/api/run', async (req, res) => {
  const { language, code, stdin } = req.body;
  let fileName, imageName, runCmd;

  if (language === 'cpp') {
    fileName  = 'code.cpp';
    imageName = 'cpp-runner:latest';
    runCmd    = `g++ ${fileName} -o main && timeout 5s ./main < stdin.txt`;
  } else if (language === 'python') {
    fileName  = 'code.py';
    imageName = 'python-runner:latest';
    runCmd    = `timeout 5s python3 ${fileName} < stdin.txt`;
  } else if (language === 'java') {
    fileName  = 'Main.java';
    imageName = 'java-runner:latest';
    runCmd    = `javac ${fileName} && timeout 5s java Main < stdin.txt`;
  } else {
    return res.status(400).json({ stdout:'', stderr:'Unsupported language' });
  }

  const tmp = path.join(os.tmpdir(), `code-run-${uuidv4()}`);
  try {
    await fs.mkdir(tmp);
    await fs.writeFile(path.join(tmp, fileName), code);
    await fs.writeFile(path.join(tmp, 'stdin.txt'), stdin||'');

    const cmd = [
      'docker run --rm --network none --memory 128m --cpus 0.5',
      `-v ${tmp}:/workspace`, imageName,
      `bash -c "${runCmd}"`
    ].join(' ');

    console.log('▶️', cmd);
    const { stdout, stderr } = await exec(cmd, { timeout: 10000 });
    res.json({ stdout, stderr });
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

// Middleware to verify socket connection
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) return next(); // Allow anonymous for backward compatibility initially
    
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
    socket.userId = decoded.id;
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

io.on('connection', socket => {
  console.log('🔌', socket.id, socket.userId ? `(User: ${socket.userId})` : '(Anonymous)');

  socket.on('joinRoom', async ({ roomId }) => {
    socket.join(roomId);
    
    // Check if user has permission (if logged in)
    if (socket.userId) {
      const membership = await RoomMember.findOne({ roomId, userId: socket.userId });
      socket.role = membership ? membership.role : 'viewer';
    } else {
      socket.role = 'viewer';
    }
    
    // Load room state
    const room = await Room.findById(roomId);
    if (room) {
      socket.emit('roomState', { code: room.code, language: room.language, role: socket.role });
    }
  });

  socket.on('codeChange', async ({ roomId, code }) => {
    // Only editors/owners can change code
    if (socket.role === 'viewer') return;
    
    // Broadcast to room immediately
    socket.to(roomId).emit('codeUpdate', code);
    
    // Persist to DB (could be optimized with Redis caching later)
    await Room.findByIdAndUpdate(roomId, { code });
  });

  socket.on('languageChange', async ({ roomId, language }) => {
    if (socket.role === 'viewer') return;
    
    socket.to(roomId).emit('languageUpdate', language);
    await Room.findByIdAndUpdate(roomId, { language });
  });

  socket.on('runResult', ({ roomId, stdout, stderr }) => {
    socket.to(roomId).emit('runResult', { stdout, stderr });
  });

  // Whiteboard events
  socket.on('whiteboardDraw', async ({ roomId, element }) => {
    if (socket.role === 'viewer') return;
    
    socket.to(roomId).emit('whiteboardUpdate', element);
    
    // Optimistic persistence
    await Whiteboard.updateOne(
      { roomId },
      { $push: { elements: element }, updatedAt: new Date() },
      { upsert: true }
    );
  });

  socket.on('whiteboardClear', async ({ roomId }) => {
    if (socket.role === 'viewer') return;
    
    socket.to(roomId).emit('whiteboardCleared');
    await Whiteboard.updateOne({ roomId }, { $set: { elements: [], updatedAt: new Date() } });
  });

  // Chat events
  socket.on('sendMessage', async ({ roomId, message }) => {
    if (!socket.userId) return; // Must be logged in to chat
    
    const chatMsg = await ChatMessage.create({
      roomId,
      userId: socket.userId,
      message
    });
    
    await chatMsg.populate('userId', 'name avatar');
    io.to(roomId).emit('newMessage', chatMsg);
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

  socket.on('disconnect', () => console.log('❌', socket.id));
});

httpServer.listen(PORT, () => {
  console.log(`🚀 Listening on port ${PORT}`);
});
