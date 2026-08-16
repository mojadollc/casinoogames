import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { gameAPI, walletAPI } from '../../services/api';
import WebGLWheelView from '../../components/webgl/WebGLWheel.jsx';

// ── Wheel Audio Engine ──────────────────────────────────────────────────────────
let wAC = null;
let wheelSpinNodes = null;
let tickInterval = null;

function getWAC() {
  if (!wAC) { const A = window.AudioContext || window.webkitAudioContext; wAC = new A(); }
  if (wAC.state === 'suspended') wAC.resume();
  return wAC;
}

function makeNoise(ac) {
  const buf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

// Wheel spinning — ball rolling on track sound
function startWheelSpinSound() {
  const ac = getWAC();
  const t  = ac.currentTime;
  const master = ac.createGain();
  master.gain.setValueAtTime(0, t);
  master.gain.linearRampToValueAtTime(0.25, t + 0.4);
  master.connect(ac.destination);

  // Rolling ball: filtered noise through bandpass
  const noise = ac.createBufferSource();
  noise.buffer = makeNoise(ac);
  noise.loop = true;
  const bpf = ac.createBiquadFilter();
  bpf.type = 'bandpass'; bpf.frequency.value = 800; bpf.Q.value = 2.5;
  const nGain = ac.createGain(); nGain.gain.value = 0.5;
  noise.connect(bpf); bpf.connect(nGain); nGain.connect(master);
  noise.start();

  // Mechanical whirr: sawtooth through lowpass
  const whirr = ac.createOscillator();
  whirr.type = 'sawtooth'; whirr.frequency.value = 62;
  const lpf = ac.createBiquadFilter();
  lpf.type = 'lowpass'; lpf.frequency.value = 200;
  const wGain = ac.createGain(); wGain.gain.value = 0.3;
  whirr.connect(lpf); lpf.connect(wGain); wGain.connect(master);
  whirr.start();

  // High shimmer
  const shimmer = ac.createOscillator();
  shimmer.type = 'sine'; shimmer.frequency.value = 2200;
  const sGain = ac.createGain(); sGain.gain.value = 0.03;
  shimmer.connect(sGain); sGain.connect(master);
  shimmer.start();

  wheelSpinNodes = { master, noise, whirr, shimmer };
}

function stopWheelSpinSound() {
  if (!wheelSpinNodes || !wAC) return;
  const { master, noise, whirr, shimmer } = wheelSpinNodes;
  const t = wAC.currentTime;
  master.gain.setValueAtTime(master.gain.value, t);
  master.gain.linearRampToValueAtTime(0, t + 0.25);
  setTimeout(() => {
    try { noise.stop(); whirr.stop(); shimmer.stop(); } catch(e) {}
    wheelSpinNodes = null;
  }, 300);
}

// Segment tick — clicker sound as wheel passes each divider
function startSegmentTicks(segmentCount, initialBpm = 420) {
  stopSegmentTicks();
  const ac = getWAC();
  let bpm = initialBpm;
  let lastTick = 0;

  function tick() {
    const t = ac.currentTime;
    if (t - lastTick < 60 / bpm) return;
    lastTick = t;

    // Sharp click: noise burst through highpass
    const buf = makeNoise(ac);
    const src = ac.createBufferSource(); src.buffer = buf;
    const hpf = ac.createBiquadFilter(); hpf.type = 'highpass'; hpf.frequency.value = 3500;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.025);
    src.connect(hpf); hpf.connect(g); g.connect(ac.destination);
    src.start(t); src.stop(t + 0.025);

    // Slow down gradually
    bpm = Math.max(60, bpm * 0.992);
  }

  tickInterval = setInterval(tick, 14);
}

function stopSegmentTicks() {
  if (tickInterval) { clearInterval(tickInterval); tickInterval = null; }
}

// Final stop thud when wheel locks
function playWheelStopSound() {
  const ac = getWAC();
  const t  = ac.currentTime;

  // Heavy thud
  const thud = ac.createOscillator(); const tg = ac.createGain();
  thud.type = 'sine'; thud.frequency.setValueAtTime(180, t);
  thud.frequency.exponentialRampToValueAtTime(50, t + 0.1);
  tg.gain.setValueAtTime(0.6, t); tg.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  thud.connect(tg); tg.connect(ac.destination); thud.start(t); thud.stop(t + 0.18);

  // Metallic snap
  const snap = ac.createBufferSource(); snap.buffer = makeNoise(ac);
  const hpf = ac.createBiquadFilter(); hpf.type = 'highpass'; hpf.frequency.value = 2800;
  const sg = ac.createGain();
  sg.gain.setValueAtTime(0.45, t); sg.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
  snap.connect(hpf); hpf.connect(sg); sg.connect(ac.destination);
  snap.start(t); snap.stop(t + 0.07);

  // Spring resonance
  const spring = ac.createOscillator(); const spg = ac.createGain();
  spring.type = 'sine'; spring.frequency.setValueAtTime(380, t);
  spring.frequency.exponentialRampToValueAtTime(240, t + 0.15);
  spg.gain.setValueAtTime(0.2, t); spg.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
  spring.connect(spg); spg.connect(ac.destination); spring.start(t); spring.stop(t + 0.22);
}

// Win coin cascade
function playWheelWinSound(big = false) {
  const ac  = getWAC();
  const t0  = ac.currentTime;
  const cnt = big ? 20 : 10;
  const dur = big ? 1.6 : 0.9;

  for (let i = 0; i < cnt; i++) {
    const ct = t0 + (i / cnt) * dur;
    // Coin clink: tight bandpass noise
    const buf = makeNoise(ac);
    const src = ac.createBufferSource(); src.buffer = buf;
    const bpf = ac.createBiquadFilter();
    bpf.type = 'bandpass'; bpf.frequency.value = 2800 + Math.random() * 1200; bpf.Q.value = 20;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.3, ct); g.gain.exponentialRampToValueAtTime(0.001, ct + 0.08);
    src.connect(bpf); bpf.connect(g); g.connect(ac.destination);
    src.start(ct); src.stop(ct + 0.08);
    // Resonant ring
    const ring = ac.createOscillator(); const rg = ac.createGain();
    ring.type = 'sine'; ring.frequency.value = 1500 + Math.random() * 700;
    rg.gain.setValueAtTime(0.14, ct); rg.gain.exponentialRampToValueAtTime(0.001, ct + 0.15);
    ring.connect(rg); rg.connect(ac.destination); ring.start(ct); ring.stop(ct + 0.15);
  }

  // Rising chime for big wins
  if (big) {
    [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
      const t = t0 + dur + i * 0.11;
      const o = ac.createOscillator(); const g = ac.createGain();
      o.type = 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(0.24, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + 0.45);
    });
  }
}

const GAME_CONFIG = {
  'crazy-time': {
    title: 'Crazy Time', emoji: '🎡', accent: '#FF2D75',
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
    title: 'Lightning Roulette', emoji: '⚡', accent: '#FFD700',
    segments: Array.from({ length: 37 }, (_, i) => ({
      label: String(i),
      color: i === 0 ? '#2E7D32' : i % 2 === 0 ? '#C62828' : '#212121',
      multiplier: 35,
    })),
  },
  'dream-catcher': {
    title: 'Dream Catcher', emoji: '🎯', accent: '#7C4DFF',
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
    title: 'Monopoly Live', emoji: '🎩', accent: '#FFD700',
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
  if (s.includes('crazy')) return GAME_CONFIG['crazy-time'];
  if (s.includes('monopoly')) return GAME_CONFIG['monopoly-live'];
  if (s.includes('lightning') || s.includes('roulette')) return GAME_CONFIG['lightning-roulette'];
  if (s.includes('dream')) return GAME_CONFIG['dream-catcher'];
  for (const key of Object.keys(GAME_CONFIG)) {
    if (s.includes(key)) return GAME_CONFIG[key];
  }
  return GAME_CONFIG['dream-catcher'];
}

export default function LiveGame() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const config = useMemo(() => resolveConfig(slug), [slug]);

  const [game, setGame] = useState(null);
  const [balance, setBalance] = useState(0);
  const [bet, setBet] = useState(50);
  const [spinning, setSpinning] = useState(false);
  const [targetIndex, setTargetIndex] = useState(null);
  const [result, setResult] = useState(null);
  const [lastWin, setLastWin] = useState(0);
  const [message, setMessage] = useState('Place a bet and spin!');
  const [history, setHistory] = useState([]);
  const [celebrate, setCelebrate] = useState(false);
  const [lightsOn, setLightsOn] = useState(false);
  const [pendingResult, setPendingResult] = useState(null);
  const pendingRef = useRef(null);

  useEffect(() => {
    walletAPI.balance().then(({ data }) => setBalance(Number(data.balance) || 0)).catch(() => {});
    gameAPI.details(slug).then(({ data }) => {
      setGame(data);
      setBet(Number(data.min_bet) || 50);
    }).catch(() => navigate('/'));
  }, [slug, navigate]);

  useEffect(() => {
    if (!spinning) { setLightsOn(false); return; }
    const t = setInterval(() => setLightsOn(v => !v), 160);
    return () => clearInterval(t);
  }, [spinning]);

  const onSpinEnd = useCallback(() => {
    const pending = pendingRef.current;
    stopWheelSpinSound();
    stopSegmentTicks();
    playWheelStopSound();
    if (!pending) { setSpinning(false); return; }
    const { displaySeg, totalWin } = pending;
    setResult(displaySeg);
    setLastWin(totalWin);
    setHistory(prev => [{ segment: displaySeg, win: totalWin }, ...prev].slice(0, 10));
    if (totalWin > 0) {
      setTimeout(() => playWheelWinSound(totalWin > 500), 180);
      setCelebrate(true);
      setMessage(`🎉 ${displaySeg.label}! You won ₱${totalWin.toLocaleString()}`);
      setTimeout(() => setCelebrate(false), 100);
    } else {
      setMessage(`${displaySeg.label} — Better luck next time!`);
    }
    pendingRef.current = null;
    setPendingResult(null);
    setSpinning(false);
  }, []);

  const spin = async () => {
    if (spinning || !game || balance < bet) return;
    setSpinning(true);
    setResult(null);
    setLastWin(0);
    setCelebrate(false);
    setMessage('Wheel is spinning…');
    setTargetIndex(null);
    startWheelSpinSound();
    startSegmentTicks(config.segments.length);

    try {
      // Server-authoritative: admin win_rate / force_outcome / max_payout / dry_run
      const { data } = await gameAPI.play(game.id, { betAmount: bet });
      setBalance(Number(data.balance) || 0);

      const segments = config.segments;
      let idx = typeof data.segmentIndex === 'number' ? data.segmentIndex : 0;
      if (idx < 0 || idx >= segments.length) idx = 0;

      const serverSeg = data.segment || {};
      const displaySeg = {
        ...segments[idx],
        ...serverSeg,
        label: serverSeg.label || segments[idx].label,
        color: segments[idx].color,
        multiplier: serverSeg.multiplier ?? segments[idx].multiplier,
      };

      const pending = { displaySeg, totalWin: Number(data.totalWin) || 0 };
      pendingRef.current = pending;
      setPendingResult(pending);
      // Kick WebGL spin toward this index
      setTargetIndex(idx);
    } catch (err) {
      stopWheelSpinSound();
      stopSegmentTicks();
      setMessage(err.response?.data?.error || err.message || 'Spin failed');
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
  const wheelSize = Math.min(320, typeof window !== 'undefined' ? window.innerWidth - 48 : 320);

  return (
    <div style={{
      minHeight: '100vh', maxWidth: 480, margin: '0 auto',
      background: 'linear-gradient(165deg, #0a0a18 0%, #12122a 45%, #1a0a20 100%)',
      color: '#f0f0ff', fontFamily: 'system-ui, sans-serif',
      display: 'flex', flexDirection: 'column',
    }}>
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
          <div style={{ fontSize: 10, color: '#6a6a8a', letterSpacing: 1 }}>LIVE · REAL MONEY</div>
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
            background: lightsOn ? (i % 2 === 0 ? config.accent : '#FFD700') : '#333',
            boxShadow: lightsOn ? `0 0 10px ${i % 2 === 0 ? config.accent : '#FFD700'}` : 'none',
          }} />
        ))}
      </div>

      {/* WebGL wheel */}
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', padding: '18px 12px 8px' }}>
        {/* Pointer */}
        <div style={{
          position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', zIndex: 6,
          width: 0, height: 0,
          borderLeft: '14px solid transparent',
          borderRight: '14px solid transparent',
          borderTop: `28px solid ${config.accent}`,
          filter: `drop-shadow(0 2px 8px ${config.accent})`,
        }} />
        <div style={{
          borderRadius: '50%',
          padding: 8,
          background: `conic-gradient(from 0deg, ${config.accent}55, transparent, ${config.accent}55)`,
          boxShadow: spinning ? `0 0 48px ${config.accent}77` : '0 12px 36px rgba(0,0,0,0.55)',
        }}>
          <WebGLWheelView
            segments={config.segments}
            targetIndex={targetIndex}
            spinning={spinning && targetIndex != null}
            onSpinEnd={onSpinEnd}
            size={wheelSize}
            accent={config.accent}
            celebrate={celebrate}
          />
        </div>
      </div>

      <div style={{ textAlign: 'center', minHeight: 52, padding: '8px 16px', fontWeight: 800, fontSize: 16, color: lastWin > 0 ? '#FFD700' : '#aab' }}>
        {result && (
          <div style={{
            display: 'inline-block', padding: '6px 16px', borderRadius: 20, marginBottom: 4,
            background: `${result.color}33`, border: `1px solid ${result.color}`, color: '#fff',
          }}>
            {result.label}{result.multiplier ? ` · ${result.multiplier}×` : ''}
          </div>
        )}
        <div>{message}</div>
      </div>

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
            <div style={{ fontSize: 10, color: '#667' }}>YOUR BET</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#FFD700' }}>₱{Number(bet).toLocaleString()}</div>
          </div>
          <button type="button" onClick={spin} disabled={spinning || balance < bet || balance <= 0}
            style={{
              width: 120, height: 120, borderRadius: '50%', border: 'none',
              background: spinning || balance < bet
                ? 'linear-gradient(145deg, #333, #222)'
                : `linear-gradient(145deg, ${config.accent}, #FFD700, ${config.accent})`,
              color: spinning || balance < bet ? '#555' : '#1a1020',
              fontSize: 18, fontWeight: 900,
              cursor: spinning || balance < bet ? 'not-allowed' : 'pointer',
              boxShadow: spinning || balance < bet ? 'none' : `0 0 28px ${config.accent}88`,
            }}>
            {spinning ? '…' : 'SPIN'}
          </button>
          <div style={{ flex: 1, textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: '#667' }}>LAST WIN</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: lastWin > 0 ? '#00e676' : '#556' }}>
              ₱{Number(lastWin).toLocaleString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
