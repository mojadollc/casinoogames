import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { gameAPI, walletAPI } from '../../services/api';

/** Detailed SVG rooster facing direction dir: 1 = right (Meron), -1 = left (Wala) */
function Rooster({ color = '#c62828', dir = 1, pose = 'idle', size = 140 }) {
  // pose: idle | attack | hurt | win | lose
  const bob = pose === 'idle' ? 'roosterBob 0.9s ease-in-out infinite' : 'none';
  const attack = pose === 'attack' ? `translateX(${dir * 18}px) rotate(${dir * -12}deg)` : '';
  const hurt = pose === 'hurt' ? `translateX(${-dir * 10}px) rotate(${dir * 8}deg)` : '';
  const win = pose === 'win' ? 'translateY(-8px)' : '';
  const lose = pose === 'lose' ? 'translateY(12px) rotate(25deg)' : '';
  const transform = `scaleX(${dir}) ${attack} ${hurt} ${win} ${lose}`;

  const body = color;
  const dark = shade(color, -0.25);
  const light = shade(color, 0.2);
  const comb = '#e53935';
  const beak = '#ffb300';
  const leg = '#f9a825';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      style={{
        transform,
        transformOrigin: '60px 90px',
        transition: 'transform 0.18s ease',
        animation: bob,
        filter: pose === 'win' ? 'drop-shadow(0 0 12px gold)' : 'drop-shadow(0 6px 10px rgba(0,0,0,0.45))',
      }}
    >
      {/* Tail feathers */}
      <path d="M28 55 Q8 40 12 22 Q22 38 32 48 Z" fill={dark} />
      <path d="M30 58 Q14 48 18 28 Q28 44 34 52 Z" fill={body} />
      <path d="M32 60 Q20 55 22 35 Q30 48 36 55 Z" fill={light} />
      {/* Body */}
      <ellipse cx="55" cy="62" rx="28" ry="24" fill={body} />
      <ellipse cx="58" cy="58" rx="18" ry="14" fill={light} opacity="0.35" />
      {/* Wing */}
      <path d="M48 58 Q38 70 52 78 Q62 70 58 58 Z" fill={dark} />
      <path d="M50 60 Q44 68 52 74 Q58 68 56 60 Z" fill={light} opacity="0.5" />
      {/* Neck */}
      <path d="M70 48 Q82 40 88 28 Q78 36 68 46 Z" fill={body} />
      <path d="M72 46 Q80 38 86 30 Q80 36 70 44 Z" fill={light} opacity="0.4" />
      {/* Head */}
      <circle cx="90" cy="26" r="12" fill={body} />
      {/* Comb */}
      <path d="M84 16 Q86 6 90 14 Q92 4 96 14 Q100 8 98 18 Z" fill={comb} />
      {/* Wattle */}
      <path d="M88 34 Q90 42 86 40 Q84 36 88 34" fill={comb} />
      {/* Beak */}
      <path d="M100 26 L112 28 L100 32 Z" fill={beak} />
      {/* Eye */}
      <circle cx="94" cy="24" r="3.2" fill="#111" />
      <circle cx="95" cy="23" r="1" fill="#fff" />
      {/* Legs */}
      <path d="M48 82 L44 102 M44 102 L38 100 M44 102 L44 108 M44 102 L50 106" stroke={leg} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M62 84 L66 104 M66 104 L60 102 M66 104 L66 110 M66 104 L72 106" stroke={leg} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      {/* Spur */}
      <path d="M45 96 L40 92" stroke="#ccc" strokeWidth="1.5" />
    </svg>
  );
}

function shade(hex, amt) {
  try {
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16);
    let r = (n >> 16) + Math.round(255 * amt);
    let g = ((n >> 8) & 255) + Math.round(255 * amt);
    let b = (n & 255) + Math.round(255 * amt);
    r = Math.max(0, Math.min(255, r));
    g = Math.max(0, Math.min(255, g));
    b = Math.max(0, Math.min(255, b));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  } catch {
    return hex;
  }
}

const BETS = [20, 50, 100, 500, 1000, 5000];

export default function CockFightGame() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState(null);
  const [balance, setBalance] = useState(0);
  const [bet, setBet] = useState(50);
  const [side, setSide] = useState('meron');
  const [fighting, setFighting] = useState(false);
  const [poseM, setPoseM] = useState('idle');
  const [poseW, setPoseW] = useState('idle');
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState('Pick MERON or WALA and place your bet');
  const [lastWin, setLastWin] = useState(0);
  const [history, setHistory] = useState([]);
  const timers = useRef([]);

  useEffect(() => {
    walletAPI.balance().then(({ data }) => setBalance(Number(data.balance) || 0)).catch(() => {});
    gameAPI.details(slug).then(({ data }) => {
      setGame(data);
      setBet(Number(data.min_bet) || 20);
    }).catch(() => navigate('/'));
    return () => timers.current.forEach(clearTimeout);
  }, [slug, navigate]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const runFightAnim = async (winner, rounds = 4) => {
    clearTimers();
    for (let i = 0; i < rounds; i++) {
      const meronAttacks = i % 2 === 0;
      await new Promise(r => {
        setPoseM(meronAttacks ? 'attack' : 'hurt');
        setPoseW(meronAttacks ? 'hurt' : 'attack');
        const t = setTimeout(r, 280);
        timers.current.push(t);
      });
      await new Promise(r => {
        setPoseM('idle');
        setPoseW('idle');
        const t = setTimeout(r, 120);
        timers.current.push(t);
      });
    }
    if (winner === 'draw') {
      setPoseM('idle');
      setPoseW('idle');
    } else if (winner === 'meron') {
      setPoseM('win');
      setPoseW('lose');
    } else {
      setPoseM('lose');
      setPoseW('win');
    }
  };

  const fight = async () => {
    if (fighting || !game || balance < bet) return;
    setFighting(true);
    setResult(null);
    setLastWin(0);
    setMessage('Fight!');
    setPoseM('idle');
    setPoseW('idle');

    try {
      const { data } = await gameAPI.cockfight(game.id, bet, side);
      setBalance(Number(data.balance) || 0);
      await runFightAnim(data.winner, data.rounds || 4);

      setResult(data);
      setLastWin(Number(data.totalWin) || 0);
      setHistory(prev => [{ winner: data.winner, side, win: data.totalWin }, ...prev].slice(0, 8));

      if (data.isPush) {
        setMessage(`DRAW — stake returned ₱${Number(data.totalWin).toLocaleString()}`);
      } else if (data.totalWin > 0 && data.side === data.winner) {
        setMessage(`🏆 ${data.winner.toUpperCase()} wins! You won ₱${Number(data.totalWin).toLocaleString()}`);
      } else {
        setMessage(`${data.winner.toUpperCase()} wins — better luck next bout`);
      }
    } catch (err) {
      setMessage(err.response?.data?.error || err.message || 'Fight failed');
      setPoseM('idle');
      setPoseW('idle');
    } finally {
      setFighting(false);
    }
  };

  if (!game) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a0a0a', color: '#c99' }}>
        Loading arena…
      </div>
    );
  }

  const minBet = Number(game.min_bet) || 10;
  const maxBet = Number(game.max_bet) || 20000;
  const quick = BETS.filter(v => v >= minBet && v <= maxBet);

  return (
    <div style={{
      minHeight: '100vh', maxWidth: 480, margin: '0 auto',
      background: 'linear-gradient(180deg, #1a0505 0%, #2a1010 40%, #1a0a08 100%)',
      color: '#ffe8e0', fontFamily: 'system-ui, sans-serif',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 14px', background: 'rgba(0,0,0,0.45)', borderBottom: '1px solid #5a2020',
      }}>
        <Link to="/" style={{ color: '#f88', textDecoration: 'none', fontWeight: 700 }}>← Lobby</Link>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 900, color: '#FFD700', fontSize: 14 }}>{game.name || 'Sabong Arena'}</div>
          <div style={{ fontSize: 10, color: '#a66' }}>COCKFIGHT · REAL MONEY</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: '#a66' }}>BALANCE</div>
          <div style={{ fontWeight: 800, color: '#FFD700' }}>₱{Number(balance).toLocaleString()}</div>
        </div>
      </div>

      {/* Arena */}
      <div style={{
        margin: '12px 12px 8px',
        borderRadius: 16,
        background: 'radial-gradient(ellipse at center, #3d2817 0%, #1a1008 70%)',
        border: '3px solid #8B4513',
        boxShadow: 'inset 0 0 40px rgba(0,0,0,0.5), 0 0 20px rgba(139,69,19,0.3)',
        minHeight: 260,
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Dust / ground */}
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, height: '40%',
          background: 'linear-gradient(0deg, #5d4037, transparent)', opacity: 0.5,
        }} />
        {/* VS badge */}
        <div style={{
          position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.6)', color: '#FFD700', fontWeight: 900,
          padding: '4px 14px', borderRadius: 20, fontSize: 13, zIndex: 2,
          border: '1px solid #FFD70055',
        }}>VS</div>

        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
          padding: '40px 8px 16px', height: '100%', boxSizing: 'border-box',
        }}>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#ff6b6b', marginBottom: 4 }}>MERON</div>
            <Rooster color="#c62828" dir={1} pose={poseM} size={130} />
          </div>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#64b5f6', marginBottom: 4 }}>WALA</div>
            <Rooster color="#1565c0" dir={-1} pose={poseW} size={130} />
          </div>
        </div>

        {result && (
          <div style={{
            position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
            background: result.winner === 'meron' ? '#c62828' : result.winner === 'wala' ? '#1565c0' : '#666',
            color: '#fff', fontWeight: 900, padding: '6px 16px', borderRadius: 12, fontSize: 14,
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          }}>
            {result.winner.toUpperCase()} WINS
          </div>
        )}
      </div>

      {/* Message */}
      <div style={{
        textAlign: 'center', padding: '6px 14px', minHeight: 36,
        fontWeight: 700, fontSize: 14, color: lastWin > 0 ? '#FFD700' : '#cbb',
      }}>
        {message}
      </div>

      {/* Side select */}
      <div style={{ display: 'flex', gap: 8, padding: '0 14px 10px' }}>
        {[
          { id: 'meron', label: 'MERON', sub: '1.95×', color: '#c62828' },
          { id: 'wala', label: 'WALA', sub: '1.95×', color: '#1565c0' },
          { id: 'draw', label: 'DRAW', sub: '8×', color: '#6a6a6a' },
        ].map(s => (
          <button
            key={s.id}
            type="button"
            disabled={fighting}
            onClick={() => setSide(s.id)}
            style={{
              flex: 1, padding: '12px 8px', borderRadius: 12, border: side === s.id ? `2px solid ${s.color}` : '1px solid #444',
              background: side === s.id ? `${s.color}33` : 'rgba(0,0,0,0.3)',
              color: side === s.id ? '#fff' : '#aaa', fontWeight: 900, cursor: fighting ? 'not-allowed' : 'pointer',
            }}
          >
            <div>{s.label}</div>
            <div style={{ fontSize: 11, opacity: 0.8 }}>{s.sub}</div>
          </button>
        ))}
      </div>

      {/* History */}
      {history.length > 0 && (
        <div style={{ padding: '0 14px 8px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {history.map((h, i) => (
            <span key={i} style={{
              fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
              background: h.winner === 'meron' ? '#c6282833' : h.winner === 'wala' ? '#1565c033' : '#333',
              color: h.winner === 'meron' ? '#ff8a80' : h.winner === 'wala' ? '#82b1ff' : '#bbb',
            }}>
              {h.winner.toUpperCase()}{h.win > 0 ? ` +₱${h.win}` : ''}
            </span>
          ))}
        </div>
      )}

      {/* Controls */}
      <div style={{
        marginTop: 'auto', padding: '12px 14px 20px',
        background: 'rgba(0,0,0,0.5)', borderTop: '1px solid #5a2020',
      }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {quick.map(v => (
            <button key={v} type="button" onClick={() => setBet(v)} disabled={fighting || v > balance}
              style={{
                padding: '8px 12px', borderRadius: 8, fontWeight: 700, fontSize: 12,
                border: bet === v ? '2px solid #FFD700' : '1px solid #444',
                background: bet === v ? 'rgba(255,215,0,0.15)' : 'rgba(255,255,255,0.04)',
                color: bet === v ? '#FFD700' : '#999',
                cursor: v > balance ? 'not-allowed' : 'pointer', opacity: v > balance ? 0.4 : 1,
              }}>₱{v}</button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: '#866' }}>BET</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#FFD700' }}>₱{bet.toLocaleString()}</div>
          </div>
          <button
            type="button"
            onClick={fight}
            disabled={fighting || balance < bet}
            style={{
              flex: 1.4, padding: '16px', borderRadius: 14, border: 'none',
              background: fighting || balance < bet
                ? '#333'
                : 'linear-gradient(135deg, #c62828, #FFD700, #1565c0)',
              color: fighting || balance < bet ? '#666' : '#1a0505',
              fontWeight: 900, fontSize: 16, letterSpacing: 1,
              cursor: fighting || balance < bet ? 'not-allowed' : 'pointer',
              boxShadow: fighting ? 'none' : '0 0 24px rgba(255,100,0,0.4)',
            }}
          >
            {fighting ? 'FIGHTING…' : 'FIGHT'}
          </button>
          <div style={{ flex: 1, textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: '#866' }}>LAST WIN</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: lastWin > 0 ? '#00e676' : '#555' }}>
              ₱{Number(lastWin).toLocaleString()}
            </div>
          </div>
        </div>
        <div style={{ fontSize: 11, color: '#655', marginTop: 8, textAlign: 'center' }}>
          Min ₱{minBet} · Max ₱{maxBet} · Admin controls win rate in Games panel
        </div>
      </div>

      <style>{`
        @keyframes roosterBob {
          0%, 100% { transform: scaleX(var(--dir, 1)) translateY(0); }
          50% { transform: scaleX(var(--dir, 1)) translateY(-4px); }
        }
      `}</style>
    </div>
  );
}
