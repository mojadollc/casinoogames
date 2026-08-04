const express = require('express');
const path = require('path');
const multer = require('multer');
const { query } = require('../config/database');
const { authenticate, isAdmin } = require('../middleware/auth');
const { creditWallet } = require('../wallet/routes');

const thumbnailStorage = multer.diskStorage({
  destination: path.join(__dirname, '../uploads/thumbnails'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `game_${req.params.id}_${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage: thumbnailStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

const logoStorage = multer.diskStorage({
  destination: path.join(__dirname, '../uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `logo${ext}`);
  },
});
const uploadLogo = multer({
  storage: logoStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|png|webp|svg\+xml)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

const router = express.Router();
const adminAuth = [authenticate, isAdmin];

// Track connected socket users in memory
const onlineUsers = new Set();
const trackOnlineUsers = (io) => {
  io.on('connection', (socket) => {
    socket.on('join', (userId) => {
      onlineUsers.add(userId);
      socket.userId = userId;
    });
    socket.on('disconnect', () => {
      if (socket.userId) onlineUsers.delete(socket.userId);
    });
  });
};

// Dashboard stats
router.get('/dashboard', adminAuth, async (req, res) => {
  try {
    const safe = async (sql, fallback) => {
      try { return await query(sql); } catch { return fallback; }
    };

    // Money stats: only count successful (completed) money movement.
    // Pending/canceled/expired Xendit invoices must NOT inflate "Today Deposits".
    const [deposits, pendingDeposits, withdrawals, bets, wins, activeGames, totalDeposited] = await Promise.all([
      query("SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count FROM deposit_requests WHERE status = 'completed' AND created_at > NOW() - INTERVAL 1 DAY"),
      query("SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count FROM deposit_requests WHERE status = 'pending' AND created_at > NOW() - INTERVAL 1 DAY"),
      query("SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count FROM withdrawal_requests WHERE status IN ('completed','approved') AND created_at > NOW() - INTERVAL 1 DAY"),
      query("SELECT COALESCE(SUM(bet_amount), 0) as total, COUNT(*) as count FROM game_rounds WHERE created_at > NOW() - INTERVAL 1 DAY"),
      query("SELECT COALESCE(SUM(win_amount), 0) as total FROM game_rounds WHERE created_at > NOW() - INTERVAL 1 DAY"),
      query("SELECT COUNT(*) as count FROM games WHERE status = 'active'"),
      query("SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count FROM deposit_requests WHERE status = 'completed'")
    ]);

    // sessions.updated_at requires migration 007 — fall back to expires_at check
    const onlineRow = await safe(
      "SELECT COUNT(*) as count FROM sessions WHERE expires_at > NOW() AND updated_at > NOW() - INTERVAL 15 MINUTE",
      { rows: [{ count: 0 }] }
    );

    const totalBets = parseFloat(bets.rows[0].total);
    const totalWins = parseFloat(wins.rows[0].total);
    const dailyRevenue = totalBets - totalWins;
    const rtp = totalBets > 0 ? ((totalWins / totalBets) * 100).toFixed(2) : 0;

    res.json({
      onlinePlayers: onlineUsers.size || parseInt(onlineRow.rows[0].count),
      dailyRevenue: parseFloat(dailyRevenue.toFixed(2)),
      deposits: { total: parseFloat(deposits.rows[0].total), count: parseInt(deposits.rows[0].count) },
      pendingDeposits: { total: parseFloat(pendingDeposits.rows[0].total), count: parseInt(pendingDeposits.rows[0].count) },
      withdrawals: { total: parseFloat(withdrawals.rows[0].total), count: parseInt(withdrawals.rows[0].count) },
      bets: { total: totalBets, count: parseInt(bets.rows[0].count) },
      wins: totalWins,
      rtp: parseFloat(rtp),
      activeGames: parseInt(activeGames.rows[0].count),
      totalDeposited: { total: parseFloat(totalDeposited.rows[0].total), count: parseInt(totalDeposited.rows[0].count) }
    });
  } catch (err) {
    console.error('Dashboard error:', err.message, err.stack);
    res.status(500).json({ error: err.message });
  }
});

// Player management — show ALL non-admin users (not only role_id = 1)
router.get('/players', adminAuth, async (req, res) => {
  try {
    const { search, page = 1, limit = 20, kyc_status, status } = req.query;
    const offset = Math.max(0, (parseInt(page, 10) || 1) - 1) * (parseInt(limit, 10) || 20);
    const lim = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

    // Detect optional columns (migrations 004 / 008)
    let hasKycCols = true;
    let hasGeoCols = true;
    try {
      await query('SELECT profile_image, address, kyc_bonus_claimed FROM users LIMIT 1');
    } catch {
      hasKycCols = false;
    }
    try {
      await query('SELECT latitude, longitude, geocoded_address FROM users LIMIT 1');
    } catch {
      hasGeoCols = false;
    }

    const kycSelect = hasKycCols
      ? ', u.profile_image, u.address, u.kyc_bonus_claimed'
      : ', NULL as profile_image, NULL as address, NULL as kyc_bonus_claimed';
    const geoSelect = hasGeoCols
      ? ', u.latitude, u.longitude, u.geocoded_address'
      : ', NULL as latitude, NULL as longitude, NULL as geocoded_address';

    // Exclude admin / superadmin by role name (works even if role ids differ)
    // Also include users with NULL role_id or unknown roles so no player is hidden
    let where = `WHERE (
      u.role_id IS NULL
      OR u.role_id NOT IN (SELECT id FROM roles WHERE name IN ('admin', 'superadmin'))
      OR NOT EXISTS (SELECT 1 FROM roles r WHERE r.id = u.role_id AND r.name IN ('admin', 'superadmin'))
    )`;
    const params = [];

    const term = (search || '').trim();
    if (term) {
      if (hasKycCols) {
        where += ' AND (u.username LIKE ? OR u.email LIKE ? OR IFNULL(u.phone,\'\') LIKE ? OR IFNULL(u.address,\'\') LIKE ?)';
        const q = `%${term}%`;
        params.push(q, q, q, q);
      } else {
        where += ' AND (u.username LIKE ? OR u.email LIKE ? OR IFNULL(u.phone,\'\') LIKE ?)';
        const q = `%${term}%`;
        params.push(q, q, q);
      }
    }
    if (kyc_status) {
      where += ' AND u.kyc_status = ?';
      params.push(kyc_status);
    }
    if (status) {
      where += ' AND u.status = ?';
      params.push(status);
    }

    const sql = `SELECT u.id, u.username, u.email, u.phone, u.vip_level, u.kyc_status, u.status, u.created_at,
      u.role_id ${kycSelect}${geoSelect},
      COALESCE(w.balance, 0) as balance
      FROM users u
      LEFT JOIN wallets w ON w.user_id = u.id
      ${where}
      ORDER BY u.created_at DESC
      LIMIT ${lim} OFFSET ${offset}`;

    const countSql = `SELECT COUNT(*) as total FROM users u ${where}`;

    let result;
    let countResult;
    try {
      [result, countResult] = await Promise.all([
        query(sql, params),
        query(countSql, params),
      ]);
    } catch (primaryErr) {
      // Fallback: simplest query so the panel never stays empty
      console.error('Players primary query failed, using fallback:', primaryErr.message);
      const fallbackSql = `SELECT u.id, u.username, u.email, u.phone, u.vip_level, u.kyc_status, u.status, u.created_at,
        u.role_id, NULL as profile_image, NULL as address, NULL as kyc_bonus_claimed,
        NULL as latitude, NULL as longitude, NULL as geocoded_address,
        COALESCE(w.balance, 0) as balance
        FROM users u
        LEFT JOIN wallets w ON w.user_id = u.id
        WHERE u.role_id IS NULL OR u.role_id <= 1 OR u.role_id NOT IN (
          SELECT id FROM roles WHERE name IN ('admin', 'superadmin')
        )
        ORDER BY u.created_at DESC
        LIMIT ${lim} OFFSET ${offset}`;
      const fallbackCount = `SELECT COUNT(*) as total FROM users u
        WHERE u.role_id IS NULL OR u.role_id <= 1 OR u.role_id NOT IN (
          SELECT id FROM roles WHERE name IN ('admin', 'superadmin')
        )`;
      [result, countResult] = await Promise.all([
        query(fallbackSql, []),
        query(fallbackCount, []),
      ]);
    }

    const rows = (result.rows || []).map((r) => {
      let claimed = r.kyc_bonus_claimed;
      if (typeof claimed === 'string') {
        try { claimed = JSON.parse(claimed); } catch { claimed = {}; }
      }
      const lat = r.latitude != null ? parseFloat(r.latitude) : null;
      const lng = r.longitude != null ? parseFloat(r.longitude) : null;
      const img = r.profile_image;
      return {
        ...r,
        latitude: lat,
        longitude: lng,
        maps_url: (lat != null && lng != null) ? `https://www.google.com/maps?q=${lat},${lng}` : null,
        kyc_bonus_claimed: claimed || {},
        has_selfie: !!(img && img !== 'kyc_selfie_verified'),
        profile_image: img && String(img).startsWith('data:image/')
          ? img
          : (img === 'kyc_selfie_verified' ? null : img),
      };
    });

    res.json({ players: rows, total: parseInt(countResult.rows[0]?.total || 0, 10) });
  } catch (err) {
    console.error('Players error:', err.message, err.stack);
    res.status(500).json({ error: 'Failed to load players', detail: err.message });
  }
});

// Single player detail (full KYC + selfie + geocode)
router.get('/players/:id', adminAuth, async (req, res) => {
  try {
    let hasKycCols = true;
    let hasGeoCols = true;
    try {
      await query('SELECT profile_image, address, kyc_bonus_claimed FROM users LIMIT 1');
    } catch {
      hasKycCols = false;
    }
    try {
      await query('SELECT latitude, longitude, geocoded_address FROM users LIMIT 1');
    } catch {
      hasGeoCols = false;
    }
    const kycSelect = hasKycCols
      ? ', u.profile_image, u.address, u.kyc_bonus_claimed'
      : ', NULL as profile_image, NULL as address, NULL as kyc_bonus_claimed';
    const geoSelect = hasGeoCols
      ? ', u.latitude, u.longitude, u.geocoded_address'
      : ', NULL as latitude, NULL as longitude, NULL as geocoded_address';

    const result = await query(
      `SELECT u.id, u.username, u.email, u.phone, u.vip_level, u.kyc_status, u.status, u.created_at, u.updated_at
       ${kycSelect}${geoSelect},
       COALESCE(w.balance, 0) as balance, COALESCE(w.bonus_balance, 0) as bonus_balance
       FROM users u LEFT JOIN wallets w ON w.user_id = u.id
       WHERE u.id = ?
        AND (
          u.role_id IS NULL
          OR u.role_id NOT IN (SELECT id FROM roles WHERE name IN ('admin', 'superadmin'))
        )`,
      [req.params.id]
    );
    if (!result.rows?.length) return res.status(404).json({ error: 'Player not found' });
    const row = result.rows[0];
    let claimed = row.kyc_bonus_claimed;
    if (typeof claimed === 'string') {
      try { claimed = JSON.parse(claimed); } catch { claimed = {}; }
    }
    const lat = row.latitude != null ? parseFloat(row.latitude) : null;
    const lng = row.longitude != null ? parseFloat(row.longitude) : null;
    res.json({
      ...row,
      latitude: lat,
      longitude: lng,
      maps_url: (lat != null && lng != null) ? `https://www.google.com/maps?q=${lat},${lng}` : null,
      kyc_bonus_claimed: claimed || {},
      has_selfie: !!(row.profile_image && row.profile_image !== 'kyc_selfie_verified'),
    });
  } catch (err) {
    console.error('Player detail error:', err.message);
    res.status(500).json({ error: 'Failed to load player' });
  }
});

// Re-geocode a player's address (admin)
router.post('/players/:id/geocode', adminAuth, async (req, res) => {
  try {
    const { geocodeAddress, mapsLink } = require('../utils/geocode');
    try { await query('ALTER TABLE users ADD COLUMN latitude DECIMAL(10,7) NULL'); } catch {}
    try { await query('ALTER TABLE users ADD COLUMN longitude DECIMAL(10,7) NULL'); } catch {}
    try { await query('ALTER TABLE users ADD COLUMN geocoded_address VARCHAR(500) NULL'); } catch {}

    const result = await query(
      `SELECT id, address FROM users WHERE id = ?
       AND (role_id IS NULL OR role_id NOT IN (SELECT id FROM roles WHERE name IN ('admin', 'superadmin')))`,
      [req.params.id]
    );
    if (!result.rows?.length) return res.status(404).json({ error: 'Player not found' });
    const address = req.body?.address || result.rows[0].address;
    if (!address) return res.status(400).json({ error: 'No address to geocode' });

    const geo = await geocodeAddress(address);
    if (!geo) return res.status(422).json({ error: 'Could not geocode this address' });

    await query(
      'UPDATE users SET latitude = ?, longitude = ?, geocoded_address = ?, updated_at = NOW() WHERE id = ?',
      [geo.lat, geo.lng, geo.displayName.slice(0, 500), req.params.id]
    );

    res.json({
      message: 'Address geocoded',
      latitude: geo.lat,
      longitude: geo.lng,
      geocoded_address: geo.displayName,
      maps_url: mapsLink(geo.lat, geo.lng),
    });
  } catch (err) {
    console.error('Admin geocode error:', err.message);
    res.status(500).json({ error: 'Geocode failed' });
  }
});

router.put('/players/:id/status', adminAuth, async (req, res) => {
  const { status } = req.body;
  const allowed = ['active', 'suspended', 'banned', 'pending'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` });
  }
  await query('UPDATE users SET status = ?, updated_at = NOW() WHERE id = ?', [status, req.params.id]);
  await query('INSERT INTO admin_logs (id, admin_id, action, target_type, target_id, details) VALUES (UUID(), ?, ?, ?, ?, ?)',
    [req.user.id, 'update_status', 'user', req.params.id, JSON.stringify({ status })]);
  res.json({ message: 'Player status updated' });
});

router.put('/players/:id/kyc', adminAuth, async (req, res) => {
  const { kyc_status } = req.body;
  await query('UPDATE users SET kyc_status = ? WHERE id = ?', [kyc_status, req.params.id]);
  res.json({ message: 'KYC status updated' });
});

// Wallet management
router.get('/wallets', adminAuth, async (req, res) => {
  const result = await query(
    'SELECT w.*, u.username, u.email FROM wallets w JOIN users u ON u.id = w.user_id ORDER BY w.balance DESC LIMIT 100'
  );
  res.json(result.rows);
});

router.post('/wallets/adjust', adminAuth, async (req, res) => {
  try {
    const { userId, amount, reason } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    const value = parseFloat(amount);
    if (!Number.isFinite(value) || value === 0) {
      return res.status(400).json({ error: 'Valid non-zero amount is required' });
    }
    if (Math.abs(value) > 1_000_000) {
      return res.status(400).json({ error: 'Adjustment exceeds maximum (₱1,000,000)' });
    }
    if (value > 0) {
      await creditWallet(userId, value, 'admin_adjustment', reason || 'Admin credit', req.user.id);
    } else {
      const { debitWallet } = require('../wallet/routes');
      await debitWallet(userId, Math.abs(value), 'admin_adjustment', reason || 'Admin debit', req.user.id);
    }
    await query(
      'INSERT INTO admin_logs (id, admin_id, action, target_type, target_id, details) VALUES (UUID(), ?, ?, ?, ?, ?)',
      [req.user.id, 'wallet_adjustment', 'wallet', userId, JSON.stringify({ amount: value, reason })]
    );
    res.json({ message: 'Wallet adjusted' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Withdrawal approvals
router.get('/withdrawals', adminAuth, async (req, res) => {
  const { status = 'pending' } = req.query;
  const result = await query(
    'SELECT wr.*, u.username, u.email FROM withdrawal_requests wr JOIN users u ON u.id = wr.user_id WHERE wr.status = ? ORDER BY wr.created_at',
    [status]
  );
  res.json(result.rows);
});

router.post('/withdrawals/:id/approve', adminAuth, async (req, res) => {
  try {
    const wd = await query('SELECT * FROM withdrawal_requests WHERE id = ?', [req.params.id]);
    if (!wd.rows[0]) return res.status(404).json({ error: 'Withdrawal not found' });
    if (wd.rows[0].status !== 'pending') return res.status(400).json({ error: 'Withdrawal is not pending' });

    // Mark approved first (claim) to prevent double-approve
    await query(
      "UPDATE withdrawal_requests SET approved_by = ?, status = 'approved', updated_at = NOW() WHERE id = ? AND status = 'pending'",
      [req.user.id, req.params.id]
    );

    // Attempt Xendit payout when configured; stay on 'approved' if provider unavailable
    let payout = null;
    try {
      const { processPayout } = require('../payment/routes');
      if (process.env.XENDIT_SECRET_KEY) {
        payout = await processPayout(req.params.id);
      }
    } catch (payoutErr) {
      console.error('Payout processing error (withdrawal remains approved):', payoutErr.message);
    }

    await query(
      "UPDATE wallet_transactions SET description = 'Withdrawal approved' WHERE reference_id = ? AND type = 'withdrawal'",
      [req.params.id]
    );
    try {
      const io = require('../server').io;
      if (io) io.to(wd.rows[0].user_id).emit('wallet:update', { type: 'withdrawal_approved', amount: wd.rows[0].amount });
    } catch {}
    res.json({ message: 'Withdrawal approved', payout: payout ? 'submitted' : 'manual' });
  } catch (err) {
    console.error('Approve withdrawal error:', err);
    res.status(400).json({ error: err.message });
  }
});

router.post('/withdrawals/:id/reject', adminAuth, async (req, res) => {
  try {
    const wd = await query('SELECT * FROM withdrawal_requests WHERE id = ?', [req.params.id]);
    if (!wd.rows[0]) return res.status(404).json({ error: 'Withdrawal not found' });
    if (wd.rows[0].status !== 'pending') return res.status(400).json({ error: 'Withdrawal is not pending' });
    // Refund wallet since it was debited on submit
    await creditWallet(wd.rows[0].user_id, wd.rows[0].amount, 'refund', 'Withdrawal rejected - refund', req.params.id);
    await query('UPDATE withdrawal_requests SET status = \'rejected\', updated_at = NOW() WHERE id = ?', [req.params.id]);
    await query('UPDATE wallet_transactions SET description = \'Withdrawal rejected - refunded\' WHERE reference_id = ? AND type = \'withdrawal\'',
      [req.params.id]);
    // Notify user
    try {
      const io = require('../server').io;
      if (io) io.to(wd.rows[0].user_id).emit('wallet:update', { type: 'withdrawal_rejected', amount: wd.rows[0].amount });
    } catch {}
    res.json({ message: 'Withdrawal rejected and refunded' });
  } catch (err) {
    console.error('Reject withdrawal error:', err);
    res.status(400).json({ error: err.message });
  }
});

// Game configuration
router.get('/games', adminAuth, async (req, res) => {
  // Ensure every game has a game_controls row so win_rate is never defaulted by COALESCE
  await query(`
    INSERT IGNORE INTO game_controls (id, game_id, win_rate)
    SELECT UUID(), g.id, 25.00 FROM games g
    WHERE NOT EXISTS (SELECT 1 FROM game_controls gc WHERE gc.game_id = g.id)
  `);
  const result = await query(`
    SELECT g.*, gc.win_rate, gc.force_outcome, gc.min_payout, gc.max_payout, gc.payout_cap, gc.dry_run
    FROM games g
    LEFT JOIN game_controls gc ON gc.game_id = g.id
    ORDER BY g.created_at DESC
  `);
  res.json(result.rows);
});

router.post('/games', adminAuth, async (req, res) => {
  const { name, slug, type, config, rtp, min_bet, max_bet } = req.body;
  await query(
    'INSERT INTO games (id, name, slug, type, config, rtp, min_bet, max_bet) VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?)',
    [name, slug, type || 'slot', JSON.stringify(config || {}), rtp || 96, min_bet || 1, max_bet || 10000]
  );
  const result = await query('SELECT * FROM games WHERE slug = ?', [slug]);
  res.status(201).json(result.rows[0]);
});

router.put('/games/:id', adminAuth, async (req, res) => {
  const { status, config, min_bet, max_bet, rtp, name, thumbnail_url } = req.body;
  const fields = [];
  const params = [];
  if (status !== undefined)        { fields.push('status = ?');        params.push(status); }
  if (config !== undefined)        { fields.push('config = ?');        params.push(JSON.stringify(config)); }
  if (min_bet !== undefined)       { fields.push('min_bet = ?');       params.push(min_bet); }
  if (max_bet !== undefined)       { fields.push('max_bet = ?');       params.push(max_bet); }
  if (rtp !== undefined)           { fields.push('rtp = ?');           params.push(rtp); }
  if (name !== undefined)          { fields.push('name = ?');          params.push(name); }
  if (thumbnail_url !== undefined) { fields.push('thumbnail_url = ?'); params.push(thumbnail_url); }
  if (!fields.length) return res.json({ message: 'Nothing to update' });
  params.push(req.params.id);
  // Add thumbnail_url column if it doesn't exist yet (safe migration)
  try { await query('ALTER TABLE games ADD COLUMN thumbnail_url VARCHAR(500) NULL'); } catch {}
  await query(`UPDATE games SET ${fields.join(', ')} WHERE id = ?`, params);
  await query('INSERT INTO audit_logs (id, user_id, action, entity, entity_id, details) VALUES (UUID(),?,?,?,?,?)',
    [req.user.id, 'game_update', 'game', req.params.id, JSON.stringify(req.body)]);
  res.json({ message: 'Game updated' });
});

// Upload game thumbnail
router.post('/games/:id/thumbnail', adminAuth, upload.single('thumbnail'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const thumbnailUrl = `/uploads/thumbnails/${req.file.filename}`;
    try { await query('ALTER TABLE games ADD COLUMN thumbnail_url VARCHAR(500) NULL'); } catch {}
    await query('UPDATE games SET thumbnail_url = ? WHERE id = ?', [thumbnailUrl, req.params.id]);
    await query('INSERT INTO audit_logs (id, user_id, action, entity, entity_id, details) VALUES (UUID(),?,?,?,?,?)',
      [req.user.id, 'game_thumbnail_upload', 'game', req.params.id, JSON.stringify({ thumbnailUrl })]);
    res.json({ thumbnailUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Promotion management
router.get('/promotions', adminAuth, async (req, res) => {
  const result = await query('SELECT * FROM promotions ORDER BY created_at DESC');
  res.json(result.rows);
});

router.post('/promotions', adminAuth, async (req, res) => {
  const { name, type, description, config, start_date, end_date, max_claims } = req.body;
  await query(
    'INSERT INTO promotions (id, name, type, description, config, start_date, end_date, max_claims) VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?)',
    [name, type, description, JSON.stringify(config || {}), start_date || null, end_date || null, max_claims || null]
  );
  res.status(201).json({ message: 'Promotion created' });
});

// Reporting
router.get('/reports/revenue', adminAuth, async (req, res) => {
  const { period = '7d' } = req.query;
  const days = period === '30d' ? 30 : period === '24h' ? 1 : 7;
  const result = await query(`
    SELECT DATE(created_at) as date,
      SUM(CASE WHEN type = 'deposit' THEN amount ELSE 0 END) as deposits,
      SUM(CASE WHEN type = 'withdrawal' THEN ABS(amount) ELSE 0 END) as withdrawals,
      SUM(CASE WHEN type = 'bet' THEN ABS(amount) ELSE 0 END) as bets,
      SUM(CASE WHEN type = 'win' THEN amount ELSE 0 END) as wins
    FROM wallet_transactions WHERE created_at > NOW() - INTERVAL ${days} DAY
    GROUP BY DATE(created_at) ORDER BY date
  `);
  res.json(result.rows);
});

router.get('/reports/players', adminAuth, async (req, res) => {
  const result = await query(`
    SELECT DATE(created_at) as date, COUNT(*) as new_players
    FROM users WHERE created_at > NOW() - INTERVAL 30 DAY
    GROUP BY DATE(created_at) ORDER BY date
  `);
  res.json(result.rows);
});

// Audit logs
router.get('/audit-logs', adminAuth, async (req, res) => {
  const result = await query(
    'SELECT al.*, u.username FROM audit_logs al LEFT JOIN users u ON u.id = al.user_id ORDER BY al.created_at DESC LIMIT 100'
  );
  res.json(result.rows);
});

router.get('/roles', adminAuth, async (req, res) => {
  const result = await query('SELECT * FROM roles');
  res.json(result.rows);
});

// Platform settings (logo, etc.)
router.get('/settings', async (req, res) => {
  try {
    await query('CREATE TABLE IF NOT EXISTS platform_settings (`key` VARCHAR(100) PRIMARY KEY, value TEXT, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)');
    const result = await query('SELECT `key`, value FROM platform_settings');
    const settings = {};
    result.rows.forEach(r => { settings[r.key] = r.value; });
    res.json(settings);
  } catch (err) {
    console.error('settings GET error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/settings/logo', adminAuth, (req, res, next) => {
  const fs = require('fs');
  const uploadsDir = path.join(__dirname, '../uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  uploadLogo.single('logo')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File too large. Maximum size is 2MB.' });
      }
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const logoUrl = `/uploads/${req.file.filename}`;
    await query('CREATE TABLE IF NOT EXISTS platform_settings (`key` VARCHAR(100) PRIMARY KEY, value TEXT, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)');
    await query('INSERT INTO platform_settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = NOW()', ['logo_url', logoUrl]);
    try {
      await query('INSERT INTO audit_logs (id, user_id, action, entity, entity_id, details) VALUES (UUID(),?,?,?,?,?)',
        [req.user.id, 'logo_upload', 'platform', null, JSON.stringify({ logoUrl })]);
    } catch {} // audit log is non-critical
    res.json({ logoUrl });
  } catch (err) {
    console.error('logo upload error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
module.exports.trackOnlineUsers = trackOnlineUsers;
module.exports.onlineUsers = onlineUsers;
