const mongoose = require('mongoose');

const verificationVoteSchema = new mongoose.Schema({
  complaintId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Complaint',
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  vote: {
    type: String,
    enum: ['fixed', 'not_fixed'],
    required: true,
  },
}, {
  timestamps: true,
});

// Same pattern as Validation — one vote per user per complaint, enforced at the DB level
verificationVoteSchema.index({ complaintId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('VerificationVote', verificationVoteSchema);