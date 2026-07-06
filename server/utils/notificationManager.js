// In-memory store of active SSE connections
// Maps userId (string) → response object (the open HTTP connection)
// When a user opens the app, their connection is stored here
// When they close the tab, it's removed
const connections = new Map();

// Register a new SSE connection for a user
// Called when the user's browser connects to /api/notifications/stream
const addConnection = (userId, res) => {
  // If the user already has a connection (e.g. opened a second tab),
  // close the old one before storing the new one
  if (connections.has(userId)) {
    try {
      connections.get(userId).end();
    } catch {
      // Connection may already be closed — ignore
    }
  }
  connections.set(userId, res);
  console.log(`[SSE] User ${userId} connected — ${connections.size} active connections`);
};

// Remove a connection when the user disconnects
// Called when the browser closes the EventSource (tab close, page navigation)
const removeConnection = (userId) => {
  connections.delete(userId);
  console.log(`[SSE] User ${userId} disconnected — ${connections.size} active connections`);
};

// Send a notification to a specific user
// If they're not connected, the notification is silently dropped
// (no persistence — if they're offline, they won't see past notifications)
const sendNotification = (userId, notification) => {
  const userIdStr = userId.toString();
  if (!connections.has(userIdStr)) return;

  const res = connections.get(userIdStr);
  try {
    // SSE format: each message must be prefixed with "data: " and end with "\n\n"
    // The browser's EventSource parses this format automatically
    res.write(`data: ${JSON.stringify(notification)}\n\n`);
  } catch (error) {
    // Connection is broken — clean it up
    console.error(`[SSE] Failed to send to ${userIdStr}:`, error.message);
    removeConnection(userIdStr);
  }
};

// Send to multiple users at once
// Used when a complaint affects both the filer and validators
const sendToMultiple = (userIds, notification) => {
  userIds.forEach(userId => sendNotification(userId, notification));
};

module.exports = { addConnection, removeConnection, sendNotification, sendToMultiple };