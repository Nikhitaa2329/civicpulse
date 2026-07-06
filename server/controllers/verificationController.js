const VerificationVote = require('../models/VerificationVote');
const Validation = require('../models/Validation');
const Complaint = require('../models/Complaint');
const User = require('../models/User');
const { sendNotification } = require('../utils/notificationManager');
const { sendReopenedOfficialEmail, sendReopenedCitizenEmail } = require('../utils/emailService');

const REOPEN_THRESHOLD = 0.4; // 40% "not fixed" votes triggers a reopen
const MIN_VOTES_FOR_REOPEN = 2; // need at least this many votes before the threshold applies

exports.castVerificationVote = async (req, res) => {
  try {
    const complaintId = req.params.id;
    const userId = req.user.id;
    const { vote } = req.body;

    if (!['fixed', 'not_fixed'].includes(vote)) {
      return res.status(400).json({ message: "Vote must be either 'fixed' or 'not_fixed'" });
    }

    const complaint = await Complaint.findById(complaintId);
    if (!complaint) {
      return res.status(404).json({ message: 'Complaint not found' });
    }

    if (complaint.status !== 'pending_verification') {
      return res.status(400).json({ message: 'This complaint is not currently awaiting verification' });
    }

    // ── MERGE-AWARE ELIGIBILITY ──────────────────────────────────────────
    // If this complaint is a MASTER that other complaints were merged into,
    // the people who filed or validated those merged duplicates are also
    // genuinely affected citizens — they deserve a voice in verification,
    // even though they never directly interacted with the master complaint
    // document itself. Without this, merging silently strips merged
    // citizens of their right to dispute a fake resolution.

    // Find every complaint that points its mergedInto field at this one
    // (i.e. every duplicate that was folded into this master)
    const mergedDuplicates = await Complaint.find({ mergedInto: complaintId }).select('_id filedBy');

    // Pull out just the IDs we need from those duplicate documents
    const mergedComplaintIds = mergedDuplicates.map((c) => c._id);
    const mergedFilerIds = mergedDuplicates.map((c) => c.filedBy.toString());
    // ──────────────────────────────────────────────────────────────────

    // Path 1: did this user file the MASTER complaint directly?
    const isFiler = complaint.filedBy.toString() === userId;

    // Path 2: did this user file one of the DUPLICATES that got merged in?
    const isMergedFiler = mergedFilerIds.includes(userId);

    // Path 3: did this user validate the MASTER complaint during the
    // community-validation phase?
    const didValidateMaster = await Validation.findOne({ complaintId, userId });

    // Path 4: did this user validate one of the DUPLICATES before they
    // were merged in? ($in matches against the whole array of duplicate IDs)
    const didValidateMerged = await Validation.findOne({
      complaintId: { $in: mergedComplaintIds },
      userId,
    });

    // Eligible if ANY of the four paths apply
    const isEligible = isFiler || isMergedFiler || didValidateMaster || didValidateMerged;

    if (!isEligible) {
      return res.status(403).json({
        message: 'Only citizens who reported or validated this complaint (including merged duplicates) can vote on its resolution',
      });
    }

    // Record the vote — duplicate prevention via the same try/catch + error code pattern as Validation
    try {
      await VerificationVote.create({ complaintId, userId, vote });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(400).json({ message: 'You have already voted on this complaint' });
      }
      throw error; // some other unexpected error — let the outer catch handle it
    }

    // Tally all votes so far for this complaint
    const totalVotes = await VerificationVote.countDocuments({ complaintId });
    const notFixedVotes = await VerificationVote.countDocuments({ complaintId, vote: 'not_fixed' });

    const notFixedRatio = notFixedVotes / totalVotes;

    // Check if the reopen threshold has been crossed
   if (totalVotes >= MIN_VOTES_FOR_REOPEN && notFixedRatio >= REOPEN_THRESHOLD) {
      complaint.status = 'reopened';
      complaint.timeline.push({
        event: `Reopened — ${notFixedVotes}/${totalVotes} citizens voted not fixed (${Math.round(notFixedRatio * 100)}%)`,
        actor: userId,
      });

      // Drop the assigned official's credibility score for a false resolution claim
      if (complaint.assignedTo) {
        await User.findByIdAndUpdate(complaint.assignedTo, {
          $inc: { credibilityScore: -10 },
        });

        // Notify the official that their fix was rejected by citizens
        // They need to know their credibility score dropped and the complaint
        // is back in the priority queue requiring attention
  sendNotification(complaint.assignedTo.toString(), {
          type: 'complaint_reopened',
          title: 'Your fix was rejected by citizens',
          message: `"${complaint.title}" was marked not fixed by ${notFixedVotes}/${totalVotes} citizens and has been reopened. Your credibility score has been reduced by 10 points.`,
          complaintId: complaint._id,
          timestamp: new Date().toISOString(),
        });

        // Email the official — works even when they're not in the app
        // Most important email in the system — direct accountability consequence
        const official = await User.findById(complaint.assignedTo).select('email');
        if (official?.email) {
          sendReopenedOfficialEmail(
            official.email,
            complaint.title,
            complaint._id,
            notFixedVotes,
            totalVotes
          );
        }
      }

      // Also notify the citizen who filed
      sendNotification(complaint.filedBy.toString(), {
        type: 'complaint_reopened',
        title: 'Complaint reopened',
        message: `"${complaint.title}" has been reopened after community voting. It will be reassigned to an official for proper resolution.`,
        complaintId: complaint._id,
        timestamp: new Date().toISOString(),
      });

      // Email the citizen — confirms the system worked on their behalf
      const filer = await User.findById(complaint.filedBy).select('email');
      if (filer?.email) {
        sendReopenedCitizenEmail(
          filer.email,
          complaint.title,
          complaint._id
        );
      }

      await complaint.save();

      return res.status(200).json({
        message: 'Complaint has been reopened — majority of citizens reported it is not actually fixed',
        totalVotes,
        notFixedVotes,
        complaint,
      });
    }

    // Threshold not crossed — just record the vote
    complaint.timeline.push({
      event: `Citizen voted: ${vote === 'fixed' ? 'confirmed fixed' : 'not fixed'} (${totalVotes} vote${totalVotes > 1 ? 's' : ''} so far)`,
      actor: userId,
    });
    await complaint.save();

    // Check if enough fixed votes to resolve
    const fixedVotes = await VerificationVote.countDocuments({
      complaintId,
      vote: 'fixed',
    });

    if (totalVotes >= MIN_VOTES_FOR_REOPEN && fixedVotes > notFixedVotes) {
      complaint.status = 'resolved';
      complaint.timeline.push({
        event: `Complaint resolved — community confirmed the fix is genuine (${fixedVotes}/${totalVotes} voted fixed)`,
        actor: userId,
      });

      if (complaint.assignedTo) {
        await User.findByIdAndUpdate(complaint.assignedTo, {
          $inc: { credibilityScore: 5 },
        });
      }

      await complaint.save();

      return res.status(200).json({
        message: 'Complaint resolved — community confirmed the fix',
        totalVotes,
        fixedVotes,
        complaint,
      });
    }

    res.status(200).json({
      message: 'Vote recorded',
      totalVotes,
      notFixedVotes,
    });
    
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
exports.getVerificationSummary = async (req, res) => {
  try {
    const complaintId = req.params.id;
    const userId = req.user?.id;

    const totalVotes = await VerificationVote.countDocuments({ complaintId });
    const fixedVotes = await VerificationVote.countDocuments({ complaintId, vote: 'fixed' });
    const notFixedVotes = await VerificationVote.countDocuments({ complaintId, vote: 'not_fixed' });

    // Check if current user has already voted
    let userVote = null;
    if (userId) {
      const existingVote = await VerificationVote.findOne({ complaintId, userId });
      if (existingVote) userVote = existingVote.vote;
    }

    res.status(200).json({
      totalVotes,
      fixedVotes,
      notFixedVotes,
      userVote, // null if not voted, 'fixed' or 'not_fixed' if already voted
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};