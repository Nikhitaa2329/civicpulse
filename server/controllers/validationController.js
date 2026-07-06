const Validation = require('../models/Validation');
const Complaint = require('../models/Complaint');
const User = require('../models/User');
const calculateDistance = require('../utils/distance');
const { sendNotification } = require('../utils/notificationManager');
const { sendComplaintOpenEmail } = require('../utils/emailService');


const VALIDATION_THRESHOLD = 2; // number of confirmations needed to officially file
const MAX_VALIDATION_DISTANCE = 500; // meters

exports.validateComplaint = async (req, res) => {
  try {
    const complaintId = req.params.id;
    const userId = req.user.id;
    const { lat, lng } = req.body; // current live location, sent by the frontend at validation time

    if (!lat || !lng) {
      return res.status(400).json({ message: 'Your current location is required to validate' });
    }

    const complaint = await Complaint.findById(complaintId);
    if (!complaint) {
      return res.status(404).json({ message: 'Complaint not found' });
    }

    if (complaint.status !== 'pending_validation') {
      return res.status(400).json({ message: 'This complaint is no longer pending validation' });
    }

    if (complaint.filedBy.toString() === userId) {
      return res.status(403).json({ message: 'You cannot validate your own complaint' });
    }

    // Check distance using the LIVE coordinates sent in this request
    const distance = calculateDistance(
      complaint.location.lat,
      complaint.location.lng,
      lat,
      lng
    );

    if (distance > MAX_VALIDATION_DISTANCE) {
      return res.status(403).json({
        message: `You are too far from this complaint to validate it (${Math.round(distance)}m away, must be within ${MAX_VALIDATION_DISTANCE}m)`,
      });
    }

    try {
      await Validation.create({ complaintId, userId });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(400).json({ message: 'You have already validated this complaint' });
      }
      throw error;
    }

    const validationCount = await Validation.countDocuments({ complaintId });

   if (validationCount >= VALIDATION_THRESHOLD) {
  complaint.status = 'open';
  complaint.slaDeadline = calculateSLADeadline(complaint.category);
  complaint.timeline.push({
    event: `Complaint validated by community (${validationCount} confirmations) — now open`,
    actor: userId,
  });
  await complaint.save();

  // Notify the citizen who filed — their complaint is now officially open
  sendNotification(complaint.filedBy.toString(), {
    type: 'complaint_validated',
    title: 'Your complaint is now open',
    message: `"${complaint.title}" has been confirmed by the community and is now open for official action.`,
    complaintId: complaint._id,
    timestamp: new Date().toISOString(),
  });

  // After sendNotification(...) in the VALIDATION_THRESHOLD block:
// Fetch the filer's email to send the notification
const filer = await User.findById(complaint.filedBy).select('email name');
if (filer?.email) {
  sendComplaintOpenEmail(filer.email, complaint.title, complaint._id);
}

  return res.status(200).json({
    message: 'Complaint validated and is now officially open',
    validationCount,
    complaint,
  });
}

    complaint.timeline.push({
      event: `Validated by a neighbour (${validationCount}/${VALIDATION_THRESHOLD} confirmations)`,
      actor: userId,
    });
    await complaint.save();

    res.status(200).json({
      message: 'Validation recorded',
      validationCount,
      neededForOpen: VALIDATION_THRESHOLD - validationCount,
    });

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Helper: calculates the SLA deadline based on category, from the moment a complaint opens
const calculateSLADeadline = (category) => {
  const slaHours = {
    power_outage: 24,
    open_manhole: 24,
    waterlogging: 48,
    water_supply: 48,
    garbage: 72,
    streetlight: 72,
    broken_road: 168, // 7 days
    other: 72,
  };

  const hours = slaHours[category] || 72;
  const deadline = new Date();
  deadline.setHours(deadline.getHours() + hours);
  return deadline;
};
exports.getValidationCount = async (req, res) => {
  try {
    const complaintId = req.params.id;
    const count = await Validation.countDocuments({ complaintId });
    res.status(200).json({ count });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
exports.getSuspiciousValidators = async (req, res) => {
  try {
    const suspicious = await Validation.aggregate([
      // Step 1: Join with complaints to get the filer of each validated complaint
      {
        $lookup: {
          from: 'complaints',
          localField: 'complaintId',
          foreignField: '_id',
          as: 'complaint',
        },
      },
      // Step 2: Flatten the complaint array (each validation has one complaint)
      {
        $unwind: '$complaint',
      },
      // Step 3: Group by validator + filer pair — how many times has this
      // validator confirmed complaints from this specific filer?
      {
        $group: {
          _id: {
            validator: '$userId',
            filer: '$complaint.filedBy',
          },
          validationCount: { $sum: 1 },
          complaintIds: { $push: '$complaintId' },
        },
      },
      // Step 4: Group by validator — how many DIFFERENT filers have they
      // validated for? A legitimate validator confirms many different people's
      // complaints. A suspicious one only ever validates for one person.
      {
        $group: {
          _id: '$_id.validator',
          uniqueFilers: { $sum: 1 },
          totalValidations: { $sum: '$validationCount' },
          filerBreakdown: {
            $push: {
              filerId: '$_id.filer',
              count: '$validationCount',
            },
          },
        },
      },
      // Step 5: Flag validators who only ever validated one filer's complaints
      // AND did it at least 3 times — suggests coordinated behavior
      {
        $match: {
          uniqueFilers: 1,
          totalValidations: { $gte: 3 },
        },
      },
      // Step 6: Populate validator name for display
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'validatorUser',
        },
      },
      {
        $unwind: '$validatorUser',
      },
      // Step 7: Populate filer name from the breakdown
      {
        $lookup: {
          from: 'users',
          localField: 'filerBreakdown.filerId',
          foreignField: '_id',
          as: 'filerUser',
        },
      },
      {
        $project: {
          validatorName: '$validatorUser.name',
          validatorEmail: '$validatorUser.email',
          uniqueFilers: 1,
          totalValidations: 1,
          filerName: { $arrayElemAt: ['$filerUser.name', 0] },
          filerEmail: { $arrayElemAt: ['$filerUser.email', 0] },
        },
      },
      {
        $sort: { totalValidations: -1 },
      },
    ]);

    res.status(200).json({
      count: suspicious.length,
      patterns: suspicious,
    });

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};