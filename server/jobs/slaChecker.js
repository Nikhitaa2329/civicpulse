const cron = require('node-cron');
const Complaint = require('../models/Complaint');
const User = require('../models/User');
const { sendSLAWarningEmail } = require('../utils/emailService');

// Runs every hour
// Two jobs in one:
// 1. Mark newly breached complaints as 'overdue'
// 2. Auto-escalate complaints that have been overdue for 24+ hours with no action
const slaChecker = cron.schedule('0 * * * *', async () => {
  console.log('[SLA Checker] Running at', new Date().toISOString());

  try {
    const now = new Date();

    // ── JOB 1: Mark newly breached complaints as overdue ──────────────
    // Same as before — find open/in_progress complaints past their deadline
    const breachedComplaints = await Complaint.find({
      status: { $in: ['open', 'in_progress'] },
      slaDeadline: { $lt: now },
    });

    for (const complaint of breachedComplaints) {
      complaint.status = 'overdue';
      complaint.timeline.push({
        event: 'SLA deadline breached — marked overdue',
        actor: null,
      });
      await complaint.save();
      console.log(`[SLA Checker] Marked overdue: ${complaint._id}`);
    }

    // ── JOB 1.5: Send SLA warning emails 6 hours before breach ────────
    // This is the most valuable notification in the system —
    // it fires BEFORE the breach, giving the official a chance to act
    // and avoid the credibility penalty and public overdue flag
    const sixHoursFromNow = new Date(now.getTime() + 6 * 60 * 60 * 1000);
    const oneHourFromNow = new Date(now.getTime() + 1 * 60 * 60 * 1000);

    // Find in_progress complaints whose SLA deadline falls within
    // the next 1-6 hours — the warning window
    // Lower bound (oneHourFromNow) prevents re-sending every hour
    // as the deadline gets very close — one warning is enough
    const warningComplaints = await Complaint.find({
      status: 'in_progress',
      slaDeadline: {
        $gt: oneHourFromNow,   // more than 1 hour away
        $lt: sixHoursFromNow,  // less than 6 hours away
      },
      assignedTo: { $ne: null },
    });

    for (const complaint of warningComplaints) {
      const hoursRemaining = Math.round(
        (complaint.slaDeadline - now) / (1000 * 60 * 60)
      );

      const official = await User.findById(complaint.assignedTo).select('email name');
      if (official?.email) {
        sendSLAWarningEmail(
          official.email,
          complaint.title,
          complaint._id,
          hoursRemaining
        );
        console.log(`[SLA Checker] Warning email sent for: ${complaint._id} — ${hoursRemaining}h remaining`);
      }
    }
    // ── JOB 2: Auto-escalate complaints overdue for 24+ hours ─────────
    // If a complaint has been overdue for more than 24 hours,
    // the assigned official clearly isn't acting — reassign it
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const escalatableComplaints = await Complaint.find({
      status: 'overdue',
      // Find complaints whose last timeline entry (SLA breach) was 24+ hours ago
      // We check updatedAt as a proxy — if it hasn't been touched in 24hrs, escalate
      updatedAt: { $lt: twentyFourHoursAgo },
      assignedTo: { $ne: null }, // only reassign if actually assigned to someone
    });

    for (const complaint of escalatableComplaints) {
      const previousOfficial = complaint.assignedTo;

      // Drop the official's credibility score for inaction
      // This is separate from the -10 for a rejected proof of fix
      // -5 for inaction (less severe, but still recorded)
      if (previousOfficial) {
        await User.findByIdAndUpdate(previousOfficial, {
          $inc: { credibilityScore: -5 },
        });
      }

      // Remove assignment and reset to open
      // The complaint goes back into the priority queue for any eligible official
      complaint.assignedTo = null;
      complaint.status = 'open';
      complaint.timeline.push({
        event: 'Escalated — reassigned due to inaction after SLA breach',
        actor: null,
      });

      await complaint.save();
      console.log(`[SLA Checker] Escalated complaint: ${complaint._id}`);
    }

    console.log(
      `[SLA Checker] Done — ${breachedComplaints.length} marked overdue, ${escalatableComplaints.length} escalated`
    );

  } catch (error) {
    console.error('[SLA Checker] Error:', error.message);
  }
});

module.exports = slaChecker;