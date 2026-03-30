const mongoose = require('mongoose');

const TWO_DAYS = 2 * 24 * 60 * 60;

const whiteboardSchema = new mongoose.Schema({
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
  elements: { type: Array, default: [] },
  updatedAt: { type: Date, default: Date.now }
});

// Auto-delete after 2 days
whiteboardSchema.index({ updatedAt: 1 }, { expireAfterSeconds: TWO_DAYS });

module.exports = mongoose.model('Whiteboard', whiteboardSchema);
