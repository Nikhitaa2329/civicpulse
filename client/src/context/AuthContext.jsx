import { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  // Lazy initializer — runs once synchronously before first render
  // This is the correct React 19 pattern for reading localStorage on mount
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem('user');
    const storedToken = localStorage.getItem('accessToken');
    if (storedUser && storedToken) {
      return JSON.parse(storedUser);
    }
    return null;
  });

  const login = (userData, token) => {
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('accessToken', token);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('accessToken');
    setUser(null);
  };

  const isAuthenticated = !!user;
  const isOfficial = user?.role === 'official';
  const isAdmin = user?.role === 'admin';
  const isCitizen = user?.role === 'citizen';

  return (
    <AuthContext.Provider value={{
      user,
      loading: false,
      login,
      logout,
      isAuthenticated,
      isOfficial,
      isAdmin,
      isCitizen,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside an AuthProvider');
  }
  return context;
};