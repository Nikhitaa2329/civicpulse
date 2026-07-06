const cloudinary = require('cloudinary').v2;

// Configure the SDK with credentials from .env
// This must run once, when the app starts, before any upload attempts
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

module.exports = cloudinary;