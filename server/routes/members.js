const express = require('express');
const router = express.Router({ mergeParams: true }); // Access parent params (roomId)
const RoomMember = require('../models/RoomMember');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// Middleware to check if user has permission to invite (owner or editor)
const canInvite = async (req, res, next) => {
  const membership = await RoomMember.findOne({
    roomId: req.params.roomId,
    userId: req.user.id
  });

  if (!membership || (membership.role !== 'owner' && membership.role !== 'editor')) {
    return res.status(403).json({ error: 'Permission denied. Only owners and editors can invite.' });
  }
  next();
};

// Invite a user to the room
router.post('/invite', canInvite, async (req, res) => {
  try {
    const { email, role } = req.body;
    
    if (!email) return res.status(400).json({ error: 'Email is required' });
    if (!['editor', 'viewer'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const userToInvite = await User.findOne({ email });
    if (!userToInvite) {
      return res.status(404).json({ error: `User with email "${email}" hasn't signed up yet. Ask them to visit the site and log in with Google first, then you can invite them.` });
    }

    // Check if already a member
    const existingMember = await RoomMember.findOne({
      roomId: req.params.roomId,
      userId: userToInvite._id
    });

    if (existingMember) {
      return res.status(400).json({ error: 'User is already a member of this room' });
    }

    const newMember = await RoomMember.create({
      roomId: req.params.roomId,
      userId: userToInvite._id,
      role
    });

    // Populate user details for response
    await newMember.populate('userId', 'name email avatar');

    res.status(201).json(newMember);
  } catch (error) {
    res.status(500).json({ error: 'Failed to invite user' });
  }
});

// Update member role (Owner only)
router.put('/:userId', async (req, res) => {
  try {
    // Check if requester is owner
    const requester = await RoomMember.findOne({
      roomId: req.params.roomId,
      userId: req.user.id
    });

    if (!requester || requester.role !== 'owner') {
      return res.status(403).json({ error: 'Only owners can change roles' });
    }

    const { role } = req.body;
    if (!['editor', 'viewer'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Cannot change owner role
    const memberToUpdate = await RoomMember.findOne({
      roomId: req.params.roomId,
      userId: req.params.userId
    });

    if (!memberToUpdate) return res.status(404).json({ error: 'Member not found' });
    if (memberToUpdate.role === 'owner') return res.status(400).json({ error: 'Cannot change owner role' });

    memberToUpdate.role = role;
    await memberToUpdate.save();

    res.json(memberToUpdate);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// Remove a member (Owner only, or self-leave)
router.delete('/:userId', async (req, res) => {
  try {
    const isSelf = req.user.id === req.params.userId;
    
    if (!isSelf) {
      // Check if requester is owner
      const requester = await RoomMember.findOne({
        roomId: req.params.roomId,
        userId: req.user.id
      });

      if (!requester || requester.role !== 'owner') {
        return res.status(403).json({ error: 'Only owners can remove other members' });
      }
    }

    const memberToRemove = await RoomMember.findOne({
      roomId: req.params.roomId,
      userId: req.params.userId
    });

    if (!memberToRemove) return res.status(404).json({ error: 'Member not found' });
    if (memberToRemove.role === 'owner') return res.status(400).json({ error: 'Owner cannot be removed' });

    await RoomMember.findByIdAndDelete(memberToRemove._id);
    res.json({ message: 'Member removed successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

module.exports = router;
