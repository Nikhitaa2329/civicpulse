const express = require('express');
const router = express.Router();
const {
  createComplaint,
  getComplaints,
  getComplaintById,
  getMyComplaints,
  assignComplaint,
  updateComplaintStatus,
  getMapData,
  getNearbyComplaints,
} = require('../controllers/complaintController');
const { protect, authorize } = require('../middleware/authMiddleware'); // authorize now imported
const upload = require('../config/multerConfig');


// IMPORTANT: specific routes before parameterized routes — explained below
router.get('/my-complaints', protect, getMyComplaints);
router.get('/map-data', getMapData); // public, no protect middleware
router.get('/nearby', getNearbyComplaints);

// upload.single('photo') — Multer middleware that expects ONE file,
// sent under the field name 'photo'
router.post('/', protect, upload.single('photo'), createComplaint);
// POST /api/complaints — must be logged in to file a complaint
router.get('/', getComplaints);

router.get('/:id', getComplaintById);

router.put('/:id/assign', protect, authorize('official', 'admin'), assignComplaint);
router.put('/:id/status', protect, authorize('official', 'admin'), updateComplaintStatus);

module.exports = router;