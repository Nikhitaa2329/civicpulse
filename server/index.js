// Load environment variables from .env into process.env
// This MUST be the first thing that runs, before we use any process.env values
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db'); 
const authRoutes = require('./routes/authRoutes');
const complaintRoutes = require('./routes/complaintRoutes'); 
const validationRoutes = require('./routes/validationRoutes'); 
const slaChecker = require('./jobs/slaChecker');
// No need to call it — cron.schedule() starts automatically when required
console.log('SLA checker job scheduled — runs every hour');
const resolutionRoutes = require('./routes/resolutionRoutes');
const verificationRoutes = require('./routes/verificationRoutes'); 
const insightsRoutes = require('./routes/insightsRoutes');
const aiRoutes = require('./routes/aiRoutes');
const notificationRoutes = require('./routes/notificationRoutes');



// Create our Express application instance
// Everything we configure from here on attaches to this "app" object
const app = express();

//connect to MongoDB before anything else
connectDB();

// ---- MIDDLEWARE ----
// Middleware functions run on EVERY incoming request, in the order they're added,
// before the request reaches our actual route handlers.

// express.json() parses incoming JSON request bodies into a JavaScript object
// Without this, req.body would be undefined when the frontend sends JSON data
app.use(express.json());

// cors() allows our React frontend (running on a different port/domain)
// to make requests to this server. Without it, browsers block the request.
app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true, // allows cookies (we'll need this for refresh tokens later)
}));

// ---- A SIMPLE TEST ROUTE ----
// This is just to confirm the server is alive and responding
app.get('/', (req, res) => {
  res.json({ message: 'CivicPulse API is running' });
});

// any request starting with /api/auth gets handled by authRoutes

app.use('/api/auth', authRoutes);
app.use('/api/complaints', complaintRoutes); 
app.use('/api/validations', validationRoutes);
app.use('/api/complaints', resolutionRoutes); // same base path as complaintRoutes
app.use('/api/verifications', verificationRoutes);
app.use('/api/insights', insightsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/notifications', notificationRoutes);



// ---- START THE SERVER ----
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});