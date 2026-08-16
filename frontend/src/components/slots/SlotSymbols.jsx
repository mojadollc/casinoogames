import React, { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
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

function randId() {
  return SYMBOL_IDS[Math.floor(Math.random() * SYMBOL_IDS.length)];
}

// ── Single symbol cell ────────────────────────────────────────────────────────
export default function SlotSymbol({ id, winning = false, size = 58 }) {
  const color = SYMBOL_COLORS[id] || '#FFD700';
  const emoji = SYMBOL_EMOJI[id] || '🎰';
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    if (winning) {
      gsap.killTweensOf(ref.current);
      gsap.fromTo(ref.current,
        { scale: 1 },
        { scale: 1.18, duration: 0.28, repeat: -1, yoyo: true, ease: 'power1.inOut' }
      );
    } else {
      gsap.killTweensOf(ref.current);
      gsap.set(ref.current, { scale: 1 });
    }
    return () => { if (ref.current) gsap.killTweensOf(ref.current); };
  }, [winning]);

  return (
    <div
      ref={ref}
      style={{
        width: size, height: size,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.55, borderRadius: 10, flexShrink: 0,
        background: winning
          ? `linear-gradient(145deg, ${color}33, ${color}11)`
          : 'linear-gradient(145deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02))',
        border: winning ? `2px solid ${color}` : '2px solid rgba(255,255,255,0.1)',
        boxShadow: winning ? `0 0 18px ${color}, 0 0 6px ${color}` : '0 2px 8px rgba(0,0,0,0.5)',
        transformOrigin: 'center',
        transition: 'background 0.2s, border-color 0.2s, box-shadow 0.2s',
        userSelect: 'none',
      }}
    >
      {emoji}
    </div>
  );
}

export const REEL_STOP_DELAYS = [0, 0.15, 0.32, 0.52, 0.75];

// ── Animated Reel ─────────────────────────────────────────────────────────────
// Imperative: parent calls reelRef.current.startSpin() / stopSpin(finalSymbols)
// This avoids ALL React state/prop race conditions.
export const AnimatedReel = forwardRef(function AnimatedReel(
  { initialSymbols, cellSize = 58, gap = 6, winningRows = [], accent = '#FFD700' },
  ref
) {
  const CELL = cellSize + gap;
  const VISIBLE_H = cellSize * 3 + gap * 2;
  const STRIP_EXTRA = 20; // random symbols above final 3

  const containerRef = useRef(null);
  const stripRef = useRef(null);
  const isSpinningRef = useRef(false);
  const rafRef = useRef(null);
  const speedRef = useRef(0);
  const posRef = useRef(0);
  const onStopCbRef = useRef(null);
  const finalSymsRef = useRef(null);
  const stoppingRef = useRef(false);

  // Build DOM cells imperatively — no React re-render during spin
  const buildStrip = (finals, extra = STRIP_EXTRA) => {
    const strip = stripRef.current;
    if (!strip) return;
    strip.innerHTML = '';
    const total = extra + 3;
    for (let i = 0; i < total; i++) {
      const id = i >= extra
        ? (finals?.[i - extra] || randId())
        : randId();
      const cell = document.createElement('div');
      cell.style.cssText = `
        width:${cellSize}px; height:${cellSize}px; flex-shrink:0;
        display:flex; align-items:center; justify-content:center;
        font-size:${Math.round(cellSize * 0.55)}px;
        border-radius:10px;
        background:linear-gradient(145deg,rgba(255,255,255,0.07),rgba(255,255,255,0.02));
        border:2px solid rgba(255,255,255,0.1);
        box-shadow:0 2px 8px rgba(0,0,0,0.5);
        user-select:none; pointer-events:none;
      `;
      cell.textContent = SYMBOL_EMOJI[id] || '🎰';
      cell.dataset.id = id;
      strip.appendChild(cell);
    }
    return total;
  };

  // Show static final symbols (no animation)
  const showStatic = (syms) => {
    const strip = stripRef.current;
    if (!strip) return;
    strip.innerHTML = '';
    strip.style.transform = 'translateY(0px)';
    strip.style.filter = 'blur(0px)';
    const finals = syms || initialSymbols || [randId(), randId(), randId()];
    for (let i = 0; i < 3; i++) {
      const id = finals[i] || randId();
      const cell = document.createElement('div');
      const isWin = winningRows.includes(i);
      const color = SYMBOL_COLORS[id] || '#FFD700';
      cell.style.cssText = `
        width:${cellSize}px; height:${cellSize}px; flex-shrink:0;
        display:flex; align-items:center; justify-content:center;
        font-size:${Math.round(cellSize * 0.55)}px;
        border-radius:10px;
        background:${isWin ? `linear-gradient(145deg,${color}33,${color}11)` : 'linear-gradient(145deg,rgba(255,255,255,0.07),rgba(255,255,255,0.02))'};
        border:2px solid ${isWin ? color : 'rgba(255,255,255,0.1)'};
        box-shadow:${isWin ? `0 0 18px ${color},0 0 6px ${color}` : '0 2px 8px rgba(0,0,0,0.5)'};
        user-select:none; pointer-events:none;
      `;
      cell.textContent = SYMBOL_EMOJI[id] || '🎰';
      strip.appendChild(cell);
    }
  };

  // Initialize with static symbols
  useEffect(() => {
    showStatic(initialSymbols);
  }, []); // eslint-disable-line

  // Update win highlights when not spinning
  useEffect(() => {
    if (!isSpinningRef.current && !stoppingRef.current) {
      showStatic(finalSymsRef.current || initialSymbols);
    }
  }, [winningRows]); // eslint-disable-line

  // Imperative API exposed to parent
  useImperativeHandle(ref, () => ({
    startSpin() {
      if (isSpinningRef.current) return;
      isSpinningRef.current = true;
      stoppingRef.current = false;
      finalSymsRef.current = null;

      const totalCells = buildStrip(null, STRIP_EXTRA);
      const maxScroll = (totalCells - 3) * CELL;
      posRef.current = 0;
      speedRef.current = 0;

      // Update container border
      if (containerRef.current) {
        containerRef.current.style.borderColor = accent;
        containerRef.current.style.boxShadow = `inset 0 0 20px ${accent}44, 0 0 14px ${accent}33`;
      }

      // Accelerate then loop
      const LOOP_AT = STRIP_EXTRA * CELL * 0.5; // start looping halfway through random symbols
      const TARGET_SPEED = CELL * 0.55; // pixels per frame at full speed

      const tick = () => {
        if (!isSpinningRef.current) return;

        // Accelerate
        if (speedRef.current < TARGET_SPEED) {
          speedRef.current = Math.min(TARGET_SPEED, speedRef.current + TARGET_SPEED * 0.08);
        }

        posRef.current += speedRef.current;

        // Loop: when we've scrolled past the random section, reset to start of random section
        if (posRef.current >= LOOP_AT) {
          posRef.current -= LOOP_AT;
          // Rebuild random top section to keep it fresh
          buildStrip(finalSymsRef.current, STRIP_EXTRA);
        }

        if (stripRef.current) {
          stripRef.current.style.transform = `translateY(-${posRef.current}px)`;
          // Blur at high speed
          const blur = Math.min(3, speedRef.current / TARGET_SPEED * 3);
          stripRef.current.style.filter = `blur(${blur.toFixed(1)}px)`;
        }

        if (stoppingRef.current) {
          doStop();
        } else {
          rafRef.current = requestAnimationFrame(tick);
        }
      };

      rafRef.current = requestAnimationFrame(tick);
    },

    stopSpin(finals, onStop) {
      finalSymsRef.current = finals;
      onStopCbRef.current = onStop;
      stoppingRef.current = true;
      // tick() will call doStop() on next frame
    },
  }));

  const doStop = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    isSpinningRef.current = false;
    stoppingRef.current = false;

    const finals = finalSymsRef.current || [randId(), randId(), randId()];

    // Build final strip and snap to end
    const totalCells = buildStrip(finals, STRIP_EXTRA);
    const finalPos = (totalCells - 3) * CELL;

    if (stripRef.current) {
      // Start from a bit above final position for bounce effect
      const startPos = finalPos - CELL * 1.5;
      stripRef.current.style.filter = 'blur(1px)';
      gsap.fromTo(
        stripRef.current,
        { y: -startPos },
        {
          y: -finalPos,
          duration: 0.45,
          ease: 'back.out(2)',
          onUpdate() {
            const p = this.progress();
            if (stripRef.current) {
              stripRef.current.style.filter = `blur(${((1 - p) * 1.5).toFixed(1)}px)`;
            }
          },
          onComplete() {
            // Replace with clean static display
            showStatic(finals);
            // Reset container border
            if (containerRef.current) {
              containerRef.current.style.borderColor = 'rgba(255,215,0,0.25)';
              containerRef.current.style.boxShadow = 'inset 0 0 12px rgba(0,0,0,0.6)';
            }
            onStopCbRef.current?.();
            onStopCbRef.current = null;
          },
        }
      );
    } else {
      showStatic(finals);
      onStopCbRef.current?.();
      onStopCbRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      gsap.killTweensOf(stripRef.current);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        width: cellSize + 12,
        height: VISIBLE_H,
        overflow: 'hidden',
        borderRadius: 12,
        position: 'relative',
        background: 'linear-gradient(180deg, rgba(0,0,0,0.8) 0%, rgba(10,10,30,0.6) 50%, rgba(0,0,0,0.8) 100%)',
        border: '2px solid rgba(255,215,0,0.25)',
        boxShadow: 'inset 0 0 12px rgba(0,0,0,0.6)',
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}
    >
      {/* Top fade */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 20, zIndex: 3,
        background: 'linear-gradient(180deg, rgba(0,0,0,0.9), transparent)',
        pointerEvents: 'none',
      }} />
      {/* Bottom fade */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 20, zIndex: 3,
        background: 'linear-gradient(0deg, rgba(0,0,0,0.9), transparent)',
        pointerEvents: 'none',
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
      />
    </div>
  );
});
