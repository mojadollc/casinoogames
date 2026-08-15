import React, { useRef, useEffect, useState, useCallback } from 'react';
import { gsap } from 'gsap';

const SIZE = 64;

// ── SVG Symbol Renderer ──────────────────────────────────────────────────────

const frame = (bg, border, children, glow) => (
  <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width="100%" height="100%" style={{ display: 'block', filter: glow ? `drop-shadow(0 0 6px ${glow})` : undefined }}>
    <defs>
      <linearGradient id={`bg-${bg.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={bg} stopOpacity="0.95" />
        <stop offset="100%" stopColor={border} stopOpacity="0.85" />
      </linearGradient>
      <radialGradient id={`shine-${bg.replace('#', '')}`} cx="35%" cy="30%" r="60%">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
        <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
      </radialGradient>
    </defs>
    <rect x="2" y="2" width="60" height="60" rx="12" fill={`url(#bg-${bg.replace('#', '')})`} stroke={border} strokeWidth="2.5" />
    <rect x="2" y="2" width="60" height="60" rx="12" fill={`url(#shine-${bg.replace('#', '')})`} />
    {children}
  </svg>
);

const SYMBOLS = {
  wild: (glow) => frame('#3d2a00', '#FFD700', (
    <>
      <text x="32" y="28" textAnchor="middle" fontSize="11" fontWeight="900" fill="#FFD700" fontFamily="Arial Black, sans-serif">WILD</text>
      <path d="M32 34 L36 42 L45 43 L38 49 L40 58 L32 53 L24 58 L26 49 L19 43 L28 42 Z" fill="#FFD700" stroke="#FFF8DC" strokeWidth="1" />
    </>
  ), glow || '#FFD700'),

  scatter: (glow) => frame('#003344', '#00D9FF', (
    <>
      <polygon points="32,12 38,26 52,28 41,38 44,52 32,44 20,52 23,38 12,28 26,26" fill="#00D9FF" stroke="#E0FFFF" strokeWidth="1.2" />
      <circle cx="32" cy="34" r="6" fill="#E0FFFF" opacity="0.9" />
    </>
  ), glow || '#00D9FF'),

  seven: (glow) => frame('#4a0028', '#FF1493', (
    <text x="32" y="44" textAnchor="middle" fontSize="36" fontWeight="900" fill="#FF1493" fontFamily="Arial Black, sans-serif" stroke="#FFB6C1" strokeWidth="1.5">7</text>
  ), glow || '#FF1493'),

  bar: (glow) => frame('#2a1800', '#CD7F32', (
    <>
      <rect x="12" y="22" width="40" height="20" rx="4" fill="#CD7F32" stroke="#FFE4B5" strokeWidth="1.5" />
      <text x="32" y="37" textAnchor="middle" fontSize="12" fontWeight="900" fill="#1a0f00" fontFamily="Arial Black, sans-serif">BAR</text>
    </>
  ), glow || '#CD7F32'),

  bell: (glow) => frame('#3d3000', '#FFD700', (
    <>
      <path d="M32 14 C22 14 18 24 18 34 L18 40 L46 40 L46 34 C46 24 42 14 32 14 Z" fill="#FFD700" stroke="#FFF8DC" strokeWidth="1.5" />
      <rect x="28" y="40" width="8" height="6" rx="2" fill="#FFA500" />
      <circle cx="32" cy="50" r="4" fill="#FFA500" stroke="#FFF8DC" strokeWidth="1" />
    </>
  ), glow || '#FFD700'),

  cherry: (glow) => frame('#3d0018', '#FF1493', (
    <>
      <path d="M32 18 Q28 28 24 30" stroke="#2E8B57" strokeWidth="2.5" fill="none" />
      <path d="M32 18 Q36 28 40 30" stroke="#2E8B57" strokeWidth="2.5" fill="none" />
      <circle cx="22" cy="42" r="10" fill="#E0115F" stroke="#FF69B4" strokeWidth="1.5" />
      <circle cx="40" cy="40" r="10" fill="#C71585" stroke="#FF69B4" strokeWidth="1.5" />
    </>
  ), glow || '#FF1493'),

  lemon: (glow) => frame('#3d3d00', '#FFD700', (
    <ellipse cx="32" cy="34" rx="18" ry="14" fill="#FFE135" stroke="#F4C430" strokeWidth="2" />
  ), glow || '#FFD700'),

  orange: (glow) => frame('#3d2000', '#FF8C00', (
    <>
      <circle cx="32" cy="34" r="16" fill="#FF8C00" stroke="#FFA500" strokeWidth="2" />
      <path d="M32 18 C30 22 28 24 32 26 C36 24 34 22 32 18" fill="#228B22" />
    </>
  ), glow || '#FF8C00'),

  plum: (glow) => frame('#2a0040', '#9932CC', (
    <ellipse cx="32" cy="36" rx="14" ry="16" fill="#8B008B" stroke="#DA70D6" strokeWidth="2" />
  ), glow || '#9932CC'),

  grape: (glow) => frame('#1a0030', '#8B008B', (
    <>
      <circle cx="32" cy="28" r="7" fill="#7B2D8E" stroke="#DDA0DD" strokeWidth="1" />
      <circle cx="24" cy="36" r="7" fill="#6A1B9A" stroke="#DDA0DD" strokeWidth="1" />
      <circle cx="40" cy="36" r="7" fill="#6A1B9A" stroke="#DDA0DD" strokeWidth="1" />
      <circle cx="28" cy="44" r="6" fill="#4A148C" stroke="#DDA0DD" strokeWidth="1" />
      <circle cx="36" cy="44" r="6" fill="#4A148C" stroke="#DDA0DD" strokeWidth="1" />
    </>
  ), glow || '#8B008B'),
};

export const SYMBOL_COLORS = {
  wild: '#FFD700', scatter: '#00D9FF', seven: '#FF1493', bar: '#CD7F32', bell: '#FFD700',
  cherry: '#FF1493', lemon: '#FFD700', orange: '#FF8C00', plum: '#9932CC', grape: '#8B008B',
};

export const SYMBOL_IDS = ['wild', 'scatter', 'seven', 'bar', 'bell', 'cherry', 'lemon', 'orange', 'plum', 'grape'];

// ── Single Symbol Cell ───────────────────────────────────────────────────────

export default function SlotSymbol({ id, winning = false, size = 56 }) {
  const color = SYMBOL_COLORS[id] || '#FFD700';
  const render = SYMBOLS[id] || SYMBOLS.cherry;
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    if (winning) {
      gsap.killTweensOf(ref.current);
      gsap.to(ref.current, {
        scale: 1.15,
        duration: 0.3,
        repeat: -1,
        yoyo: true,
        ease: 'power1.inOut',
      });
    } else {
      gsap.killTweensOf(ref.current);
      gsap.to(ref.current, { scale: 1, duration: 0.2, ease: 'power2.out' });
    }
    return () => gsap.killTweensOf(ref.current);
  }, [winning]);

  return (
    <div
      ref={ref}
      style={{
        width: size,
        height: size,
        borderRadius: 10,
        overflow: 'hidden',
        flexShrink: 0,
        boxShadow: winning
          ? `0 0 22px ${color}, 0 0 8px ${color}, inset 0 0 12px ${color}44`
          : '0 2px 6px rgba(0,0,0,0.4)',
        border: winning ? `2px solid ${color}` : '2px solid rgba(255,255,255,0.06)',
        background: '#0a0a14',
        transformOrigin: 'center',
        transition: 'box-shadow 0.3s, border-color 0.3s',
      }}
    >
      {render(winning ? color : null)}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function randomId() {
  return SYMBOL_IDS[Math.floor(Math.random() * SYMBOL_IDS.length)];
}

function buildStrip(finalThree, spinRows = 28) {
  const strip = Array.from({ length: spinRows }, () => ({ id: randomId() }));
  const finals = (finalThree && finalThree.length >= 3)
    ? finalThree.slice(0, 3).map(s => ({ id: (s && s.id) || s || 'cherry' }))
    : [{ id: randomId() }, { id: randomId() }, { id: randomId() }];
  return [...strip, ...finals];
}

// Sequential stop delays (ms): CLACK → CLACK → CLACK → CLACK → CLACK
// Reel 0=0ms, 1=120ms, 2=300ms, 3=520ms, 4=770ms after spin starts
export const REEL_STOP_DELAYS = [0, 0.12, 0.30, 0.52, 0.77]; // seconds

// ── Animated Reel Column ─────────────────────────────────────────────────────

/**
 * Props:
 *   finalSymbols  — array of 3 symbol ids/objects for the stopped result
 *   spinning      — boolean: true = spin, false = stop
 *   cellSize      — px height of each symbol cell
 *   gap           — px gap between cells
 *   winningRows   — array of row indices [0,1,2] that are winning
 *   accent        — border/glow color while spinning
 *   stopDelay     — seconds to wait before stopping (use REEL_STOP_DELAYS[i])
 *   onStop        — callback fired when this reel finishes stopping
 */
export function AnimatedReel({
  finalSymbols,
  spinning,
  cellSize = 58,
  gap = 6,
  winningRows = [],
  accent = '#FFD700',
  stopDelay = 0,
  onStop,
}) {
  const stripRef = useRef(null);
  const tweenRef = useRef(null);
  const loopRef = useRef(null);
  const phaseRef = useRef('idle'); // 'idle' | 'accelerating' | 'spinning' | 'stopping' | 'stopped'
  const rowH = cellSize + gap;

  const [strip, setStrip] = useState(() =>
    finalSymbols && finalSymbols.length >= 3
      ? finalSymbols.slice(0, 3).map(s => ({ id: (s && s.id) || s || 'cherry' }))
      : [{ id: randomId() }, { id: randomId() }, { id: randomId() }]
  );
  const [phase, setPhase] = useState('idle');

  // Sync idle display
  useEffect(() => {
    if (!spinning && (phase === 'idle' || phase === 'stopped')) {
      if (finalSymbols && finalSymbols.length >= 3) {
        setStrip(finalSymbols.slice(0, 3).map(s => ({ id: (s && s.id) || s || 'cherry' })));
      }
      const el = stripRef.current;
      if (el) gsap.set(el, { y: 0, filter: 'blur(0px)' });
    }
  }, [finalSymbols, spinning, phase]);

  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;

    if (spinning) {
      // ── SPIN START ──────────────────────────────────────────────────────
      const s = buildStrip(finalSymbols, 32);
      setStrip(s);
      setPhase('accelerating');
      phaseRef.current = 'accelerating';

      if (tweenRef.current) tweenRef.current.kill();
      if (loopRef.current) loopRef.current.kill();

      gsap.set(el, { y: 0, filter: 'blur(0px)' });

      const loopDist = (s.length - 3) * rowH;
      const fullDuration = (s.length - 3) * 0.042; // fast scroll speed

      // Phase A: accelerate from 0 → full speed (power2.in over first 250ms)
      tweenRef.current = gsap.to(el, {
        y: -rowH * 5,
        duration: 0.25,
        ease: 'power2.in',
        onUpdate() {
          const p = tweenRef.current.progress();
          gsap.set(el, { filter: `blur(${p * 2.5}px)` });
        },
        onComplete() {
          // Phase B: full-speed loop
          phaseRef.current = 'spinning';
          setPhase('spinning');
          gsap.set(el, { filter: 'blur(2.5px)' });

          loopRef.current = gsap.to(el, {
            y: `-=${loopDist}`,
            duration: fullDuration,
            ease: 'none',
            repeat: -1,
            modifiers: {
              y: gsap.utils.unitize(v => parseFloat(v) % -loopDist),
            },
          });
        },
      });

    } else if (phaseRef.current === 'spinning' || phaseRef.current === 'accelerating') {
      // ── STOP ────────────────────────────────────────────────────────────
      const doStop = () => {
        if (loopRef.current) loopRef.current.kill();
        if (tweenRef.current) tweenRef.current.kill();

        const s = buildStrip(finalSymbols, 22);
        setStrip(s);
        phaseRef.current = 'stopping';
        setPhase('stopping');

        const finalOffset = (s.length - 3) * rowH;
        // Start from a few rows above final to give the bounce room
        gsap.set(el, { y: -(finalOffset - rowH * 4), filter: 'blur(1.5px)' });

        tweenRef.current = gsap.to(el, {
          y: -finalOffset,
          duration: 0.55,
          ease: 'back.out(1.6)',
          onUpdate() {
            const p = tweenRef.current.progress();
            // Blur fades out as reel decelerates
            gsap.set(el, { filter: `blur(${(1 - p) * 1.5}px)` });
          },
          onComplete() {
            phaseRef.current = 'stopped';
            setPhase('stopped');
            gsap.set(el, { filter: 'blur(0px)' });

            // Trim to final 3 symbols
            const finals = (finalSymbols && finalSymbols.length >= 3
              ? finalSymbols.slice(0, 3)
              : s.slice(-3)
            ).map(sym => ({ id: (sym && sym.id) || sym || 'cherry' }));
            setStrip(finals);
            gsap.set(el, { y: 0 });

            onStop?.();
          },
        });
      };

      if (stopDelay > 0) {
        tweenRef.current = gsap.delayedCall(stopDelay, doStop);
      } else {
        doStop();
      }
    }

    return () => {
      if (tweenRef.current) tweenRef.current.kill();
      if (loopRef.current) loopRef.current.kill();
    };
  }, [spinning]); // eslint-disable-line react-hooks/exhaustive-deps

  const isMoving = phase === 'spinning' || phase === 'stopping' || phase === 'accelerating';
  const showWin = phase === 'idle' || phase === 'stopped';

  return (
    <div
      style={{
        width: cellSize + 12,
        height: cellSize * 3 + gap * 2,
        overflow: 'hidden',
        borderRadius: 12,
        position: 'relative',
        background: 'linear-gradient(180deg, rgba(0,0,0,0.75) 0%, rgba(15,15,30,0.5) 50%, rgba(0,0,0,0.75) 100%)',
        border: `1px solid ${isMoving ? accent + 'cc' : 'rgba(255,215,0,0.22)'}`,
        boxShadow: isMoving
          ? `inset 0 0 24px ${accent}55, 0 0 16px ${accent}44`
          : 'inset 0 0 14px rgba(0,0,0,0.7)',
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
    >
      {/* Top fade mask */}
      <div style={{
        pointerEvents: 'none', position: 'absolute', left: 0, right: 0, top: 0,
        height: 24, zIndex: 3,
        background: 'linear-gradient(180deg, rgba(0,0,0,0.95), transparent)',
      }} />
      {/* Bottom fade mask */}
      <div style={{
        pointerEvents: 'none', position: 'absolute', left: 0, right: 0, bottom: 0,
        height: 24, zIndex: 3,
        background: 'linear-gradient(0deg, rgba(0,0,0,0.95), transparent)',
      }} />

      <div
        ref={stripRef}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap,
          paddingTop: gap,
          willChange: 'transform',
        }}
      >
        {strip.map((sym, i) => {
          const winning = showWin && winningRows.includes(i);
          return (
            <SlotSymbol
              key={`${sym.id}-${i}`}
              id={sym.id}
              size={cellSize}
              winning={winning}
            />
          );
        })}
      </div>
    </div>
  );
}
