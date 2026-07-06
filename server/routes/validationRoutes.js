const express = require('express');
const router = express.Router();
const { validateComplaint, getValidationCount,getSuspiciousValidators } = require('../controllers/validationController');
const { protect, authorize } = require('../middleware/authMiddleware');

// POST /api/validations/:id — validate a specific complaint by its ID
router.get('/suspicious', protect, authorize('admin'), getSuspiciousValidators);
router.post('/:id', protect, validateComplaint);
router.get('/:id/count', getValidationCount);

module.exports = router;