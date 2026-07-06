const express = require('express');
const router = express.Router();
const { submitProofOfFix } = require('../controllers/resolutionController');
const { protect, authorize } = require('../middleware/authMiddleware');
const upload = require('../config/multerConfig');

router.put('/:id/resolve', protect, authorize('official', 'admin'), upload.single('photo'), submitProofOfFix);

module.exports = router;