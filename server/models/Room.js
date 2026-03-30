const mongoose = require('mongoose');

const TWO_DAYS = 2 * 24 * 60 * 60; // 172800 seconds

const roomSchema = new mongoose.Schema({
  name: { type: String, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
  code: { type: String, default: '' },
  language: { type: String, default: 'cpp' },
});

// Auto-delete after 2 days
roomSchema.index({ createdAt: 1 }, { expireAfterSeconds: TWO_DAYS });

module.exports = mongoose.model('Room', roomSchema);
