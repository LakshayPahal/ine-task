import { useState, useEffect } from 'react';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('userId');
    const displayName = localStorage.getItem('displayName');
    
    if (token && userId && displayName) {
      setUser({ token, userId, displayName });
    }
    setLoading(false);
  }, []);

  const login = (userData) => {
    localStorage.setItem('token', userData.token);
    localStorage.setItem('userId', userData.userId);
    localStorage.setItem('displayName', userData.displayName);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('displayName');
    setUser(null);
  };

  const requireAuth = () => {
    return !!user;
  };

  return {
    user,
    loading,
    login,
    logout,
    requireAuth,
    isAuthenticated: !!user
  };
}