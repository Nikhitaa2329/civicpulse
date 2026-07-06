import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useAuth } from './AuthContext';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const eventSourceRef = useRef(null);

  useEffect(() => {
    // Only connect if the user is logged in
    if (!isAuthenticated) {
      // Clean up any existing connection when user logs out
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      return;
    }

    const token = localStorage.getItem('accessToken');
    if (!token) return;

    // EventSource doesn't support custom headers directly
    // We pass the token as a query parameter instead
    // The backend reads it from req.query.token
    const url = `/api/notifications/stream?token=${token}`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Ignore the initial connection confirmation and heartbeats
        if (data.type === 'connected') return;

        // Add to notifications list and increment unread count
        setNotifications(prev => [data, ...prev].slice(0, 20)); // keep last 20
        setUnreadCount(prev => prev + 1);
      } catch {
        // Ignore malformed events
      }
    };

    eventSource.onerror = () => {
      // EventSource automatically reconnects on error
      // No manual handling needed
      console.log('[SSE] Connection error — will retry automatically');
    };

    // Clean up when component unmounts or auth state changes
    return () => {
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [isAuthenticated]);

  const markAllRead = () => setUnreadCount(0);
  const clearNotifications = () => {
    setNotifications([]);
    setUnreadCount(0);
  };

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      markAllRead,
      clearNotifications,
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationContext);