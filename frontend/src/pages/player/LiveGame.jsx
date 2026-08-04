import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { gameAPI, walletAPI } from '../../services/api';

// Display configs — must stay aligned with backend liveSegmentsForSlug()
const GAME_CONFIG = {
  'crazy-time': {
    title: 'Crazy Time',
    emoji: '🎡',
    accent: '#FF2D75',
    segments: [
      { label: '1', color: '#E53935', multiplier: 1 },
      { label: '2', color: '#FDD835', multiplier: 2 },
      { label: '5', color: '#00ACC1', multiplier: 5 },
      { label: '10', color: '#8E24AA', multiplier: 10 },
      { label: 'COIN FLIP', color: '#43A047', multiplier: 2 },
      { label: 'CASH HUNT', color: '#FB8C00', multiplier: 5 },
      { label: 'PACHINKO', color: '#1E88E5', multiplier: 8 },
      { label: 'CRAZY TIME', color: '#D81B60', multiplier: 50 },
    ],
  },
  'lightning-roulette': {
    title: 'Lightning Roulette',
    emoji: '⚡',
    accent: '#FFD700',
    segments: Array.from({ length: 37 }, (_, i) => ({
      label: String(i),
      color: i === 0 ? '#2E7D32' : i % 2 === 0 ? '#C62828' : '#212121',
      multiplier: 35,
    })),
  },
  'dream-catcher': {
    title: 'Dream Catcher',
    emoji: '🎯',
    accent: '#7C4DFF',
    segments: [
      { label: '1', color: '#E53935', multiplier: 1 },
      { label: '2', color: '#FDD835', multiplier: 2 },
      { label: '5', color: '#00ACC1', multiplier: 5 },
      { label: '10', color: '#8E24AA', multiplier: 10 },
      { label: '20', color: '#FB8C00', multiplier: 20 },
      { label: '40', color: '#3949AB', multiplier: 40 },
      { label: '2×', color: '#43A047', multiplier: 2 },
      { label: '7×', color: '#D81B60', multiplier: 7 },
    ],
  },
  'monopoly-live': {
    title: 'Monopoly Live',
    emoji: '🎩',
    accent: '#FFD700',
    segments: [
      { label: '1', color: '#E53935', multiplier: 1 },
      { label: '2', color: '#FDD835', multiplier: 2 },
      { label: '5', color: '#00ACC1', multiplier: 5 },
      { label: '10', color: '#8E24AA', multiplier: 10 },
      { label: '2 ROLLS', color: '#6A1B9A', multiplier: 15 },
      { label: '4 ROLLS', color: '#EF6C00', multiplier: 30 },
      { label: 'CHANCE', color: '#2E7D32', multiplier: 5 },
    ],
  },
};

function resolveConfig(slug = '') {
  const s = slug.toLowerCase();
  for (const key of Object.keys(GAME_CONFIG)) {
    if (s.includes(key) || key.includes(s)) return GAME_CONFIG[key];
  }
  if (s.includes('crazy')) return GAME_CONFIG['crazy-time'];
  if (s.includes('monopoly')) return GAME_CONFIG['monopoly-live'];
  if (s.includes('lightning') || s.includes('roulette')) return GAME_CONFIG['lightning-roulette'];
  return GAME_CONFIG['dream-catcher'];
}

/** SVG wheel with labels */
function Wheel({ segments, rotation, spinning, size = 300, accent = '#FFD700' }) {
  const n = segments.length || 1;
  const angle = 360 / n;
  const r = size / 2;
  const cx = r;
  const cy = r;

  const polar = (deg, rad) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return [cx + rad * Math.cos(a), cy + rad * Math.sin(a)];
  };

  const slicePath = (i) => {
    const start = i * angle;
    const end = start + angle;
    const [x1, y1] = polar(start, r - 4);
    const [x2, y2] = polar(end, r - 4);
    const large = angle > 180 ? 1 : 0;
    return `M ${cx} ${cy} L ${x1} ${y1} A ${r - 4} ${r - 4} 0 ${large} 1 ${x2} ${y2} Z`;
  };

  const labelPos = (i) => {
    const mid = i * angle + angle / 2;
    return polar(mid, r * 0.62);
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{
        transform: `rotate(${rotation}deg)`,
        transition: spinning
          ? 'transform 4.8s cubic-bezier(0.12, 0.75, 0.15, 1)'
          : 'none',
        filter: spinning
          ? `drop-shadow(0 0 24px ${accent}88)`
          : `drop-shadow(0 8px 24px rgba(0,0,0,0.5))`,
        borderRadius: '50%',
      }}
    >
      <defs>
        <radialGradient id="wheelHub" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff8dc" />
          <stop offset="55%" stopColor="#FFD700" />
          <stop offset="100%" stopColor="#b8860b" />
        </radialGradient>
        <filter id="softGlow">
          <feGaussianBlur stdDeviation="2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Outer ring */}
      <circle cx={cx} cy={cy} r={r - 1} fill="#1a1a2e" stroke={accent} strokeWidth="4" />

      {segments.map((seg, i) => {
        const [lx, ly] = labelPos(i);
        const fontSize = n > 20 ? 9 : n > 12 ? 11 : seg.label.length > 4 ? 10 : 14;
        return (
          <g key={i}>
            <path d={slicePath(i)} fill={seg.color} stroke="rgba(0,0,0,0.35)" strokeWidth="1" />
            <text
              x={lx}
              y={ly}
              fill="#fff"
              fontSize={fontSize}
              fontWeight="900"
              textAnchor="middle"
              dominantBaseline="middle"
              transform={`rotate(${i * angle + angle / 2}, ${lx}, ${ly})`}
              style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)', pointerEvents: 'none' }}
            >
              {seg.label}
            </text>
          </g>
        );
      })}

      {/* Hub */}
      <circle cx={cx} cy={cy} r={Math.max(22, r * 0.12)} fill="url(#wheelHub)" stroke="#fff" strokeWidth="2" filter="url(#softGlow)" />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize="11" fontWeight="900" fill="#3a2a00">
        SPIN
      </text>
    </svg>
  );
}

function Pointer({ accent }) {
  return (
    <div style={{
      position: 'absolute', top: -6, left: '50%', transform: 'translateX(-50%)',
      zIndex: 5, width: 0, height: 0,
      borderLeft: '14px solid transparent',
      borderRight: '14px solid transparent',
      borderTop: `28px solid ${accent}`,
      filter: `drop-shadow(0 2px 6px ${accent})`,
    }}>
      <div style={{
        position: 'absolute', top: -28, left: -6, width: 12, height: 12,
        borderRadius: '50%', background: accent, boxShadow: `0 0 10px ${accent}`,
      }} />
    </div>
  );
}

export default function LiveGame() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const config = useMemo(() => resolveConfig(slug), [slug]);

  const [game, setGame] = useState(null);
  const [balance, setBalance] = useState(0);
  const [bet, setBet] = useState(50);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const [lastWin, setLastWin] = useState(0);
  const [message, setMessage] = useState('Place a bet and spin!');
  const [rotation, setRotation] = useState(0);
  const [history, setHistory] = useState([]);
  const [lightsOn, setLightsOn] = useState(false);
  const rotRef = useRef(0);

  useEffect(() => {
    walletAPI.balance().then(({ data }) => setBalance(Number(data.balance) || 0)).catch(() => {});
    gameAPI.details(slug).then(({ data }) => {
      setGame(data);
      setBet(Number(data.min_bet) || 50);
    }).catch(() => navigate('/'));
  }, [slug, navigate]);

  // Blink lights while spinning
  useEffect(() => {
    if (!spinning) { setLightsOn(false); return; }
    const t = setInterval(() => setLightsOn(v => !v), 180);
    return () => clearInterval(t);
  }, [spinning]);

  const anglePer = 360 / (config.segments.length || 1);

  /**
   * Compute absolute rotation so segment index lands under the top pointer.
   * Segments are drawn starting at top going clockwise; pointer is at top.
   */
  const rotationForIndex = (index, currentRot) => {
    const targetCenter = index * anglePer + anglePer / 2;
    // Wheel rotates clockwise in CSS positive direction; pointer fixed at top.
    // Content at angle θ moves to top when rotation = -θ (mod 360), use positive spins.
    const mod = ((currentRot % 360) + 360) % 360;
    const desired = (360 - targetCenter) % 360;
    let delta = (desired - mod + 360) % 360;
    const extraSpins = 5 + Math.floor(Math.random() * 3); // 5–7 full turns
    return currentRot + extraSpins * 360 + delta;
  };

  const spin = async () => {
    if (spinning || !game || balance < bet) return;
    setSpinning(true);
    setResult(null);
    setLastWin(0);
    setMessage('Wheel is spinning…');

    try {
      // Server-authoritative (admin win_rate / force_outcome / max_payout / dry_run)
      const { data } = await gameAPI.play(game.id, { betAmount: bet });
      setBalance(Number(data.balance) || 0);

      const segments = config.segments;
      let idx = typeof data.segmentIndex === 'number' ? data.segmentIndex : 0;
      if (idx < 0 || idx >= segments.length) idx = 0;

      // Prefer server segment label/multiplier when present
      const serverSeg = data.segment || {};
      const displaySeg = {
        ...segments[idx],
        ...serverSeg,
        label: serverSeg.label || segments[idx].label,
        color: segments[idx].color,
        multiplier: serverSeg.multiplier ?? segments[idx].multiplier,
      };

      const nextRot = rotationForIndex(idx, rotRef.current);
      rotRef.current = nextRot;
      setRotation(nextRot);

      // Wait for CSS spin to finish
      await new Promise(r => setTimeout(r, 5000));

      setResult(displaySeg);
      setLastWin(Number(data.totalWin) || 0);
      setHistory(prev => [{ segment: displaySeg, win: Number(data.totalWin) || 0 }, ...prev].slice(0, 10));

      if (data.totalWin > 0) {
        setMessage(`🎉 ${displaySeg.label}! You won ₱${Number(data.totalWin).toLocaleString()}`);
      } else {
        setMessage(`${displaySeg.label} — Better luck next time!`);
      }
    } catch (err) {
      setMessage(err.response?.data?.error || err.message || 'Spin failed');
    } finally {
      setSpinning(false);
    }
  };

  if (!game) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a18', color: '#888' }}>
        Loading…
      </div>
    );
  }

  const minBet = Number(game.min_bet) || 10;
  const maxBet = Number(game.max_bet) || 50000;
  const quickBets = [50, 100, 500, 1000, 5000].filter(v => v >= minBet && v <= maxBet);

  return (
    <div style={{
      minHeight: '100vh', maxWidth: 480, margin: '0 auto',
      background: `linear-gradient(165deg, #0a0a18 0%, #12122a 45%, #1a0a20 100%)`,
      color: '#f0f0ff', fontFamily: 'system-ui, sans-serif',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 16px', borderBottom: `1px solid ${config.accent}33`,
        background: 'rgba(0,0,0,0.35)',
      }}>
        <Link to="/" style={{ color: '#8cf', textDecoration: 'none', fontWeight: 700 }}>← Lobby</Link>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 900, color: config.accent, fontSize: 15 }}>
            {config.emoji} {game.name || config.title}
          </div>
          <div style={{ fontSize: 10, color: '#6a6a8a', letterSpacing: 1 }}>LIVE SHOW · REAL MONEY</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: '#6a6a8a' }}>BALANCE</div>
          <div style={{ fontWeight: 800, color: '#FFD700' }}>₱{Number(balance).toLocaleString()}</div>
        </div>
      </div>

      {/* Stage lights */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '10px 0 0' }}>
        {Array.from({ length: 9 }, (_, i) => (
          <div key={i} style={{
            width: 10, height: 10, borderRadius: '50%',
            background: lightsOn
              ? (i % 2 === 0 ? config.accent : '#FFD700')
              : '#333',
            boxShadow: lightsOn ? `0 0 10px ${i % 2 === 0 ? config.accent : '#FFD700'}` : 'none',
            transition: 'background 0.12s',
          }} />
        ))}
      </div>

      {/* Wheel stage */}
      <div style={{
        position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center',
        padding: '20px 12px 8px',
      }}>
        <div style={{
          position: 'relative',
          padding: 10,
          borderRadius: '50%',
          background: `conic-gradient(from 0deg, ${config.accent}44, transparent, ${config.accent}44)`,
          boxShadow: spinning
            ? `0 0 40px ${config.accent}66, inset 0 0 20px rgba(0,0,0,0.5)`
            : '0 12px 40px rgba(0,0,0,0.5)',
        }}>
          <Pointer accent={config.accent} />
          <Wheel
            segments={config.segments}
            rotation={rotation}
            spinning={spinning}
            size={Math.min(320, typeof window !== 'undefined' ? window.innerWidth - 48 : 320)}
            accent={config.accent}
          />
        </div>
      </div>

      {/* Result banner */}
      <div style={{
        textAlign: 'center', minHeight: 52, padding: '8px 16px',
        fontWeight: 800, fontSize: 16,
        color: lastWin > 0 ? '#FFD700' : '#aab',
      }}>
        {result && (
          <div style={{
            display: 'inline-block', padding: '6px 16px', borderRadius: 20,
            background: `${result.color}33`, border: `1px solid ${result.color}`,
            color: '#fff', marginBottom: 4,
          }}>
            {result.label}
            {result.multiplier ? ` · ${result.multiplier}×` : ''}
          </div>
        )}
        <div>{message}</div>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div style={{ padding: '0 16px 8px' }}>
          <div style={{ fontSize: 10, color: '#667', marginBottom: 6, fontWeight: 700 }}>RECENT</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {history.map((h, i) => (
              <div key={i} style={{
                padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                background: `${h.segment.color}22`, color: h.segment.color,
                border: `1px solid ${h.segment.color}55`,
              }}>
                {h.segment.label}{h.win > 0 ? ` +₱${h.win}` : ''}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Controls */}
      <div style={{
        marginTop: 'auto', padding: '14px 16px 22px',
        background: 'rgba(0,0,0,0.45)', borderTop: `1px solid ${config.accent}33`,
      }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {quickBets.map(v => (
            <button key={v} type="button" onClick={() => setBet(v)} disabled={spinning || v > balance}
              style={{
                padding: '8px 12px', borderRadius: 8, fontWeight: 700, fontSize: 12,
                border: bet === v ? `2px solid ${config.accent}` : '1px solid #333',
                background: bet === v ? `${config.accent}22` : 'rgba(255,255,255,0.04)',
                color: bet === v ? config.accent : '#889',
                cursor: v > balance ? 'not-allowed' : 'pointer', opacity: v > balance ? 0.4 : 1,
              }}>₱{v}</button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: '#667', marginBottom: 4 }}>YOUR BET</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#FFD700' }}>₱{Number(bet).toLocaleString()}</div>
            <div style={{ fontSize: 10, color: '#556' }}>Min ₱{minBet} · Max ₱{maxBet}</div>
          </div>
          <button
            type="button"
            onClick={spin}
            disabled={spinning || balance < bet || balance <= 0}
            style={{
              width: 120, height: 120, borderRadius: '50%', border: 'none',
              background: spinning || balance < bet
                ? 'linear-gradient(145deg, #333, #222)'
                : `linear-gradient(145deg, ${config.accent}, #FFD700, ${config.accent})`,
              color: spinning || balance < bet ? '#555' : '#1a1020',
              fontSize: 18, fontWeight: 900, letterSpacing: 1,
              cursor: spinning || balance < bet ? 'not-allowed' : 'pointer',
              boxShadow: spinning || balance < bet ? 'none' : `0 0 28px ${config.accent}88`,
              animation: spinning ? 'pulseSpin 0.4s ease infinite' : 'none',
            }}
          >
            {spinning ? '…' : 'SPIN'}
          </button>
          <div style={{ flex: 1, textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: '#667', marginBottom: 4 }}>LAST WIN</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: lastWin > 0 ? '#00e676' : '#556' }}>
              ₱{Number(lastWin).toLocaleString()}
            </div>
          </div>
        </div>

        {balance <= 0 && (
          <div style={{ textAlign: 'center', marginTop: 10, fontSize: 13, color: '#f66' }}>
            No balance!{' '}
            <span onClick={() => navigate('/wallet')} style={{ color: '#FFD700', cursor: 'pointer', textDecoration: 'underline' }}>
              Deposit
            </span>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulseSpin {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.04); }
        }
      `}</style>
    </div>
  );
}
