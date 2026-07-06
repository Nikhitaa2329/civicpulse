const { addConnection, removeConnection } = require('../utils/notificationManager');

exports.streamNotifications = async (req, res) => {
  const userId = req.user.id;

  // Set SSE headers — these tell the browser this is a streaming response
  // not a regular JSON response
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  // Disable response buffering — without this, Node.js buffers the response
  // and the browser doesn't receive events until the buffer flushes
  // flushHeaders() sends the headers immediately, opening the stream
  res.flushHeaders();

  // Register this connection in the manager
  addConnection(userId, res);

  // Send an initial "connected" event so the browser knows the stream is live
  // This also serves as a heartbeat confirmation
  res.write(`data: ${JSON.stringify({
    type: 'connected',
    message: 'Notification stream connected',
    timestamp: new Date().toISOString(),
  })}\n\n`);

  // Set up a heartbeat — sends a comment every 30 seconds
  // This prevents the connection from timing out on proxies and load balancers
  // SSE comments start with ":" and are ignored by the browser
  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, 30000);

  // Clean up when the client disconnects
  // This fires when the user closes the tab, navigates away, or loses connection
  req.on('close', () => {
    clearInterval(heartbeat);
    removeConnection(userId);
  });
};