const express = require('express');
const router = express.Router();
const { parseComplaint } = require('../controllers/aiController');
const { protect } = require('../middleware/authMiddleware');

router.post('/parse-complaint', protect, parseComplaint);

module.exports = router;