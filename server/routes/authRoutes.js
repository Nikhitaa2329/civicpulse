const express = require('express');
const router = express.Router();
const { register, login, getProfile,createOfficial } = require('../controllers/authController');
const { protect, authorize } = require('../middleware/authMiddleware');

// POST /api/auth/register
router.post('/register', register);

// POST /api/auth/login
router.post('/login', login);

// GET /api/auth/profile — protected route
router.get('/profile', protect, getProfile);

router.post('/create-official', protect, authorize('admin'), createOfficial);

module.exports = router;