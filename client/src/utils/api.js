import axios from 'axios';

// Create an axios instance with your backend's base URL
// During development, the Vite proxy forwards /api/* to http://localhost:5000
// In production, this would point to your deployed Render URL
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/api`
    : '/api',
});

// Request interceptor — runs before EVERY request this instance makes
// Automatically attaches the JWT token to the Authorization header
// so you don't have to manually add it in every component
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — runs after EVERY response comes back
// If the server returns 401 (token expired/invalid), automatically
// clear localStorage and redirect to login
api.interceptors.response.use(
  (response) => response, // success — just pass it through
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;