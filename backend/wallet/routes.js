const express = require('express');
const { query, getClient } = require('../config/database');
const { authenticate, isAdmin } = require('../middleware/auth');

const router = express.Router();

const parseAmount = (amount) => {
  const n = parseFloat(amount);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error('Invalid amount');
  }
  // Cap single operation at 10M to avoid overflow abuse
  if (n > 10_000_000) {
    throw new Error('Amount exceeds maximum allowed');
  }
  return Math.round(n * 100) / 100; // 2 decimal places
};

router.get('/balance', authenticate, async (req, res) => {
  try {
    const result = await query(
      'SELECT balance, bonus_balance, currency FROM wallets WHERE user_id = ?',
      [req.user.id]
    );
    if (!result.rows[0]) {
      // Auto-create wallet if missing (legacy users)
      await query('INSERT INTO wallets (id, user_id) VALUES (UUID(), ?)', [req.user.id]);
      return res.json({ balance: 0, bonus_balance: 0, currency: 'PHP' });
    }
    res.json({
      balance: parseFloat(result.rows[0].balance) || 0,
      bonus_balance: parseFloat(result.rows[0].bonus_balance) || 0,
      currency: result.rows[0].currency || 'PHP',
    });
  } catch (err) {
    console.error('Balance error:', err.message);
    res.status(500).json({ error: 'Failed to load balance' });
  }
});

router.get('/transactions', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 20, type } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    let sql = 'SELECT * FROM wallet_transactions WHERE user_id = ?';
    let countSql = 'SELECT COUNT(*) as total FROM wallet_transactions WHERE user_id = ?';
    const params = [req.user.id];
    const countParams = [req.user.id];
    if (type) {
      sql += ' AND type LIKE ?';
      params.push(type + '%');
      countSql += ' AND type LIKE ?';
      countParams.push(type + '%');
    }
    sql += ` ORDER BY created_at DESC LIMIT ${limitNum} OFFSET ${offset}`;

    const [result, count] = await Promise.all([
      query(sql, params),
      query(countSql, countParams),
    ]);
    res.json({
      transactions: result.rows,
      total: parseInt(count.rows[0]?.total || 0, 10),
      page: pageNum,
      limit: limitNum,
    });
  } catch (err) {
    console.error('Transactions error:', err.message);
    res.status(500).json({ error: 'Failed to load transactions' });
  }
});

const emitWalletUpdate = (userId, balance, type, amount, description) => {
  try {
    const { io } = require('../server');
    if (io) {
      io.to(userId).emit('wallet:update', {
        balance,
        type,
        amount,
        description,
        timestamp: new Date(),
      });
    }
  } catch {
    // Socket optional
  }
};

const creditWallet = async (userId, amount, type, description, referenceId) => {
  const value = parseAmount(amount);
  const client = await getClient();
  try {
    await client.BEGIN();
    const wallet = await client.query(
      'SELECT id, balance FROM wallets WHERE user_id = ? FOR UPDATE',
      [userId]
    );
    if (!wallet.rows[0]) {
      // Create wallet if missing
      await client.query('INSERT INTO wallets (id, user_id, balance) VALUES (UUID(), ?, 0)', [userId]);
      const created = await client.query(
        'SELECT id, balance FROM wallets WHERE user_id = ? FOR UPDATE',
        [userId]
      );
      wallet.rows[0] = created.rows[0];
    }
    const before = parseFloat(wallet.rows[0].balance) || 0;
    const newBalance = Math.round((before + value) * 100) / 100;
    await client.query(
      'UPDATE wallets SET balance = ?, updated_at = NOW() WHERE user_id = ?',
      [newBalance, userId]
    );
    await client.query(
      'INSERT INTO wallet_transactions (id, wallet_id, user_id, type, amount, balance_before, balance_after, reference_id, description) VALUES (UUID(),?,?,?,?,?,?,?,?)',
      [wallet.rows[0].id, userId, type, value, before, newBalance, referenceId || null, description || null]
    );
    await client.COMMIT();
    emitWalletUpdate(userId, newBalance, type, value, description);
    return { balance: newBalance };
  } catch (err) {
    await client.ROLLBACK();
    throw err;
  } finally {
    client.release();
  }
};

const debitWallet = async (userId, amount, type, description, referenceId) => {
  const value = parseAmount(amount);
  const client = await getClient();
  try {
    await client.BEGIN();
    const wallet = await client.query(
      'SELECT id, balance FROM wallets WHERE user_id = ? FOR UPDATE',
      [userId]
    );
    if (!wallet.rows[0]) throw new Error('Wallet not found');
    const before = parseFloat(wallet.rows[0].balance) || 0;
    if (before < value) throw new Error('Insufficient balance');
    const newBalance = Math.round((before - value) * 100) / 100;
    await client.query(
      'UPDATE wallets SET balance = ?, updated_at = NOW() WHERE user_id = ?',
      [newBalance, userId]
    );
    await client.query(
      'INSERT INTO wallet_transactions (id, wallet_id, user_id, type, amount, balance_before, balance_after, reference_id, description) VALUES (UUID(),?,?,?,?,?,?,?,?)',
      [wallet.rows[0].id, userId, type, -value, before, newBalance, referenceId || null, description || null]
    );
    await client.COMMIT();
    emitWalletUpdate(userId, newBalance, type, -value, description);
    return { balance: newBalance };
  } catch (err) {
    await client.ROLLBACK();
    throw err;
  } finally {
    client.release();
  }
};

// Wallet summary: winnings today, total winnings, total bets
router.get('/summary', authenticate, async (req, res) => {
  try {
    const [todayWin, totalWin, totalBet] = await Promise.all([
      query(
        "SELECT COALESCE(SUM(amount),0) AS total FROM wallet_transactions WHERE user_id = ? AND type IN ('win','free_spin_win','jackpot') AND DATE(created_at) = CURDATE()",
        [req.user.id]
      ),
      query(
        "SELECT COALESCE(SUM(amount),0) AS total FROM wallet_transactions WHERE user_id = ? AND type IN ('win','free_spin_win','jackpot')",
        [req.user.id]
      ),
      query(
        "SELECT COALESCE(SUM(ABS(amount)),0) AS total FROM wallet_transactions WHERE user_id = ? AND type = 'bet'",
        [req.user.id]
      ),
    ]);
    res.json({
      winnings_today: parseFloat(todayWin.rows[0].total) || 0,
      winnings_total: parseFloat(totalWin.rows[0].total) || 0,
      bets_total: parseFloat(totalBet.rows[0].total) || 0,
    });
  } catch (err) {
    console.error('Summary error:', err.message);
    res.status(500).json({ error: 'Failed to load summary' });
  }
});

// Admin-only manual refund — players cannot self-refund (was an infinite-money exploit)
router.post('/refund', authenticate, isAdmin, async (req, res) => {
  const { userId, transactionId, reason, amount } = req.body;
  try {
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    let refundAmount = amount;
    if (transactionId && !refundAmount) {
      const tx = await query('SELECT * FROM wallet_transactions WHERE id = ? AND user_id = ?', [
        transactionId,
        userId,
      ]);
      if (!tx.rows[0]) return res.status(404).json({ error: 'Transaction not found' });
      refundAmount = Math.abs(parseFloat(tx.rows[0].amount));
    }
    if (!refundAmount) return res.status(400).json({ error: 'amount or transactionId required' });
    const result = await creditWallet(
      userId,
      refundAmount,
      'refund',
      reason || 'Admin refund',
      transactionId || null
    );
    await query(
      'INSERT INTO audit_logs (id, user_id, action, entity, entity_id, details) VALUES (UUID(),?,?,?,?,?)',
      [
        req.user.id,
        'wallet_refund',
        'wallet',
        userId,
        JSON.stringify({ transactionId, amount: refundAmount, reason }),
      ]
    );
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = { router, creditWallet, debitWallet, parseAmount };
