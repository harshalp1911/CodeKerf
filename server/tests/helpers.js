// Starts a real app and socket server on a random port, backed by a test MongoDB database
// and a separate Redis database, so tests exercise the same code paths as production.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const http = require('http');
const mongoose = require('mongoose');
const { createClient } = require('redis');
const { io: connectSocket } = require('socket.io-client');
const createApp = require('../app');
const createSocketServer = require('../sockets');

const MONGO_URI = process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/codekerf-test';
const REDIS_URL = process.env.TEST_REDIS_URL || 'redis://127.0.0.1:6379/15';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Resolves once `check()` returns something truthy; for things that happen asynchronously
const waitFor = async (check, timeout = 3000) => {
  const deadline = Date.now() + timeout;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > deadline) throw new Error('Timed out waiting for condition');
    await sleep(25);
  }
};

// Code the tests run by default instead of Docker: echoes the code back
const fakeRunner = { run: async (language, code) => ({ stdout: `ran ${language}: ${code}`, stderr: '' }) };

const startServer = async ({ runner = fakeRunner } = {}) => {
  await mongoose.connect(MONGO_URI);
  await mongoose.connection.dropDatabase();
  // Unique, partial and TTL indexes are part of what's under test, so recreate them
  await Promise.all(Object.values(mongoose.models).map((model) => model.syncIndexes()));

  const redis = createClient({ url: REDIS_URL });
  await redis.connect();
  await redis.flushDb();

  const app = createApp({ redis, runner });
  const httpServer = http.createServer(app);
  const io = createSocketServer(httpServer);
  app.set('io', io);
  await new Promise((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${httpServer.address().port}`;
  const sockets = [];

  const api = async (method, path, { token, guest, ip, body } = {}) => {
    const res = await fetch(url + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...(guest && { 'X-Guest-Key': guest }),
        ...(ip && { 'X-Forwarded-For': ip })
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    return { status: res.status, headers: res.headers, body: await res.json().catch(() => null) };
  };

  let userCount = 0;
  // Registers a new account and returns { token, user }
  const register = async (name) => {
    userCount += 1;
    const res = await api('POST', '/api/auth/register', {
      body: { email: `user${userCount}@test.com`, password: 'secret123', name }
    });
    return res.body;
  };

  // Connects a socket that records every event it receives in `socket.events`
  const connect = ({ token, guest } = {}) => new Promise((resolve, reject) => {
    const socket = connectSocket(url, {
      path: '/socket.io',
      auth: { token, guestKey: guest },
      transports: ['websocket'],
      forceNew: true
    });
    sockets.push(socket);
    socket.events = [];
    socket.onAny((event, ...args) => socket.events.push({ event, args }));
    socket.received = (event, match = () => true) => socket.events.some((e) => e.event === event && match(e.args[0]));
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', reject);
  });

  // Emits `event` and resolves with whichever of `replies` comes back first, as { event, payload }
  const request = (socket, event, payload, replies) => new Promise((resolve) => {
    const handlers = replies.map((name) => [name, (data) => {
      handlers.forEach(([n, h]) => socket.off(n, h));
      resolve({ event: name, payload: data });
    }]);
    handlers.forEach(([name, handler]) => socket.on(name, handler));
    socket.emit(event, payload);
  });

  const close = async () => {
    sockets.forEach((socket) => socket.disconnect());
    await new Promise((resolve) => io.close(resolve));
    await redis.quit();
    await mongoose.disconnect();
  };

  return { url, redis, api, register, connect, request, close };
};

module.exports = { startServer, sleep, waitFor };
