// server/config.js
// Shared settings that several files need, checked once at startup.

const DEV_JWT_SECRET = 'dev-only-insecure-jwt-secret';

let JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  // Anyone who knows the fallback could sign their own tokens, so never allow it in production
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set in production');
  }
  console.warn('⚠️ JWT_SECRET is not set, using an insecure development secret');
  JWT_SECRET = DEV_JWT_SECRET;
}

// Code limits shared by /api/run, share links and live editing
const LANGUAGES = ['cpp', 'python', 'java'];
const MAX_CODE_LENGTH = 100 * 1024;

module.exports = { JWT_SECRET, LANGUAGES, MAX_CODE_LENGTH };
