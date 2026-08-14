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
    const status = err.response?.status;
    const cfg = err.config || {};

    // Rate limit — never log the user out; optional short retry
    if (status === 429) {
      const retryAfter = Number(err.response?.data?.retryAfter || err.response?.headers?.['retry-after'] || 2);
      if (!cfg._rateRetry && retryAfter <= 5) {
        cfg._rateRetry = true;
        await new Promise((r) => setTimeout(r, retryAfter * 1000));
        return api(cfg);
      }
      // Surface a clean error for UI (games keep running)
      err.message = err.response?.data?.error || 'Too many requests — please wait a moment.';
      return Promise.reject(err);
    }

    // Auth refresh — only logout on real auth failure, not network/429
    if (status === 401 && !cfg._retry) {
      cfg._retry = true;
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error('No refresh token');
        const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
        localStorage.setItem('token', data.token);
        cfg.headers = cfg.headers || {};
        cfg.headers.Authorization = `Bearer ${data.token}`;
        return api(cfg);
      } catch (refreshErr) {
        const rs = refreshErr.response?.status;
        // Do not wipe session on rate-limit or transient errors
        if (rs === 429 || !rs) {
          return Promise.reject(refreshErr);
        }
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
  changePassword: (current_password, new_password) => api.put('/auth/change-password', { current_password, new_password }),
  changeEmail: (email, password) => api.put('/auth/change-email', { email, password }),
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
  cockfight: (gameId, betAmount, side) => api.post(`/games/${gameId}/cockfight`, { betAmount, side }),
  fishingShoot: (gameId, betAmount, extra = {}) => api.post(`/games/${gameId}/fishing-shoot`, { betAmount, ...extra }),
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
  geocodePlayer: (id, address) => api.post(`/admin/players/${id}/geocode`, address ? { address } : {}),
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
  bulkSetForceOutcome: (force_outcome, gameIds) => api.put('/games/bulk/force-outcome', { force_outcome, game_ids: gameIds }),
  forceOutcome: (gameId, data) => api.post(`/games/${gameId}/force-outcome`, data),
  setPlayerClass: (gameId, data) => api.post(`/games/${gameId}/player-class`, data),
  triggerJackpot: (gameId, userId) => api.post(`/games/${gameId}/trigger-jackpot`, { user_id: userId }),
  getGameStats: (gameId) => api.get(`/games/${gameId}/stats`),
  getOnlinePlayers: () => api.get('/games/online-players'),
};

export const affiliationAPI = {
  getMyCode: () => api.get('/affiliation/my-code'),
  getMyAffiliates: () => api.get('/affiliation/my-affiliates'),
  getStats: () => api.get('/affiliation/stats'),
};

export default api;
