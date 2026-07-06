import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, MapPin, ArrowLeft } from 'lucide-react';
import api from '../utils/api';

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/register', {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: 'citizen',
      });
      navigate('/login', {
        state: { message: 'Account created successfully — please sign in' },
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
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

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Create account
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Join your community — report and verify civic issues
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded px-4 py-3 mb-5 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Full name
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full border border-slate-200 rounded px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                placeholder="Your full name"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full border border-slate-200 rounded px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
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
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  className="w-full border border-slate-200 rounded px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white pr-10"
                  placeholder="Min. 6 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Confirm password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  className="w-full border border-slate-200 rounded px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white pr-10"
                  placeholder="Re-enter password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 hover:bg-slate-700 disabled:bg-slate-400 text-white font-bold py-2.5 rounded text-sm transition-colors mt-2"
            >
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-600 hover:underline font-semibold">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}