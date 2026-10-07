import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiRequest } from '../api/http.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => sessionStorage.getItem('host_token'));
  const [user, setUser] = useState(() => {
    const saved = sessionStorage.getItem('host_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function verifyUser() {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const data = await apiRequest('/api/auth/me');
        setUser(data.user);
        sessionStorage.setItem('host_user', JSON.stringify(data.user));
      } catch (err) {
        console.warn('Auth verification failed:', err.message);
        logout();
      } finally {
        setLoading(false);
      }
    }

    verifyUser();
  }, [token]);

  function login(newToken, newUser) {
    setToken(newToken);
    setUser(newUser);
    sessionStorage.setItem('host_token', newToken);
    sessionStorage.setItem('host_user', JSON.stringify(newUser));
  }

  function logout() {
    setToken(null);
    setUser(null);
    sessionStorage.removeItem('host_token');
    sessionStorage.removeItem('host_user');
  }

  return (
    <AuthContext.Provider value={{ token, user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
