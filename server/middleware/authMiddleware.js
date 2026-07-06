const jwt = require('jsonwebtoken');

// This middleware protects routes — it runs BEFORE the actual route handler
const protect = (req, res, next) => {
  // Tokens are sent in the request header like this:
  // Authorization: Bearer <token>
  let token;

// Check Authorization header first — used by all normal API calls
if (req.headers.authorization?.startsWith('Bearer ')) {
  token = req.headers.authorization.split(' ')[1];
}
// Fall back to query parameter — used by SSE connections only
// EventSource cannot set custom headers, so token is passed as ?token=<jwt>
else if (req.query.token) {
  token = req.query.token;
}

if (!token) {
  return res.status(401).json({ message: 'Not authorized, no token' });
}
  try {
    // jwt.verify checks the signature AND the expiry in one call
    // If the token was tampered with, or expired, this throws an error
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach the decoded payload to req.user
    // Every route handler downstream can now access req.user.id and req.user.role
    req.user = decoded;

    // next() passes control forward — to the next middleware, or the actual route handler
    next();

  } catch (error) {
    return res.status(401).json({ message: 'Not authorized, token failed' });
  }
};

// This middleware checks if the logged-in user's role is in the allowed list
// It's a "middleware factory" — a function that RETURNS a middleware function,
// which lets us customize which roles are allowed per route
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    // req.user was set by the 'protect' middleware, which must run BEFORE this one
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied: insufficient permissions' });
    }
    next();
  };
};

module.exports = { protect, authorize };