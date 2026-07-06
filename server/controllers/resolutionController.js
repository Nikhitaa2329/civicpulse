const Complaint = require('../models/Complaint');
const cloudinary = require('../config/cloudinary');
const { generateHash, hammingDistance } = require('../utils/perceptualHash');
const { sendNotification } = require('../utils/notificationManager');
const { sendVerificationNeededEmail } = require('../utils/emailService');
const User = require('../models/User');

const SUSPICIOUS_THRESHOLD = 10; // Hamming distance below this = flagged as suspicious
// Lower threshold than before, since dHash is a more discriminating signal —
// genuinely different images naturally produce larger distances with dHash
// than they did with average hashing, so the bar for "suspicious" tightens.

const uploadToCloudinary = (buffer, folder) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder, transformation: [{ width: 1000, height: 1000, crop: 'limit' }] },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    uploadStream.end(buffer);
  });
};

exports.submitProofOfFix = async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);

    if (!complaint) {
      return res.status(404).json({ message: 'Complaint not found' });
    }

    const isAssignedOfficial = complaint.assignedTo && complaint.assignedTo.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isAssignedOfficial && !isAdmin) {
      return res.status(403).json({ message: 'You are not authorized to resolve this complaint' });
    }

    if (!['in_progress', 'overdue'].includes(complaint.status)) {
      return res.status(400).json({
        message: `Cannot submit proof of fix for a complaint with status '${complaint.status}'`,
      });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'An after-photo is required' });
    }

    const uploadResult = await uploadToCloudinary(req.file.buffer, 'civicpulse/resolutions');
    const afterPhotoUrl = uploadResult.secure_url;

    // Fetch the original before-photo's actual bytes, so we can hash it
    // (only its URL was stored — not the raw image data)
    const beforeImageResponse = await fetch(complaint.beforePhoto);
    const beforeImageBuffer = Buffer.from(await beforeImageResponse.arrayBuffer());

    const beforeHash = await generateHash(beforeImageBuffer);
    const afterHash = await generateHash(req.file.buffer);

    const distance = hammingDistance(beforeHash, afterHash);
    const isSuspicious = distance < SUSPICIOUS_THRESHOLD;

    // The hash NEVER blocks resolution — it only sets an advisory flag.
    // Final authority always rests with citizen verification voting.
    complaint.afterPhoto = afterPhotoUrl;
    complaint.hashSimilarity = distance;
    complaint.status = 'pending_verification';

    complaint.timeline.push({
      event: isSuspicious
        ? `Proof of fix submitted — flagged for review (hash distance: ${distance})`
        : `Proof of fix submitted (hash distance: ${distance})`,
      actor: req.user.id,
    });

 await complaint.save();

    // Notify the citizen who filed this complaint
    // Their vote is now needed to verify whether the fix is genuine
    // The message changes based on whether the hash flagged the proof as suspicious —
    // if it was flagged, the citizen should know to look carefully at the after-photo
   sendNotification(complaint.filedBy.toString(), {
      type: 'proof_submitted',
      title: isSuspicious
        ? 'Proof of fix submitted — please verify carefully'
        : 'Proof of fix submitted — your vote needed',
      message: isSuspicious
        ? `An official submitted proof for "${complaint.title}" but the photos appear similar. Please check the after-photo carefully before voting.`
        : `An official has submitted proof that "${complaint.title}" is resolved. Please verify whether the fix is genuine.`,
      complaintId: complaint._id,
      timestamp: new Date().toISOString(),
    });

    // Send email to citizen — works even when they're not in the app
    // isSuspicious changes both the subject line and body of the email
    const filer = await User.findById(complaint.filedBy).select('email');
    if (filer?.email) {
      sendVerificationNeededEmail(
        filer.email,
        complaint.title,
        complaint._id,
        isSuspicious
      );
    }

    res.status(200).json({
      message: isSuspicious
        ? 'Proof submitted, but flagged for review — the before and after photos appear structurally similar. Citizen verification will make the final call.'
        : 'Proof of fix submitted, pending citizen verification',
      hashDistance: distance,
      isSuspicious,
      complaint,
    });

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};