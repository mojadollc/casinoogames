import { useRef, useCallback } from 'react';

let _ctx = null;
const ctx = () => {
  if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
  return _ctx;
};
const resume = () => {
  const c = ctx();
  if (c.state === 'suspended') c.resume();
  return c;
};

const osc = (c, type, freq, duration, gain, freqEnd) => {
  const o = c.createOscillator();
  const g = c.createGain();
  o.connect(g); g.connect(c.destination);
  o.type = type;
  o.frequency.setValueAtTime(freq, c.currentTime);
  if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, c.currentTime + duration);
  g.gain.setValueAtTime(gain, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
  o.start(c.currentTime);
  o.stop(c.currentTime + duration);
};

const noise = (c, duration, gain, filterFreq = 2000, filterType = 'bandpass') => {
  const buf = c.createBuffer(1, c.sampleRate * duration, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  const g = c.createGain();
  const f = c.createBiquadFilter();
  f.type = filterType;
  f.frequency.value = filterFreq;
  src.buffer = buf;
  src.connect(f); f.connect(g); g.connect(c.destination);
  g.gain.setValueAtTime(gain, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
  src.start(c.currentTime);
  src.stop(c.currentTime + duration);
};

const SOUNDS = {
  deal: (c) => {
    noise(c, 0.09, 0.18, 3500, 'highpass');
    osc(c, 'triangle', 320, 0.07, 0.06, 180);
  },
  flip: (c) => {
    noise(c, 0.06, 0.22, 4000, 'highpass');
    osc(c, 'sine', 600, 0.05, 0.08, 900);
  },
  chip: (c) => {
    osc(c, 'triangle', 900, 0.12, 0.22, 400);
    noise(c, 0.05, 0.12, 1200, 'bandpass');
  },
  chips: (c) => {
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        osc(c, 'triangle', 850 + i * 60, 0.1, 0.18, 380);
        noise(c, 0.04, 0.1, 1100, 'bandpass');
      }, i * 55);
    }
  },
  shuffle: (c) => {
    for (let i = 0; i < 12; i++) {
      setTimeout(() => noise(c, 0.04, 0.14, 3000 + Math.random() * 2000, 'highpass'), i * 28);
    }
  },
  win: (c) => {
    [523, 659, 784, 1047].forEach((f, i) =>
      setTimeout(() => osc(c, 'sine', f, 0.35, 0.16), i * 85)
    );
  },
  bigwin: (c) => {
    [392, 523, 659, 784, 1047, 1319].forEach((f, i) =>
      setTimeout(() => {
        osc(c, 'square', f, 0.4, 0.1, f);
        osc(c, 'sine', f * 2, 0.4, 0.05);
      }, i * 60)
    );
    noise(c, 0.35, 0.08);
  },
  lose: (c) => {
    osc(c, 'sawtooth', 220, 0.3, 0.14, 80);
    noise(c, 0.2, 0.06, 400, 'lowpass');
  },
  push: (c) => {
    osc(c, 'sine', 440, 0.25, 0.1, 440);
    setTimeout(() => osc(c, 'sine', 440, 0.25, 0.06, 440), 120);
  },
  click: (c) => {
    osc(c, 'sine', 900, 0.06, 0.2, 600);
    noise(c, 0.03, 0.06, 1500, 'bandpass');
  },
  blackjack: (c) => {
    [659, 784, 988, 1319, 1568].forEach((f, i) =>
      setTimeout(() => {
        osc(c, 'sine', f, 0.45, 0.2);
        osc(c, 'triangle', f * 1.5, 0.3, 0.08);
      }, i * 70)
    );
    setTimeout(() => noise(c, 0.4, 0.07), 0);
  },
};

export default function useCardSounds() {
  const mutedRef = useRef(false);
  const play = useCallback((name) => {
    if (mutedRef.current) return;
    try { SOUNDS[name]?.(resume()); } catch (_) {}
  }, []);
  const setMuted = useCallback((v) => { mutedRef.current = v; }, []);
  return { play, setMuted, muted: mutedRef };
}
