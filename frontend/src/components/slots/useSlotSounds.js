import { useRef, useCallback } from 'react';

// Synthesize all sounds via Web Audio API — no external files needed
// Wrapped in Howler-style API for easy timing control

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

// Low-level synth primitives
const osc = (c, type, freq, startFreq, duration, gain, freqEnd) => {
  const o = c.createOscillator();
  const g = c.createGain();
  o.connect(g); g.connect(c.destination);
  o.type = type;
  o.frequency.setValueAtTime(startFreq || freq, c.currentTime);
  if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, c.currentTime + duration);
  g.gain.setValueAtTime(gain, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
  o.start(c.currentTime);
  o.stop(c.currentTime + duration);
};

const noise = (c, duration, gain) => {
  const buf = c.createBuffer(1, c.sampleRate * duration, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  const g = c.createGain();
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 800;
  src.buffer = buf;
  src.connect(filter); filter.connect(g); g.connect(c.destination);
  g.gain.setValueAtTime(gain, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
  src.start(c.currentTime);
  src.stop(c.currentTime + duration);
};

// Sound definitions
const SOUNDS = {
  click: (c) => {
    osc(c, 'sine', 800, 1000, 0.08, 0.3, 600);
    noise(c, 0.04, 0.08);
  },

  whoosh: (c) => {
    osc(c, 'sawtooth', 200, 80, 0.25, 0.12, 400);
    noise(c, 0.25, 0.06);
  },

  clack: (c) => {
    // Mechanical stop thud
    osc(c, 'triangle', 180, 300, 0.12, 0.25, 80);
    noise(c, 0.06, 0.15);
  },

  win: (c) => {
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      setTimeout(() => osc(c, 'sine', freq, freq, 0.3, 0.18), i * 90);
    });
  },

  bigwin: (c) => {
    // Fanfare: ascending chord + noise burst
    const fanfare = [392, 494, 587, 784, 988, 1175];
    fanfare.forEach((freq, i) => {
      setTimeout(() => {
        osc(c, 'square', freq, freq * 0.8, 0.4, 0.12, freq);
        osc(c, 'sine', freq * 2, freq * 2, 0.4, 0.06);
      }, i * 55);
    });
    setTimeout(() => noise(c, 0.3, 0.1), 0);
  },

  coins: (c) => {
    // Rapid high-pitched pings
    for (let i = 0; i < 8; i++) {
      setTimeout(() => {
        const f = 1200 + Math.random() * 800;
        osc(c, 'sine', f, f, 0.15, 0.12);
      }, i * 40 + Math.random() * 20);
    }
  },

  coinburst: (c) => {
    for (let i = 0; i < 20; i++) {
      setTimeout(() => {
        const f = 800 + Math.random() * 1200;
        osc(c, 'sine', f, f, 0.12, 0.08);
      }, i * 25 + Math.random() * 30);
    }
    noise(c, 0.4, 0.05);
  },
};

export default function useSlotSounds() {
  const mutedRef = useRef(false);

  const play = useCallback((name) => {
    if (mutedRef.current) return;
    try {
      const c = resume();
      SOUNDS[name]?.(c);
    } catch (_) {}
  }, []);

  const setMuted = useCallback((v) => { mutedRef.current = v; }, []);

  return { play, setMuted, muted: mutedRef };
}
