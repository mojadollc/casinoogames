const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const { query, getClient } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { creditWallet } = require('../wallet/routes');
const { updateAffiliationOnDeposit } = require('../affiliation/routes');

const router = express.Router();

const xenditAPI = axios.create({
  baseURL: 'https://api.xendit.co',
  auth: { username: process.env.XENDIT_SECRET_KEY, password: '' }
});

// Create deposit (invoice)
router.post('/deposit', authenticate, async (req, res) => {
  const { amount, payment_method } = req.body;
  const value = parseFloat(amount);
  if (!Number.isFinite(value) || value < 100) {
    return res.status(400).json({ error: 'Minimum deposit is ₱100' });
  }
  if (value > 500000) {
    return res.status(400).json({ error: 'Maximum deposit is ₱500,000' });
  }
  if (!process.env.XENDIT_SECRET_KEY) {
    return res.status(503).json({ error: 'Payment provider not configured' });
  }

  try {
    const invoice = await xenditAPI.post('/v2/invoices', {
      external_id: `dep_${req.user.id}_${Date.now()}`,
      amount: value,
      currency: 'PHP',
      description: `Deposit for ${req.user.username}`,
      payment_methods: payment_method ? [payment_method] : undefined,
      success_redirect_url: `${process.env.FRONTEND_URL}/wallet?status=success`,
      failure_redirect_url: `${process.env.FRONTEND_URL}/wallet?status=failed`
    });

    await query(
      'INSERT INTO payment_transactions (id, user_id, type, amount, provider_ref, status, metadata) VALUES (UUID(),?,?,?,?,?,?)',
      [req.user.id, 'deposit', value, invoice.data.id, 'pending', JSON.stringify({ invoice_url: invoice.data.invoice_url })]
    );
    await query('INSERT INTO deposit_requests (id, user_id, amount, payment_method, provider_ref) VALUES (UUID(),?,?,?,?)',
      [req.user.id, value, payment_method || null, invoice.data.id]);

    res.json({ invoice_url: invoice.data.invoice_url, id: invoice.data.id });
  } catch (err) {
    console.error('Deposit error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to create deposit', detail: err.response?.data?.message || err.message });
  }
});

// Request withdrawal (payout)
router.post('/withdraw', authenticate, async (req, res) => {
  const { amount, bank_code, account_number, account_name } = req.body;
  const value = parseFloat(amount);
  if (!Number.isFinite(value) || value < 100) {
    return res.status(400).json({ error: 'Minimum withdrawal is ₱100' });
  }
  if (value > 500000) {
    return res.status(400).json({ error: 'Maximum withdrawal is ₱500,000' });
  }
  if (!bank_code || !account_number || !account_name) {
    return res.status(400).json({ error: 'bank_code, account_number, and account_name are required' });
  }

  // KYC check — all 3 steps (selfie, phone, location) must be completed
  const kycResult = await query('SELECT kyc_bonus_claimed FROM users WHERE id = ?', [req.user.id]);
  const kycClaimed = kycResult.rows[0]?.kyc_bonus_claimed;
  const claimed = kycClaimed ? (typeof kycClaimed === 'string' ? JSON.parse(kycClaimed) : kycClaimed) : {};
  const missing = ['selfie', 'phone', 'location'].filter(k => !claimed[k]);
  if (missing.length > 0) {
    return res.status(403).json({
      error: 'KYC verification required before withdrawal',
      kyc_incomplete: true,
      missing,
    });
  }

  try {
    const realDeposit = await query(
      "SELECT id FROM payment_transactions WHERE user_id = ? AND type = 'deposit' AND status = 'completed' LIMIT 1",
      [req.user.id]
    );
    if (!realDeposit.rows[0]) {
      return res.status(400).json({ error: 'Withdrawal requires at least one completed real deposit' });
    }

    const wallet = await query('SELECT balance FROM wallets WHERE user_id = ?', [req.user.id]);
    if (!wallet.rows[0] || parseFloat(wallet.rows[0].balance) < value) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // Debit wallet immediately and record transaction
    const { debitWallet } = require('../wallet/routes');
    await debitWallet(req.user.id, value, 'withdrawal', 'Withdrawal request - pending approval', null);

    const inserted = await query(
      'INSERT INTO withdrawal_requests (id, user_id, amount, bank_code, account_number, account_name, status) VALUES (UUID(),?,?,?,?,?,\'pending\')',
      [req.user.id, value, bank_code, account_number, account_name]
    );
    const wr = await query('SELECT id FROM withdrawal_requests WHERE user_id = ? ORDER BY created_at DESC LIMIT 1', [req.user.id]);

    // Update wallet_transaction reference_id to the withdrawal request id
    await query(
      'UPDATE wallet_transactions SET reference_id = ? WHERE user_id = ? AND type = \'withdrawal\' AND reference_id IS NULL ORDER BY created_at DESC LIMIT 1',
      [wr.rows[0]?.id, req.user.id]
    );

    try {
      const io = require('../server').io;
      if (io) io.to('admins').emit('withdrawal:new', { id: wr.rows[0]?.id, amount: value, username: req.user.username });
    } catch {}

    res.json({ message: 'Withdrawal request submitted for approval' });
  } catch (err) {
    console.error('Withdraw error:', err);
    res.status(500).json({ error: 'Failed to create withdrawal request' });
  }
});

// Process payout (admin) — wallet already debited on withdrawal request submission
const processPayout = async (withdrawalId) => {
  const wd = await query('SELECT * FROM withdrawal_requests WHERE id = ?', [withdrawalId]);
  if (!wd.rows[0]) throw new Error('Withdrawal not found');

  const payout = await xenditAPI.post('/payouts', {
    external_id: `wd_${withdrawalId}`,
    amount: wd.rows[0].amount,
    bank_code: wd.rows[0].bank_code,
    account_holder_name: wd.rows[0].account_name,
    account_number: wd.rows[0].account_number,
    description: 'Casino Payout'
  });

  await query('UPDATE withdrawal_requests SET status = ?, provider_ref = ?, updated_at = NOW() WHERE id = ?',
    ['processing', payout.data.id, withdrawalId]);
  return payout.data;
};

// Webhook handler (also exported for direct route mounting)
const webhookHandler = async (req, res) => {
  const webhookToken = req.headers['x-callback-token'];
  if (webhookToken !== process.env.XENDIT_WEBHOOK_TOKEN) {
    return res.status(401).json({ error: 'Invalid webhook token' });
  }

  const { external_id, status, id, amount } = req.body;

  try {
    if (external_id?.startsWith('dep_')) {
      if (status === 'PAID') {
        // Atomic claim of pending deposit to prevent double-credit on webhook retries
        const client = await getClient();
        try {
          await client.BEGIN();
          const tx = await client.query(
            "SELECT * FROM payment_transactions WHERE provider_ref = ? AND status = 'pending' FOR UPDATE",
            [id]
          );
          if (!tx.rows[0]) {
            await client.COMMIT();
            return res.json({ received: true, note: 'already processed or unknown' });
          }
          const creditAmt = parseFloat(tx.rows[0].amount) || 0;
          if (creditAmt <= 0) {
            await client.ROLLBACK();
            return res.status(400).json({ error: 'Invalid stored amount' });
          }
          await client.query(
            "UPDATE payment_transactions SET status = 'completed', webhook_data = ?, updated_at = NOW() WHERE provider_ref = ?",
            [JSON.stringify(req.body), id]
          );
          await client.query(
            "UPDATE deposit_requests SET status = 'completed' WHERE provider_ref = ?",
            [id]
          );
          await client.COMMIT();
          // Credit outside the payment_tx lock to avoid long wallet locks inside this transaction
          await creditWallet(tx.rows[0].user_id, creditAmt, 'deposit', 'Xendit deposit', id);
          await updateAffiliationOnDeposit(tx.rows[0].user_id, creditAmt);
        } catch (e) {
          try { await client.ROLLBACK(); } catch {}
          throw e;
        } finally {
          client.release();
        }
      } else if (status === 'EXPIRED' || status === 'FAILED') {
        await query(
          "UPDATE payment_transactions SET status = ?, webhook_data = ?, updated_at = NOW() WHERE provider_ref = ? AND status = 'pending'",
          [status.toLowerCase(), JSON.stringify(req.body), id]
        );
        await query('UPDATE deposit_requests SET status = ? WHERE provider_ref = ?', [status.toLowerCase(), id]);
      }
    } else if (external_id?.startsWith('wd_')) {
      const wdId = external_id.replace('wd_', '');
      const wd = await query('SELECT * FROM withdrawal_requests WHERE id = ?', [wdId]);
      if (!wd.rows[0]) {
        return res.json({ received: true, note: 'unknown withdrawal' });
      }
      // Only process if still processing/pending
      if (['completed', 'failed', 'rejected'].includes(wd.rows[0].status)) {
        return res.json({ received: true, note: 'already finalized' });
      }
      const newStatus = status === 'COMPLETED' ? 'completed' : 'failed';
      await query('UPDATE withdrawal_requests SET status = ?, updated_at = NOW() WHERE id = ?', [newStatus, wdId]);
      if (status === 'FAILED' || status === 'FAILED_PAYOUT') {
        const refundAmt = parseFloat(wd.rows[0].amount) || parseFloat(amount) || 0;
        if (wd.rows[0].user_id && refundAmt > 0) {
          await creditWallet(wd.rows[0].user_id, refundAmt, 'refund', 'Payout failed - refund', wdId);
        }
      }
    }
    res.json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};
router.post('/webhook', webhookHandler);

// Payment history
router.get('/history', authenticate, async (req, res) => {
  const result = await query(
    'SELECT * FROM payment_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50', [req.user.id]);
  res.json(result.rows);
});

module.exports = { router, processPayout, webhookHandler };
