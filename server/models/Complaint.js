const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters'],
  },
  category: {
    type: String,
    required: true,
    enum: [
      'waterlogging',
      'power_outage',
      'broken_road',
      'garbage',
      'streetlight',
      'water_supply',
      'open_manhole',
      'other',
    ],
  },
  description: {
    type: String,
    required: true,
    trim: true,
  },
  location: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    address: { type: String }, // human-readable, optional
  },
  beforePhoto: {
    type: String, // Cloudinary URL
    required: true,
  },
  afterPhoto: {
    type: String, // Cloudinary URL, only set when official resolves it
    default: null,
  },
  status: {
    type: String,
    enum: [
      'pending_validation',
      'open',
      'in_progress',
      'pending_verification',
      'resolved',
      'overdue',
      'reopened',
      'expired',
    ],
    default: 'pending_validation',
  },
  filedBy: {
    type: mongoose.Schema.Types.ObjectId, // a reference to a User document
    ref: 'User', // tells Mongoose this ID points to the User collection
    required: true,
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null, // null until an official is assigned
  },
  wardId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ward',
    default: null,
  },
  pincode: {
  type: String,
  default: null,
  // Populated at filing time from the citizen's form input —
  // used as a geographic grouping proxy in place of official ward boundaries
  },
  slaDeadline: {
    type: Date,
    default: null, // set once the complaint moves to 'open'
  },
  hashSimilarity: {
    type: Number, // Hamming distance between before/after photo hashes
    default: null,
  },
  mergedInto: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Complaint', // a complaint can reference ANOTHER complaint — self-referential
    default: null,
  },
  affectedCount: {
    type: Number,
    default: 1, // every complaint starts representing just its own filer
  },
  timeline: [
    {
      event: { type: String, required: true },
      actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      timestamp: { type: Date, default: Date.now },
    },
  ],
  resolvedAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true, // adds createdAt and updatedAt automatically
});

module.exports = mongoose.model('Complaint', complaintSchema);