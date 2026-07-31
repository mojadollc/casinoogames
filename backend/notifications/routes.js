const express = require('express');
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Get notifications
router.get('/', authenticate, async (req, res) => {
  const result = await query(
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50', [req.user.id]
  );
  res.json(result.rows);
});

// Mark all as read — must be before /:id/read to avoid route conflict
router.put('/read-all', authenticate, async (req, res) => {
  await query('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.user.id]);
  res.json({ message: 'All marked as read' });
});

// Mark as read
router.put('/:id/read', authenticate, async (req, res) => {
  await query('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  res.json({ message: 'Marked as read' });
});

// Unread count
router.get('/unread-count', authenticate, async (req, res) => {
  const result = await query('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0', [req.user.id]);
  res.json({ count: parseInt(result.rows[0].count) });
});

// Send notification helper
const sendNotification = async (userId, type, title, message, io) => {
  await query(
    'INSERT INTO notifications (id, user_id, type, title, message) VALUES (UUID(), ?, ?, ?, ?)',
    [userId, type, title, message]
  );
  if (io) io.to(userId).emit('notification', { type, title, message });
};

module.exports = { router, sendNotification };
