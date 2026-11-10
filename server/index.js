// server/index.js
// Starts the server: connects to MongoDB and Redis, then serves the app and sockets on PORT.
require('dotenv').config();
const mongoose = require('mongoose');
const { createServer } = require('http');
const { createClient } = require('redis');

const createApp = require('./app');
const createSocketServer = require('./sockets');
const containerPool = require('./services/containerPool');

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
  console.log('✅ Redis connected');
});

// ── 2) HTTP & SOCKET.IO ─────────────────────────────────────────────────────
const app = createApp({ redis: pubClient });
const httpServer = createServer(app);
const io = createSocketServer(httpServer, { pubClient, subClient });

// Member routes use this to update open tabs when someone's role changes
app.set('io', io);

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
