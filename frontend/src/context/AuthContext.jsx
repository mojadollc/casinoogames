import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { authAPI, walletAPI } from '../services/api';

const AuthContext = createContext(null);
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3020/api';
const USER_CACHE_KEY = 'cached_user';
const BALANCE_CACHE_KEY = 'cached_balance';

export const AuthProvider = ({ children }) => {
  // Restore from cache instantly — no loading flash
  const cachedUser = (() => { try { const u = localStorage.getItem(USER_CACHE_KEY); return u ? JSON.parse(u) : null; } catch { return null; } })();
  const cachedBalance = (() => { const b = localStorage.getItem(BALANCE_CACHE_KEY); return b ? Number(b) : 0; })();

  const [user, setUser] = useState(cachedUser);
  const [balance, setBalance] = useState(cachedBalance);
  // Only show loading spinner if there is NO cached user at all
  const [loading, setLoading] = useState(!cachedUser && !!localStorage.getItem('token'));

  const saveUser = (u) => {
    setUser(u);
    if (u) localStorage.setItem(USER_CACHE_KEY, JSON.stringify(u));
    else { localStorage.removeItem(USER_CACHE_KEY); localStorage.removeItem(BALANCE_CACHE_KEY); }
  };

  const fetchBalance = async () => {
    try {
      const { data } = await walletAPI.balance();
      const val = Number(data.balance) || 0;
      setBalance(val);
      localStorage.setItem(BALANCE_CACHE_KEY, val);
    } catch {}
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    const refreshToken = localStorage.getItem('refreshToken');
    if (!token && !refreshToken) { setLoading(false); return; }

    const init = async () => {
      try {
        const { data } = await authAPI.profile();
        saveUser(data);
        fetchBalance();
      } catch {
        if (refreshToken) {
          try {
            const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
            localStorage.setItem('token', data.token);
            const profile = await authAPI.profile();
            saveUser(profile.data);
            fetchBalance();
          } catch {
            localStorage.removeItem('token');
            localStorage.removeItem('refreshToken');
            saveUser(null);
          }
        } else {
          localStorage.removeItem('token');
          saveUser(null);
        }
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  const login = async (credentials) => {
    const { data } = await authAPI.login(credentials);
    if (data.requires2FA) return { requires2FA: true };
    localStorage.setItem('token', data.token);
    localStorage.setItem('refreshToken', data.refreshToken);
    saveUser(data.user);
    fetchBalance();
    return data;
  };

  const register = async (userData) => {
    const { data } = await authAPI.register(userData);
    localStorage.setItem('token', data.token);
    localStorage.setItem('refreshToken', data.refreshToken);
    saveUser(data.user);
    setBalance(0);
    localStorage.setItem(BALANCE_CACHE_KEY, '0');
    return data;
  };

  const logout = async () => {
    try { await authAPI.logout(); } catch {}
    localStorage.clear();
    saveUser(null);
    setBalance(0);
  };

  const refreshProfile = async () => {
    const { data } = await authAPI.profile();
    saveUser(data);
  };

  const updateBalance = (newBalance) => {
    const val = Number(newBalance) || 0;
    setBalance(val);
    localStorage.setItem(BALANCE_CACHE_KEY, val);
  };

  return (
    <AuthContext.Provider value={{ user, balance, loading, login, register, logout, refreshProfile, fetchBalance, updateBalance }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
