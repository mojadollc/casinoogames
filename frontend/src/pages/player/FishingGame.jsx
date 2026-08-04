import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { gameAPI, walletAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useFishingRoom } from '../../hooks/useSocket';

const BET_OPTIONS = [1, 2, 5, 10, 20, 50, 100];

let audioCtx = null;
const ctx = () => {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
};
const tone = (freq, dur, type = 'sine', vol = 0.12) => {
  try {
    const c = ctx();
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, c.currentTime);
    g.gain.setValueAtTime(vol, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.connect(g); g.connect(c.destination);
    o.start(); o.stop(c.currentTime + dur);
  } catch {}
};
const sfx = {
  fire: () => { tone(180, 0.08, 'square', 0.08); tone(320, 0.06, 'sawtooth', 0.05); },
  miss: () => { tone(90, 0.12, 'sine', 0.06); },
  catch: () => { [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.15, 'sine', 0.1), i * 60)); },
  boss: () => { [200, 300, 450, 600].forEach((f, i) => setTimeout(() => tone(f, 0.2, 'sawtooth', 0.08), i * 80)); },
};

let _fx = 1;
const uid = () => _fx++;

function Bubbles() {
  const items = useRef(
    Array.from({ length: 16 }, (_, i) => ({
      id: i, left: Math.random() * 100, delay: Math.random() * 8,
      dur: 6 + Math.random() * 8, size: 4 + Math.random() * 10,
    }))
  ).current;
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 1 }}>
      {items.map(b => (
        <div key={b.id} style={{
          position: 'absolute', left: `${b.left}%`, bottom: -20,
          width: b.size, height: b.size, borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.08)',
          animation: `bubbleUp ${b.dur}s linear ${b.delay}s infinite`,
        }} />
      ))}
    </div>
  );
}

function Cannon({ angle, power }) {
  const barrelLen = 36 + power * 4;
  return (
    <div style={{ position: 'absolute', left: '50%', bottom: 8, transform: 'translateX(-50%)', zIndex: 15, pointerEvents: 'none' }}>
      <div style={{
        width: 56, height: 22, background: 'linear-gradient(180deg,#555,#222)',
        borderRadius: '8px 8px 4px 4px', border: '2px solid #888', margin: '0 auto',
        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
      }} />
      <div style={{
        position: 'absolute', left: '50%', bottom: 18, width: 14, height: barrelLen, marginLeft: -7,
        transformOrigin: '50% 100%', transform: `rotate(${angle}deg)`,
        background: 'linear-gradient(90deg,#666,#ddd 40%,#666)', borderRadius: '6px 6px 2px 2px',
        border: '1px solid #999',
      }}>
        <div style={{
          position: 'absolute', top: -6, left: '50%', marginLeft: -8, width: 16, height: 10, borderRadius: '50%',
          background: 'radial-gradient(circle,#ffd700,#ff8c00)', boxShadow: '0 0 10px #ffd700',
        }} />
      </div>
    </div>
  );
}

export default function FishingGame() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const areaRef = useRef(null);

  const [game, setGame] = useState(null);
  const [balance, setBalance] = useState(0);
  const [bet, setBet] = useState(5);
  const [bullets, setBullets] = useState([]);
  const [fx, setFx] = useState([]);
  const [lastWin, setLastWin] = useState(0);
  const [sessionWin, setSessionWin] = useState(0);
  const [combo, setCombo] = useState(0);
  const [message, setMessage] = useState('Connecting to ocean…');
  const [autoMode, setAutoMode] = useState(false);
  const [cannonAngle, setCannonAngle] = useState(0);
  const [busy, setBusy] = useState(false);
  const [shots, setShots] = useState(0);
  const [catches, setCatches] = useState(0);

  // Multiplayer shared state
  const { connected, synced, fishes, players, catchFeed } = useFishingRoom(game?.id, user);

  const fishesRef = useRef(fishes);
  fishesRef.current = fishes;
  const balanceRef = useRef(balance);
  balanceRef.current = balance;
  const betRef = useRef(bet);
  betRef.current = bet;
  const busyRef = useRef(false);
  const userIdRef = useRef(user?.id);
  userIdRef.current = user?.id;

  useEffect(() => {
    walletAPI.balance().then(({ data }) => setBalance(Number(data.balance) || 0)).catch(() => {});
    gameAPI.details(slug).then(({ data }) => {
      setGame(data);
      const minB = Number(data.min_bet) || 1;
      setBet(minB <= 5 ? 5 : minB);
    }).catch(() => navigate('/'));
  }, [slug, navigate]);

  useEffect(() => {
    if (synced) setMessage('Tap a fish to shoot! Others hunt in this ocean too.');
    else if (connected) setMessage('Syncing ocean…');
    else setMessage('Connecting…');
  }, [synced, connected]);

  // Show other players' catches
  useEffect(() => {
    if (!catchFeed.length) return;
    const latest = catchFeed[0];
    if (!latest || latest.userId === userIdRef.current) return;
    setMessage(`${latest.username} caught ${latest.fish?.emoji || '🐟'} +₱${Number(latest.totalWin || 0).toLocaleString()}`);
  }, [catchFeed]);

  const onPointerMove = useCallback((e) => {
    const rect = areaRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.bottom - 20;
    const x = (e.clientX ?? e.touches?.[0]?.clientX) - cx;
    const y = cy - (e.clientY ?? e.touches?.[0]?.clientY);
    const deg = Math.atan2(x, Math.max(8, y)) * (180 / Math.PI);
    setCannonAngle(Math.max(-70, Math.min(70, deg)));
  }, []);

  const addFx = (items) => {
    const tagged = items.map(it => ({ ...it, id: uid() }));
    setFx(prev => [...prev, ...tagged]);
    setTimeout(() => setFx(prev => prev.filter(p => !tagged.find(t => t.id === p.id))), 900);
  };

  const fireBullet = (fromX, fromY, toX, toY) => {
    const id = uid();
    setBullets(prev => [...prev, { id, x: fromX, y: fromY, tx: toX, ty: toY }]);
    setTimeout(() => setBullets(prev => prev.filter(b => b.id !== id)), 280);
  };

  const shoot = async (fish) => {
    if (busyRef.current || !game) return;
    if (balanceRef.current < betRef.current) {
      setMessage('Insufficient balance — deposit to keep hunting!');
      setAutoMode(false);
      return;
    }

    busyRef.current = true;
    setBusy(true);
    sfx.fire();
    setShots(s => s + 1);

    const rect = areaRef.current?.getBoundingClientRect();
    if (rect) {
      const fromX = rect.width / 2;
      const fromY = rect.height - 24;
      const toX = (fish.x / 100) * rect.width;
      const toY = (fish.y / 100) * rect.height;
      const deg = Math.atan2(toX - fromX, fromY - toY) * (180 / Math.PI);
      setCannonAngle(Math.max(-70, Math.min(70, deg)));
      fireBullet(fromX, fromY, toX, toY);
    }

    try {
      const { data } = await gameAPI.fishingShoot(game.id, betRef.current, { fishId: fish.id });
      setBalance(Number(data.balance) || 0);

      if (data.hit && data.fish) {
        sfx.catch();
        if ((data.fish.multiplier || 0) >= 8) sfx.boss();
        setLastWin(data.totalWin);
        setSessionWin(w => w + data.totalWin);
        setCombo(c => c + 1);
        setCatches(c => c + 1);
        setMessage(`You caught ${data.fish.emoji || fish.emoji} ${data.fish.name || fish.label}! +₱${Number(data.totalWin).toLocaleString()}`);
        if (rect) {
          const px = (fish.x / 100) * rect.width;
          const py = (fish.y / 100) * rect.height;
          addFx([
            { kind: 'text', x: px, y: py, text: `+₱${data.totalWin}`, color: '#FFD700' },
            { kind: 'burst', x: px, y: py, color: fish.color || '#FFD700' },
          ]);
        }
      } else {
        sfx.miss();
        setCombo(0);
        setMessage('Miss! Fish escaped…');
        if (rect) {
          const px = (fish.x / 100) * rect.width;
          const py = (fish.y / 100) * rect.height;
          addFx([{ kind: 'text', x: px, y: py, text: 'MISS', color: '#90A4AE' }]);
        }
      }
    } catch (err) {
      setMessage(err.response?.data?.error || 'Shot failed');
      setAutoMode(false);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  // Auto-hunt
  useEffect(() => {
    if (!autoMode) return;
    const t = setInterval(() => {
      if (busyRef.current) return;
      if (balanceRef.current < betRef.current) {
        setAutoMode(false);
        setMessage('Auto stopped — low balance');
        return;
      }
      const list = fishesRef.current;
      if (!list.length) return;
      const ranked = [...list].sort((a, b) => (b.maxHp || 1) - (a.maxHp || 1));
      const target = ranked[Math.floor(Math.random() * Math.min(3, ranked.length))];
      if (target) shoot(target);
    }, 750);
    return () => clearInterval(t);
  }, [autoMode, game]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!game) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#001a33', color: '#7ec8ff' }}>
        Loading ocean…
      </div>
    );
  }

  const power = Math.min(6, Math.max(1, Math.ceil(Math.log10(bet + 1) * 2)));

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #001528 0%, #003355 40%, #004466 100%)',
      color: '#e8f4ff', fontFamily: 'system-ui, sans-serif',
      display: 'flex', flexDirection: 'column', maxWidth: 480, margin: '0 auto', position: 'relative', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', background: 'rgba(0,10,30,0.85)', borderBottom: '1px solid rgba(0,200,255,0.2)', zIndex: 30,
      }}>
        <Link to="/" style={{ color: '#7ec8ff', textDecoration: 'none', fontWeight: 700, fontSize: 14 }}>← Lobby</Link>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#FFD700' }}>{game.name || 'Ocean King'}</div>
          <div style={{ fontSize: 10, color: connected ? '#2ecc71' : '#e74c3c' }}>
            {connected ? `● LIVE · ${players.length} hunter${players.length === 1 ? '' : 's'}` : '○ Offline'}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: '#6a9' }}>BALANCE</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#FFD700' }}>₱{Number(balance).toLocaleString('en', { minimumFractionDigits: 2 })}</div>
        </div>
      </div>

      {/* Players strip */}
      {players.length > 0 && (
        <div style={{
          display: 'flex', gap: 6, padding: '6px 12px', overflowX: 'auto', fontSize: 11,
          background: 'rgba(0,20,40,0.7)', zIndex: 30, alignItems: 'center',
        }}>
          <span style={{ color: '#5a9', flexShrink: 0 }}>In ocean:</span>
          {players.map(p => (
            <span key={p.userId} style={{
              padding: '2px 8px', borderRadius: 10, flexShrink: 0,
              background: p.userId === user?.id ? 'rgba(255,215,0,0.2)' : 'rgba(0,100,150,0.35)',
              color: p.userId === user?.id ? '#FFD700' : '#9cd',
              border: p.userId === user?.id ? '1px solid #FFD70055' : '1px solid transparent',
            }}>
              {p.userId === user?.id ? 'You' : p.username}
            </span>
          ))}
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'flex', gap: 8, padding: '4px 12px', fontSize: 11, color: '#8bc', background: 'rgba(0,20,40,0.5)', zIndex: 30 }}>
        <span>Session <b style={{ color: '#FFD700' }}>₱{sessionWin.toLocaleString()}</b></span>
        <span>·</span>
        <span>Catches <b style={{ color: '#7f7' }}>{catches}</b></span>
        <span>·</span>
        <span>Shots <b>{shots}</b></span>
        {combo > 1 && <span style={{ marginLeft: 'auto', color: '#ff6', fontWeight: 800 }}>COMBO x{combo}</span>}
      </div>

      {/* Ocean */}
      <div
        ref={areaRef}
        onMouseMove={onPointerMove}
        onTouchMove={onPointerMove}
        style={{
          flex: 1, position: 'relative', margin: '8px 10px', borderRadius: 16, overflow: 'hidden',
          background: 'linear-gradient(180deg, #0a4a6e 0%, #0d6a8f 35%, #087a7a 70%, #0a5a4a 100%)',
          boxShadow: 'inset 0 0 60px rgba(0,0,0,0.35), 0 0 0 2px rgba(0,200,255,0.25)',
          minHeight: 360, cursor: 'crosshair',
        }}
      >
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
          background: 'radial-gradient(ellipse 80% 40% at 50% -10%, rgba(255,255,255,0.18), transparent 60%)',
        }} />
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, height: 48, zIndex: 2, pointerEvents: 'none',
          background: 'linear-gradient(0deg, rgba(20,40,20,0.9), transparent)',
        }} />
        <Bubbles />

        {/* Shared fish from server */}
        {fishes.map(f => (
          <div
            key={f.id}
            onClick={() => shoot(f)}
            style={{
              position: 'absolute', left: `${f.x}%`, top: `${f.y}%`,
              fontSize: f.size || 32, lineHeight: 1,
              transform: `translate(-50%, -50%) scaleX(${(f.dir || 1) < 0 ? -1 : 1})`,
              cursor: 'pointer', zIndex: 10,
              filter: `drop-shadow(0 0 6px ${(f.color || '#4FC3F7')}88)`,
              userSelect: 'none',
              textShadow: f.type === 'dragon' ? '0 0 20px #FFD700' : undefined,
            }}
            title={`${f.label || f.type} · HP ${f.hp}/${f.maxHp}`}
          >
            {f.emoji}
            {(f.maxHp || 1) > 1 && (
              <div style={{
                position: 'absolute', bottom: -6, left: '50%',
                transform: `translateX(-50%) scaleX(${(f.dir || 1) < 0 ? -1 : 1})`,
                width: 36, height: 4, background: 'rgba(0,0,0,0.5)', borderRadius: 2, overflow: 'hidden',
              }}>
                <div style={{
                  width: `${((f.hp || 1) / (f.maxHp || 1)) * 100}%`, height: '100%',
                  background: (f.hp || 1) > (f.maxHp || 1) * 0.5 ? '#2ecc71' : '#e74c3c',
                }} />
              </div>
            )}
          </div>
        ))}

        {bullets.map(b => (
          <div key={b.id} style={{
            position: 'absolute', left: b.x, top: b.y, width: 10, height: 10, borderRadius: '50%',
            background: 'radial-gradient(circle, #fff 0%, #ffd700 40%, #ff8c00 100%)',
            boxShadow: '0 0 14px #ffd700', transform: 'translate(-50%, -50%)',
            animation: 'bulletFly 0.28s linear forwards',
            ['--tx']: `${b.tx - b.x}px`, ['--ty']: `${b.ty - b.y}px`,
            zIndex: 12, pointerEvents: 'none',
          }} />
        ))}

        {fx.map(item =>
          item.kind === 'text' ? (
            <div key={item.id} style={{
              position: 'absolute', left: item.x, top: item.y, transform: 'translate(-50%, -50%)',
              color: item.color, fontWeight: 900, fontSize: 18, textShadow: '0 2px 8px rgba(0,0,0,0.8)',
              animation: 'floatUp 1s ease-out forwards', pointerEvents: 'none', zIndex: 20, whiteSpace: 'nowrap',
            }}>{item.text}</div>
          ) : (
            <div key={item.id} style={{ position: 'absolute', left: item.x, top: item.y, zIndex: 18, pointerEvents: 'none' }}>
              {Array.from({ length: 10 }, (_, i) => {
                const a = (i / 10) * Math.PI * 2;
                const d = 28 + (i % 3) * 12;
                return (
                  <div key={i} style={{
                    position: 'absolute', width: 4, height: 4, borderRadius: '50%',
                    background: item.color || '#FFD700',
                    animation: 'particleOut 0.7s ease-out forwards',
                    ['--dx']: `${Math.cos(a) * d}px`, ['--dy']: `${Math.sin(a) * d}px`,
                  }} />
                );
              })}
            </div>
          )
        )}

        <Cannon angle={cannonAngle} power={power} />

        {/* Live catch ticker */}
        {catchFeed[0] && catchFeed[0].userId !== user?.id && (
          <div style={{
            position: 'absolute', top: 10, left: 10, right: 10, zIndex: 25,
            background: 'rgba(0,0,0,0.55)', borderRadius: 8, padding: '6px 10px',
            fontSize: 12, color: '#FFD700', textAlign: 'center',
            border: '1px solid rgba(255,215,0,0.25)',
            animation: 'floatUp 2.5s ease-out forwards',
          }}>
            {catchFeed[0].username} caught {catchFeed[0].fish?.emoji} ₱{Number(catchFeed[0].totalWin || 0).toLocaleString()}
          </div>
        )}
      </div>

      <div style={{ textAlign: 'center', padding: '4px 12px', minHeight: 28, fontSize: 13, fontWeight: 700, color: lastWin > 0 ? '#FFD700' : '#9cd' }}>
        {message}
      </div>

      <div style={{ padding: '10px 14px 18px', background: 'rgba(0,12,28,0.95)', borderTop: '1px solid rgba(0,180,255,0.2)', zIndex: 30 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 11, color: '#6a9', width: 28 }}>BET</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, flex: 1 }}>
            {BET_OPTIONS.map(v => (
              <button key={v} type="button" onClick={() => setBet(v)} disabled={busy || v > balance}
                style={{
                  padding: '6px 10px', borderRadius: 8,
                  border: bet === v ? '2px solid #FFD700' : '1px solid #245',
                  background: bet === v ? 'rgba(255,215,0,0.15)' : 'rgba(0,40,60,0.6)',
                  color: bet === v ? '#FFD700' : '#8bc', fontWeight: 700, fontSize: 12,
                  cursor: v > balance ? 'not-allowed' : 'pointer', opacity: v > balance ? 0.4 : 1,
                }}>₱{v}</button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" onClick={() => setAutoMode(a => !a)} disabled={balance < bet}
            style={{
              flex: 1, padding: '12px', borderRadius: 12, border: 'none', fontWeight: 800, fontSize: 14,
              background: autoMode ? 'linear-gradient(135deg,#e74c3c,#c0392b)' : 'linear-gradient(135deg,#1abc9c,#16a085)',
              color: '#fff', cursor: balance < bet ? 'not-allowed' : 'pointer',
            }}>
            {autoMode ? '⏹ STOP AUTO' : '▶ AUTO HUNT'}
          </button>
          <div style={{
            minWidth: 90, textAlign: 'center', padding: '8px 10px', borderRadius: 12,
            background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.25)',
          }}>
            <div style={{ fontSize: 10, color: '#a80' }}>LAST WIN</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#FFD700' }}>₱{Number(lastWin).toLocaleString()}</div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes bubbleUp {
          0% { transform: translateY(0) scale(1); opacity: 0.6; }
          100% { transform: translateY(-110vh) scale(0.6); opacity: 0; }
        }
        @keyframes floatUp {
          0% { transform: translate(-50%, -50%) scale(0.6); opacity: 0; }
          20% { opacity: 1; }
          100% { transform: translate(-50%, -140%) scale(1); opacity: 0; }
        }
        @keyframes particleOut {
          0% { transform: translate(0,0) scale(1); opacity: 1; }
          100% { transform: translate(var(--dx), var(--dy)) scale(0); opacity: 0; }
        }
        @keyframes bulletFly {
          0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          100% { transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) scale(0.4); opacity: 0.2; }
        }
      `}</style>
    </div>
  );
}
