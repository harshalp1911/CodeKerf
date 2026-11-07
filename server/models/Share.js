const mongoose = require('mongoose');

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// A one-time share link for code written outside a room. The first person to open the
// link claims it, and nobody else can use it afterwards.
const shareSchema = new mongoose.Schema({
  // Random, unguessable value used in the link. The database _id is never exposed.
  token: { type: String, required: true, unique: true },
  // Exactly one of these identifies the person sharing
  ownerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  ownerGuestKey: { type: String, default: null },
  role: { type: String, enum: ['viewer', 'editor'], required: true },
  code: { type: String, default: '' },
  language: { type: String, default: 'cpp' },
  // 'user:<id>' for editor links, 'guest:<browser key>' for viewer links; null until opened
  claimedBy: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: () => new Date(Date.now() + ONE_DAY_MS) }
});

// MongoDB deletes the share once expiresAt passes (its cleanup runs about once a minute,
// so queries also check expiresAt themselves)
shareSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// One share per person. Partial so the many shares where the field is null don't collide.
shareSchema.index({ ownerUserId: 1 }, { unique: true, partialFilterExpression: { ownerUserId: { $type: 'objectId' } } });
shareSchema.index({ ownerGuestKey: 1 }, { unique: true, partialFilterExpression: { ownerGuestKey: { $type: 'string' } } });

module.exports = mongoose.model('Share', shareSchema);
