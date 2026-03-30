const mongoose = require('mongoose');

const TWO_DAYS = 2 * 24 * 60 * 60;

const memberSchema = new mongoose.Schema({
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, enum: ['owner', 'editor', 'viewer'], default: 'viewer' },
  joinedAt: { type: Date, default: Date.now }
});

// Auto-delete after 2 days
memberSchema.index({ joinedAt: 1 }, { expireAfterSeconds: TWO_DAYS });

module.exports = mongoose.model('RoomMember', memberSchema);
