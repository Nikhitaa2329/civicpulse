const mongoose = require('mongoose');

const validationSchema = new mongoose.Schema({
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
}, {
  timestamps: true, // createdAt tells us exactly when this validation happened
});

// COMPOUND UNIQUE INDEX: prevents the same user from validating
// the same complaint more than once, enforced at the database level
validationSchema.index({ complaintId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('Validation', validationSchema);