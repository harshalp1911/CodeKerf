const mongoose = require('mongoose');

const TWO_DAYS = 2 * 24 * 60 * 60;

const whiteboardSchema = new mongoose.Schema({
  // Unique so two first strokes arriving together share one board. Without it, both upserts
  // could insert their own document and one of the strokes would be lost.
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true, unique: true },
  elements: { type: Array, default: [] },
  updatedAt: { type: Date, default: Date.now }
});

// Auto-delete after 2 days
whiteboardSchema.index({ updatedAt: 1 }, { expireAfterSeconds: TWO_DAYS });

module.exports = mongoose.model('Whiteboard', whiteboardSchema);
