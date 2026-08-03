import React, { useState, useEffect } from 'react';
import { promoAPI, affiliationAPI } from '../../services/api';

const BUILTIN_TYPES = ['daily_login', 'cashback', 'referral', 'lucky_draw'];

export default function Promotions() {
  const [promos, setPromos] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [tab, setTab] = useState('promos');
  const [message, setMessage] = useState('');
  const [refCode, setRefCode] = useState('');
  const [myCode, setMyCode] = useState('');

  useEffect(() => {
    promoAPI.list().then(({ data }) => {
      setPromos((data || []).filter((p) => !BUILTIN_TYPES.includes(p.type)));
    }).catch(() => {});
    promoAPI.leaderboard().then(({ data }) => setLeaderboard(data || [])).catch(() => {});
    affiliationAPI.getMyCode().then(({ data }) => setMyCode(data?.code || data?.referral_code || '')).catch(() => {});
  }, []);

  const claim = async (action) => {
    try {
      const { data } = await action();
      setMessage(`✅ ${data.message}${data.amount != null ? ` (₱${data.amount})` : ''}`);
      setTimeout(() => setMessage(''), 4000);
    } catch (err) {
      setMessage(`❌ ${err.response?.data?.error || 'Failed'}`);
      setTimeout(() => setMessage(''), 4000);
    }
  };

  const claimReferral = async () => {
    if (!refCode.trim()) {
      setMessage('❌ Enter a referral code');
      setTimeout(() => setMessage(''), 3000);
      return;
    }
    await claim(() => promoAPI.referral(refCode.trim()));
  };

  return (
    <div>
      <div className="tabs">
        <button className={tab === 'promos' ? 'active' : ''} onClick={() => setTab('promos')}>Promotions</button>
        <button className={tab === 'leaderboard' ? 'active' : ''} onClick={() => setTab('leaderboard')}>Leaderboard</button>
      </div>

      {message && (
        <div className="card" style={{ textAlign: 'center', marginBottom: '12px' }}>
          <p style={{ fontSize: '14px' }}>{message}</p>
        </div>
      )}

      {tab === 'promos' && (
        <div>
          {myCode && (
            <div className="card" style={{ marginBottom: '12px', textAlign: 'center' }}>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Your referral code</p>
              <p style={{ fontSize: '22px', fontWeight: 800, color: 'var(--gold)', letterSpacing: '2px' }}>{myCode}</p>
            </div>
          )}

          <div className="promo-card" onClick={() => claim(() => promoAPI.dailyLogin())}>
            <div className="promo-icon">📅</div>
            <div className="promo-info">
              <h3>Daily Login Bonus</h3>
              <p>Claim ₱10 every day just for logging in</p>
            </div>
          </div>

          <div className="promo-card" onClick={() => claim(() => promoAPI.cashback())}>
            <div className="promo-icon">💸</div>
            <div className="promo-info">
              <h3>Weekly Cashback</h3>
              <p>Get 5% back on your weekly losses (max ₱5,000)</p>
            </div>
          </div>

          <div className="promo-card" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div className="promo-icon">👥</div>
              <div className="promo-info">
                <h3>Refer a Friend</h3>
                <p>Both get ₱50 when you claim with their code</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
              <input
                value={refCode}
                onChange={(e) => setRefCode(e.target.value.toUpperCase())}
                placeholder="Enter referral code"
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,215,0,0.3)',
                  background: 'rgba(0,0,0,0.3)',
                  color: '#fff',
                }}
              />
              <button
                type="button"
                onClick={claimReferral}
                style={{
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #ffd700, #b8860b)',
                  color: '#1a0a2e',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Claim
              </button>
            </div>
          </div>

          <div className="promo-card">
            <div className="promo-icon">🎲</div>
            <div className="promo-info">
              <h3>Hourly Lucky Draw</h3>
              <p>₱100 randomly awarded every hour to active players (once per day max)</p>
            </div>
          </div>

          {promos.map((p) => (
            <div className="promo-card" key={p.id}>
              <div className="promo-icon">🎁</div>
              <div className="promo-info">
                <h3>{p.name}</h3>
                <p>{p.description || p.type}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'leaderboard' && (
        <div className="card">
          <h3 style={{ marginBottom: '12px' }}>🏆 Weekly Top Winners</h3>
          {leaderboard.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>No data yet</p>
          ) : (
            leaderboard.map((entry, i) => (
              <div className="tx-item" key={i}>
                <div className="tx-info">
                  <h4>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`} {entry.username}
                  </h4>
                  <p>{entry.total_spins} spins</p>
                </div>
                <span className="tx-amount positive">₱{Number(entry.total_wins).toLocaleString()}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
