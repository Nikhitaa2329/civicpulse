import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
// Wraps any route that requires authentication
// If not logged in → redirect to login
// If logged in but wrong role → redirect to home
export default function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

