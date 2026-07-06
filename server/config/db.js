const mongoose = require('mongoose');

// This function attempts to connect to MongoDB using the URI from .env
// We wrap it in an async function because connecting to a database
// over the network takes time and might fail — we need to handle both cases
const connectDB = async () => {
  try {
    // mongoose.connect() returns a Promise — we 'await' it to pause
    // execution here until the connection succeeds or fails
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    // If the database fails to connect, there's no point running a server
    // that can't store or retrieve data — so we exit the entire process
    process.exit(1);
  }
};

module.exports = connectDB;