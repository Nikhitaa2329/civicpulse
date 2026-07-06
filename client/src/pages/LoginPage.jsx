import { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { Eye, EyeOff, MapPin, ArrowLeft } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const successMessage = location.state?.message;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await api.post('/auth/login', { email, password });
      const { accessToken, ...userData } = response.data;
      login(userData, accessToken);
      if (userData.role === 'official' || userData.role === 'admin') {
        navigate('/dashboard');
      } else {
        navigate('/');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top brand strip */}
<div className="bg-slate-900 py-6 flex justify-center">
  <Link to="/" className="flex items-center gap-2.5">
    <div className="bg-blue-600 p-1.5 rounded">
      <MapPin className="w-4 h-4 text-white" />
    </div>
    <span className="text-white font-black text-xl tracking-tight">
      Civic<span className="text-blue-400">Pulse</span>
    </span>
  </Link>
</div>

{/* Back to map — ADD THIS */}
<div className="bg-slate-800 py-2 flex justify-center">
  <Link
    to="/"
    className="text-slate-400 hover:text-white text-xs flex items-center gap-1.5 transition-colors"
  >
    <ArrowLeft className="w-3 h-3" />
    Back to live map
  </Link>
</div>


      {/* Form area */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Sign in
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Report and track civic issues in your area
            </p>
          </div>

          {successMessage && (
            <div className="bg-green-50 border border-green-200 text-green-700 rounded px-4 py-3 mb-5 text-sm">
              {successMessage}
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded px-4 py-3 mb-5 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full border border-slate-200 rounded px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent bg-white"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full border border-slate-200 rounded px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent bg-white pr-10"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword
                    ? <EyeOff className="w-4 h-4" />
                    : <Eye className="w-4 h-4" />
                  }
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 hover:bg-slate-700 disabled:bg-slate-400 text-white font-bold py-2.5 rounded text-sm transition-colors mt-2"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            No account?{' '}
            <Link to="/register" className="text-blue-600 hover:underline font-semibold">
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}