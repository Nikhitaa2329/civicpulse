const User = require('../models/User');
const bcrypt = require('bcryptjs');

// This function handles registration logic.
// It's an async function because we're calling the database, which takes time.
exports.register = async (req, res) => {
  try {
    // Destructure the fields we expect from the request body
    // (the JSON data sent by Postman or, later, the React form)
    const { name, email, password, role, location, pincode } = req.body;

    // Check if a user with this email already exists
    // We do this BEFORE creating, to give a clear error instead of
    // letting MongoDB throw a confusing duplicate-key error
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // Hash the password before storing it
    // We NEVER store plain text passwords
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create the new user document in MongoDB
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role, // if not provided, schema default 'citizen' kicks in
      location,
      pincode,
    });

    // Send back a success response
    // IMPORTANT: we deliberately do NOT send the password back, even hashed
    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    });

  } catch (error) {
    // Catches anything unexpected — bad data that slipped past our checks,
    // a database connection hiccup, etc.
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const jwt = require('jsonwebtoken');

// Helper function: generates a short-lived access token
// We'll reuse this every time we need to issue a new token
const generateAccessToken = (userId, role) => {
  return jwt.sign(
    { id: userId, role: role }, // payload — data embedded inside the token
    process.env.JWT_SECRET,     // secret key used to sign it
    { expiresIn: '15m' }        // token becomes invalid after 15 minutes
  );
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find the user by email
    const user = await User.findOne({ email });
    if (!user) {
      // Deliberately vague — we don't say "email not found" specifically,
      // to avoid telling attackers whether an email is registered at all
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    // Compare the plain-text password they sent against the stored hash
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    // Credentials are correct — generate a token proving this user is logged in
    const accessToken = generateAccessToken(user._id, user.role);

    res.status(200).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      accessToken,
    });

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getProfile = async (req, res) => {
  try {
    // req.user was attached by our middleware — we trust it's a valid, logged-in user
    // We fetch fresh data from the DB rather than just returning the JWT payload,
    // in case the user's info has changed since the token was issued
    const user = await User.findById(req.user.id).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json(user);

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.createOfficial = async (req, res) => {
  try {
    const { name, email, password, assignedPincodes } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const official = await User.create({
      name,
      email,
      password: hashedPassword,
      role: 'official',
      assignedPincodes: assignedPincodes || [],
    });

    res.status(201).json({
      _id: official._id,
      name: official.name,
      email: official.email,
      role: official.role,
      assignedPincodes: official.assignedPincodes,
    });

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};