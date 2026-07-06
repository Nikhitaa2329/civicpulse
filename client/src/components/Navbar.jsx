import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { MapPin, LogOut, User, Plus, BarChart2, Shield, Bell } from 'lucide-react';

export default function Navbar() {
  const { user, isAuthenticated, isOfficial, isAdmin, logout } = useAuth();
  const { notifications, unreadCount, markAllRead } = useNotifications();
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showNotifications && !e.target.closest('.notification-bell')) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotifications]);

  return (
    <header className="bg-slate-900 px-6 py-3 flex items-center justify-between relative z-10">
      {/* Left — Logo */}
      <Link to="/" className="flex items-center gap-2.5">
        <div className="bg-blue-600 p-1.5 rounded">
          <MapPin className="w-4 h-4 text-white" />
        </div>
        <div>
          <span className="text-white font-black text-lg tracking-tight">
            Civic<span className="text-blue-400">Pulse</span>
          </span>
          <p className="text-slate-400 text-xs leading-none mt-0.5 hidden sm:block">
            Tamil Nadu Civic Accountability
          </p>
        </div>
      </Link>

      {/* Right — Navigation + Auth */}
      <div className="flex items-center gap-3">

        {/* Map link — always visible */}
        <Link
          to="/"
          className="text-slate-400 hover:text-white text-sm font-medium transition-colors hidden sm:block"
        >
          Live Map
        </Link>

        {isAuthenticated ? (
          <>
            {!isOfficial && !isAdmin && (
              <>
                <Link
                  to="/my-complaints"
                  className="text-slate-300 hover:text-white text-sm font-medium transition-colors"
                >
                  My Reports
                </Link>
                <Link
                  to="/file-complaint"
                  className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Report Issue
                </Link>
              </>
            )}

            {(isOfficial || isAdmin) && (
              <>
                <Link
                  to="/dashboard"
                  className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded transition-colors"
                >
                  <BarChart2 className="w-4 h-4" />
                  Dashboard
                </Link>
                {isAdmin && (
                  <Link
                    to="/admin"
                    className="flex items-center gap-1.5 text-slate-300 hover:text-white text-sm font-medium transition-colors"
                  >
                    <Shield className="w-4 h-4" />
                    Admin
                  </Link>
                )}
              </>
            )}

            {/* Notification Bell — shown to all logged-in users */}
            <div className="relative notification-bell">
              <button
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  if (!showNotifications) markAllRead();
                }}
                className="relative text-slate-400 hover:text-white transition-colors p-1"
              >
                <Bell className="w-5 h-5" />
                {/* Red badge — only shows when there are unread notifications */}
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notification dropdown */}
              {showNotifications && (
                <div className="absolute right-0 top-9 w-80 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                    <p className="text-sm font-bold text-slate-800">Notifications</p>
                    <button
                      onClick={() => setShowNotifications(false)}
                      className="text-slate-400 hover:text-slate-600 text-xs"
                    >
                      Close
                    </button>
                  </div>

                  {notifications.length === 0 ? (
                    <div className="px-4 py-6 text-center">
                      <Bell className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                      <p className="text-sm text-slate-400">No notifications yet</p>
                      <p className="text-xs text-slate-300 mt-1">
                        Status changes will appear here in real time
                      </p>
                    </div>
                  ) : (
                   <div className="max-h-80 overflow-y-auto">
                      {notifications.map((notification, index) => (
                        <Link
                          key={index}
                          to={`/complaints/${notification.complaintId}`}
                          onClick={() => setShowNotifications(false)}
                          className="block px-4 py-3 hover:bg-slate-50 border-b border-slate-50 transition-colors last:border-0"
                        >
                          <p className="text-xs font-bold text-slate-800 mb-0.5">
                            {notification.title}
                          </p>
                          <p className="text-xs text-slate-500 leading-relaxed">
                            {notification.message}
                          </p>
                          <p className="text-xs text-slate-300 mt-1">
                            {new Date(notification.timestamp).toLocaleTimeString('en-IN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* User info + logout */}
            <div className="flex items-center gap-2.5 pl-3 border-l border-slate-700">
              <div className="flex items-center gap-1.5">
                <div className="w-7 h-7 bg-slate-700 rounded-full flex items-center justify-center">
                  <User className="w-3.5 h-3.5 text-slate-300" />
                </div>
                <div className="hidden sm:block">
                  <p className="text-white text-sm font-medium leading-none">
                    {user.name.split(' ')[0]}
                  </p>
                  <p className="text-slate-400 text-xs capitalize mt-0.5">
                    {user.role}
                  </p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="text-slate-400 hover:text-red-400 transition-colors p-1"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </>
        ) : (
          <>
            <Link
              to="/login"
              className="text-sm text-slate-300 hover:text-white font-medium transition-colors"
            >
              Sign in
            </Link>
            <Link
              to="/register"
              className="text-sm bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2 rounded transition-colors"
            >
              Register
            </Link>
          </>
        )}
      </div>
    </header>
  );
}