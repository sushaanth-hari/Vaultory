import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('vaultory_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      const storedToken = localStorage.getItem('vaultory_token');
      if (storedToken) {
        try {
          const res = await api.get('/auth/me');
          setUser(res.data);
          localStorage.setItem('vaultory_user', JSON.stringify(res.data));
        } catch (err) {
          console.error("Auth validation failed:", err);
          logout();
        }
      }
      setLoading(false);
    };

    fetchUser();
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const { access_token, user: userData } = res.data;
    localStorage.setItem('vaultory_token', access_token);
    localStorage.setItem('vaultory_user', JSON.stringify(userData));
    setToken(access_token);
    setUser(userData);
    return userData;
  };

  const register = async (email, password, full_name) => {
    const res = await api.post('/auth/register', { email, password, full_name });
    const { access_token, user: userData } = res.data;
    localStorage.setItem('vaultory_token', access_token);
    localStorage.setItem('vaultory_user', JSON.stringify(userData));
    setToken(access_token);
    setUser(userData);
    return userData;
  };

  const logout = () => {
    localStorage.removeItem('vaultory_token');
    localStorage.removeItem('vaultory_user');
    setToken(null);
    setUser(null);
  };

  const updateProfile = async (updateData) => {
    const res = await api.put('/auth/me', updateData);
    setUser(res.data);
    localStorage.setItem('vaultory_user', JSON.stringify(res.data));
    return res.data;
  };

  const refreshUser = async () => {
    try {
      const res = await api.get('/auth/me');
      setUser(res.data);
      localStorage.setItem('vaultory_user', JSON.stringify(res.data));
      return res.data;
    } catch (e) {
      console.error("Error refreshing user:", e);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, updateProfile, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

