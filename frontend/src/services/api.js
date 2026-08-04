import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3020/api';

const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401 && !err.config._retry) {
      err.config._retry = true;
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error('No refresh token');
        const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
        localStorage.setItem('token', data.token);
        err.config.headers.Authorization = `Bearer ${data.token}`;
        return api(err.config);
      } catch {
        // Clear everything and redirect to login
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('cached_user');
        localStorage.removeItem('cached_balance');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(err);
  }
);

export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  profile: () => api.get('/auth/profile'),
  updateProfile: (data) => api.put('/auth/profile', data),
  kycBonus: (type, value) => api.post('/auth/kyc-bonus', { type, value }),
  enable2FA: () => api.post('/auth/2fa/enable'),
  verify2FA: (otp) => api.post('/auth/2fa/verify', { otp }),
  logout: () => api.post('/auth/logout', { refreshToken: localStorage.getItem('refreshToken') }),
};

export const walletAPI = {
  balance: () => api.get('/wallet/balance'),
  transactions: (params) => api.get('/wallet/transactions', { params }),
};

export const paymentAPI = {
  deposit: (data) => api.post('/payments/deposit', data),
  withdraw: (data) => api.post('/payments/withdraw', data),
  history: () => api.get('/payments/history'),
};

export const gameAPI = {
  list: () => api.get('/games'),
  details: (slug) => api.get(`/games/${slug}`),
  spin: (gameId, betAmount) => api.post(`/games/${gameId}/spin`, { betAmount }),
  freeSpin: (gameId) => api.post(`/games/${gameId}/free-spin`),
  fishingShoot: (gameId, betAmount) => api.post(`/games/${gameId}/fishing-shoot`, { betAmount }),
  play: (gameId, payload) => api.post(`/games/${gameId}/play`, payload),
  history: (gameId) => api.get(`/games/${gameId}/history`),
  jackpotTotal: () => api.get('/games/jackpots/total'),
};

export const promoAPI = {
  list: () => api.get('/promotions'),
  dailyLogin: () => api.post('/promotions/daily-login'),
  referral: (code) => api.post('/promotions/referral', { referral_code: code }),
  cashback: () => api.post('/promotions/cashback'),
  leaderboard: () => api.get('/promotions/leaderboard'),
};

export const notifAPI = {
  list: () => api.get('/notifications'),
  markRead: (id) => api.put(`/notifications/${id}/read`),
  unreadCount: () => api.get('/notifications/unread-count'),
};

export const adminAPI = {
  dashboard: () => api.get('/admin/dashboard'),
  players: (params) => api.get('/admin/players', { params }),
  player: (id) => api.get(`/admin/players/${id}`),
  updatePlayerStatus: (id, status) => api.put(`/admin/players/${id}/status`, { status }),
  updateKYC: (id, status) => api.put(`/admin/players/${id}/kyc`, { kyc_status: status }),
  wallets: () => api.get('/admin/wallets'),
  adjustWallet: (data) => api.post('/admin/wallets/adjust', data),
  withdrawals: (status) => api.get('/admin/withdrawals', { params: { status } }),
  approveWithdrawal: (id) => api.post(`/admin/withdrawals/${id}/approve`),
  rejectWithdrawal: (id) => api.post(`/admin/withdrawals/${id}/reject`),
  games: () => api.get('/admin/games'),
  createGame: (data) => api.post('/admin/games', data),
  updateGame: (id, data) => api.put(`/admin/games/${id}`, data),
  uploadGameThumbnail: (id, file) => {
    const fd = new FormData();
    fd.append('thumbnail', file);
    return api.post(`/admin/games/${id}/thumbnail`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  promotions: () => api.get('/admin/promotions'),
  createPromotion: (data) => api.post('/admin/promotions', data),
  revenue: (period) => api.get('/admin/reports/revenue', { params: { period } }),
  auditLogs: () => api.get('/admin/audit-logs'),
  affiliations: (params) => api.get('/affiliation/admin/all', { params }),
  topReferrers: () => api.get('/affiliation/admin/top-referrers'),
  getSettings: () => api.get('/admin/settings'),
  uploadLogo: (file) => {
    const fd = new FormData();
    fd.append('logo', file);
    return api.post('/admin/settings/logo', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  // Game Controls (Admin)
  getGameControls: (gameId) => api.get(`/games/${gameId}/controls`),
  setGameControls: (gameId, data) => api.put(`/games/${gameId}/controls`, data),
  bulkSetWinRate: (win_rate, gameIds) => api.put('/games/bulk/win-rate', { win_rate, game_ids: gameIds }),
  forceOutcome: (gameId, data) => api.post(`/games/${gameId}/force-outcome`, data),
  setPlayerClass: (gameId, data) => api.post(`/games/${gameId}/player-class`, data),
  triggerJackpot: (gameId, userId) => api.post(`/games/${gameId}/trigger-jackpot`, { user_id: userId }),
  getGameStats: (gameId) => api.get(`/games/${gameId}/stats`),
};

export const affiliationAPI = {
  getMyCode: () => api.get('/affiliation/my-code'),
  getMyAffiliates: () => api.get('/affiliation/my-affiliates'),
  getStats: () => api.get('/affiliation/stats'),
};

export default api;
