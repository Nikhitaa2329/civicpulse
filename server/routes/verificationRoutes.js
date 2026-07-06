const express = require('express');
const router = express.Router();
const { castVerificationVote, getVerificationSummary } = require('../controllers/verificationController');
const { protect } = require('../middleware/authMiddleware');

router.post('/:id', protect, castVerificationVote);
router.get('/:id/summary', protect, getVerificationSummary);

module.exports = router;