import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
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
function randSymbols(n) { return Array.from({ length: n }, rand); }

// Inject keyframes into <head> once at module load time
(function injectStyles() {
  const id = '__slot_styles__';
  if (document.getElementById(id)) return;
  const el = document.createElement('style');
  el.id = id;
  el.textContent = `
    @keyframes symPulse {
      0%,100% { transform: scale(1); }
      50%      { transform: scale(1.18); }
    }
  `;
  document.head.appendChild(el);
})();

// ─────────────────────────────────────────────────────────────────────────────
export const AnimatedReel = forwardRef(function AnimatedReel(
  { initialSymbols, cellSize = 58, gap = 6, winningRows = [], accent = '#FFD700' },
  ref
) {
  const CELL    = cellSize + gap;
  const VISIBLE = 3;
  const VIEW_H  = VISIBLE * cellSize + (VISIBLE - 1) * gap;

  // We keep 20 symbols in the strip at all times
  // The strip div is moved upward via translateY in a setInterval
  const STRIP_COUNT = 20;

  const wrapRef    = useRef(null);   // overflow:hidden container
  const stripRef   = useRef(null);   // the moving strip
  const intervalRef = useRef(null);
  const posRef     = useRef(0);      // current translateY (negative = moved up)
  const speedRef   = useRef(0);
  const stoppingRef = useRef(false);
  const finalSymsRef = useRef(null);
  const onStopRef  = useRef(null);

  // React state only for idle display
  const [idleSyms, setIdleSyms] = useState(
    () => initialSymbols?.slice(0, 3) ?? randSymbols(3)
  );
  const [isMoving, setIsMoving] = useState(false);

  // Build the strip DOM directly — no React re-render
  function buildStrip(syms) {
    const strip = stripRef.current;
    if (!strip) return;
    strip.innerHTML = '';
    syms.forEach(id => {
      const cell = document.createElement('div');
      cell.style.cssText = `
        width:${cellSize}px;
        height:${cellSize}px;
        flex-shrink:0;
        display:flex;
        align-items:center;
        justify-content:center;
        font-size:${Math.round(cellSize * 0.55)}px;
        border-radius:10px;
        background:linear-gradient(145deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02));
        border:2px solid rgba(255,255,255,0.12);
        box-shadow:0 2px 8px rgba(0,0,0,0.5);
        user-select:none;
      `;
      cell.textContent = SYMBOL_EMOJI[id] || '🎰';
      strip.appendChild(cell);
    });
  }

  useImperativeHandle(ref, () => ({
    startSpin() {
      if (intervalRef.current) clearInterval(intervalRef.current);
      stoppingRef.current = false;
      speedRef.current = 0;
      posRef.current = 0;
      finalSymsRef.current = null;

      // Build a long random strip
      const syms = randSymbols(STRIP_COUNT);
      buildStrip(syms);

      // Show the strip, hide idle
      setIsMoving(true);

      // Glow border
      if (wrapRef.current) {
        wrapRef.current.style.borderColor = accent;
        wrapRef.current.style.boxShadow = `inset 0 0 20px ${accent}55, 0 0 12px ${accent}44`;
      }

      const TARGET_SPEED = CELL * 0.6; // px per tick at full speed
      const ACCEL        = TARGET_SPEED * 0.1;
      const STRIP_PX     = STRIP_COUNT * CELL;

      intervalRef.current = setInterval(() => {
        // Accelerate
        if (speedRef.current < TARGET_SPEED) {
          speedRef.current = Math.min(TARGET_SPEED, speedRef.current + ACCEL);
        }

        posRef.current += speedRef.current;

        // Loop: when we've scrolled one full strip, reset to 0 and rebuild
        if (posRef.current >= STRIP_PX - VIEW_H) {
          posRef.current = 0;
          buildStrip(randSymbols(STRIP_COUNT));
        }

        // Apply blur proportional to speed
        const blur = ((speedRef.current / TARGET_SPEED) * 2.5).toFixed(1);

        if (stripRef.current) {
          stripRef.current.style.transform = `translateY(-${posRef.current.toFixed(1)}px)`;
          stripRef.current.style.filter    = `blur(${blur}px)`;
        }

        // Check if we should stop
        if (stoppingRef.current) {
          doStop();
        }
      }, 16); // ~60fps
    },

    stopSpin(finals, onStop) {
      finalSymsRef.current = finals?.length >= 3 ? finals.slice(0, 3) : randSymbols(3);
      onStopRef.current    = onStop;
      stoppingRef.current  = true;
    },
  }));

  function doStop() {
    clearInterval(intervalRef.current);
    intervalRef.current  = null;
    stoppingRef.current  = false;

    const finals = finalSymsRef.current || randSymbols(3);

    // Show idle view with final symbols
    setIdleSyms(finals);
    setIsMoving(false);

    // Reset border
    if (wrapRef.current) {
      wrapRef.current.style.borderColor = 'rgba(255,215,0,0.25)';
      wrapRef.current.style.boxShadow   = 'inset 0 0 12px rgba(0,0,0,0.6)';
    }

    // Bounce the idle strip after React renders it
    setTimeout(() => {
      const idleEl = wrapRef.current?.querySelector('.idle-strip');
      if (idleEl) {
        gsap.fromTo(idleEl, { y: -10 }, { y: 0, duration: 0.35, ease: 'back.out(2.5)' });
      }
      onStopRef.current?.();
      onStopRef.current = null;
    }, 20);
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  // Sync idle symbols when prop changes
  useEffect(() => {
    if (!isMoving && initialSymbols?.length >= 3) {
      setIdleSyms(initialSymbols.slice(0, 3));
    }
  }, [initialSymbols]); // eslint-disable-line

  return (
    <div
      ref={wrapRef}
      style={{
        width: cellSize + 12,
        height: VIEW_H,
        overflow: 'hidden',
        borderRadius: 12,
        position: 'relative',
        flexShrink: 0,
        background: 'linear-gradient(180deg,rgba(0,0,0,0.85),rgba(10,10,30,0.7) 50%,rgba(0,0,0,0.85))',
        border: '2px solid rgba(255,215,0,0.25)',
        boxShadow: 'inset 0 0 12px rgba(0,0,0,0.6)',
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}
    >
      {/* Fade top */}
      <div style={{ position:'absolute',top:0,left:0,right:0,height:18,zIndex:3,
        background:'linear-gradient(180deg,rgba(0,0,0,0.9),transparent)',pointerEvents:'none' }} />
      {/* Fade bottom */}
      <div style={{ position:'absolute',bottom:0,left:0,right:0,height:18,zIndex:3,
        background:'linear-gradient(0deg,rgba(0,0,0,0.9),transparent)',pointerEvents:'none' }} />

      {/* Moving strip — populated imperatively */}
      {isMoving && (
        <div
          ref={stripRef}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap,
            paddingTop: gap / 2,
            willChange: 'transform',
          }}
        />
      )}

      {/* Idle static symbols */}
      {!isMoving && (
        <div
          className="idle-strip"
          style={{ display:'flex', flexDirection:'column', gap, paddingTop: gap / 2 }}
        >
          {idleSyms.map((id, i) => {
            const color   = SYMBOL_COLORS[id] || '#FFD700';
            const winning = winningRows.includes(i);
            return (
              <div
                key={i}
                style={{
                  width: cellSize, height: cellSize, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: Math.round(cellSize * 0.55),
                  borderRadius: 10,
                  background: winning
                    ? `linear-gradient(145deg,${color}44,${color}11)`
                    : 'linear-gradient(145deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))',
                  border: `2px solid ${winning ? color : 'rgba(255,255,255,0.12)'}`,
                  boxShadow: winning ? `0 0 20px ${color},0 0 8px ${color}` : '0 2px 8px rgba(0,0,0,0.5)',
                  userSelect: 'none',
                  animation: winning ? 'symPulse 0.5s ease-in-out infinite' : 'none',
                }}
              >
                {SYMBOL_EMOJI[id] || '🎰'}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

export default AnimatedReel;
