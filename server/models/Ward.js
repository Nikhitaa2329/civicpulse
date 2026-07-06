const mongoose = require('mongoose');

const wardSchema = new mongoose.Schema({
  wardName: {
    type: String,
    required: true,
    trim: true,
  },
  areaName: {
    type: String,
    required: true,
    trim: true,
  },
  pincode: {
    type: String,
    required: true,
  },
  assignedOfficialId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null, // a ward might not have an official assigned yet
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Ward', wardSchema);