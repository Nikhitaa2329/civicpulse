const Complaint = require('../models/Complaint');
const cloudinary = require('../config/cloudinary');
const User = require('../models/User');
const { sendNotification } = require('../utils/notificationManager');
const { sendComplaintAssignedEmail } = require('../utils/emailService');

// Helper function: uploads a buffer (in-memory file data) to Cloudinary
const uploadToCloudinary = (buffer) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'civicpulse',
        transformation: [{ width: 1000, height: 1000, crop: 'limit' }],
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    uploadStream.end(buffer);
  });
};

exports.createComplaint = async (req, res) => {
  try {
    const { title, category, description, lat, lng, address,pincode } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: 'A photo is required' });
    }

    if (!title || !category || !description || !lat || !lng) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const uploadResult = await uploadToCloudinary(req.file.buffer);

    const complaint = await Complaint.create({
      title,
      category,
      description,
      location: { lat, lng, address },
      pincode: pincode || null, // store it directly on the complaint

      beforePhoto: uploadResult.secure_url,
      filedBy: req.user.id,
      status: 'pending_validation',
      timeline: [
        {
          event: 'Complaint filed',
          actor: req.user.id,
        },
      ],
    });

    res.status(201).json(complaint);

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


// GET all complaints — public, no login required
// Supports optional filtering by category and status via query parameters
exports.getComplaints = async (req, res) => {
  try {
    const { category, status } = req.query;

    // Build a filter object dynamically based on what was actually provided
    const filter = {};
    if (category) filter.category = category;
    if (status) filter.status = status;

    const complaints = await Complaint.find(filter)
      .populate('filedBy', 'name credibilityScore') // replace ObjectId with actual user data
      .sort({ createdAt: -1 }); // newest first

    res.status(200).json(complaints);

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// GET a single complaint by its ID — public
exports.getComplaintById = async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id)
      .populate('filedBy', 'name credibilityScore')
      .populate('assignedTo', 'name credibilityScore');

    if (!complaint) {
      return res.status(404).json({ message: 'Complaint not found' });
    }

    res.status(200).json(complaint);

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// GET complaints filed by the currently logged-in user — protected
exports.getMyComplaints = async (req, res) => {
  try {
    const complaints = await Complaint.find({ filedBy: req.user.id })
      .sort({ createdAt: -1 });

    res.status(200).json(complaints);

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// An official accepts/claims an open complaint, assigning it to themselves
exports.assignComplaint = async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);

    if (!complaint) {
      return res.status(404).json({ message: 'Complaint not found' });
    }

    // Only 'open' complaints can be picked up — not pending, not already in progress
    if (complaint.status !== 'open') {
      return res.status(400).json({
        message: `Cannot assign a complaint with status '${complaint.status}'. Only 'open' complaints can be assigned.`,
      });
    }

    // Prevent re-assigning a complaint that's already taken by someone else
    if (complaint.assignedTo) {
      return res.status(400).json({ message: 'This complaint is already assigned to an official' });
    }

    // Pincode-based routing check
    // Admins can assign any complaint regardless of pincode
    // Officials can only assign complaints in their assigned pincodes
    // Officials with no assigned pincodes can assign any complaint (fallback)
    if (req.user.role !== 'admin') {
      const official = await User.findById(req.user.id).select('assignedPincodes');
      if (official.assignedPincodes?.length > 0 && complaint.pincode) {
        if (!official.assignedPincodes.includes(complaint.pincode)) {
          return res.status(403).json({
            message: `This complaint is in pincode ${complaint.pincode} which is not in your assigned area. Contact your administrator if you believe this is an error.`,
          });
        }
      }
    }
    complaint.assignedTo = req.user.id;
    complaint.status = 'in_progress';
    complaint.timeline.push({
      event: 'Official accepted the complaint',
      actor: req.user.id,
    });

    await complaint.save();

    // Notify the citizen who filed this complaint
    // They get instant feedback that an official has picked it up
    // If the citizen is offline, sendNotification silently does nothing —
    // they'll see the updated status next time they load the complaint
   sendNotification(complaint.filedBy.toString(), {
      type: 'complaint_assigned',
      title: 'An official has been assigned',
      message: `"${complaint.title}" has been assigned to an official and is now in progress.`,
      complaintId: complaint._id,
      timestamp: new Date().toISOString(),
    });

    // Send email to citizen — works even if they're not in the app
    // Fetch filer's email and the official's name for the email body
    const filer = await User.findById(complaint.filedBy).select('email');
    const official = await User.findById(req.user.id).select('name');
    if (filer?.email) {
      sendComplaintAssignedEmail(
        filer.email,
        complaint.title,
        complaint._id,
        official?.name || 'A ward officer'
      );
    }

    res.status(200).json(complaint);

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
// Allows an assigned official (or admin) to update a complaint's status
// Restricted to a specific, valid set of transitions
exports.updateComplaintStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const complaint = await Complaint.findById(req.params.id);

    if (!complaint) {
      return res.status(404).json({ message: 'Complaint not found' });
    }

    // Only the official actually assigned to this complaint (or an admin) can update it
    const isAssignedOfficial = complaint.assignedTo && complaint.assignedTo.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isAssignedOfficial && !isAdmin) {
      return res.status(403).json({ message: 'You are not authorized to update this complaint' });
    }

    // Define which transitions are actually valid from the CURRENT status
    const allowedTransitions = {
      in_progress: ['pending_verification'], // resolving requires the Proof-of-Fix flow, built separately
      overdue: ['in_progress', 'pending_verification'],
    };

    const validNextStates = allowedTransitions[complaint.status] || [];

    if (!validNextStates.includes(status)) {
      return res.status(400).json({
        message: `Cannot transition from '${complaint.status}' to '${status}'`,
      });
    }

    complaint.status = status;
    complaint.timeline.push({
      event: `Status updated to '${status}'`,
      actor: req.user.id,
    });

    await complaint.save();

    res.status(200).json(complaint);

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
// GET lightweight map data — public, no auth required
// Returns only the fields the frontend map needs to render pins and heatmap layers
// Deliberately excludes photos, timelines, populated fields — keeps the payload lean
// since this endpoint could be called frequently as the map re-renders
exports.getMapData = async (req, res) => {
  try {
    const complaints = await Complaint.find({
      status: {
        $in: [
          'pending_validation',
          'open',
          'in_progress',
          'overdue',
          'pending_verification',
          'reopened',
        ]
      },
      mergedInto: null,
    }).select('location status category affectedCount createdAt pincode');

    res.status(200).json(complaints);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
const calculateDistance = require('../utils/distance');

// GET complaints near a location with same category
// Used by the filing form to warn about duplicate complaints
exports.getNearbyComplaints = async (req, res) => {
  try {
    const { lat, lng, category, radius = 500 } = req.query;

    if (!lat || !lng || !category) {
      return res.status(400).json({ message: 'lat, lng and category are required' });
    }

    // Find open/pending complaints of the same category
    const complaints = await Complaint.find({
      category,
      status: { $in: ['pending_validation', 'open', 'in_progress', 'overdue'] },
      mergedInto: null,
    }).select('location title status affectedCount createdAt');

    // Filter by actual distance using Haversine
    // (same formula already proven in community validation)
    const nearby = complaints.filter((complaint) => {
      const distance = calculateDistance(
        parseFloat(lat),
        parseFloat(lng),
        complaint.location.lat,
        complaint.location.lng
      );
      return distance <= parseFloat(radius);
    });

    res.status(200).json({
      count: nearby.length,
      complaints: nearby,
    });

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};