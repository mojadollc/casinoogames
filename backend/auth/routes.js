const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const { query } = require('../config/database');
const { authenticate, authLimiter } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { createAffiliation } = require('../affiliation/routes');
const { creditWallet } = require('../wallet/routes');

const router = express.Router();

// Register
router.post('/register', authLimiter, [
  body('username').isLength({ min: 3, max: 50 }).trim(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { username, email, password, phone, ref } = req.body;
  try {
    const existing = await query('SELECT id FROM users WHERE email = ? OR username = ?', [email, username]);
    if (existing.rows.length) return res.status(409).json({ error: 'User already exists' });

    const id = uuidv4();
    const password_hash = await bcrypt.hash(password, 12);
    // Generate unique referral code at registration
    let referral_code;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    do {
      referral_code = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      const existing = await query('SELECT id FROM users WHERE referral_code = ?', [referral_code]);
      if (!existing.rows.length) break;
    } while (true);

    await query(
      'INSERT INTO users (id, username, email, password_hash, phone, referral_code) VALUES (?, ?, ?, ?, ?, ?)',
      [id, username, email, password_hash, phone || null, referral_code]
    );

    const walletId = uuidv4();
    await query('INSERT INTO wallets (id, user_id) VALUES (?, ?)', [walletId, id]);

    // Handle referral
    if (ref) {
      await createAffiliation(id, ref);
    }

    const token = jwt.sign({ userId: id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });
    const refreshToken = jwt.sign({ userId: id }, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN });

    const sessionId = uuidv4();
    await query(
      'INSERT INTO sessions (id, user_id, token, ip_address, user_agent, expires_at) VALUES (?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))',
      [sessionId, id, refreshToken, req.ip, req.headers['user-agent']]
    );

    res.status(201).json({ user: { id, username, email, referral_code }, token, refreshToken });
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', authLimiter, [
  body('email').isEmail(),
  body('password').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid email or password format' });

  const { email, password, otp } = req.body;
  try {
    const result = await query('SELECT * FROM users WHERE email = ?', [email]);
    const user = result.rows[0];

    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    if (user.status !== 'active') return res.status(403).json({ error: 'Account suspended' });

    if (user.two_factor_enabled) {
      if (!otp) return res.status(200).json({ requires2FA: true });
      const verified = speakeasy.totp.verify({ secret: user.two_factor_secret, encoding: 'base32', token: otp });
      if (!verified) return res.status(401).json({ error: 'Invalid OTP' });
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });
    const refreshToken = jwt.sign({ userId: user.id }, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN });

    const sessionId = uuidv4();
    await query(
      'INSERT INTO sessions (id, user_id, token, ip_address, user_agent, expires_at) VALUES (?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))',
      [sessionId, user.id, refreshToken, req.ip, req.headers['user-agent']]
    );

    await query('INSERT INTO audit_logs (id, user_id, action, ip_address) VALUES (?, ?, ?, ?)',
      [uuidv4(), user.id, 'login', req.ip]);

    res.json({ user: { id: user.id, username: user.username, email: user.email, vip_level: user.vip_level, role_id: user.role_id }, token, refreshToken });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Refresh token
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const session = await query(
      'SELECT * FROM sessions WHERE token = ? AND user_id = ? AND expires_at > NOW()',
      [refreshToken, decoded.userId]
    );
    if (!session.rows[0]) return res.status(401).json({ error: 'Invalid refresh token' });
    const token = jwt.sign({ userId: decoded.userId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });
    res.json({ token });
  } catch (err) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// Profile
router.get('/profile', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT u.id, u.username, u.email, u.phone, u.vip_level, u.role_id, u.kyc_status, u.status,
       u.responsible_gaming, u.two_factor_enabled, u.created_at,
       w.balance, w.bonus_balance
       FROM users u JOIN wallets w ON w.user_id = u.id WHERE u.id = ?`, [req.user.id]);
    const row = result.rows[0];
    if (!row) return res.status(404).json({ error: 'User not found' });
    // Fetch migration-004 columns separately — graceful fallback if not yet migrated
    try {
      const extra = await query(
        'SELECT profile_image, address, kyc_bonus_claimed FROM users WHERE id = ?', [req.user.id]);
      Object.assign(row, extra.rows[0] || {});
    } catch {}
    res.json(row);
  } catch (err) {
    console.error('Profile error:', err.message);
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

// Update profile
router.put('/profile', authenticate, async (req, res) => {
  const { phone, responsible_gaming, address } = req.body;
  await query(
    'UPDATE users SET phone = COALESCE(?, phone), address = COALESCE(?, address), responsible_gaming = COALESCE(?, responsible_gaming), updated_at = NOW() WHERE id = ?',
    [phone || null, address || null, responsible_gaming ? JSON.stringify(responsible_gaming) : null, req.user.id]
  );
  res.json({ message: 'Profile updated' });
});

// KYC Registration Bonus
// Bonuses: selfie=50, phone=30, location=20 (total 100 PHP)
const KYC_BONUS = { selfie: 50, phone: 30, location: 20 };

router.post('/kyc-bonus', authenticate, async (req, res) => {
  const { type, value } = req.body;
  if (!KYC_BONUS[type]) return res.status(400).json({ error: 'Invalid bonus type' });

  try {
    // Ensure columns exist (safe — idempotent)
    try { await query('ALTER TABLE users ADD COLUMN profile_image TEXT'); } catch {}
    try { await query('ALTER TABLE users ADD COLUMN address VARCHAR(500)'); } catch {}
    try { await query('ALTER TABLE users ADD COLUMN kyc_bonus_claimed JSON'); } catch {}

    const userResult = await query('SELECT kyc_bonus_claimed, profile_image, phone FROM users WHERE id = ?', [req.user.id]);
    const user = userResult.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });

    let claimed = {};
    if (user.kyc_bonus_claimed) {
      claimed = typeof user.kyc_bonus_claimed === 'string'
        ? JSON.parse(user.kyc_bonus_claimed)
        : user.kyc_bonus_claimed;
    }

    if (claimed[type]) return res.status(409).json({ error: 'Bonus already claimed for this step' });

    const updates = [];
    const params = [];

    if (type === 'selfie') {
      // value is either a base64 data URL or a URL string — store a flag, not the raw image
      updates.push('profile_image = ?');
      params.push(value ? 'kyc_selfie_verified' : 'kyc_selfie_verified');
    } else if (type === 'phone' && value) {
      updates.push('phone = ?');
      params.push(String(value).trim());
    } else if (type === 'location' && value) {
      updates.push('address = ?');
      params.push(typeof value === 'object' ? JSON.stringify(value) : String(value));
    }

    claimed[type] = true;
    updates.push('kyc_bonus_claimed = ?');
    params.push(JSON.stringify(claimed));
    updates.push('updated_at = NOW()');
    params.push(req.user.id);

    await query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);

    const amount = KYC_BONUS[type];
    await creditWallet(req.user.id, amount, 'kyc_bonus', `KYC bonus - ${type}`, null);

    await query(
      'INSERT INTO audit_logs (id, user_id, action, ip_address) VALUES (UUID(), ?, ?, ?)',
      [req.user.id, `kyc_bonus_${type}`, req.ip || '0.0.0.0']
    );

    const allClaimed = Object.keys(KYC_BONUS).every(k => claimed[k]);
    res.json({ message: `\u20b1${amount} bonus credited!`, amount, allClaimed, claimed });
  } catch (err) {
    console.error('KYC bonus error:', err.message, err.stack);
    res.status(500).json({ error: 'Failed to process bonus' });
  }
});

// Enable 2FA
router.post('/2fa/enable', authenticate, async (req, res) => {
  const secret = speakeasy.generateSecret({ name: `CasinoPlatform:${req.user.username}` });
  await query('UPDATE users SET two_factor_secret = ? WHERE id = ?', [secret.base32, req.user.id]);
  const qr = await qrcode.toDataURL(secret.otpauth_url);
  res.json({ secret: secret.base32, qrCode: qr });
});

router.post('/2fa/verify', authenticate, async (req, res) => {
  const user = await query('SELECT two_factor_secret FROM users WHERE id = ?', [req.user.id]);
  const verified = speakeasy.totp.verify({ secret: user.rows[0].two_factor_secret, encoding: 'base32', token: req.body.otp });
  if (!verified) return res.status(400).json({ error: 'Invalid OTP' });
  await query('UPDATE users SET two_factor_enabled = 1 WHERE id = ?', [req.user.id]);
  res.json({ message: '2FA enabled' });
});

// Logout
router.post('/logout', authenticate, async (req, res) => {
  await query('DELETE FROM sessions WHERE user_id = ? AND token = ?', [req.user.id, req.body.refreshToken]);
  res.json({ message: 'Logged out' });
});

module.exports = router;
