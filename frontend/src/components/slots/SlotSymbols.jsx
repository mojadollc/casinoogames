import React from 'react';

/** Premium SVG symbols for slot reels — no external image assets needed */
const SIZE = 64;

const frame = (bg, border, children, glow) => (
  <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width="100%" height="100%" style={{ display: 'block', filter: glow ? `drop-shadow(0 0 6px ${glow})` : undefined }}>
    <defs>
      <linearGradient id={`bg-${bg}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={bg} stopOpacity="0.95" />
        <stop offset="100%" stopColor={border} stopOpacity="0.85" />
      </linearGradient>
      <radialGradient id={`shine-${bg}`} cx="35%" cy="30%" r="60%">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
        <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
      </radialGradient>
    </defs>
    <rect x="2" y="2" width="60" height="60" rx="12" fill={`url(#bg-${bg})`} stroke={border} strokeWidth="2.5" />
    <rect x="2" y="2" width="60" height="60" rx="12" fill={`url(#shine-${bg})`} />
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
    <>
      <text x="32" y="44" textAnchor="middle" fontSize="36" fontWeight="900" fill="#FF1493" fontFamily="Arial Black, sans-serif"
        stroke="#FFB6C1" strokeWidth="1.5">7</text>
    </>
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
      <ellipse cx="32" cy="22" rx="6" ry="3" fill="#FFF8DC" opacity="0.5" />
    </>
  ), glow || '#FFD700'),

  cherry: (glow) => frame('#3d0018', '#FF1493', (
    <>
      <path d="M32 18 Q28 28 24 30" stroke="#2E8B57" strokeWidth="2.5" fill="none" />
      <path d="M32 18 Q36 28 40 30" stroke="#2E8B57" strokeWidth="2.5" fill="none" />
      <circle cx="22" cy="42" r="10" fill="#E0115F" stroke="#FF69B4" strokeWidth="1.5" />
      <circle cx="40" cy="40" r="10" fill="#C71585" stroke="#FF69B4" strokeWidth="1.5" />
      <ellipse cx="19" cy="38" rx="3" ry="2" fill="#fff" opacity="0.35" />
    </>
  ), glow || '#FF1493'),

  lemon: (glow) => frame('#3d3d00', '#FFD700', (
    <>
      <ellipse cx="32" cy="34" rx="18" ry="14" fill="#FFE135" stroke="#F4C430" strokeWidth="2" />
      <ellipse cx="32" cy="34" rx="12" ry="9" fill="none" stroke="#F0E68C" strokeWidth="1" opacity="0.6" />
      <path d="M32 18 Q34 22 32 24" stroke="#228B22" strokeWidth="2" fill="none" />
    </>
  ), glow || '#FFD700'),

  orange: (glow) => frame('#3d2000', '#FF8C00', (
    <>
      <circle cx="32" cy="34" r="16" fill="#FF8C00" stroke="#FFA500" strokeWidth="2" />
      <path d="M32 18 C30 22 28 24 32 26 C36 24 34 22 32 18" fill="#228B22" />
      <circle cx="26" cy="30" r="3" fill="#fff" opacity="0.25" />
    </>
  ), glow || '#FF8C00'),

  plum: (glow) => frame('#2a0040', '#9932CC', (
    <>
      <ellipse cx="32" cy="36" rx="14" ry="16" fill="#8B008B" stroke="#DA70D6" strokeWidth="2" />
      <path d="M32 18 Q30 28 32 36" stroke="#4B0082" strokeWidth="2" fill="none" />
      <ellipse cx="26" cy="30" rx="4" ry="3" fill="#fff" opacity="0.25" />
    </>
  ), glow || '#9932CC'),

  grape: (glow) => frame('#1a0030', '#8B008B', (
    <>
      <circle cx="32" cy="28" r="7" fill="#7B2D8E" stroke="#DDA0DD" strokeWidth="1" />
      <circle cx="24" cy="36" r="7" fill="#6A1B9A" stroke="#DDA0DD" strokeWidth="1" />
      <circle cx="40" cy="36" r="7" fill="#6A1B9A" stroke="#DDA0DD" strokeWidth="1" />
      <circle cx="28" cy="44" r="6" fill="#4A148C" stroke="#DDA0DD" strokeWidth="1" />
      <circle cx="36" cy="44" r="6" fill="#4A148C" stroke="#DDA0DD" strokeWidth="1" />
      <path d="M32 16 Q30 22 32 28" stroke="#2E7D32" strokeWidth="2" fill="none" />
      <ellipse cx="36" cy="18" rx="5" ry="3" fill="#43A047" />
    </>
  ), glow || '#8B008B'),
};

export const SYMBOL_COLORS = {
  wild: '#FFD700', scatter: '#00D9FF', seven: '#FF1493', bar: '#CD7F32', bell: '#FFD700',
  cherry: '#FF1493', lemon: '#FFD700', orange: '#FF8C00', plum: '#9932CC', grape: '#8B008B'
};

export const SYMBOL_ORDER = ['wild', 'scatter', 'seven', 'bar', 'bell', 'cherry', 'lemon', 'orange', 'plum', 'grape'];

/** Renders a single slot symbol as polished SVG */
export default function SlotSymbol({ id, winning = false, spinning = false, size = 56 }) {
  const color = SYMBOL_COLORS[id] || '#FFD700';
  const render = SYMBOLS[id] || SYMBOLS.cherry;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 12,
        overflow: 'hidden',
        transform: winning ? 'scale(1.08)' : 'scale(1)',
        transition: 'transform 0.2s ease',
        animation: winning ? 'slotWinPulse 0.45s ease infinite' : spinning ? 'slotReelBlur 0.1s linear infinite' : 'none',
        boxShadow: winning
          ? `0 0 18px ${color}, 0 0 4px ${color}, inset 0 0 8px ${color}40`
          : `0 2px 8px rgba(0,0,0,0.45)`,
        border: winning ? `2px solid ${color}` : '2px solid rgba(255,255,255,0.08)',
        background: '#0a0a14',
      }}
    >
      {render(winning ? color : null)}
    </div>
  );
}
