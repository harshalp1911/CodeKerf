const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');

const WINDOW_SECONDS = 60;
const LIMITS = { user: 30, guest: 10 }; // runs per minute

// Logged-in users are counted by account. Guests are counted by IP address: a guest key
// is made up by the browser, so a script could send a new one with every request.
const whoIsRunning = (req) => {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    try {
      const { id } = jwt.verify(header.slice(7), JWT_SECRET);
      return { key: `user:${id}`, limit: LIMITS.user };
    } catch (_) { /* expired or invalid token: count them as a guest */ }
  }
  return { key: `ip:${req.ip}`, limit: LIMITS.guest };
};

// Fixed one-minute window kept in Redis, so the limit holds across every server instance
const createRunLimit = (redis) => async (req, res, next) => {
  const { key, limit } = whoIsRunning(req);
  const redisKey = `runlimit:${key}`;
  try {
    // The first run in a window starts the 60-second expiry; later runs only add to the count
    const [count, , ttl] = await redis.multi()
      .incr(redisKey)
      .expire(redisKey, WINDOW_SECONDS, 'NX')
      .ttl(redisKey)
      .exec();
    if (count > limit) {
      const retryAfter = Math.max(ttl, 1);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({
        error: `Too many runs. You can run code ${limit} times a minute; try again in ${retryAfter} seconds.`
      });
    }
  } catch (err) {
    // If Redis is down, let the run through: the container pool still caps how many run at once
    console.error('⚠️ Run limit check failed:', err.message);
  }
  next();
};

module.exports = createRunLimit;
