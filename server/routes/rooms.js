const express = require('express');
const router = express.Router();
const Room = require('../models/Room');
const RoomMember = require('../models/RoomMember');
const authMiddleware = require('../middleware/auth');

// All room routes require authentication
router.use(authMiddleware);

// Get all rooms the user is a member of
router.get('/', async (req, res) => {
  try {
    const memberships = await RoomMember.find({ userId: req.user.id }).populate('roomId');
    
    // Filter out null rooms (in case a room was deleted but member doc remained)
    const validRooms = memberships
      .filter(m => m.roomId)
      .map(m => ({
        ...m.roomId.toObject(),
        userRole: m.role
      }));
      
    res.json(validRooms);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create a new room
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Room name is required' });
    }

    const room = await Room.create({
      name,
      createdBy: req.user.id
    });

    // Add creator as the owner
    await RoomMember.create({
      roomId: room._id,
      userId: req.user.id,
      role: 'owner'
    });

    res.status(201).json(room);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// Get a specific room details
router.get('/:id', async (req, res) => {
  try {
    // Check if user is a member
    const membership = await RoomMember.findOne({
      roomId: req.params.id,
      userId: req.user.id
    });

    if (!membership) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const room = await Room.findById(req.params.id).populate('createdBy', 'name email avatar');
    
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const members = await RoomMember.find({ roomId: room._id }).populate('userId', 'name email avatar');

    res.json({
      ...room.toObject(),
      currentUserRole: membership.role,
      members
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete a room
router.delete('/:id', async (req, res) => {
  try {
    const membership = await RoomMember.findOne({
      roomId: req.params.id,
      userId: req.user.id
    });

    if (!membership || membership.role !== 'owner') {
      return res.status(403).json({ error: 'Only room owner can delete the room' });
    }

    await Room.findByIdAndDelete(req.params.id);
    await RoomMember.deleteMany({ roomId: req.params.id });
    // Also delete chat messages and whiteboard
    const ChatMessage = require('../models/ChatMessage');
    const Whiteboard = require('../models/Whiteboard');
    await ChatMessage.deleteMany({ roomId: req.params.id });
    await Whiteboard.deleteMany({ roomId: req.params.id });

    res.json({ message: 'Room deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
