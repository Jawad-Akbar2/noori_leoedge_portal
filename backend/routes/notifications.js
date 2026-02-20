import express from 'express';
import jwt from 'jsonwebtoken';
import Employee from '../models/Employee.js';

const router = express.Router();

// Middleware
const auth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await Employee.findById(decoded.id);
    req.user = user;
    req.userId = decoded.id;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Unauthorized' });
  }
};

// **Get notifications (Placeholder)**
router.get('/', auth, async (req, res) => {
  try {
    // Placeholder for notification system
    // Can be extended with a Notification model later
    res.json({
      notifications: [
        {
          id: '1',
          message: 'Your leave request has been approved',
          type: 'success',
          timestamp: new Date(),
          read: false
        }
      ]
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// **Mark notification as read (Placeholder)**
router.patch('/:id/read', auth, async (req, res) => {
  try {
    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;