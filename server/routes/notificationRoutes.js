const express = require('express');
const router = express.Router();
const { streamNotifications } = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');

// Protected — only logged-in users get notifications
router.get('/stream', protect, streamNotifications);

module.exports = router;