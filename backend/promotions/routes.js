const express = require('express');
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { creditWallet } = require('../wallet/routes');
const { SecureRNG } = require('../../game-engine/engine');

const router = express.Router();
const rng = new SecureRNG();

// Get active promotions
router.get('/', authenticate, async (req, res) => {
  const result = await query(
    "SELECT id, name, type, description, config, start_date, end_date FROM promotions WHERE status = 'active' AND (end_date IS NULL OR end_date > NOW())"
  );
  res.json(result.rows);
});

// Claim daily login bonus
router.post('/daily-login', authenticate, async (req, res) => {
  try {
    const existing = await query(
      "SELECT id FROM promotion_rewards WHERE user_id = ? AND type = 'daily_login' AND created_at > DATE_SUB(NOW(), INTERVAL 1 DAY)",
      [req.user.id]
    );
    if (existing.rows.length) return res.status(400).json({ error: 'Already claimed today' });

    const bonus = 10;
    await creditWallet(req.user.id, bonus, 'bonus', 'Daily login bonus', 'daily_login');
    await query("INSERT INTO promotion_rewards (id, user_id, amount, type) VALUES (UUID(), ?, ?, 'daily_login')", [req.user.id, bonus]);
    res.json({ message: 'Daily bonus claimed', amount: bonus });
  } catch (err) {
    console.error('Daily login error:', err.message);
    res.status(500).json({ error: 'Failed to claim daily bonus' });
  }
});

// Cashback (weekly)
router.post('/cashback', authenticate, async (req, res) => {
  try {
    const existing = await query(
      "SELECT id FROM promotion_rewards WHERE user_id = ? AND type = 'cashback' AND created_at > DATE_SUB(NOW(), INTERVAL 1 WEEK)",
      [req.user.id]
    );
    if (existing.rows.length) return res.status(400).json({ error: 'Cashback already claimed this week' });

    const losses = await query(
      "SELECT COALESCE(SUM(bet_amount) - SUM(win_amount), 0) as net_loss FROM game_rounds WHERE user_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 WEEK)",
      [req.user.id]
    );
    const netLoss = parseFloat(losses.rows[0].net_loss);
    if (netLoss <= 0) return res.status(400).json({ error: 'No losses to cashback' });

    const cashback = parseFloat((netLoss * 0.05).toFixed(2));
    await creditWallet(req.user.id, cashback, 'bonus', 'Weekly cashback', 'cashback');
    await query("INSERT INTO promotion_rewards (id, user_id, amount, type) VALUES (UUID(), ?, ?, 'cashback')", [req.user.id, cashback]);
    res.json({ message: 'Cashback claimed', amount: cashback });
  } catch (err) {
    console.error('Cashback error:', err.message);
    res.status(500).json({ error: 'Failed to claim cashback' });
  }
});

// Lucky draw (hourly random ₱100 bonus)
const runLuckyDraw = async () => {
  try {
    const eligible = await query(
      "SELECT DISTINCT user_id FROM game_rounds WHERE created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)"
    );
    if (!eligible.rows.length) return;
    const winner = eligible.rows[rng.generate(0, eligible.rows.length - 1)];
    await creditWallet(winner.user_id, 100, 'bonus', 'Lucky draw winner', 'lucky_draw');
    await query("INSERT INTO promotion_rewards (id, user_id, amount, type) VALUES (UUID(), ?, 100, 'lucky_draw')", [winner.user_id]);
    await query(
      "INSERT INTO notifications (id, user_id, type, title, message) VALUES (UUID(), ?, 'reward', 'Lucky Draw Winner!', 'You won ₱100 in the hourly lucky draw!')",
      [winner.user_id]
    );
  } catch (err) {
    console.error('Lucky draw error:', err.message);
  }
};

// Leaderboard
router.get('/leaderboard', authenticate, async (req, res) => {
  const result = await query(`
    SELECT u.username, SUM(gr.win_amount) as total_wins, COUNT(*) as total_spins
    FROM game_rounds gr JOIN users u ON u.id = gr.user_id
    WHERE gr.created_at > DATE_SUB(NOW(), INTERVAL 1 WEEK)
    GROUP BY u.id, u.username ORDER BY total_wins DESC LIMIT 20
  `);
  res.json(result.rows);
});

module.exports = { router, runLuckyDraw };
