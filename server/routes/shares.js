const crypto = require('crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
const Share = require('../models/Share');
const { JWT_SECRET } = require('../config');
const { isGuestKey } = require('../utils/identity');

const router = express.Router();

const LANGUAGES = ['cpp', 'python', 'java'];
const MAX_CODE_LENGTH = 100 * 1024;

// Works out who is asking: a logged-in user (Bearer token) or a guest (X-Guest-Key header)
const identify = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  }

  const guestKey = req.headers['x-guest-key'];
  if (!req.user && !isGuestKey(guestKey)) {
    return res.status(400).json({ error: 'Missing guest key' });
  }

  req.owner = req.user ? { ownerUserId: req.user.id } : { ownerGuestKey: guestKey };
  next();
};

router.use(identify);

const findActiveShare = (owner) => Share.findOne({ ...owner, expiresAt: { $gt: new Date() } });

const toResponse = (share) => ({
  token: share.token,
  role: share.role,
  code: share.code,
  language: share.language,
  claimed: !!share.claimedBy,
  expiresAt: share.expiresAt
});

// The caller's current share, so the landing page can carry on sharing after a refresh
router.get('/mine', async (req, res) => {
  try {
    const share = await findActiveShare(req.owner);
    res.json({ share: share ? toResponse(share) : null });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create a share link. Guests can only share read-only links.
router.post('/', async (req, res) => {
  try {
    const { role, code = '', language = 'cpp' } = req.body || {};

    if (!['viewer', 'editor'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    if (!req.user && role !== 'viewer') {
      return res.status(403).json({ error: 'Log in to share with editor access.' });
    }
    if (typeof code !== 'string' || code.length > MAX_CODE_LENGTH || !LANGUAGES.includes(language)) {
      return res.status(400).json({ error: 'Invalid code or language' });
    }

    // One active link per person: sharing again returns the existing link
    const existing = await findActiveShare(req.owner);
    if (existing) return res.json({ share: toResponse(existing) });

    // An expired share may not have been cleaned up yet, and would block the unique index
    await Share.deleteMany({ ...req.owner, expiresAt: { $lte: new Date() } });

    const share = await Share.create({
      ...req.owner,
      token: crypto.randomBytes(16).toString('base64url'),
      role,
      code,
      language
    });
    res.status(201).json({ share: toResponse(share) });
  } catch (error) {
    // Two requests at once (e.g. a double click): the unique index lets only one through
    if (error.code === 11000) {
      const share = await findActiveShare(req.owner).catch(() => null);
      if (share) return res.json({ share: toResponse(share) });
    }
    res.status(500).json({ error: 'Failed to create share link' });
  }
});

// Stop sharing. Guests get a single link, so only logged-in users can stop and share again.
router.delete('/mine', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(403).json({ error: 'Guests can share one link. Log in to stop sharing and create a new one.' });
    }

    const share = await Share.findOneAndDelete(req.owner);
    if (!share) return res.status(404).json({ error: 'You are not sharing anything' });

    // Close the link for whoever has it open
    const io = req.app.get('io');
    if (io) {
      const channel = `share:${share._id}`;
      io.to(channel).emit('shareEnded', { message: 'The owner stopped sharing this code.' });
      io.in(channel).socketsLeave(channel);
    }
    res.json({ message: 'Stopped sharing' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to stop sharing' });
  }
});

module.exports = router;
