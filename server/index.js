// server/index.js
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const mongoose = require('mongoose');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');
const passport = require('passport');
const jwt = require('jsonwebtoken');

const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const memberRoutes = require('./routes/members');
const shareRoutes = require('./routes/shares');
const containerPool = require('./services/containerPool');
const { LANGUAGES: RUN_LANGUAGES } = containerPool;
const createRunLimit = require('./middleware/runLimit');
const { JWT_SECRET } = require('./config');
const { isGuestKey } = require('./utils/identity');

const app = express();
const PORT = process.env.PORT || 5002;
// Behind nginx, req.ip should be the visitor's address from X-Forwarded-For, not nginx's.
// Only set this when a proxy is in front: otherwise anyone could fake the header.
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);

// ── 1) MONGO & REDIS ────────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/online-code-editor';
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ Mongo connected'))
  .catch(e => console.error('❌ Mongo error', e));

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const pubClient = createClient({ url: redisUrl });
const subClient = pubClient.duplicate();

const runLimit = createRunLimit(pubClient);

Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
  console.log('✅ Rediss connected');
});

// Import models
const User = require('./models/User');
const Room = require('./models/Room');
const RoomMember = require('./models/RoomMember');
const ChatMessage = require('./models/ChatMessage');
const Whiteboard = require('./models/Whiteboard');
const Share = require('./models/Share');

// ── 2) MIDDLEWARE & ROUTES ──────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  methods: ['GET','POST','PUT','DELETE'],
  credentials: true
}));
// Above the 100 KB code limit, so oversized code gets a clear message from /api/run instead of a bare 413
app.use(express.json({ limit: '256kb' }));
app.use(passport.initialize());

app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/rooms/:roomId/members', memberRoutes);
app.use('/api/shares', shareRoutes);

// ── 3) REST ───────────────────────────────────────────────────────────────
app.get('/', (_req, res) => res.json({ status: 'ok', service: 'CodeKerf API', version: '1.0.0' }));
app.get('/api/ping', (_req, res) => res.json({ message: 'pong' }));

const MAX_CODE_LENGTH = 100 * 1024;
const MAX_STDIN_LENGTH = 64 * 1024;

app.post('/api/run', runLimit, async (req, res) => {
  const { language, code, stdin = '' } = req.body;
  if (!RUN_LANGUAGES[language]) {
    return res.status(400).json({ error: 'Unsupported language' });
  }
  if (typeof code !== 'string' || code.length > MAX_CODE_LENGTH
    || typeof stdin !== 'string' || stdin.length > MAX_STDIN_LENGTH) {
    return res.status(400).json({ error: 'Code must be under 100 KB and input under 64 KB' });
  }

  try {
    const result = await containerPool.run(language, code, stdin);
    if (!result) {
      return res.status(503).json({ error: 'The server is busy running other code. Please try again in a few seconds.' });
    }
    res.json(result);
  } catch (err) {
    console.error('Run failed:', err);
    res.status(500).json({ error: 'Could not run the code. Please try again.' });
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
const CHAT_HISTORY_LIMIT = 100;

const isElementId = (id) => typeof id === 'string' && id.length > 0 && id.length <= 64;
const isWhiteboardElement = (element) => !!element && typeof element === 'object' && isElementId(element.id);
const CURSOR_COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'];

const INVALID_LINK = 'This link is no longer valid.';

// Identify the user from their token. Sockets without a token stay anonymous and can't use rooms.
io.use(async (socket, next) => {
  const { token, guestKey } = socket.handshake.auth;
  // Guests are recognised by a random key their browser keeps; only share links use it
  if (isGuestKey(guestKey)) socket.guestKey = guestKey;
  socket.cursorColor = CURSOR_COLORS[0];
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

// Code editing works the same in rooms and share links. Returns where to broadcast and how to
// save, if this socket may act on `id` (a room id or a share token) with one of `roles`.
const liveTarget = (socket, id, roles) => {
  const room = allowedRoom(socket, id, roles);
  if (room) {
    return { channel: room, save: (fields) => Room.findByIdAndUpdate(room, fields) };
  }

  const share = socket.share;
  if (!share || String(id) !== share.token || !socket.rooms.has(share.channel)) return null;
  if (roles && !roles.includes(share.role)) return null;
  return { channel: share.channel, save: (fields) => Share.updateOne({ _id: share.id }, fields) };
};

io.on('connection', socket => {
  console.log('🔌', socket.id, socket.userId ? `(User: ${socket.userId})` : '(Anonymous)');

  // Lets member routes reach every tab this user has open
  if (socket.userId) socket.join(`user:${socket.userId}`);

  // Wraps async handlers so a bad payload or database error is logged instead of crashing the server.
  // `reply` answers events the client sent with a callback, and does nothing otherwise.
  const on = (event, handler) => {
    socket.on(event, async (payload, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      try {
        await handler(payload || {}, reply);
      } catch (err) {
        console.error(`❌ ${event} failed:`, err);
        reply({ error: 'Something went wrong' });
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

    const recentMessages = await ChatMessage.find({ roomId })
      .sort({ timestamp: -1 })
      .limit(CHAT_HISTORY_LIMIT)
      .populate('userId', 'name avatar');

    socket.emit('roomState', {
      code: room.code,
      language: room.language,
      role: membership.role,
      messages: recentMessages.reverse()
    });
  });

  // Open a share link. The owner can always reopen it; anyone else claims it, and once it is
  // claimed only that same person (account for editor links, browser for viewer links) gets in.
  on('joinShare', async ({ token }) => {
    const fail = (code, message) => socket.emit('shareError', { code, message });
    if (typeof token !== 'string' || token.length > 64) return fail('INVALID', INVALID_LINK);

    const share = await Share.findOne({ token, expiresAt: { $gt: new Date() } });
    if (!share) return fail('INVALID', INVALID_LINK);

    const isOwner = (socket.userId && String(share.ownerUserId) === socket.userId) ||
      (socket.guestKey && share.ownerGuestKey === socket.guestKey);

    let role = 'owner';
    if (!isOwner) {
      if (share.role === 'editor' && !socket.userId) {
        return fail('LOGIN_REQUIRED', 'Log in to open this editor link.');
      }
      const claimant = share.role === 'editor'
        ? `user:${socket.userId}`
        : socket.guestKey && `guest:${socket.guestKey}`;
      if (!claimant) return fail('INVALID', INVALID_LINK);

      // Claim in one atomic update, so if two people open the link at the same moment,
      // only one of them gets it
      const claimed = share.claimedBy === claimant ||
        await Share.findOneAndUpdate({ _id: share._id, claimedBy: null }, { claimedBy: claimant });
      if (!claimed) return fail('INVALID', INVALID_LINK);
      role = share.role;
    }

    const channel = `share:${share._id}`;
    if (socket.share && socket.share.channel !== channel) socket.leave(socket.share.channel);
    socket.join(channel);
    socket.share = { id: share._id.toString(), token, channel, role };

    if (role !== 'owner') {
      socket.to(channel).emit('shareJoined', { role, name: socket.userName || 'A guest' });
    }
    socket.emit('shareState', {
      code: share.code,
      language: share.language,
      role,
      linkRole: share.role,
      claimed: role !== 'owner' || !!share.claimedBy
    });
  });

  on('codeChange', async ({ roomId, code }) => {
    const target = liveTarget(socket, roomId, EDIT_ROLES);
    if (!target || typeof code !== 'string' || code.length > MAX_CODE_LENGTH) return;

    socket.to(target.channel).emit('codeUpdate', code);
    await target.save({ code });
  });

  on('languageChange', async ({ roomId, language }) => {
    const target = liveTarget(socket, roomId, EDIT_ROLES);
    if (!target || !LANGUAGES.includes(language)) return;

    socket.to(target.channel).emit('languageUpdate', language);
    await target.save({ language });
  });

  on('runResult', ({ roomId, stdout, stderr }) => {
    const target = liveTarget(socket, roomId, EDIT_ROLES);
    if (!target) return;

    socket.to(target.channel).emit('runResult', { stdout: String(stdout ?? ''), stderr: String(stderr ?? '') });
  });

  // Whiteboard events. Every object carries a client-generated `id`, so edits and deletes
  // can find the exact object instead of guessing by position.
  on('getWhiteboard', async ({ roomId }, reply) => {
    const room = allowedRoom(socket, roomId);
    if (!room) return reply({ error: 'Not in this room' });

    const board = await Whiteboard.findOne({ roomId: room });
    reply({ elements: board ? board.elements : [] });
  });

  on('whiteboardDraw', async ({ roomId, element }) => {
    const room = allowedRoom(socket, roomId, EDIT_ROLES);
    if (!room || !isWhiteboardElement(element)) return;

    socket.to(room).emit('whiteboardUpdate', element);
    await Whiteboard.updateOne(
      { roomId: room },
      { $push: { elements: element }, updatedAt: new Date() },
      { upsert: true }
    );
  });

  on('whiteboardObjectModified', async ({ roomId, element }) => {
    const room = allowedRoom(socket, roomId, EDIT_ROLES);
    if (!room || !isWhiteboardElement(element)) return;

    socket.to(room).emit('whiteboardObjectModified', { element });
    await Whiteboard.updateOne(
      { roomId: room, 'elements.id': element.id },
      { $set: { 'elements.$': element, updatedAt: new Date() } }
    );
  });

  on('whiteboardObjectRemoved', async ({ roomId, id }) => {
    const room = allowedRoom(socket, roomId, EDIT_ROLES);
    if (!room || !isElementId(id)) return;

    socket.to(room).emit('whiteboardObjectRemoved', { id });
    await Whiteboard.updateOne(
      { roomId: room },
      { $pull: { elements: { id } }, updatedAt: new Date() }
    );
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
    const target = liveTarget(socket, roomId);
    if (!target || !Number.isInteger(line) || !Number.isInteger(ch)) return;

    socket.to(target.channel).emit('cursorMove', {
      userId: socket.userId || socket.id,
      userName: socket.userName || 'Guest',
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

  // Rooms are only deleted by the owner's explicit delete (DELETE /api/rooms/:id) or the 2-day expiry.
  // Deleting on disconnect meant a refresh or network blip wiped the room for everyone.
  socket.on('disconnect', () => {
    console.log('❌ Disconnect:', socket.id, 'userId:', socket.userId, 'roomId:', socket.currentRoomId, 'role:', socket.roomRole);
  });
});

httpServer.listen(PORT, async () => {
  console.log(`🚀 Listening on port ${PORT}`);
  
  // Initialize container pool in background (don't block server start)
  containerPool.init().catch(err => {
    console.error('⚠️ Container pool init failed:', err.message);
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
