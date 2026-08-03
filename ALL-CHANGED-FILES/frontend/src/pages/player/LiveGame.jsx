import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { gameAPI, walletAPI } from '../../services/api';

// Wheel segments per game
const GAME_CONFIG = {
  'crazy-time': {
    emoji: '🎡',
    segments: [
      { label: '1', color: '#FF4500', multiplier: 1, weight: 9 },
      { label: '2', color: '#FFD700', multiplier: 2, weight: 4 },
      { label: '5', color: '#00CED1', multiplier: 5, weight: 2 },
      { label: '10', color: '#FF1493', multiplier: 10, weight: 1 },
      { label: 'CASH HUNT', color: '#9370DB', multiplier: 15, weight: 1 },
      { label: 'PACHINKO', color: '#FF8C00', multiplier: 20, weight: 1 },
      { label: 'COIN FLIP', color: '#00FA9A', multiplier: 8, weight: 1 },
      { label: 'CRAZY TIME', color: '#FF2D75', multiplier: 50, weight: 1 },
    ],
  },
  'lightning-roulette': {
    emoji: '⚡',
    segments: Array.from({ length: 37 }, (_, i) => ({
      label: String(i),
      color: i === 0 ? '#00AA00' : i % 2 === 0 ? '#CC0000' : '#1a1a1a',
      multiplier: i === 0 ? 35 : 35,
      weight: 1,
    })),
  },
  'dream-catcher': {
    emoji: '🎯',
    segments: [
      { label: '1', color: '#FF4500', multiplier: 1, weight: 23 },
      { label: '2', color: '#FFD700', multiplier: 2, weight: 15 },
      { label: '5', color: '#00CED1', multiplier: 5, weight: 7 },
      { label: '10', color: '#FF1493', multiplier: 10, weight: 4 },
      { label: '20', color: '#9370DB', multiplier: 20, weight: 2 },
      { label: '40', color: '#FF8C00', multiplier: 40, weight: 1 },
      { label: '2×', color: '#00FA9A', multiplier: 2, weight: 3 },
      { label: '7×', color: '#FF2D75', multiplier: 7, weight: 1 },
    ],
  },
  'monopoly-live': {
    emoji: '🎩',
    segments: [
      { label: '1', color: '#FF4500', multiplier: 1, weight: 22 },
      { label: '2', color: '#FFD700', multiplier: 2, weight: 15 },
      { label: '5', color: '#00CED1', multiplier: 5, weight: 7 },
      { label: '10', color: '#FF1493', multiplier: 10, weight: 4 },
      { label: '2 ROLLS', color: '#9370DB', multiplier: 15, weight: 3 },
      { label: '4 ROLLS', color: '#FF8C00', multiplier: 30, weight: 1 },
      { label: 'CHANCE', color: '#00FA9A', multiplier: 5, weight: 2 },
    ],
  },
};

const DEFAULT_CONFIG = GAME_CONFIG['dream-catcher'];

export default function LiveGame() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState(null);
  const [balance, setBalance] = useState(0);
  const [bet, setBet] = useState(50);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const [lastWin, setLastWin] = useState(0);
  const [message, setMessage] = useState('');
  const [wheelAngle, setWheelAngle] = useState(0);
  const [history, setHistory] = useState([]);

  const config = GAME_CONFIG[slug] || DEFAULT_CONFIG;
  const isRoulette = slug === 'lightning-roulette';

  useEffect(() => {
    walletAPI.balance().then(({ data }) => setBalance(Number(data.balance) || 0)).catch(() => {});
    gameAPI.details(slug).then(({ data }) => {
      setGame(data);
      setBet(Number(data.min_bet));
    }).catch(() => navigate('/'));
  }, [slug, navigate]);

  const spin = async () => {
    if (spinning || balance < bet) return;
    setSpinning(true);
    setMessage('');
    setLastWin(0);
    setResult(null);

    // Animate wheel
    const spins = 5 + Math.random() * 5;
    const targetAngle = wheelAngle + spins * 360;
    setWheelAngle(targetAngle);

    try {
      // Server-authoritative segment + payout
      const { data } = await gameAPI.play(game.id, { betAmount: bet });
      setBalance(data.balance);

      let segment = data.segment;
      // Map server segment onto local display config when possible
      if (data.segmentIndex != null && config.segments[data.segmentIndex]) {
        segment = { ...config.segments[data.segmentIndex], ...(data.segment || {}) };
      } else if (!segment) {
        segment = config.segments[0];
      }

      await new Promise(r => setTimeout(r, 2500));

      setResult(segment);
      setLastWin(data.totalWin || 0);
      setHistory(prev => [{ segment, win: data.totalWin || 0 }, ...prev].slice(0, 8));

      if (data.totalWin > 0) {
        setMessage(`🎉 ${segment.label}! You won ₱${data.totalWin.toLocaleString()}`);
      } else {
        setMessage(`${segment.label || '—'} — Better luck next time!`);
      }
    } catch (err) {
      setMessage(err.response?.data?.error || 'Spin failed');
    }
    setSpinning(false);
  };

  if (!game) return <div className="loading"><div className="spinner" /></div>;

  const quickBets = [50, 100, 500, 1000, 5000].filter(v => v >= Number(game.min_bet) && v <= Number(game.max_bet));

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #0a0015 0%, #1a0a2e 50%, #0a0015 100%)', padding: '16px', color: 'white' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', padding: '12px 16px', background: 'rgba(255,215,0,0.08)', borderRadius: '14px', border: '1px solid rgba(255,215,0,0.2)' }}>
        <button onClick={() => navigate('/')} style={{ padding: '8px 18px', background: 'linear-gradient(135deg, #ffd700, #b8860b)', border: 'none', borderRadius: '10px', color: '#1a0a2e', fontWeight: '800', cursor: 'pointer' }}>← Back</button>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '10px', color: 'rgba(255,215,0,0.7)' }}>Balance</div>
          <div style={{ fontSize: '20px', fontWeight: '900', color: '#ffd700' }}>₱{Number(balance).toLocaleString('en', { minimumFractionDigits: 2 })}</div>
        </div>
      </div>

      {/* Title */}
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <div style={{ fontSize: '36px', marginBottom: '4px' }}>{config.emoji}</div>
        <h2 style={{ fontSize: '24px', fontWeight: '900', background: 'linear-gradient(135deg, #ffd700, #ffed4a)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 }}>{game.name}</h2>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '8px' }}>
          <span style={{ padding: '4px 12px', background: 'rgba(255,215,0,0.1)', borderRadius: '20px', fontSize: '11px', color: '#ffd700', border: '1px solid rgba(255,215,0,0.3)' }}>RTP {game.rtp}%</span>
          <span style={{ padding: '4px 12px', background: 'rgba(255,45,117,0.1)', borderRadius: '20px', fontSize: '11px', color: '#ff2d75', border: '1px solid rgba(255,45,117,0.3)' }}>LIVE</span>
        </div>
      </div>

      {/* Wheel / Segments Display */}
      <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '20px', border: '1px solid rgba(255,215,0,0.15)', padding: '20px', marginBottom: '16px' }}>
        {/* Spinning indicator */}
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <div style={{ fontSize: '48px', transition: 'transform 2.5s cubic-bezier(0.17,0.67,0.12,0.99)', transform: `rotate(${wheelAngle}deg)`, display: 'inline-block' }}>
            {config.emoji}
          </div>
          {spinning && <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginTop: '4px', letterSpacing: '2px' }}>SPINNING...</div>}
        </div>

        {/* Segments grid */}
        <div style={{ display: 'grid', gridTemplateColumns: isRoulette ? 'repeat(6, 1fr)' : 'repeat(4, 1fr)', gap: '6px' }}>
          {(isRoulette ? config.segments.slice(0, 12) : config.segments).map((seg, i) => (
            <div key={i} style={{
              padding: '8px 4px', borderRadius: '8px', textAlign: 'center', fontSize: isRoulette ? '13px' : '11px', fontWeight: '700',
              background: result?.label === seg.label ? seg.color : `${seg.color}22`,
              color: result?.label === seg.label ? '#fff' : seg.color,
              border: `1px solid ${seg.color}44`,
              transform: result?.label === seg.label ? 'scale(1.1)' : 'scale(1)',
              transition: 'all 0.3s',
              boxShadow: result?.label === seg.label ? `0 0 15px ${seg.color}` : 'none',
            }}>
              {seg.label}
              {!isRoulette && <div style={{ fontSize: '9px', opacity: 0.7 }}>{seg.multiplier}×</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Result */}
      {message && (
        <div style={{ textAlign: 'center', marginBottom: '16px', padding: '14px', background: lastWin > 0 ? 'rgba(0,245,160,0.1)' : 'rgba(255,255,255,0.05)', borderRadius: '12px', border: `1px solid ${lastWin > 0 ? 'rgba(0,245,160,0.3)' : 'rgba(255,255,255,0.1)'}` }}>
          <div style={{ fontSize: '18px', fontWeight: '800', color: lastWin > 0 ? '#00f5a0' : 'rgba(255,255,255,0.7)' }}>{message}</div>
          {lastWin > 0 && <div style={{ fontSize: '28px', fontWeight: '900', color: '#ffd700', marginTop: '4px' }}>+₱{lastWin.toLocaleString()}</div>}
        </div>
      )}

      {/* Bet Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', marginBottom: '12px', padding: '12px', background: 'rgba(255,215,0,0.05)', borderRadius: '12px', border: '1px solid rgba(255,215,0,0.15)' }}>
        <button onClick={() => setBet(Math.max(Number(game.min_bet), bet - Number(game.min_bet)))} disabled={spinning} style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, #ffd700, #b8860b)', border: 'none', color: '#1a0a2e', fontSize: '20px', fontWeight: '900', cursor: 'pointer' }}>−</button>
        <div style={{ textAlign: 'center', minWidth: '90px' }}>
          <div style={{ fontSize: '10px', color: 'rgba(255,215,0,0.6)' }}>BET</div>
          <div style={{ fontSize: '22px', fontWeight: '900', color: '#ffd700' }}>₱{bet}</div>
        </div>
        <button onClick={() => setBet(Math.min(Number(game.max_bet), bet + Number(game.min_bet)))} disabled={spinning || bet + Number(game.min_bet) > balance} style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, #ffd700, #b8860b)', border: 'none', color: '#1a0a2e', fontSize: '20px', fontWeight: '900', cursor: 'pointer' }}>+</button>
      </div>

      {/* Quick Bets */}
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
        {quickBets.map(v => (
          <button key={v} onClick={() => setBet(v)} disabled={spinning || v > balance} style={{ padding: '7px 14px', borderRadius: '20px', background: bet === v ? 'linear-gradient(135deg, #ffd700, #b8860b)' : 'rgba(255,215,0,0.08)', border: `1px solid ${bet === v ? '#ffd700' : 'rgba(255,215,0,0.3)'}`, color: bet === v ? '#1a0a2e' : '#ffd700', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>₱{v}</button>
        ))}
      </div>

      {/* Spin Button */}
      <div style={{ textAlign: 'center', marginBottom: '16px' }}>
        <button onClick={spin} disabled={spinning || balance < bet || balance <= 0} style={{ width: '110px', height: '110px', borderRadius: '50%', background: spinning || balance < bet ? 'linear-gradient(145deg, #333, #222)' : 'linear-gradient(145deg, #ffd700, #ffa500, #ffd700)', border: spinning || balance < bet ? '4px solid #444' : '4px solid rgba(255,255,255,0.3)', color: spinning || balance < bet ? '#666' : '#1a0a2e', fontSize: '16px', fontWeight: '900', cursor: spinning || balance < bet ? 'not-allowed' : 'pointer', boxShadow: spinning || balance < bet ? 'none' : '0 0 30px rgba(255,215,0,0.5)', textTransform: 'uppercase', letterSpacing: '1px' }}>
          {spinning ? '...' : 'SPIN'}
        </button>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Recent Results</div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {history.map((h, i) => (
              <div key={i} style={{ padding: '4px 10px', borderRadius: '8px', background: `${h.segment.color}22`, color: h.segment.color, border: `1px solid ${h.segment.color}44`, fontSize: '12px', fontWeight: '700' }}>{h.segment.label}</div>
            ))}
          </div>
        </div>
      )}

      {balance <= 0 && (
        <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(255,71,87,0.1)', border: '1px solid #ff4757', borderRadius: '12px', textAlign: 'center', color: '#ff4757', fontSize: '13px', fontWeight: '600' }}>
          No balance! <span onClick={() => navigate('/wallet')} style={{ color: '#ffd700', cursor: 'pointer', textDecoration: 'underline' }}>Deposit</span> to play.
        </div>
      )}
    </div>
  );
}
