const Complaint = require('../models/Complaint');
const Validation = require('../models/Validation'); 
const User = require('../models/User');

// Groups complaints into rough 500m geographic cells, so nearby-but-not-identical
// coordinates still cluster together (two reports of the same pothole rarely
// have EXACTLY the same GPS reading)
const ROUNDING_PRECISION = 3; // ~111 meters per 0.001 degree at the equator
const RECURRENCE_WINDOW_MONTHS = 6;
const RECURRENCE_THRESHOLD = 3; // 3+ reports in the window = "recurring"
const MERGE_WINDOW_DAYS = 7;
const MERGE_THRESHOLD = 3; // 3+ similar complaints in the window = candidate for merging

exports.getRecurringIssues = async (req, res) => {
  try {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - RECURRENCE_WINDOW_MONTHS);

    const recurringIssues = await Complaint.aggregate([
      // Stage 1: only look at complaints from within our recurrence window
      {
        $match: {
          createdAt: { $gte: sixMonthsAgo },
        },
      },
      // Stage 2: create rounded lat/lng fields so nearby coordinates cluster together
      {
        $addFields: {
          roundedLat: {
            $round: [{ $multiply: ['$location.lat', Math.pow(10, ROUNDING_PRECISION)] }, 0],
          },
          roundedLng: {
            $round: [{ $multiply: ['$location.lng', Math.pow(10, ROUNDING_PRECISION)] }, 0],
          },
        },
      },
      // Stage 3: group by category + rounded location, count occurrences
      {
        $group: {
          _id: {
            category: '$category',
            roundedLat: '$roundedLat',
            roundedLng: '$roundedLng',
          },
          count: { $sum: 1 },
          complaintIds: { $push: '$_id' },
          titles: { $push: '$title' },
          firstReported: { $min: '$createdAt' },
          lastReported: { $max: '$createdAt' },
          sampleAddress: { $first: '$location.address' },
        },
      },
      // Stage 4: only keep groups that meet our recurrence threshold
      {
        $match: {
          count: { $gte: RECURRENCE_THRESHOLD },
        },
      },
      // Stage 5: sort by most frequent first
      {
        $sort: { count: -1 },
      },
    ]);

    res.status(200).json({
      recurringIssueCount: recurringIssues.length,
      issues: recurringIssues,
    });

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Finds clusters of recent, unmerged complaints that look like duplicates of each other
exports.getMergeCandidates = async (req, res) => {
  try {
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - MERGE_WINDOW_DAYS);

    const candidates = await Complaint.aggregate([
      {
        $match: {
          createdAt: { $gte: windowStart },
          mergedInto: null, // only consider complaints not already merged into something
        },
      },
      {
        $addFields: {
          roundedLat: { $round: [{ $multiply: ['$location.lat', 1000] }, 0] },
          roundedLng: { $round: [{ $multiply: ['$location.lng', 1000] }, 0] },
        },
      },
      {
        $group: {
          _id: { category: '$category', roundedLat: '$roundedLat', roundedLng: '$roundedLng' },
          count: { $sum: 1 },
          complaintIds: { $push: '$_id' },
          titles: { $push: '$title' },
        },
      },
      {
        $match: { count: { $gte: MERGE_THRESHOLD } },
      },
      {
        $sort: { count: -1 },
      },
    ]);

    res.status(200).json({ candidateCount: candidates.length, candidates });

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Performs the actual merge: one complaint becomes the master, the rest point to it
exports.mergeComplaints = async (req, res) => {
  try {
    const { masterId, duplicateIds } = req.body;

    if (!masterId || !Array.isArray(duplicateIds) || duplicateIds.length === 0) {
      return res.status(400).json({ message: 'masterId and a non-empty duplicateIds array are required' });
    }

    const masterComplaint = await Complaint.findById(masterId);
    if (!masterComplaint) {
      return res.status(404).json({ message: 'Master complaint not found' });
    }

    // Point every duplicate's mergedInto field at the master
    await Complaint.updateMany(
      { _id: { $in: duplicateIds } },
      { $set: { mergedInto: masterId } }
    );

    // The master's affected count grows by however many duplicates were just merged in
    masterComplaint.affectedCount += duplicateIds.length;
    masterComplaint.timeline.push({
      event: `Merged with ${duplicateIds.length} duplicate report(s) — now affecting ${masterComplaint.affectedCount} citizen(s)`,
      actor: req.user.id,
    });
    await masterComplaint.save();

    res.status(200).json({
      message: `Merged ${duplicateIds.length} complaint(s) into master`,
      masterComplaint,
    });

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ── HELPER: Historical breach rate for a given pincode area ──────────────
// Computes what fraction of complaints in this pincode have ever gone
// overdue or been reopened after a disputed resolution.
// Using pincode instead of wardId — Tamil Nadu's official ward polygon
// data isn't publicly available in a clean queryable format, and pincode
// is a real administrative boundary citizens naturally know.
const getAreaBreachRate = async (pincode) => {
  // No pincode = no historical data to draw from — contribute 0 to priority
  if (!pincode) return 0;

  // Count all complaints ever filed from this pincode
  const totalInArea = await Complaint.countDocuments({
    pincode: pincode,
  });

  if (totalInArea === 0) return 0;

  // Count how many of those have broken their SLA promise in any form
  const breachedInArea = await Complaint.countDocuments({
    pincode: pincode,
    status: { $in: ['overdue', 'reopened'] },
  });

  // Returns a ratio between 0 and 1 (e.g., 0.6 = 60% breach rate)
  return breachedInArea / totalInArea;
};

// ── HELPER: Category urgency weights ─────────────────────────────────────
// Kept consistent with SLA deadline table — same relative urgency ordering,
// so the priority score doesn't contradict the SLA system's own assumptions
const CATEGORY_URGENCY_WEIGHT = {
  power_outage: 10,
  open_manhole: 10,
  waterlogging: 8,
  water_supply: 8,
  garbage: 5,
  streetlight: 5,
  broken_road: 3,
  other: 3,
};

const VALIDATION_CAP = 20;   // extra validations beyond 20 stop adding marginal priority
const AFFECTED_CAP = 20;     // same cap for affected count — prevents one viral complaint
const AGE_CAP_DAYS = 10;     // age contribution caps out after ~10 days

// ── HELPER: Priority score for a single complaint ─────────────────────────
// Returns a score AND a human-readable breakdown of every contributing term.
// Breakdown is deliberate — every input is auditable, no black box.
// AI was deliberately excluded from this feature: priority directly affects
// which complaints officials see first, and an opaque AI ranking would be
// hard to justify if a citizen asked why their urgent issue was ranked low.
const calculatePriorityScore = async (complaint) => {
  // Term 1: category urgency — how inherently dangerous/time-sensitive is this type of issue?
  const categoryWeight = CATEGORY_URGENCY_WEIGHT[complaint.category] || 3;

  // Term 2: community validation count — how many independent neighbours confirmed this?
  // This is distinct from affectedCount: validations happen BEFORE a complaint opens
  // (proving the issue is real), while affectedCount grows from merging separate
  // reports (filed independently). Both capture "how many people care" but differently.
  const validationCount = await Validation.countDocuments({ complaintId: complaint._id });
  const cappedValidations = Math.min(validationCount, VALIDATION_CAP);

  // Term 3: affected count — how many citizens' reports were merged into this one?
  const cappedAffected = Math.min(complaint.affectedCount || 1, AFFECTED_CAP);

  // Term 4: age urgency — older unresolved issues deserve more attention
  // Caps at AGE_CAP_DAYS so very old complaints don't infinitely outrank new urgent ones
  const hoursElapsed = (Date.now() - new Date(complaint.createdAt).getTime()) / (1000 * 60 * 60);
  const daysElapsed = hoursElapsed / 24;
  const urgencyFromAge = Math.min(daysElapsed, AGE_CAP_DAYS);

  // Term 5: area breach rate — this pincode's historical track record
  // A ward that consistently fails SLA promises gets a bump, surfacing its
  // complaints earlier in officials' queues for proactive attention
  const areaBreachRate = await getAreaBreachRate(complaint.pincode);
  const breachRiskBonus = areaBreachRate * 5; // max 5 points if 100% breach rate

  const totalScore =
    categoryWeight +
    cappedValidations +
    cappedAffected +
    urgencyFromAge +
    breachRiskBonus;

  return {
    totalScore: Math.round(totalScore * 100) / 100,
    breakdown: {
      categoryWeight,
      communityValidations: cappedValidations,
      affectedCitizens: cappedAffected,
      ageInDays: Math.round(daysElapsed * 10) / 10,
      areaBreachRate: Math.round(areaBreachRate * 100) / 100,
      breachRiskBonus: Math.round(breachRiskBonus * 100) / 100,
    },
  };
};

// ── ROUTE HANDLER: Priority Queue ─────────────────────────────────────────
// Returns all currently actionable complaints (open/in_progress/overdue),
// ranked by their computed priority score, highest first.
exports.getPriorityQueue = async (req, res) => {
  try {
    const officialId = req.user.id;
    const official = await User.findById(officialId).select('assignedPincodes role');

    // Build the base filter FIRST
    const filter = {
      status: { $in: ['open', 'in_progress', 'overdue'] },
    };

    if (official.role !== 'admin' && official.assignedPincodes?.length > 0) {
      filter.pincode = { $in: official.assignedPincodes };
    }

    const complaints = await Complaint.find(filter).populate('filedBy', 'name');

    // Compute a priority score for every eligible complaint — concurrently,
    // not sequentially, since each calculation involves database queries.
    // Promise.all waits for ALL the concurrent async computations to finish
    // before proceeding, rather than awaiting them one by one in a slow loop.
    const scored = await Promise.all(
      complaints.map(async (complaint) => {
        const { totalScore, breakdown } = await calculatePriorityScore(complaint);
        return {
          complaintId: complaint._id,
          title: complaint.title,
          category: complaint.category,
          status: complaint.status,
          location: complaint.location,
          pincode: complaint.pincode,
          affectedCount: complaint.affectedCount,
          filedBy: complaint.filedBy,
          priorityScore: totalScore,
          breakdown, // exposed so the ranking is always explainable, never opaque
        };
      })
    );

    // Sort descending — highest priority first
    scored.sort((a, b) => b.priorityScore - a.priorityScore);

    res.status(200).json({
      count: scored.length,
      queue: scored,
    });

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getEscalationStats = async (req, res) => {
  try {
    // Count complaints that have been escalated at least once
    // We identify them by looking for the escalation timeline entry
    const escalatedComplaints = await Complaint.countDocuments({
      'timeline.event': {
        $regex: 'Escalated',
        $options: 'i',
      },
    });

    // Count currently overdue complaints
    const currentlyOverdue = await Complaint.countDocuments({
      status: 'overdue',
    });

    // Count officials with credibility below 90 — indicates pattern of issues
    const lowCredibilityOfficials = await User.find({
      role: 'official',
      credibilityScore: { $lt: 90 },
    }).select('name email credibilityScore');

    res.status(200).json({
      escalatedComplaints,
      currentlyOverdue,
      lowCredibilityOfficials,
    });

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};