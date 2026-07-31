const express = require('express');
const { query, getClient } = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/balance', authenticate, async (req, res) => {
  const result = await query('SELECT balance, bonus_balance, currency FROM wallets WHERE user_id = ?', [req.user.id]);
  res.json(result.rows[0]);
});

router.get('/transactions', authenticate, async (req, res) => {
  const { page = 1, limit = 20, type } = req.query;
  const offset = (page - 1) * limit;
  let sql = 'SELECT * FROM wallet_transactions WHERE user_id = ?';
  let countSql = 'SELECT COUNT(*) as total FROM wallet_transactions WHERE user_id = ?';
  const params = [req.user.id];
  const countParams = [req.user.id];
  if (type) {
    sql += ' AND type = ?'; params.push(type);
    countSql += ' AND type = ?'; countParams.push(type);
  }
  sql += ` ORDER BY created_at DESC LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`;
  const [result, count] = await Promise.all([
    query(sql, params),
    query(countSql, countParams),
  ]);
  res.json({ transactions: result.rows, total: parseInt(count.rows[0].total), page: parseInt(page), limit: parseInt(limit) });
});

const emitWalletUpdate = (userId, balance, type, amount, description) => {
  try {
    const { io } = require('../server');
    if (io) io.to(userId).emit('wallet:update', { balance, type, amount, description, timestamp: new Date() });
  } catch {}
};

const creditWallet = async (userId, amount, type, description, referenceId) => {
  const client = await getClient();
  try {
    await client.BEGIN();
    const wallet = await client.query('SELECT id, balance FROM wallets WHERE user_id = ? FOR UPDATE', [userId]);
    const newBalance = parseFloat(wallet.rows[0].balance) + parseFloat(amount);
    await client.query('UPDATE wallets SET balance = ?, updated_at = NOW() WHERE user_id = ?', [newBalance, userId]);
    await client.query(
      'INSERT INTO wallet_transactions (id, wallet_id, user_id, type, amount, balance_before, balance_after, reference_id, description) VALUES (UUID(),?,?,?,?,?,?,?,?)',
      [wallet.rows[0].id, userId, type, amount, wallet.rows[0].balance, newBalance, referenceId || null, description]
    );
    await client.COMMIT();
    emitWalletUpdate(userId, newBalance, type, amount, description);
    return { balance: newBalance };
  } catch (err) {
    await client.ROLLBACK();
    throw err;
  } finally {
    client.release();
  }
};

const debitWallet = async (userId, amount, type, description, referenceId) => {
  const client = await getClient();
  try {
    await client.BEGIN();
    const wallet = await client.query('SELECT id, balance FROM wallets WHERE user_id = ? FOR UPDATE', [userId]);
    if (parseFloat(wallet.rows[0].balance) < parseFloat(amount)) throw new Error('Insufficient balance');
    const newBalance = parseFloat(wallet.rows[0].balance) - parseFloat(amount);
    await client.query('UPDATE wallets SET balance = ?, updated_at = NOW() WHERE user_id = ?', [newBalance, userId]);
    await client.query(
      'INSERT INTO wallet_transactions (id, wallet_id, user_id, type, amount, balance_before, balance_after, reference_id, description) VALUES (UUID(),?,?,?,?,?,?,?,?)',
      [wallet.rows[0].id, userId, type, -amount, wallet.rows[0].balance, newBalance, referenceId || null, description]
    );
    await client.COMMIT();
    emitWalletUpdate(userId, newBalance, type, -amount, description);
    return { balance: newBalance };
  } catch (err) {
    await client.ROLLBACK();
    throw err;
  } finally {
    client.release();
  }
};

router.post('/refund', authenticate, async (req, res) => {
  const { transactionId, reason } = req.body;
  try {
    const tx = await query('SELECT * FROM wallet_transactions WHERE id = ? AND user_id = ?', [transactionId, req.user.id]);
    if (!tx.rows[0]) return res.status(404).json({ error: 'Transaction not found' });
    const result = await creditWallet(req.user.id, Math.abs(tx.rows[0].amount), 'refund', reason, transactionId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = { router, creditWallet, debitWallet };
