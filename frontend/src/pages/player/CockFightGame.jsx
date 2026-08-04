import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { gameAPI, walletAPI } from '../../services/api';
import { createSabongArena } from '../../components/webgl/SabongArena.js';

/**
 * Sabong match — animated roosters in arena (Canvas2D + WebGL FX).
 * NOT a slot machine.
 */
const QUICK = [20, 50, 100, 500, 1000, 5000];

export default function CockFightGame() {
  const { slug } = useParams();
  const navigate = useNavigate();

  const arenaRef = useRef(null);
  const fxRef = useRef(null);
  const engineRef = useRef(null);
  const timers = useRef([]);
  const [arenaReady, setArenaReady] = useState(false);

  const [game, setGame] = useState(null);
  const [balance, setBalance] = useState(0);
  const [bet, setBet] = useState(50);
  const [side, setSide] = useState('meron');
  const [fighting, setFighting] = useState(false);
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState('Choose Meron or Wala, then start the fight');
  const [lastWin, setLastWin] = useState(0);
  const [history, setHistory] = useState([]);

  // Load game + balance
  useEffect(() => {
    walletAPI.balance().then(({ data }) => setBalance(Number(data.balance) || 0)).catch(() => {});
    gameAPI.details(slug).then(({ data }) => {
      setGame(data);
      setBet(Number(data.min_bet) || 20);
    }).catch(() => navigate('/'));
  }, [slug, navigate]);

  // Init arena AFTER canvases are mounted (depends on game so loading screen is gone)
  useEffect(() => {
    if (!game) return;
    // Wait one frame so refs attach to DOM
    let cancelled = false;
    const id = requestAnimationFrame(() => {
      if (cancelled || !arenaRef.current || !fxRef.current) return;
      // Destroy previous if any
      engineRef.current?.destroy();
      const eng = createSabongArena(arenaRef.current, fxRef.current);
      engineRef.current = eng;
      const w = Math.min(460, (arenaRef.current.parentElement?.clientWidth) || window.innerWidth - 16);
      eng.resize(Math.max(280, w), Math.round(Math.max(280, w) * 0.65));
      eng.setPoses('idle', 'idle');
      eng.start();
      setArenaReady(true);
    });

    const onResize = () => {
      const eng = engineRef.current;
      if (!eng || !arenaRef.current) return;
      const w = Math.min(460, arenaRef.current.parentElement?.clientWidth || window.innerWidth - 16);
      eng.resize(Math.max(280, w), Math.round(Math.max(280, w) * 0.65));
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
      window.removeEventListener('resize', onResize);
      engineRef.current?.destroy();
      engineRef.current = null;
      setArenaReady(false);
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [game]);

  const wait = (ms) => new Promise((r) => {
    const t = setTimeout(r, ms);
    timers.current.push(t);
  });

  const playFight = useCallback(async (winner, rounds = 6) => {
    const eng = engineRef.current;
    if (!eng) return;

    eng.setPoses('walk', 'walk');
    await wait(400);

    for (let i = 0; i < rounds; i++) {
      const meronHit = i % 2 === 0;
      eng.setPoses(meronHit ? 'attack' : 'hurt', meronHit ? 'hurt' : 'attack');
      eng.impact(meronHit ? '#c62828' : '#1565c0');
      await wait(380);
      eng.setPoses('walk', 'walk');
      await wait(160);
    }

    // Final decisive strike
    if (winner === 'meron') {
      eng.setPoses('attack', 'hurt');
      eng.impact('#c62828');
      await wait(400);
      eng.setPoses('win', 'lose');
      eng.impact('#FFD700');
    } else if (winner === 'wala') {
      eng.setPoses('hurt', 'attack');
      eng.impact('#1565c0');
      await wait(400);
      eng.setPoses('lose', 'win');
      eng.impact('#FFD700');
    } else {
      eng.setPoses('attack', 'attack');
      eng.impact('#FFD700');
      await wait(350);
      eng.setPoses('idle', 'idle');
    }
  }, []);

  const startFight = async () => {
    if (fighting || !game || balance < bet) return;
    if (!engineRef.current) {
      setMessage('Arena still loading — try again in a second');
      return;
    }
    setFighting(true);
    setResult(null);
    setLastWin(0);
    setMessage('Fight in progress…');

    try {
      const { data } = await gameAPI.cockfight(game.id, bet, side);
      setBalance(Number(data.balance) || 0);

      await playFight(data.winner, data.rounds || 6);

      setResult(data);
      setLastWin(Number(data.totalWin) || 0);
      setHistory((prev) => [{ winner: data.winner, side, win: data.totalWin }, ...prev].slice(0, 10));

      if (data.isPush) {
        setMessage(`Draw — ₱${Number(data.totalWin).toLocaleString()} stake returned`);
      } else if (data.side === data.winner && data.totalWin > 0) {
        setMessage(`${data.winner.toUpperCase()} wins! You won ₱${Number(data.totalWin).toLocaleString()}`);
      } else {
        setMessage(`${data.winner.toUpperCase()} wins the match`);
      }
    } catch (err) {
      setMessage(err.response?.data?.error || err.message || 'Fight failed');
      engineRef.current?.setPoses('idle', 'idle');
    } finally {
      setFighting(false);
    }
  };

  const minBet = Number(game?.min_bet) || 10;
  const maxBet = Number(game?.max_bet) || 20000;
  const quick = QUICK.filter((v) => v >= minBet && v <= maxBet);

  return (
    <div style={{
      minHeight: '100vh', maxWidth: 480, margin: '0 auto',
      background: 'linear-gradient(180deg, #120805, #1a0c08 50%, #0d0604)',
      color: '#f5e6d8', fontFamily: 'system-ui, sans-serif',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 12px', background: 'rgba(0,0,0,0.5)', borderBottom: '1px solid #5c2e1a',
      }}>
        <Link to="/" style={{ color: '#e8a070', textDecoration: 'none', fontWeight: 700 }}>← Lobby</Link>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 900, color: '#FFD700', fontSize: 14 }}>{game?.name || 'Sabong Arena'}</div>
          <div style={{ fontSize: 10, color: '#8a5', letterSpacing: 1 }}>
            {arenaReady ? 'LIVE ARENA' : 'LOADING ARENA…'}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: '#865' }}>BALANCE</div>
          <div style={{ fontWeight: 800, color: '#FFD700' }}>₱{Number(balance).toLocaleString()}</div>
        </div>
      </div>

      {/* Always mount canvases so refs exist (even while game loads) */}
      <div style={{
        position: 'relative', margin: '10px 8px', borderRadius: 12, overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)', minHeight: 200,
        background: '#2a1810',
      }}>
        <canvas ref={arenaRef} style={{ display: 'block', width: '100%', height: 'auto' }} />
        <canvas ref={fxRef} style={{
          position: 'absolute', left: 0, top: 0, width: '100%', height: '100%',
          pointerEvents: 'none',
        }} />
        {!arenaReady && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: '#a88', fontWeight: 700, background: 'rgba(0,0,0,0.3)',
          }}>
            Drawing roosters…
          </div>
        )}
        {result && (
          <div style={{
            position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
            background: result.winner === 'meron' ? '#c62828' : result.winner === 'wala' ? '#1565c0' : '#555',
            color: '#fff', fontWeight: 900, padding: '8px 18px', borderRadius: 10, fontSize: 15,
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)', zIndex: 2,
          }}>
            {result.winner.toUpperCase()} WINS
          </div>
        )}
      </div>

      <div style={{
        textAlign: 'center', padding: '4px 14px 8px', minHeight: 40,
        fontWeight: 700, fontSize: 14, color: lastWin > 0 ? '#FFD700' : '#c4a090',
      }}>
        {message}
      </div>

      <div style={{ display: 'flex', gap: 8, padding: '0 12px 10px' }}>
        {[
          { id: 'meron', label: 'MERON', odds: '1.95×', color: '#c62828', hint: 'Red cock' },
          { id: 'wala', label: 'WALA', odds: '1.95×', color: '#1565c0', hint: 'Blue cock' },
          { id: 'draw', label: 'DRAW', odds: '8×', color: '#6d4c41', hint: 'Tie' },
        ].map((s) => (
          <button
            key={s.id}
            type="button"
            disabled={fighting}
            onClick={() => setSide(s.id)}
            style={{
              flex: 1, padding: '12px 6px', borderRadius: 12,
              cursor: fighting ? 'not-allowed' : 'pointer',
              border: side === s.id ? `2px solid ${s.color}` : '1px solid #3a2218',
              background: side === s.id ? `${s.color}40` : 'rgba(0,0,0,0.35)',
              color: side === s.id ? '#fff' : '#a89888', fontWeight: 900,
            }}
          >
            <div style={{ fontSize: 14 }}>{s.label}</div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>{s.odds}</div>
            <div style={{ fontSize: 10, fontWeight: 600, opacity: 0.6 }}>{s.hint}</div>
          </button>
        ))}
      </div>

      {history.length > 0 && (
        <div style={{ padding: '0 12px 8px', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: '#765', fontWeight: 700 }}>LAST BOUTS</span>
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

      <div style={{
        marginTop: 'auto', padding: '12px 12px 20px',
        background: 'rgba(0,0,0,0.55)', borderTop: '1px solid #5c2e1a',
      }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {quick.map((v) => (
            <button key={v} type="button" onClick={() => setBet(v)} disabled={fighting || v > balance}
              style={{
                padding: '8px 12px', borderRadius: 8, fontWeight: 700, fontSize: 12,
                border: bet === v ? '2px solid #FFD700' : '1px solid #3a2218',
                background: bet === v ? 'rgba(255,215,0,0.12)' : 'rgba(255,255,255,0.03)',
                color: bet === v ? '#FFD700' : '#9a8',
                opacity: v > balance ? 0.35 : 1, cursor: v > balance ? 'not-allowed' : 'pointer',
              }}>₱{v}</button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: '#765' }}>STAKE</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#FFD700' }}>₱{bet.toLocaleString()}</div>
          </div>
          <button
            type="button"
            onClick={startFight}
            disabled={fighting || !game || balance < bet || !arenaReady}
            style={{
              flex: 1.6, padding: '16px 12px', borderRadius: 14, border: 'none',
              background: fighting || balance < bet || !arenaReady
                ? '#2a1a12'
                : 'linear-gradient(135deg, #8B0000, #c62828 40%, #FFD700 100%)',
              color: fighting || balance < bet || !arenaReady ? '#555' : '#1a0800',
              fontWeight: 900, fontSize: 17, letterSpacing: 1,
              cursor: fighting || balance < bet || !arenaReady ? 'not-allowed' : 'pointer',
              boxShadow: fighting ? 'none' : '0 0 28px rgba(200,40,40,0.45)',
            }}
          >
            {fighting ? 'FIGHTING…' : !arenaReady ? 'LOADING…' : 'START FIGHT'}
          </button>
          <div style={{ flex: 1, textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: '#765' }}>PAYOUT</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: lastWin > 0 ? '#69f0ae' : '#444' }}>
              ₱{Number(lastWin).toLocaleString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
