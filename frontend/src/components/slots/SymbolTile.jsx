import React from 'react';

/**
 * SymbolTile — renders a single slot symbol cell.
 *
 * Props:
 *   id        {string}  symbol key (e.g. 'wild', 'scatter', 'seven')
 *   symbols   {object}  theme symbol map: { [id]: { emoji, name, value, type, color, card, multiplier } }
 *   highlight {bool}    win glow ring
 *   small     {bool}    compact size (paytable / debug)
 */
export default function SymbolTile({ id, symbols = {}, highlight = false, small = false }) {
  const s = symbols[id];
  const size = small ? 60 : 100;
  const fontSize = small ? 30 : 52;

  if (!s) {
    return (
      <div style={{
        width: '100%',
        height: size,
        borderRadius: 12,
        background: 'rgba(10,5,22,0.9)',
        border: '2px solid rgba(255,215,0,0.1)',
      }} />
    );
  }

  const isScatter = s.type === 'scatter' || id === 'scatter';
  const isWild    = s.type === 'wild'    || id === 'wild';
  const isCard    = !!s.card;

  // Base container style
  const base = {
    position: 'relative',
    width: '100%',
    height: size,
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    transform: highlight ? 'scale(1.07)' : 'scale(1)',
    userSelect: 'none',
  };

  // Background & border per type
  let bg, border, boxShadow;

  if (isCard) {
    bg = 'linear-gradient(145deg, #e8e0f0, #c8bcd8)';
    border = highlight ? '2px solid #ffd700' : '2px solid rgba(255,215,0,0.5)';
    boxShadow = highlight
      ? '0 0 22px rgba(255,215,0,0.9), inset 0 0 8px rgba(255,215,0,0.2)'
      : 'inset 0 2px 8px rgba(0,0,0,0.35), 0 2px 6px rgba(0,0,0,0.5)';
  } else if (isScatter) {
    bg = 'radial-gradient(circle at 50% 40%, #FFE9A8, #F39C12 70%)';
    border = highlight ? '2px solid #fff' : '2px solid rgba(243,156,18,0.7)';
    boxShadow = highlight
      ? '0 0 28px rgba(243,156,18,1), 0 0 8px rgba(255,255,255,0.5)'
      : '0 0 18px rgba(243,156,18,0.6)';
  } else if (isWild) {
    bg = 'radial-gradient(circle at 50% 35%, #ff9f5a, #ff3d81 70%)';
    border = highlight ? '2px solid #fff' : '2px solid rgba(255,61,129,0.6)';
    boxShadow = highlight
      ? '0 0 28px rgba(255,61,129,0.9), 0 0 8px rgba(255,255,255,0.4)'
      : '0 0 14px rgba(255,61,129,0.4)';
  } else {
    const col = s.color || '#ffd75a';
    bg = `linear-gradient(160deg, rgba(255,255,255,0.12) 0%, rgba(0,0,0,0.28) 100%)`;
    border = highlight ? `2px solid ${col}` : '2px solid rgba(255,215,0,0.18)';
    boxShadow = highlight
      ? `0 0 22px ${col}, inset 0 0 10px ${col}33`
      : 'inset 0 0 12px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.5)';
  }

  // Win pulse animation via inline keyframes injected once
  if (highlight && !document.getElementById('_stile_kf')) {
    const style = document.createElement('style');
    style.id = '_stile_kf';
    style.textContent = `
      @keyframes _stileGlow {
        0%,100% { opacity:1; transform:scale(1.07); }
        50%      { opacity:0.85; transform:scale(1.11); }
      }
      ._stile_win { animation: _stileGlow 0.55s ease-in-out infinite; }
    `;
    document.head.appendChild(style);
  }

  return (
    <div
      className={highlight ? '_stile_win' : undefined}
      style={{ ...base, background: bg, border, boxShadow }}
    >
      {/* Dark inner vignette for depth (non-scatter/wild) */}
      {!isScatter && !isWild && !isCard && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 10,
          background: 'radial-gradient(circle at 50% 50%, transparent 40%, rgba(0,0,0,0.45) 100%)',
          pointerEvents: 'none',
        }} />
      )}

      {/* Emoji */}
      <span style={{
        fontSize,
        lineHeight: 1,
        filter: isCard
          ? 'none'
          : 'drop-shadow(0 2px 4px rgba(0,0,0,0.6))',
        position: 'relative',
        zIndex: 1,
      }}>
        {s.emoji || s.icon || '❓'}
      </span>

      {/* SCATTER label */}
      {isScatter && (
        <span style={{
          position: 'absolute', top: 3, left: 4,
          fontSize: small ? 7 : 9,
          fontWeight: 900,
          color: '#7a4800',
          letterSpacing: '0.5px',
          lineHeight: 1,
          textTransform: 'uppercase',
        }}>
          SCATTER
        </span>
      )}

      {/* WILD label */}
      {isWild && (
        <span style={{
          position: 'absolute', bottom: 3, left: 0, right: 0,
          textAlign: 'center',
          fontSize: small ? 7 : 9,
          fontWeight: 900,
          color: 'rgba(255,255,255,0.9)',
          letterSpacing: '1px',
          textTransform: 'uppercase',
        }}>
          WILD
        </span>
      )}

      {/* Multiplier badge */}
      {s.multiplier && (
        <span style={{
          position: 'absolute', bottom: 3, right: 4,
          fontSize: small ? 8 : 10,
          fontWeight: 900,
          color: '#fff',
          background: '#9333ea',
          padding: '1px 4px',
          borderRadius: 20,
          lineHeight: 1.4,
        }}>
          x{s.multiplier}
        </span>
      )}

      {/* Win shimmer overlay */}
      {highlight && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 10,
          background: 'linear-gradient(135deg, rgba(255,255,255,0.18) 0%, transparent 60%)',
          pointerEvents: 'none',
        }} />
      )}
    </div>
  );
}
