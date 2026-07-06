const express = require('express');
const router = express.Router();
const {
  getRecurringIssues,
  getMergeCandidates,
  mergeComplaints,
  getPriorityQueue,
  getEscalationStats,
} = require('../controllers/recurringIssueController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Public — civic transparency data, anyone can see
router.get('/recurring-issues', getRecurringIssues);

// Official/admin only — operational tools
router.get('/merge-candidates', protect, authorize('official', 'admin'), getMergeCandidates);
router.post('/merge', protect, authorize('official', 'admin'), mergeComplaints);
router.get('/priority-queue', protect, authorize('official', 'admin'), getPriorityQueue);
router.get('/escalation-stats', protect, authorize('admin'), getEscalationStats);
module.exports = router;
