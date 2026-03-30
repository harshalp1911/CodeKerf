const mongoose = require('mongoose');

const TWO_DAYS = 2 * 24 * 60 * 60;

const chatSchema = new mongoose.Schema({
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

// Auto-delete after 2 days
chatSchema.index({ timestamp: 1 }, { expireAfterSeconds: TWO_DAYS });

module.exports = mongoose.model('ChatMessage', chatSchema);
