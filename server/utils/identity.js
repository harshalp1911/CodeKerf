// Guests have no account, so their browser keeps a random v4 UUID that identifies them
// for share links. Only accept that exact shape so the value is safe to store and compare.
const GUEST_KEY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isGuestKey = (value) => typeof value === 'string' && GUEST_KEY_PATTERN.test(value);

module.exports = { isGuestKey };
