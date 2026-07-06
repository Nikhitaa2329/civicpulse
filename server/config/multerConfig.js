const multer = require('multer');

// Instead of storing to disk OR routing through a connector package,
// we store the file temporarily in memory as a Buffer.
// We'll manually push that buffer to Cloudinary in the controller.
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true); // accept the file
    } else {
      cb(new Error('Only JPEG, PNG, and WEBP images are allowed'), false);
    }
  },
});

module.exports = upload;