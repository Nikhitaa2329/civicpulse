const mongoose = require('mongoose');

// A Schema defines the SHAPE of a document — what fields exist,
// their data types, and rules about them (required, unique, etc.)
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true, // automatically removes leading/trailing whitespace
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true, // no two users can have the same email
    lowercase: true, // automatically converts to lowercase before saving
    trim: true,
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
  },
  role: {
    type: String,
    enum: ['citizen', 'official', 'admin'], // ONLY these three values are allowed
    default: 'citizen', // if not specified, a new user is a citizen by default
  },
  location: {
    lat: { type: Number },
    lng: { type: Number },
  },
  pincode: {
    type: String,
  },
  credibilityScore: {
    type: Number,
    default: 100, // officials start with a perfect score, which can drop over time
  },
  assignedPincodes: {
  type: [String],
  default: [],
  // Pincodes this official is responsible for
  // Empty for citizens and admins
},
}, {
  timestamps: true, // automatically adds createdAt and updatedAt fields
});

// "User" here becomes the name Mongoose uses to create a MongoDB collection
// called "users" (Mongoose automatically lowercases and pluralizes the name)
module.exports = mongoose.model('User', userSchema);