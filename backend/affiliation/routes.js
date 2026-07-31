const express = require('express');
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

router.get('/my-code', authenticate, async (req, res) => {
  try {
    // Try to get referral_code column — may not exist on older MySQL
    let code = null;
    try {
      const result = await query('SELECT referral_code FROM users WHERE id = ?', [req.user.id]);
      code = result.rows[0]?.referral_code || null;
    } catch {
      // referral_code column doesn't exist yet — run backfill migration
    }

    if (!code) {
      // Try to add column if missing, then generate code
      try {
        await query('ALTER TABLE users ADD COLUMN referral_code VARCHAR(20) NULL');
      } catch {} // already exists — ignore

      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      do {
        code = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
        const existing = await query('SELECT id FROM users WHERE referral_code = ?', [code]);
        if (!existing.rows.length) break;
      } while (true);
      try {
        await query('UPDATE users SET referral_code = ? WHERE id = ?', [code, req.user.id]);
      } catch {}
    }

    const baseUrl = process.env.FRONTEND_URL || 'https://reelx.lazapee.ph';
    res.json({ code, link: `${baseUrl}/register?ref=${code}` });
  } catch (err) {
    console.error('my-code error:', err.message);
    res.status(500).json({ error: 'Failed to get referral code' });
  }
});

router.get('/my-affiliates', authenticate, async (req, res) => {
  try {
    const result = await query(`
      SELECT a.id, a.status, a.has_deposited, a.total_deposited, a.commission_earned, a.created_at,
        u.username, u.email
      FROM affiliations a JOIN users u ON u.id = a.referee_id
      WHERE a.referrer_id = ? ORDER BY a.created_at DESC
    `, [req.user.id]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Failed to get affiliates' }); }
});

router.get('/stats', authenticate, async (req, res) => {
  try {
    const result = await query(`
      SELECT COUNT(*) as total_referrals,
        SUM(CASE WHEN has_deposited = 1 THEN 1 ELSE 0 END) as deposited_count,
        SUM(CASE WHEN has_deposited = 0 THEN 1 ELSE 0 END) as not_deposited_count,
        COALESCE(SUM(total_deposited), 0) as total_deposited,
        COALESCE(SUM(commission_earned), 0) as total_commission
      FROM affiliations WHERE referrer_id = ?
    `, [req.user.id]);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Failed to get stats' }); }
});

router.get('/admin/all', authenticate, async (req, res) => {
  if (req.user.role_id < 2) return res.status(403).json({ error: 'Admin only' });
  try {
    const { page = 1, limit = 50, search } = req.query;
    const offset = (page - 1) * limit;
    let sql = `SELECT a.*, referrer.username as referrer_username, referrer.email as referrer_email,
      referee.username as referee_username, referee.email as referee_email
      FROM affiliations a JOIN users referrer ON referrer.id = a.referrer_id
      JOIN users referee ON referee.id = a.referee_id`;
    const params = [];
    if (search) {
      sql += ` WHERE referrer.username LIKE ? OR referrer.email LIKE ? OR referee.username LIKE ? OR referee.email LIKE ?`;
      const p = `%${search}%`; params.push(p, p, p, p);
    }
    sql += ` ORDER BY a.created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);
    const result = await query(sql, params);
    const countResult = await query(`SELECT COUNT(*) as total FROM affiliations`);
    res.json({ data: result.rows, total: countResult.rows[0].total });
  } catch (err) { res.status(500).json({ error: 'Failed to get affiliations' }); }
});

router.get('/admin/top-referrers', authenticate, async (req, res) => {
  if (req.user.role_id < 2) return res.status(403).json({ error: 'Admin only' });
  try {
    const result = await query(`
      SELECT u.id, u.username, u.email, u.referral_code, COUNT(a.id) as total_referrals,
        SUM(CASE WHEN a.has_deposited = 1 THEN 1 ELSE 0 END) as deposited_count,
        COALESCE(SUM(a.total_deposited), 0) as total_deposited
      FROM users u LEFT JOIN affiliations a ON a.referrer_id = u.id
      WHERE u.referral_code IS NOT NULL GROUP BY u.id ORDER BY total_referrals DESC LIMIT 50
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Failed to get top referrers' }); }
});

async function createAffiliation(refereeId, referralCode) {
  try {
    const referrer = await query('SELECT id FROM users WHERE referral_code = ?', [referralCode]);
    if (!referrer.rows[0]) {
      console.warn(`createAffiliation: referral code not found: ${referralCode}`);
      return null;
    }
    const referrerId = referrer.rows[0].id;
    if (referrerId === refereeId) return null; // prevent self-referral
    const id = uuidv4();
    await query(
      `INSERT INTO affiliations (id, referrer_id, referee_id, referral_code, status) VALUES (?, ?, ?, ?, 'registered')`,
      [id, referrerId, refereeId, referralCode]
    );
    await query('UPDATE users SET referred_by = ? WHERE id = ?', [referrerId, refereeId]);
    console.log(`Affiliation created: referrer=${referrerId} referee=${refereeId} code=${referralCode}`);
    return id;
  } catch (err) {
    console.error('createAffiliation error:', err.message);
    return null;
  }
}

const COMMISSION_RATE = 0.05; // 5% of deposit credited to referrer

async function updateAffiliationOnDeposit(userId, amount) {
  try {
    const aff = await query('SELECT referrer_id FROM affiliations WHERE referee_id = ?', [userId]);
    if (!aff.rows[0]) return;
    const commission = parseFloat((amount * COMMISSION_RATE).toFixed(2));
    await query(
      `UPDATE affiliations SET has_deposited = 1, total_deposited = total_deposited + ?, commission_earned = commission_earned + ?, status = 'deposited', updated_at = NOW() WHERE referee_id = ?`,
      [amount, commission, userId]
    );
    if (commission > 0) {
      const { creditWallet } = require('../wallet/routes');
      await creditWallet(aff.rows[0].referrer_id, commission, 'commission', `Referral commission from deposit`, userId);
    }
  } catch (err) {
    console.error('updateAffiliationOnDeposit error:', err.message);
  }
}

module.exports = { router, createAffiliation, updateAffiliationOnDeposit };
