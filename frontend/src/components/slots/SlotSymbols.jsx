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

// ─────────────────────────────────────────────────────────────────────────────
// AnimatedReel
// Parent calls: ref.current.startSpin()  — starts CSS scroll animation
//               ref.current.stopSpin(finals, cb) — stops and shows finals
// ─────────────────────────────────────────────────────────────────────────────
export const AnimatedReel = forwardRef(function AnimatedReel(
  { initialSymbols, cellSize = 58, gap = 6, winningRows = [], accent = '#FFD700' },
  ref
) {
  const CELL   = cellSize + gap;          // height of one cell + gap
  const ROWS   = 3;                       // visible rows
  const EXTRA  = 12;                      // random symbols above final rows
  const TOTAL  = EXTRA + ROWS;            // total cells in strip
  const STRIP_H = TOTAL * CELL;           // total strip pixel height
  const VIEW_H  = ROWS * CELL - gap;      // visible window height

  // 'idle' | 'spinning' | 'stopping'
  const [phase, setPhase]       = useState('idle');
  const [symbols, setSymbols]   = useState(
    () => initialSymbols?.slice(0, 3) ?? [rand(), rand(), rand()]
  );
  const [spinStrip, setSpinStrip] = useState(() => Array.from({ length: TOTAL }, rand));

  const containerRef  = useRef(null);
  const stripRef      = useRef(null);
  const finalRef      = useRef(null);
  const cbRef         = useRef(null);
  const timerRef      = useRef(null);

  // ── Imperative API ──────────────────────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    startSpin() {
      clearTimeout(timerRef.current);
      setSpinStrip(Array.from({ length: TOTAL }, rand));
      setPhase('spinning');
    },
    stopSpin(finals, onStop) {
      finalRef.current  = finals?.length >= 3 ? finals.slice(0, 3) : [rand(), rand(), rand()];
      cbRef.current     = onStop;
      setPhase('stopping');
    },
  }));

  // ── When stopping: brief pause then snap to finals with bounce ──────────────
  useEffect(() => {
    if (phase !== 'stopping') return;
    timerRef.current = setTimeout(() => {
      setSymbols(finalRef.current ?? [rand(), rand(), rand()]);
      setPhase('idle');
      // Bounce
      if (stripRef.current) {
        gsap.fromTo(stripRef.current, { y: -6 }, { y: 0, duration: 0.3, ease: 'back.out(3)' });
      }
      cbRef.current?.();
      cbRef.current = null;
    }, 180);
    return () => clearTimeout(timerRef.current);
  }, [phase]);

  // ── Sync idle display when initialSymbols prop changes ─────────────────────
  useEffect(() => {
    if (phase === 'idle' && initialSymbols?.length >= 3) {
      setSymbols(initialSymbols.slice(0, 3));
    }
  }, [initialSymbols]); // eslint-disable-line

  const spinning  = phase === 'spinning';
  const stopping  = phase === 'stopping';
  const moving    = spinning || stopping;

  // The spin strip scrolls from y=0 to y=-(STRIP_H - VIEW_H) then loops.
  // We achieve the loop by duplicating the strip and animating -50% of total.
  // Total duplicated height = STRIP_H * 2, so -50% = -STRIP_H exactly.
  const dupStrip  = [...spinStrip, ...spinStrip];
  const dupH      = STRIP_H * 2;
  const animDur   = `${(STRIP_H / 900).toFixed(2)}s`; // ~speed: 900px/s

  return (
    <div
      ref={containerRef}
      style={{
        width: cellSize + 12,
        height: VIEW_H,
        overflow: 'hidden',
        borderRadius: 12,
        position: 'relative',
        flexShrink: 0,
        background: 'linear-gradient(180deg,rgba(0,0,0,0.85),rgba(10,10,30,0.7) 50%,rgba(0,0,0,0.85))',
        border: `2px solid ${moving ? accent : 'rgba(255,215,0,0.25)'}`,
        boxShadow: moving
          ? `inset 0 0 20px ${accent}55, 0 0 12px ${accent}44`
          : 'inset 0 0 12px rgba(0,0,0,0.6)',
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}
    >
      {/* Fade top */}
      <div style={{ position:'absolute',top:0,left:0,right:0,height:18,zIndex:3,
        background:'linear-gradient(180deg,rgba(0,0,0,0.9),transparent)',pointerEvents:'none' }} />
      {/* Fade bottom */}
      <div style={{ position:'absolute',bottom:0,left:0,right:0,height:18,zIndex:3,
        background:'linear-gradient(0deg,rgba(0,0,0,0.9),transparent)',pointerEvents:'none' }} />

      {/* ── SPINNING strip ── */}
      {moving && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap,
          paddingTop: gap / 2,
          height: dupH,
          // CSS keyframe: scroll from 0 to -STRIP_H (= -50% of dupH) infinitely
          animation: spinning ? `reelScroll ${animDur} linear infinite` : 'none',
          filter: spinning ? 'blur(2px)' : 'blur(0.5px)',
          transition: stopping ? 'filter 0.15s' : 'none',
        }}>
          <style>{`
            @keyframes reelScroll {
              from { transform: translateY(0px); }
              to   { transform: translateY(-${STRIP_H}px); }
            }
          `}</style>
          {dupStrip.map((id, i) => <Cell key={i} id={id} size={cellSize} />)}
        </div>
      )}

      {/* ── IDLE static symbols ── */}
      {!moving && (
        <div
          ref={stripRef}
          style={{ display:'flex', flexDirection:'column', gap, paddingTop: gap / 2 }}
        >
          {symbols.map((id, i) => (
            <Cell key={i} id={id} size={cellSize} winning={winningRows.includes(i)} />
          ))}
        </div>
      )}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Cell
// ─────────────────────────────────────────────────────────────────────────────
function Cell({ id, size = 58, winning = false }) {
  const color = SYMBOL_COLORS[id] || '#FFD700';
  const emoji = SYMBOL_EMOJI[id] || '🎰';
  return (
    <div style={{
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
      animation: winning ? 'symbolPulse 0.5s ease-in-out infinite' : 'none',
    }}>
      <style>{`
        @keyframes symbolPulse {
          0%,100% { transform:scale(1); }
          50%      { transform:scale(1.18); }
        }
      `}</style>
      {emoji}
    </div>
  );
}

export default Cell;
