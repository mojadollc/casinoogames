const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const { query } = require('../config/database');
const { authenticate, authLimiter, registerLimiter, refreshLimiter } = require('../middleware/auth');
const { realIp } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { createAffiliation } = require('../affiliation/routes');
const { creditWallet } = require('../wallet/routes');
const { geocodeAddress, reverseGeocode, parseCoords, mapsLink } = require('../utils/geocode');

const router = express.Router();

const DUMMY_HASH = '$2a$12$KIXBp/dummy.hash.to.prevent.timing.oracle.on.missing.user';

const assertJwtConfig = () => {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters');
  }
  if (!process.env.JWT_REFRESH_SECRET || process.env.JWT_REFRESH_SECRET.length < 32) {
    throw new Error('JWT_REFRESH_SECRET must be at least 32 characters');
  }
  if (!process.env.JWT_EXPIRES_IN || !process.env.JWT_REFRESH_EXPIRES_IN) {
    throw new Error('JWT expiry env vars are not configured');
  }
};

// Sanitize helpers
const sanitizeUsername = (u) => u?.trim().replace(/[^a-zA-Z0-9_]/g, '').slice(0, 50);
const isStrongPassword = (p) => p && p.length >= 8 && /[A-Z]/.test(p) && /[0-9]/.test(p);

// Register
router.post('/register', registerLimiter, [
  body('username').isLength({ min: 3, max: 50 }).trim(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid input. Check username (3-50 chars), email, and password (min 8 chars).' });

  const rawUsername = req.body.username;
  const username = sanitizeUsername(rawUsername);
  if (!username || username.length < 3) {
    return res.status(400).json({ error: 'Username must be 3-50 characters and contain only letters, numbers, or underscores.' });
  }

  const { email, password, phone, ref } = req.body;

  if (!isStrongPassword(password)) {
    return res.status(400).json({ error: 'Password must be at least 8 characters and include one uppercase letter and one number.' });
  }

  try {
    assertJwtConfig();
    const existing = await query('SELECT id FROM users WHERE email = ? OR username = ?', [email, username]);
    if (existing.rows.length) return res.status(409).json({ error: 'User already exists' });

    const id = uuidv4();
    const password_hash = await bcrypt.hash(password, 12);
    let referral_code;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    do {
      referral_code = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      const dup = await query('SELECT id FROM users WHERE referral_code = ?', [referral_code]);
      if (!dup.rows.length) break;
    } while (true);

    await query(
      'INSERT INTO users (id, username, email, password_hash, phone, referral_code) VALUES (?, ?, ?, ?, ?, ?)',
      [id, username, email, password_hash, phone ? String(phone).slice(0, 20) : null, referral_code]
    );
    await query('INSERT INTO wallets (id, user_id) VALUES (UUID(), ?)', [id]);
    if (ref) await createAffiliation(id, ref).catch(() => {});

    const token = jwt.sign({ userId: id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });
    const refreshToken = jwt.sign({ userId: id }, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN });
    await query(
      'INSERT INTO sessions (id, user_id, token, ip_address, user_agent, expires_at) VALUES (?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))',
      [uuidv4(), id, refreshToken, realIp(req), String(req.headers['user-agent'] || '').slice(0, 255)]
    );
    res.status(201).json({ user: { id, username, email, referral_code }, token, refreshToken });
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', authLimiter, [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty().isLength({ max: 128 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid email or password format' });

  const { email, password, otp } = req.body;
  try {
    assertJwtConfig();
    const result = await query(
      'SELECT id, username, email, password_hash, status, two_factor_enabled, two_factor_secret, vip_level, role_id, failed_login_attempts, locked_until FROM users WHERE email = ?',
      [email]
    );
    const user = result.rows[0];

    // Always run bcrypt to prevent timing oracle — use dummy hash if user not found
    const hashToCheck = user?.password_hash || DUMMY_HASH;
    const match = await bcrypt.compare(password, hashToCheck);

    if (!user || !match) {
      // Increment failed attempts if user exists
      if (user) {
        const attempts = (user.failed_login_attempts || 0) + 1;
        const lockUntil = attempts >= 5
          ? new Date(Date.now() + 15 * 60 * 1000)  // lock 15 min after 5 failures
          : null;
        await query(
          'UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?',
          [attempts, lockUntil, user.id]
        ).catch(() => {});
      }
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check account lock
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const mins = Math.ceil((new Date(user.locked_until) - Date.now()) / 60000);
      return res.status(423).json({ error: `Account temporarily locked. Try again in ${mins} minute(s).` });
    }

    if (user.status !== 'active') return res.status(403).json({ error: 'Account suspended' });

    if (user.two_factor_enabled) {
      if (!otp) return res.status(200).json({ requires2FA: true });
      const verified = speakeasy.totp.verify({
        secret: user.two_factor_secret,
        encoding: 'base32',
        token: String(otp).replace(/\s/g, ''),
        window: 1,
      });
      if (!verified) return res.status(401).json({ error: 'Invalid OTP' });
    }

    // Reset failed attempts on success
    await query(
      'UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?',
      [user.id]
    ).catch(() => {});

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });
    const refreshToken = jwt.sign({ userId: user.id }, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN });
    await query(
      'INSERT INTO sessions (id, user_id, token, ip_address, user_agent, expires_at) VALUES (?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))',
      [uuidv4(), user.id, refreshToken, realIp(req), String(req.headers['user-agent'] || '').slice(0, 255)]
    );
    await query('INSERT INTO audit_logs (id, user_id, action, ip_address) VALUES (UUID(),?,?,?)',
      [user.id, 'login', realIp(req)]);

    res.json({ user: { id: user.id, username: user.username, email: user.email, vip_level: user.vip_level, role_id: user.role_id }, token, refreshToken });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Refresh token
router.post('/refresh', refreshLimiter, async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'refreshToken is required' });
  try {
    assertJwtConfig();
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
    try { await query('ALTER TABLE users ADD COLUMN latitude DECIMAL(10,7) NULL'); } catch {}
    try { await query('ALTER TABLE users ADD COLUMN longitude DECIMAL(10,7) NULL'); } catch {}
    try { await query('ALTER TABLE users ADD COLUMN geocoded_address VARCHAR(500) NULL'); } catch {}

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
    let geoResult = null;

    if (type === 'selfie') {
      // Store actual selfie (base64 data URL). Cap size to avoid huge rows (~400KB).
      if (!value || typeof value !== 'string') {
        return res.status(400).json({ error: 'Selfie image is required' });
      }
      if (value.length > 550000) {
        return res.status(400).json({ error: 'Selfie image is too large (max ~400KB). Please retake a smaller photo.' });
      }
      if (!value.startsWith('data:image/') && value !== 'verified') {
        return res.status(400).json({ error: 'Invalid selfie image format' });
      }
      updates.push('profile_image = ?');
      params.push(value === 'verified' ? 'kyc_selfie_verified' : value);
    } else if (type === 'phone' && value) {
      updates.push('phone = ?');
      params.push(String(value).trim());
    } else if (type === 'location' && value) {
      let addr = '';
      let clientCoords = null;

      if (typeof value === 'object' && value !== null) {
        addr = value.address ? String(value.address).trim() : '';
        if (value.coords) clientCoords = parseCoords(String(value.coords));
        if (value.lat != null && value.lng != null) {
          clientCoords = { lat: parseFloat(value.lat), lng: parseFloat(value.lng) };
        }
      } else {
        addr = String(value).trim();
        // If user pasted pure coords as address
        clientCoords = parseCoords(addr);
      }

      if (!addr && !clientCoords) {
        return res.status(400).json({ error: 'Address is required' });
      }

      // Prefer typed address for storage; fall back to reverse-geocoded label
      let storeAddress = addr;
      let lat = clientCoords?.lat ?? null;
      let lng = clientCoords?.lng ?? null;
      let geocodedLabel = null;

      // 1) If we only have coords → reverse geocode
      if ((!storeAddress || clientCoords) && clientCoords) {
        const rev = await reverseGeocode(clientCoords.lat, clientCoords.lng);
        if (rev) {
          lat = rev.lat;
          lng = rev.lng;
          geocodedLabel = rev.displayName;
          if (!storeAddress) storeAddress = rev.displayName;
        }
      }

      // 2) Forward geocode typed address (always try so admin gets map pin)
      if (storeAddress) {
        geoResult = await geocodeAddress(storeAddress);
        if (geoResult) {
          // Prefer geocoded coords unless client GPS was provided
          if (lat == null || lng == null) {
            lat = geoResult.lat;
            lng = geoResult.lng;
          }
          geocodedLabel = geoResult.displayName;
        }
      }

      if (!storeAddress) {
        return res.status(400).json({ error: 'Address is required' });
      }

      updates.push('address = ?');
      params.push(storeAddress.slice(0, 500));

      if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
        updates.push('latitude = ?', 'longitude = ?');
        params.push(lat, lng);
      }
      if (geocodedLabel) {
        updates.push('geocoded_address = ?');
        params.push(String(geocodedLabel).slice(0, 500));
      }
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
    const payload = { message: `\u20b1${amount} bonus credited!`, amount, allClaimed, claimed };
    if (type === 'location' && geoResult) {
      payload.geocoded = {
        lat: geoResult.lat,
        lng: geoResult.lng,
        displayName: geoResult.displayName,
        mapsUrl: mapsLink(geoResult.lat, geoResult.lng),
      };
    }
    res.json(payload);
  } catch (err) {
    console.error('KYC bonus error:', err.message, err.stack);
    res.status(500).json({ error: 'Failed to process bonus' });
  }
});

// Change Password
router.put('/change-password', authenticate, [
  body('current_password').notEmpty(),
  body('new_password').isLength({ min: 8 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'New password must be at least 8 characters' });
  const { current_password, new_password } = req.body;
  try {
    const result = await query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    const match = await bcrypt.compare(current_password, result.rows[0].password_hash);
    if (!match) return res.status(401).json({ error: 'Current password is incorrect' });
    const hash = await bcrypt.hash(new_password, 12);
    await query('UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?', [hash, req.user.id]);
    await query('INSERT INTO audit_logs (id, user_id, action, ip_address) VALUES (UUID(),?,?,?)', [req.user.id, 'change_password', req.ip]);
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Change Username
router.put('/change-username', authenticate, [
  body('username').isLength({ min: 3, max: 50 }).trim(),
  body('password').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Username must be 3–50 characters' });
  const { username, password } = req.body;
  try {
    const result = await query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    const match = await bcrypt.compare(password, result.rows[0].password_hash);
    if (!match) return res.status(401).json({ error: 'Password is incorrect' });
    const existing = await query('SELECT id FROM users WHERE username = ? AND id != ?', [username, req.user.id]);
    if (existing.rows.length) return res.status(409).json({ error: 'Username already taken' });
    await query('UPDATE users SET username = ?, updated_at = NOW() WHERE id = ?', [username, req.user.id]);
    await query('INSERT INTO audit_logs (id, user_id, action, ip_address) VALUES (UUID(),?,?,?)', [req.user.id, 'change_username', req.ip]);
    res.json({ message: 'Username updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to change username' });
  }
});

// Change Email
router.put('/change-email', authenticate, [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid email format' });
  const { email, password } = req.body;
  try {
    const result = await query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    const match = await bcrypt.compare(password, result.rows[0].password_hash);
    if (!match) return res.status(401).json({ error: 'Password is incorrect' });
    const existing = await query('SELECT id FROM users WHERE email = ? AND id != ?', [email, req.user.id]);
    if (existing.rows.length) return res.status(409).json({ error: 'Email already in use' });
    await query('UPDATE users SET email = ?, updated_at = NOW() WHERE id = ?', [email, req.user.id]);
    await query('INSERT INTO audit_logs (id, user_id, action, ip_address) VALUES (UUID(),?,?,?)', [req.user.id, 'change_email', req.ip]);
    res.json({ message: 'Email updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to change email' });
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
