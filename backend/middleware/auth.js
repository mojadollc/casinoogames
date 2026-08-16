const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const rateLimiter = require('express-rate-limit');

// ── Authenticate ──────────────────────────────────────────────────────────────
const authenticate = async (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Access denied' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const result = await query(
      'SELECT id, username, email, role_id, status, vip_level FROM users WHERE id = ?',
      [decoded.userId]
    );
    if (!result.rows[0] || result.rows[0].status !== 'active') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    req.user = result.rows[0];
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// ── Role-based authorize ──────────────────────────────────────────────────────
const authorize = (...roles) => async (req, res, next) => {
  const result = await query('SELECT name FROM roles WHERE id = ?', [req.user.role_id]);
  if (!result.rows[0] || !roles.includes(result.rows[0].name)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};

// ── Admin check ───────────────────────────────────────────────────────────────
const isAdmin = (req, res, next) => {
  if (!req.user || req.user.role_id < 2) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// ── Rate limit helpers ────────────────────────────────────────────────────────
const realIp = (req) =>
  req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || '0.0.0.0';

// Prefer per-user bucket when JWT is present (avoids whole café/NAT sharing one limit)
const clientKey = (req) => {
  try {
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      const payload = jwt.decode(header.replace('Bearer ', ''));
      if (payload?.userId) return `u:${payload.userId}`;
    }
  } catch {}
  return `ip:${realIp(req)}`;
};

// Global limiter skips health, webhooks, and high-frequency game actions
const skipGlobal = (req) => {
  const p = `${req.baseUrl || ''}${req.path || ''}` || req.originalUrl || '';
  return (
    p.includes('/health') ||
    p.includes('/webhooks') ||
    p.includes('/fishing-shoot') ||
    p.includes('/spin') ||
    p.includes('/free-spin') ||
    p.includes('/play')
  );
};

/**
 * Global API — browsing, wallet, lists.
 * Raised from 300/15min → 2000/5min per user so games stay usable.
 */
const apiLimiter = rateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 2000,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientKey,
  skip: skipGlobal,
  handler: (req, res) =>
    res.status(429).json({
      error: 'Too many requests, please try again later.',
      code: 'RATE_LIMIT',
      retryAfter: 15,
    }),
});

/**
 * Gameplay hot path — fishing shots / spins / table play.
 * Allows sustained play (~10 actions/sec burst, thousands per window).
 */
const gameLimiter = rateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 4000,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientKey,
  handler: (req, res) =>
    res.status(429).json({
      error: 'Slow down a little — too many game actions. Try again in a few seconds.',
      code: 'GAME_RATE_LIMIT',
      retryAfter: 3,
    }),
});

/** Login — tight per-IP brute-force guard: 10 attempts / 15 min */
const authLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: realIp,
  skipSuccessfulRequests: true,   // only count failures toward the limit
  handler: (req, res) =>
    res.status(429).json({
      error: 'Too many login attempts. Please wait 15 minutes.',
      code: 'AUTH_RATE_LIMIT',
      retryAfter: 900,
    }),
});

/** Register — separate limiter: 5 registrations / hour per IP */
const registerLimiter = rateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: realIp,
  handler: (req, res) =>
    res.status(429).json({
      error: 'Too many accounts created from this IP. Try again later.',
      code: 'REGISTER_RATE_LIMIT',
      retryAfter: 3600,
    }),
});

/** Token refresh — must stay high so active players are not logged out */
const refreshLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 400,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientKey,
  handler: (req, res) =>
    res.status(429).json({
      error: 'Too many token refreshes. Please wait a moment.',
      code: 'REFRESH_RATE_LIMIT',
      retryAfter: 15,
    }),
});

module.exports = {
  authenticate,
  authorize,
  isAdmin,
  apiLimiter,
  gameLimiter,
  authLimiter,
  registerLimiter,
  refreshLimiter,
  realIp,
};
