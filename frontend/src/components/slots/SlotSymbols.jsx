import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef, useCallback } from 'react';
import { gsap } from 'gsap';

export const SYMBOL_IDS = ['wild','scatter','seven','bar','bell','cherry','lemon','orange','plum','grape'];
export const SYMBOL_COLORS = {
  wild:'#FFD700', scatter:'#00D9FF', seven:'#FF1493', bar:'#CD7F32', bell:'#FFD700',
  cherry:'#FF1493', lemon:'#FFD700', orange:'#FF8C00', plum:'#9932CC', grape:'#8B008B',
};
const SYMBOL_EMOJI = {
  wild:'⭐', scatter:'💎', seven:'7️⃣', bar:'🎰', bell:'🔔',
  cherry:'🍒', lemon:'🍋', orange:'🍊', plum:'🟣', grape:'🍇',
};

function rand() { return SYMBOL_IDS[Math.floor(Math.random() * SYMBOL_IDS.length)]; }

// Inject global keyframes once
const STYLE_ID = 'reel-spin-style';
if (!document.getElementById(STYLE_ID)) {
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = `
    @keyframes reelSpin {
      0%   { transform: translateY(0px); }
      100% { transform: translateY(-50%); }
    }
    .reel-spinning {
      animation: reelSpin 0.4s linear infinite;
      filter: blur(2px);
    }
    .reel-stopping {
      filter: blur(1px);
      transition: filter 0.2s;
    }
    .reel-stopped {
      filter: blur(0px);
      transition: filter 0.15s;
    }
    @keyframes symbolWin {
      0%,100% { transform: scale(1); }
      50%      { transform: scale(1.18); }
    }
    .symbol-winning {
      animation: symbolWin 0.5s ease-in-out infinite;
    }
  `;
  document.head.appendChild(s);
}

// ── AnimatedReel ──────────────────────────────────────────────────────────────
export const AnimatedReel = forwardRef(function AnimatedReel(
  { initialSymbols, cellSize = 58, gap = 6, winningRows = [], accent = '#FFD700' },
  ref
) {
  const CELL = cellSize + gap;
  const VISIBLE_H = cellSize * 3 + gap * 2;

  // State: 'idle' | 'spinning' | 'stopping'
  const [phase, setPhase] = useState('idle');
  const [displaySyms, setDisplaySyms] = useState(
    () => (initialSymbols && initialSymbols.length >= 3 ? initialSymbols.slice(0,3) : [rand(),rand(),rand()])
  );
  // The spinning strip is 2× height so the CSS loop works: top half = random, bottom half = same random (seamless)
  const [spinSyms, setSpinSyms] = useState(() => Array.from({length: 12}, rand));

  const onStopCbRef = useRef(null);
  const finalSymsRef = useRef(null);
  const stopTimerRef = useRef(null);
  const stripRef = useRef(null);
  const containerRef = useRef(null);

  useImperativeHandle(ref, () => ({
    startSpin() {
      // Build a fresh random strip (12 symbols, looped seamlessly)
      const fresh = Array.from({length: 12}, rand);
      setSpinSyms(fresh);
      setPhase('spinning');
      if (containerRef.current) {
        containerRef.current.style.borderColor = accent;
        containerRef.current.style.boxShadow = `inset 0 0 20px ${accent}44, 0 0 14px ${accent}33`;
      }
    },
    stopSpin(finals, onStop) {
      finalSymsRef.current = finals && finals.length >= 3 ? finals : [rand(),rand(),rand()];
      onStopCbRef.current = onStop;
      setPhase('stopping');
    },
  }));

  // When phase becomes 'stopping': wait a short moment then snap to final
  useEffect(() => {
    if (phase !== 'stopping') return;
    // Let the blur transition play (200ms) then show final symbols
    stopTimerRef.current = setTimeout(() => {
      const finals = finalSymsRef.current || [rand(),rand(),rand()];
      setDisplaySyms(finals);
      setPhase('idle');
      if (containerRef.current) {
        containerRef.current.style.borderColor = 'rgba(255,215,0,0.25)';
        containerRef.current.style.boxShadow = 'inset 0 0 12px rgba(0,0,0,0.6)';
      }
      // Bounce the strip
      if (stripRef.current) {
        gsap.fromTo(stripRef.current,
          { y: -8 },
          { y: 0, duration: 0.35, ease: 'back.out(3)' }
        );
      }
      onStopCbRef.current?.();
      onStopCbRef.current = null;
    }, 220);
    return () => clearTimeout(stopTimerRef.current);
  }, [phase]);

  // Update display when initialSymbols changes and we're idle
  useEffect(() => {
    if (phase === 'idle' && initialSymbols && initialSymbols.length >= 3) {
      setDisplaySyms(initialSymbols.slice(0,3));
    }
  }, [initialSymbols, phase]);

  useEffect(() => () => clearTimeout(stopTimerRef.current), []);

  const isSpinning = phase === 'spinning';
  const isStopping = phase === 'stopping';
  const isMoving = isSpinning || isStopping;

  // The spinning strip: 24 cells (12 repeated twice for seamless loop)
  const loopSyms = [...spinSyms, ...spinSyms];
  const stripH = loopSyms.length * CELL;

  return (
    <div
      ref={containerRef}
      style={{
        width: cellSize + 12,
        height: VISIBLE_H,
        overflow: 'hidden',
        borderRadius: 12,
        position: 'relative',
        background: 'linear-gradient(180deg,rgba(0,0,0,0.85) 0%,rgba(10,10,30,0.7) 50%,rgba(0,0,0,0.85) 100%)',
        border: `2px solid rgba(255,215,0,0.25)`,
        boxShadow: 'inset 0 0 12px rgba(0,0,0,0.6)',
        flexShrink: 0,
      }}
    >
      {/* Top/bottom fade overlays */}
      <div style={{ position:'absolute', top:0, left:0, right:0, height:22, zIndex:3, background:'linear-gradient(180deg,rgba(0,0,0,0.95),transparent)', pointerEvents:'none' }} />
      <div style={{ position:'absolute', bottom:0, left:0, right:0, height:22, zIndex:3, background:'linear-gradient(0deg,rgba(0,0,0,0.95),transparent)', pointerEvents:'none' }} />

      {/* SPINNING view — CSS animation, always visible while spinning */}
      {isMoving && (
        <div
          className={isSpinning ? 'reel-spinning' : 'reel-stopping'}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap,
            paddingTop: gap,
            height: stripH,
            // animation-duration scales with strip height for consistent speed
            animationDuration: isSpinning ? `${(loopSyms.length * CELL / 1200).toFixed(2)}s` : undefined,
          }}
        >
          {loopSyms.map((id, i) => (
            <Cell key={i} id={id} size={cellSize} />
          ))}
        </div>
      )}

      {/* IDLE view — static symbols with win highlights */}
      {!isMoving && (
        <div
          ref={stripRef}
          style={{ display:'flex', flexDirection:'column', alignItems:'center', gap, paddingTop: gap }}
        >
          {displaySyms.slice(0,3).map((id, i) => (
            <Cell key={i} id={id} size={cellSize} winning={winningRows.includes(i)} />
          ))}
        </div>
      )}
    </div>
  );
});

// ── Cell ──────────────────────────────────────────────────────────────────────
function Cell({ id, size = 58, winning = false }) {
  const color = SYMBOL_COLORS[id] || '#FFD700';
  const emoji = SYMBOL_EMOJI[id] || '🎰';
  return (
    <div
      className={winning ? 'symbol-winning' : undefined}
      style={{
        width: size, height: size, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: Math.round(size * 0.55),
        borderRadius: 10,
        background: winning
          ? `linear-gradient(145deg,${color}44,${color}11)`
          : 'linear-gradient(145deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))',
        border: `2px solid ${winning ? color : 'rgba(255,255,255,0.12)'}`,
        boxShadow: winning ? `0 0 20px ${color},0 0 8px ${color}` : '0 2px 8px rgba(0,0,0,0.5)',
        userSelect: 'none',
        transformOrigin: 'center',
      }}
    >
      {emoji}
    </div>
  );
}

export default Cell;
