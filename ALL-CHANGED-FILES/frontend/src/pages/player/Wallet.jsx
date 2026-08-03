import React, { useState, useEffect, useRef } from 'react';
import { walletAPI, paymentAPI, authAPI } from '../../services/api';

const KYC_STEPS = [
  { type: 'selfie',   label: 'Take a Selfie',          bonus: 50, icon: '🤳' },
  { type: 'phone',    label: 'Add Phone Number',        bonus: 30, icon: '📱' },
  { type: 'location', label: 'Enable Current Location', bonus: 20, icon: '📍' },
];

export default function Wallet() {
  const [balance, setBalance] = useState({ balance: 0, bonus_balance: 0 });
  const [transactions, setTransactions] = useState([]);
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

  useEffect(() => {
    walletAPI.balance().then(({ data }) => setBalance(data));
    authAPI.profile().then(({ data }) => {
      const c = data.kyc_bonus_claimed;
      setKycClaimed(c ? (typeof c === 'string' ? JSON.parse(c) : c) : {});
    }).catch(() => {});
  }, []);

  useEffect(() => {
    walletAPI.transactions({ page, limit: LIMIT })
      .then(({ data }) => {
        setTransactions(data.transactions);
        setTotalTx(data.total);
      });
  }, [page]);

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
    if (missing.length > 0) { setKycMsg(''); setShowKycGate(true); }
    else setShowWithdraw(true);
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
      } else if (type === 'location') {
        value = await new Promise((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve(`${pos.coords.latitude},${pos.coords.longitude}`),
            () => reject()
          )
        ).catch(() => null);
        if (!value) { setKycMsg('Location access was denied. Please allow it in your browser settings.'); setKycLoading(''); return; }
      }
      const { data } = await authAPI.kycBonus(type, value);
      setKycClaimed(data.claimed);
      setKycMsg(`✅ ₱${data.amount} bonus credited!`);
      if (data.allClaimed) { setTimeout(() => { setShowKycGate(false); setShowWithdraw(true); setKycMsg(''); }, 1200); }
    } catch (err) {
      setKycMsg(err.response?.data?.error || 'Failed to claim bonus');
    }
    setKycLoading('');
  };

  const handleWithdraw = async (e) => {
    e.preventDefault();
    const amt = parseFloat(withdrawForm.amount);
    if (!Number.isFinite(amt) || amt < 100) {
      setMessage('Minimum withdrawal is ₱100');
      return;
    }
    if (amt > 500000) {
      setMessage('Maximum withdrawal is ₱500,000');
      return;
    }
    if (!withdrawForm.bank_code || !withdrawForm.account_number || !withdrawForm.account_name) {
      setMessage('Please fill in all bank details');
      return;
    }
    setLoading(true);
    try {
      await paymentAPI.withdraw({ ...withdrawForm, amount: amt });
      setShowWithdraw(false);
      setWithdrawForm({ amount: '', bank_code: '', account_number: '', account_name: '' });
      setMessage('✅ Withdrawal request submitted! Pending admin approval.');
      walletAPI.balance().then(({ data }) => setBalance(data));
    } catch (err) {
      setMessage('❌ ' + (err.response?.data?.error || 'Withdrawal failed'));
    }
    setLoading(false);
  };

  return (
    <div>
      {/* Balance Card */}
      <div className="balance-card">
        <p className="label">Total Balance</p>
        <p className="amount">₱{Number(balance.balance).toLocaleString('en', { minimumFractionDigits: 2 })}</p>
        {balance.bonus_balance > 0 && (
          <p className="label">Bonus: ₱{Number(balance.bonus_balance).toFixed(2)}</p>
        )}
      </div>

      {/* Action Buttons */}
      <div className="action-buttons">
        <button className="btn btn-success" onClick={() => setShowDeposit(true)}>💳 Deposit</button>
        <button className="btn btn-secondary" onClick={openWithdraw}>🏦 Withdraw</button>
      </div>

      {message && <div className="card" style={{ textAlign: 'center' }}><p style={{ color: 'var(--secondary)', fontSize: '14px' }}>{message}</p></div>}

      {/* Transactions */}
      <div className="card">
        <h3 style={{ marginBottom: '12px', fontSize: '16px' }}>Recent Transactions</h3>
        {transactions.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>No transactions yet</p>
        ) : (
          <>
            {transactions.map((tx) => (
              <div className="tx-item" key={tx.id}>
                <div className="tx-info">
                  <h4>{tx.type.replace('_', ' ').toUpperCase()}</h4>
                  <p>{new Date(tx.created_at).toLocaleDateString()}</p>
                </div>
                <span className={`tx-amount ${tx.amount > 0 ? 'positive' : 'negative'}`}>
                  {tx.amount > 0 ? '+' : ''}₱{Math.abs(tx.amount).toLocaleString()}
                </span>
              </div>
            ))}
            {/* Pagination */}
            {totalTx > LIMIT && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <button
                  onClick={() => setPage(p => p - 1)}
                  disabled={page === 1}
                  style={{ padding: '8px 18px', borderRadius: '10px', border: '1px solid rgba(255,215,0,0.3)', background: page === 1 ? 'rgba(255,255,255,0.04)' : 'rgba(255,215,0,0.1)', color: page === 1 ? 'var(--text-muted)' : 'var(--gold)', cursor: page === 1 ? 'not-allowed' : 'pointer', fontWeight: '600', fontSize: '13px' }}
                >← Prev</button>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  Page {page} of {Math.ceil(totalTx / LIMIT)}
                </span>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= Math.ceil(totalTx / LIMIT)}
                  style={{ padding: '8px 18px', borderRadius: '10px', border: '1px solid rgba(255,215,0,0.3)', background: page >= Math.ceil(totalTx / LIMIT) ? 'rgba(255,255,255,0.04)' : 'rgba(255,215,0,0.1)', color: page >= Math.ceil(totalTx / LIMIT) ? 'var(--text-muted)' : 'var(--gold)', cursor: page >= Math.ceil(totalTx / LIMIT) ? 'not-allowed' : 'pointer', fontWeight: '600', fontSize: '13px' }}
                >Next →</button>
              </div>
            )}
          </>
        )}
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
                🔒 <strong>KYC verification is required</strong> before you can withdraw funds. Complete all 3 steps below to unlock withdrawals and earn <strong style={{ color: '#ffd700' }}>up to ₱100 bonus</strong>.
              </p>
            </div>

            {/* Progress */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>KYC Progress</span>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#ffd700' }}>
                  {KYC_STEPS.filter(s => kycClaimed[s.type]).length} / 3 completed
                </span>
              </div>
              <div style={{ height: '6px', background: '#1e1e2e', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${(KYC_STEPS.filter(s => kycClaimed[s.type]).length / 3) * 100}%`,
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
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Required · Earn ₱50</div>
                  </div>
                  {kycClaimed.selfie
                    ? <span style={{ color: '#00f5a0', fontWeight: '700', fontSize: '12px' }}>✅ Done</span>
                    : <span style={{ color: '#ffd700', fontWeight: '700', fontSize: '12px' }}>₱50</span>
                  }
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
                          {kycLoading === 'selfie' ? '...' : 'Claim ₱50'}
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
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Required · Earn ₱30</div>
                  </div>
                  {kycClaimed.phone
                    ? <span style={{ color: '#00f5a0', fontWeight: '700', fontSize: '12px' }}>✅ Done</span>
                    : <span style={{ color: '#ffd700', fontWeight: '700', fontSize: '12px' }}>₱30</span>
                  }
                </div>
                {!kycClaimed.phone && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="tel" value={kycPhone} onChange={e => setKycPhone(e.target.value)}
                      placeholder="+63 9XX XXX XXXX"
                      style={{ flex: 1, padding: '7px 10px', borderRadius: '8px', background: '#0f0f1a', border: '1px solid #333', color: '#e0e0f0', fontSize: '13px' }}
                    />
                    <button className="btn btn-primary" style={{ padding: '7px 12px', fontSize: '12px' }} onClick={() => claimKycBonus('phone')} disabled={kycLoading === 'phone'}>
                      {kycLoading === 'phone' ? '...' : 'Claim ₱30'}
                    </button>
                  </div>
                )}
              </div>

              {/* Location */}
              <div className="card" style={{ opacity: kycClaimed.location ? 0.65 : 1, padding: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: kycClaimed.location ? 0 : '10px' }}>
                  <span style={{ fontSize: '24px' }}>📍</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '700', fontSize: '13px' }}>Enable Current Location</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Required · Earn ₱20</div>
                  </div>
                  {kycClaimed.location
                    ? <span style={{ color: '#00f5a0', fontWeight: '700', fontSize: '12px' }}>✅ Done</span>
                    : <span style={{ color: '#ffd700', fontWeight: '700', fontSize: '12px' }}>₱20</span>
                  }
                </div>
                {!kycClaimed.location && (
                  <button className="btn btn-primary" style={{ width: '100%', padding: '7px', fontSize: '12px' }} onClick={() => claimKycBonus('location')} disabled={kycLoading === 'location'}>
                    {kycLoading === 'location' ? 'Getting location...' : '📍 Allow Location & Claim ₱20'}
                  </button>
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
              <div className="input-group">
                <label>Payment Channel</label>
                <select value={withdrawForm.bank_code} onChange={(e) => setWithdrawForm({ ...withdrawForm, bank_code: e.target.value })} required>
                  <option value="">Select channel</option>
                  <optgroup label="E-Wallets">
                    <option value="GCASH">GCash</option>
                    <option value="MAYA">Maya</option>
                  </optgroup>
                  <optgroup label="Banks">
                    <option value="BPI">BPI</option>
                    <option value="BDO">BDO</option>
                    <option value="UNIONBANK">UnionBank</option>
                    <option value="METROBANK">Metrobank</option>
                    <option value="PNB">PNB</option>
                  </optgroup>
                </select>
              </div>
              <div className="input-group">
                <label>Account Number</label>
                <input
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={withdrawForm.account_number}
                  onChange={(e) => setWithdrawForm({ ...withdrawForm, account_number: e.target.value.replace(/\D/g, '') })}
                  required
                  placeholder="Numbers only"
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
    </div>
  );
}
