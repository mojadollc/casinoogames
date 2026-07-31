const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

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

// ── Rate limiters ─────────────────────────────────────────────────────────────
// IMPORTANT: app must have `trust proxy 1` set so req.ip is the real client IP.
// keyGenerator reads X-Forwarded-For directly as a safety fallback.
const rateLimiter = require('express-rate-limit');

const realIp = (req) =>
  req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || '0.0.0.0';

// General API — 300 req / 15 min per IP
const apiLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: realIp,
  skip: (req) => req.path === '/health', // never rate-limit health checks
  handler: (req, res) => res.status(429).json({ error: 'Too many requests, please try again later.' }),
});

// Auth endpoints — 50 req / 15 min per IP (login, register, refresh)
const authLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: realIp,
  handler: (req, res) => res.status(429).json({ error: 'Too many attempts, please wait 15 minutes.' }),
});

module.exports = { authenticate, authorize, isAdmin, apiLimiter, authLimiter };
