/**
 * AudioManager — Web Audio API synthesized sounds.
 * No audio files needed. Works on all browsers including mobile.
 */

let _ctx = null;
function ac() {
  if (!_ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    _ctx = new AC();
  }
  if (_ctx.state === 'suspended') _ctx.resume();
  return _ctx;
}

function noise(ctx) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  return src;
}

const SYNTHS = {
  spin(ctx, t) {
    const master = ctx.createGain();
    master.gain.setValueAtTime(0, t);
    master.gain.linearRampToValueAtTime(0.18, t + 0.25);
    master.gain.linearRampToValueAtTime(0, t + 0.55);
    master.connect(ctx.destination);

    // Motor hum
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 52;
    const lpf = ctx.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.value = 200;
    osc.connect(lpf); lpf.connect(master);
    osc.start(t); osc.stop(t + 0.6);

    // Tick LFO
    const tick = ctx.createOscillator();
    tick.type = 'square';
    tick.frequency.value = 280;
    const tg = ctx.createGain();
    tg.gain.value = 0;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 10;
    const lg = ctx.createGain();
    lg.gain.value = 0.15;
    lfo.connect(lg); lg.connect(tg.gain);
    tick.connect(tg); tg.connect(master);
    lfo.start(t); tick.start(t);
    lfo.stop(t + 0.6); tick.stop(t + 0.6);
  },

  reelStop(ctx, t) {
    // Thud
    const thud = ctx.createOscillator();
    const tg = ctx.createGain();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(180, t);
    thud.frequency.exponentialRampToValueAtTime(50, t + 0.08);
    tg.gain.setValueAtTime(0.6, t);
    tg.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    thud.connect(tg); tg.connect(ctx.destination);
    thud.start(t); thud.stop(t + 0.12);

    // Snap
    const n = noise(ctx);
    const hpf = ctx.createBiquadFilter();
    hpf.type = 'highpass'; hpf.frequency.value = 2400;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.35, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    n.connect(hpf); hpf.connect(ng); ng.connect(ctx.destination);
    n.start(t); n.stop(t + 0.05);
  },

  win(ctx, t) {
    [523, 659, 784, 1047].forEach((freq, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = freq;
      const st = t + i * 0.08;
      g.gain.setValueAtTime(0.22, st);
      g.gain.exponentialRampToValueAtTime(0.001, st + 0.35);
      o.connect(g); g.connect(ctx.destination);
      o.start(st); o.stop(st + 0.35);
    });
    // Coin clinks
    for (let i = 0; i < 8; i++) {
      const ct = t + i * 0.07;
      const n = noise(ctx);
      const bpf = ctx.createBiquadFilter();
      bpf.type = 'bandpass'; bpf.frequency.value = 2800 + Math.random() * 800; bpf.Q.value = 16;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.2, ct); g.gain.exponentialRampToValueAtTime(0.001, ct + 0.07);
      n.connect(bpf); bpf.connect(g); g.connect(ctx.destination);
      n.start(ct); n.stop(ct + 0.07);
    }
  },

  bigWin(ctx, t) {
    // Fanfare
    [261, 329, 392, 523, 659, 784, 1047, 1319].forEach((freq, i) => {
      const st = t + i * 0.09;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = i < 4 ? 'sawtooth' : 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0, st);
      g.gain.linearRampToValueAtTime(0.18, st + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, st + 0.45);
      o.connect(g); g.connect(ctx.destination);
      o.start(st); o.stop(st + 0.45);
    });
    // Dense coin shower
    for (let i = 0; i < 20; i++) {
      const ct = t + i * 0.06;
      const n = noise(ctx);
      const bpf = ctx.createBiquadFilter();
      bpf.type = 'bandpass'; bpf.frequency.value = 2500 + Math.random() * 1200; bpf.Q.value = 14;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.15, ct); g.gain.exponentialRampToValueAtTime(0.001, ct + 0.07);
      n.connect(bpf); bpf.connect(g); g.connect(ctx.destination);
      n.start(ct); n.stop(ct + 0.07);
    }
  },

  scatter(ctx, t) {
    // Rising shimmer
    [800, 1000, 1260, 1587, 2000].forEach((freq, i) => {
      const st = t + i * 0.06;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(0.18, st);
      g.gain.exponentialRampToValueAtTime(0.001, st + 0.3);
      o.connect(g); g.connect(ctx.destination);
      o.start(st); o.stop(st + 0.3);
    });
  },

  freeSpin(ctx, t) {
    // Magical ascending arp
    [392, 494, 587, 740, 988].forEach((freq, i) => {
      const st = t + i * 0.1;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'triangle'; o.frequency.value = freq;
      g.gain.setValueAtTime(0.25, st);
      g.gain.exponentialRampToValueAtTime(0.001, st + 0.4);
      o.connect(g); g.connect(ctx.destination);
      o.start(st); o.stop(st + 0.4);
    });
  },

  coin(ctx, t) {
    const n = noise(ctx);
    const bpf = ctx.createBiquadFilter();
    bpf.type = 'bandpass'; bpf.frequency.value = 3000; bpf.Q.value = 18;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    n.connect(bpf); bpf.connect(g); g.connect(ctx.destination);
    n.start(t); n.stop(t + 0.08);
  },

  button(ctx, t) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = 880;
    g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    o.connect(g); g.connect(ctx.destination);
    o.start(t); o.stop(t + 0.06);
  },
};

class AudioManager {
  constructor() {
    this.muted = false;
    this.effectsVolume = 0.8;
    this.masterVolume = 1.0;
  }

  play(name) {
    if (this.muted) return null;
    const synth = SYNTHS[name];
    if (!synth) return null;
    try {
      const ctx = ac();
      synth(ctx, ctx.currentTime);
      return Date.now(); // fake sound ID
    } catch (e) {
      return null;
    }
  }

  stop() { /* Web Audio nodes auto-stop */ }

  mute() { this.muted = true; }
  unmute() { this.muted = false; }
  toggleMute() { this.muted = !this.muted; return this.muted; }
  isMuted() { return this.muted; }
  setMasterVolume(v) { this.masterVolume = v; }
  setEffectsVolume(v) { this.effectsVolume = v; }
  destroy() {}
}

const audioManager = new AudioManager();
export default audioManager;
