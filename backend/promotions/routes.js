const express = require('express');
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { creditWallet } = require('../wallet/routes');
const { SecureRNG } = require('../../game-engine/engine');

const router = express.Router();
const rng = new SecureRNG();

const DAILY_LOGIN_BONUS = 10;
const CASHBACK_RATE = 0.05;
const CASHBACK_MAX = 5000; // ₱5,000 max per claim
const REFERRAL_BONUS = 50; // both parties
const LUCKY_DRAW_PRIZE = 100;

// Get active promotions
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await query(
      "SELECT id, name, type, description, config, start_date, end_date FROM promotions WHERE status = 'active' AND (end_date IS NULL OR end_date > NOW())"
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Promotions list error:', err.message);
    res.status(500).json({ error: 'Failed to load promotions' });
  }
});

// Claim daily login bonus
router.post('/daily-login', authenticate, async (req, res) => {
  try {
    const existing = await query(
      "SELECT id FROM promotion_rewards WHERE user_id = ? AND type = 'daily_login' AND created_at > DATE_SUB(NOW(), INTERVAL 1 DAY)",
      [req.user.id]
    );
    if (existing.rows.length) {
      return res.status(400).json({ error: 'Already claimed today' });
    }

    await creditWallet(req.user.id, DAILY_LOGIN_BONUS, 'bonus', 'Daily login bonus', 'daily_login');
    await query(
      "INSERT INTO promotion_rewards (id, user_id, amount, type) VALUES (UUID(), ?, ?, 'daily_login')",
      [req.user.id, DAILY_LOGIN_BONUS]
    );
    res.json({ message: 'Daily bonus claimed', amount: DAILY_LOGIN_BONUS });
  } catch (err) {
    console.error('Daily login error:', err.message);
    res.status(500).json({ error: 'Failed to claim daily bonus' });
  }
});

// Weekly cashback (5% of net losses, capped)
router.post('/cashback', authenticate, async (req, res) => {
  try {
    const existing = await query(
      "SELECT id FROM promotion_rewards WHERE user_id = ? AND type = 'cashback' AND created_at > DATE_SUB(NOW(), INTERVAL 1 WEEK)",
      [req.user.id]
    );
    if (existing.rows.length) {
      return res.status(400).json({ error: 'Cashback already claimed this week' });
    }

    const losses = await query(
      `SELECT COALESCE(SUM(bet_amount), 0) as total_bet, COALESCE(SUM(win_amount), 0) as total_win
       FROM game_rounds WHERE user_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 WEEK)`,
      [req.user.id]
    );
    const totalBet = parseFloat(losses.rows[0].total_bet) || 0;
    const totalWin = parseFloat(losses.rows[0].total_win) || 0;
    const netLoss = totalBet - totalWin;
    if (netLoss <= 0) {
      return res.status(400).json({ error: 'No losses to cashback' });
    }

    let cashback = parseFloat((netLoss * CASHBACK_RATE).toFixed(2));
    if (cashback > CASHBACK_MAX) cashback = CASHBACK_MAX;

    await creditWallet(req.user.id, cashback, 'bonus', 'Weekly cashback', 'cashback');
    await query(
      "INSERT INTO promotion_rewards (id, user_id, amount, type) VALUES (UUID(), ?, ?, 'cashback')",
      [req.user.id, cashback]
    );
    res.json({ message: 'Cashback claimed', amount: cashback, netLoss });
  } catch (err) {
    console.error('Cashback error:', err.message);
    res.status(500).json({ error: 'Failed to claim cashback' });
  }
});

// One-time referral signup bonus (both parties get ₱50)
// Note: deposit commissions are handled separately in affiliation/updateAffiliationOnDeposit
router.post('/referral', authenticate, async (req, res) => {
  try {
    const { referral_code } = req.body;
    if (!referral_code || String(referral_code).trim().length < 4) {
      return res.status(400).json({ error: 'Valid referral_code is required' });
    }
    const code = String(referral_code).trim().toUpperCase();

    // Already claimed referral bonus?
    const existing = await query(
      "SELECT id FROM promotion_rewards WHERE user_id = ? AND type = 'referral_bonus'",
      [req.user.id]
    );
    if (existing.rows.length) {
      return res.status(400).json({ error: 'Referral bonus already claimed' });
    }

    // Already referred via registration?
    const me = await query('SELECT referred_by, referral_code FROM users WHERE id = ?', [req.user.id]);
    if (me.rows[0]?.referred_by) {
      // Still allow one-time bonus if not claimed, using existing referrer
    }

    const referrer = await query(
      'SELECT id, username FROM users WHERE referral_code = ? AND id != ?',
      [code, req.user.id]
    );
    if (!referrer.rows[0]) {
      return res.status(404).json({ error: 'Referral code not found' });
    }

    // Ensure affiliation record exists
    const aff = await query('SELECT id FROM affiliations WHERE referee_id = ?', [req.user.id]);
    if (!aff.rows[0]) {
      const { createAffiliation } = require('../affiliation/routes');
      await createAffiliation(req.user.id, code);
    }

    // Credit both parties
    await creditWallet(req.user.id, REFERRAL_BONUS, 'bonus', 'Referral signup bonus', referrer.rows[0].id);
    await creditWallet(
      referrer.rows[0].id,
      REFERRAL_BONUS,
      'bonus',
      `Referral bonus for inviting ${req.user.username}`,
      req.user.id
    );

    await query(
      "INSERT INTO promotion_rewards (id, user_id, amount, type) VALUES (UUID(), ?, ?, 'referral_bonus')",
      [req.user.id, REFERRAL_BONUS]
    );
    await query(
      "INSERT INTO promotion_rewards (id, user_id, amount, type) VALUES (UUID(), ?, ?, 'referral_invite_bonus')",
      [referrer.rows[0].id, REFERRAL_BONUS]
    );

    res.json({
      message: 'Referral bonus claimed',
      amount: REFERRAL_BONUS,
      referrer: referrer.rows[0].username,
    });
  } catch (err) {
    console.error('Referral bonus error:', err.message);
    res.status(500).json({ error: 'Failed to claim referral bonus' });
  }
});

// Lucky draw (hourly random prize to an active spinner)
const runLuckyDraw = async () => {
  try {
    const eligible = await query(
      `SELECT DISTINCT user_id FROM game_rounds
       WHERE created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)
       AND user_id NOT IN (
         SELECT user_id FROM promotion_rewards
         WHERE type = 'lucky_draw' AND created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
       )`
    );
    if (!eligible.rows.length) return;

    const winner = eligible.rows[rng.generate(0, eligible.rows.length - 1)];
    await creditWallet(winner.user_id, LUCKY_DRAW_PRIZE, 'bonus', 'Lucky draw winner', 'lucky_draw');
    await query(
      "INSERT INTO promotion_rewards (id, user_id, amount, type) VALUES (UUID(), ?, ?, 'lucky_draw')",
      [winner.user_id, LUCKY_DRAW_PRIZE]
    );
    try {
      await query(
        "INSERT INTO notifications (id, user_id, type, title, message) VALUES (UUID(), ?, 'reward', 'Lucky Draw Winner!', 'You won ₱100 in the hourly lucky draw!')",
        [winner.user_id]
      );
    } catch {
      // notifications table optional
    }
    console.log(`Lucky draw winner: ${winner.user_id}`);
  } catch (err) {
    console.error('Lucky draw error:', err.message);
  }
};

// Leaderboard
router.get('/leaderboard', authenticate, async (req, res) => {
  try {
    const result = await query(`
      SELECT u.username, SUM(gr.win_amount) as total_wins, COUNT(*) as total_spins
      FROM game_rounds gr JOIN users u ON u.id = gr.user_id
      WHERE gr.created_at > DATE_SUB(NOW(), INTERVAL 1 WEEK) AND u.role_id = 1
      GROUP BY u.id, u.username ORDER BY total_wins DESC LIMIT 20
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Leaderboard error:', err.message);
    res.status(500).json({ error: 'Failed to load leaderboard' });
  }
});

module.exports = { router, runLuckyDraw };
