// server/app.js
// The Express app: middleware and HTTP routes. It doesn't connect to anything or listen
// on a port itself, so tests can build one with their own Redis client and code runner.
const express = require('express');
const cors = require('cors');
const passport = require('passport');

const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const memberRoutes = require('./routes/members');
const shareRoutes = require('./routes/shares');
const containerPool = require('./services/containerPool');
const createRunLimit = require('./middleware/runLimit');
const { MAX_CODE_LENGTH } = require('./config');

const MAX_STDIN_LENGTH = 64 * 1024;

// `redis` backs the run rate limit. `runner` runs code: the Docker container pool by default.
const createApp = ({ redis, runner = containerPool }) => {
  const app = express();

  // Behind nginx, req.ip should be the visitor's address from X-Forwarded-For, not nginx's.
  // Only set this when a proxy is in front: otherwise anyone could fake the header.
  if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);

  app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
  }));
  // Above the 100 KB code limit, so oversized code gets a clear message from /api/run instead of a bare 413
  app.use(express.json({ limit: '256kb' }));
  app.use(passport.initialize());

  app.use('/api/auth', authRoutes);
  app.use('/api/rooms', roomRoutes);
  app.use('/api/rooms/:roomId/members', memberRoutes);
  app.use('/api/shares', shareRoutes);

  app.get('/', (_req, res) => res.json({ status: 'ok', service: 'CodeKerf API', version: '1.0.0' }));
  app.get('/api/ping', (_req, res) => res.json({ message: 'pong' }));

  app.post('/api/run', createRunLimit(redis), async (req, res) => {
    const { language, code, stdin = '' } = req.body;
    if (!containerPool.LANGUAGES[language]) {
      return res.status(400).json({ error: 'Unsupported language' });
    }
    if (typeof code !== 'string' || code.length > MAX_CODE_LENGTH
      || typeof stdin !== 'string' || stdin.length > MAX_STDIN_LENGTH) {
      return res.status(400).json({ error: 'Code must be under 100 KB and input under 64 KB' });
    }

    try {
      const result = await runner.run(language, code, stdin);
      if (!result) {
        return res.status(503).json({ error: 'The server is busy running other code. Please try again in a few seconds.' });
      }
      res.json(result);
    } catch (err) {
      console.error('Run failed:', err);
      res.status(500).json({ error: 'Could not run the code. Please try again.' });
    }
  });

  return app;
};

module.exports = createApp;
