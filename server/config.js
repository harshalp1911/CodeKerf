// server/config.js
// Shared settings that several files need, checked once at startup.

const DEV_JWT_SECRET = 'dev-only-insecure-jwt-secret';
// The placeholder in .env.example: it is public on GitHub, so it is no better than having no secret
const EXAMPLE_JWT_SECRET = 'your_jwt_secret_change_this_in_production';
const MIN_PRODUCTION_SECRET_LENGTH = 32;

let JWT_SECRET = process.env.JWT_SECRET;

if (process.env.NODE_ENV === 'production') {
  // Anyone who knows or guesses the secret could sign their own login tokens
  if (!JWT_SECRET || JWT_SECRET === EXAMPLE_JWT_SECRET || JWT_SECRET.length < MIN_PRODUCTION_SECRET_LENGTH) {
    throw new Error(`JWT_SECRET must be set in production to a random string of at least ${MIN_PRODUCTION_SECRET_LENGTH} characters (try: openssl rand -hex 32)`);
  }
} else if (!JWT_SECRET) {
  console.warn('⚠️ JWT_SECRET is not set, using an insecure development secret');
  JWT_SECRET = DEV_JWT_SECRET;
}

// Code limits shared by /api/run, share links and live editing
const LANGUAGES = ['cpp', 'python', 'java'];
const MAX_CODE_LENGTH = 100 * 1024;

module.exports = { JWT_SECRET, LANGUAGES, MAX_CODE_LENGTH };
