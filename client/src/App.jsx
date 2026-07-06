import { Routes, Route} from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import MapPage from './pages/MapPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import FileComplaintPage from './pages/FileComplaintPage'
import MyComplaintsPage from './pages/MyComplaintsPage'
import ProtectedRoute from './components/ProtectedRoute'
import ComplaintDetailPage from './pages/ComplaintDetailPage'
import OfficialDashboardPage from './pages/OfficialDashboardPage'
import AdminPage from './pages/AdminPage'
import NotFoundPage from './pages/NotFoundPage';


function App() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<MapPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute allowedRoles={['official', 'admin']}>
          <OfficialDashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/file-complaint"
        element={
          <ProtectedRoute allowedRoles={['citizen', 'admin']}>
            <FileComplaintPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/my-complaints"
        element={
          <ProtectedRoute allowedRoles={['citizen', 'admin']}>
            <MyComplaintsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminPage />
          </ProtectedRoute>
        }
      />
      <Route path="/complaints/:id" element={<ComplaintDetailPage />} />
      <Route path="*" element={<NotFoundPage />} />    </Routes>
  );
}

export default App;