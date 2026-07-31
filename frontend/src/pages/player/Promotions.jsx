import React, { useState, useEffect } from 'react';
import { promoAPI } from '../../services/api';

const BUILTIN_TYPES = ['daily_login', 'cashback', 'referral', 'lucky_draw'];

export default function Promotions() {
  const [promos, setPromos] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [tab, setTab] = useState('promos');
  const [message, setMessage] = useState('');

  useEffect(() => {
    promoAPI.list().then(({ data }) => {
      // Filter out admin promos that duplicate the built-in hardcoded ones
      setPromos(data.filter(p => !BUILTIN_TYPES.includes(p.type)));
    }).catch(() => {});
    promoAPI.leaderboard().then(({ data }) => setLeaderboard(data)).catch(() => {});
  }, []);

  const claim = async (action, label) => {
    try {
      const { data } = await action();
      setMessage(`✅ ${data.message} (₱${data.amount})`);
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage(`❌ ${err.response?.data?.error || 'Failed'}`);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  return (
    <div>
      <div className="tabs">
        <button className={tab === 'promos' ? 'active' : ''} onClick={() => setTab('promos')}>Promotions</button>
        <button className={tab === 'leaderboard' ? 'active' : ''} onClick={() => setTab('leaderboard')}>Leaderboard</button>
      </div>

      {message && <div className="card" style={{ textAlign: 'center', marginBottom: '12px' }}><p style={{ fontSize: '14px' }}>{message}</p></div>}

      {tab === 'promos' && (
        <div>
          {/* Built-in promotions */}
          <div className="promo-card" onClick={() => claim(() => promoAPI.dailyLogin(), 'Daily Login')}>
            <div className="promo-icon">📅</div>
            <div className="promo-info">
              <h3>Daily Login Bonus</h3>
              <p>Claim ₱10 every day just for logging in</p>
            </div>
          </div>

          <div className="promo-card" onClick={() => claim(() => promoAPI.cashback(), 'Cashback')}>
            <div className="promo-icon">💸</div>
            <div className="promo-info">
              <h3>Weekly Cashback</h3>
              <p>Get 5% back on your weekly losses</p>
            </div>
          </div>

          <div className="promo-card">
            <div className="promo-icon">👥</div>
            <div className="promo-info">
              <h3>Refer a Friend</h3>
              <p>Both get ₱50 when they sign up</p>
            </div>
          </div>

          <div className="promo-card">
            <div className="promo-icon">🎲</div>
            <div className="promo-info">
              <h3>Hourly Lucky Draw</h3>
              <p>₱100 randomly awarded every hour to active players</p>
            </div>
          </div>

          {/* Dynamic promotions from admin */}
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
                  <h4>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`} {entry.username}</h4>
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
