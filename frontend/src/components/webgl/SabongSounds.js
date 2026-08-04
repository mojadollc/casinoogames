/**
 * Sabong SFX via Web Audio API — no external audio files needed.
 */
let ctx = null;
let unlocked = false;

function getCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

export function unlockSabongAudio() {
  const c = getCtx();
  if (!c) return;
  if (c.state === 'suspended') c.resume();
  unlocked = true;
  try {
    const o = c.createOscillator();
    const g = c.createGain();
    g.gain.value = 0.0001;
    o.connect(g);
    g.connect(c.destination);
    o.start();
    o.stop(c.currentTime + 0.01);
  } catch (e) {}
}

function noiseBuffer(c, duration) {
  const len = Math.floor(c.sampleRate * duration);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  return buf;
}

export function playStrike(intensity) {
  const c = getCtx();
  if (!c || !unlocked) return;
  if (c.state === 'suspended') c.resume();
  const t0 = c.currentTime;
  const vol = 0.25 * Math.min(1.5, intensity || 1);

  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, 0.09);
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 700 + Math.random() * 700;
  bp.Q.value = 0.85;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.1);
  src.connect(bp);
  bp.connect(g);
  g.connect(c.destination);
  src.start(t0);
  src.stop(t0 + 0.1);

  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(110 + Math.random() * 50, t0);
  osc.frequency.exponentialRampToValueAtTime(45, t0 + 0.13);
  const g2 = c.createGain();
  g2.gain.setValueAtTime(vol * 0.75, t0);
  g2.gain.exponentialRampToValueAtTime(0.001, t0 + 0.15);
  osc.connect(g2);
  g2.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + 0.16);
}

export function playWin() {
  const c = getCtx();
  if (!c || !unlocked) return;
  if (c.state === 'suspended') c.resume();
  const t0 = c.currentTime;
  [523.25, 659.25, 783.99].forEach(function (f, i) {
    const o = c.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.04 + i * 0.06);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.5 + i * 0.06);
    o.connect(g);
    g.connect(c.destination);
    o.start(t0 + i * 0.06);
    o.stop(t0 + 0.55 + i * 0.06);
  });
}

export function playLose() {
  const c = getCtx();
  if (!c || !unlocked) return;
  if (c.state === 'suspended') c.resume();
  const t0 = c.currentTime;
  const o = c.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(220, t0);
  o.frequency.exponentialRampToValueAtTime(100, t0 + 0.38);
  const g = c.createGain();
  g.gain.setValueAtTime(0.13, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.42);
  o.connect(g);
  g.connect(c.destination);
  o.start(t0);
  o.stop(t0 + 0.45);
}

export function playBell() {
  const c = getCtx();
  if (!c || !unlocked) return;
  if (c.state === 'suspended') c.resume();
  const t0 = c.currentTime;
  const o = c.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(880, t0);
  o.frequency.exponentialRampToValueAtTime(440, t0 + 0.5);
  const g = c.createGain();
  g.gain.setValueAtTime(0.16, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.55);
  o.connect(g);
  g.connect(c.destination);
  o.start(t0);
  o.stop(t0 + 0.55);
}
