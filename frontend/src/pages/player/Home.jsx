import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { gameAPI, walletAPI } from '../../services/api';
import { useLogo } from '../../hooks/useLogo';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3020';

// SVG casino icons — golden glossy badge style
const CasinoIcons = {
  slots: ({ size = 40 }) => (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <rect x="6" y="14" width="52" height="36" rx="8" fill="url(#slotBody)"/>
      <rect x="6" y="14" width="52" height="36" rx="8" stroke="#FFD700" strokeWidth="2"/>
      {/* Reels */}
      {[14,26,38].map((x,i) => (
        <g key={i}>
          <rect x={x} y="20" width="12" height="24" rx="3" fill="url(#reelBg)"/>
          <rect x={x} y="20" width="12" height="24" rx="3" stroke="#b8860b" strokeWidth="1"/>
          <text x={x+6} y="36" textAnchor="middle" fontSize="10" fill="#FFD700">{['7','★','♦'][i]}</text>
        </g>
      ))}
      {/* Handle */}
      <rect x="54" y="22" width="5" height="18" rx="2.5" fill="url(#handleGrad)"/>
      <circle cx="56.5" cy="20" r="4" fill="url(#handleBall)"/>
      {/* Coin slot */}
      <rect x="24" y="46" width="16" height="3" rx="1.5" fill="#b8860b"/>
      <defs>
        <linearGradient id="slotBody" x1="6" y1="14" x2="58" y2="50" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#2d1b4e"/><stop offset="100%" stopColor="#1a0a2e"/>
        </linearGradient>
        <linearGradient id="reelBg" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#3a2060"/><stop offset="100%" stopColor="#1a0a2e"/>
        </linearGradient>
        <linearGradient id="handleGrad" x1="0" y1="0" x2="1" y2="0" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#FFD700"/><stop offset="100%" stopColor="#b8860b"/>
        </linearGradient>
        <radialGradient id="handleBall" cx="40%" cy="35%">
          <stop offset="0%" stopColor="#ffe566"/><stop offset="100%" stopColor="#b8860b"/>
        </radialGradient>
      </defs>
    </svg>
  ),
  live: ({ size = 40 }) => (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <circle cx="32" cy="32" r="26" fill="url(#liveCircle)" stroke="#FF4444" strokeWidth="2"/>
      <circle cx="32" cy="32" r="18" fill="none" stroke="rgba(255,68,68,0.4)" strokeWidth="1"/>
      <circle cx="32" cy="32" r="8" fill="#FF4444"/>
      <circle cx="32" cy="32" r="4" fill="#ff8888"/>
      {/* LIVE text */}
      <text x="32" y="54" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#FF4444" letterSpacing="2">LIVE</text>
      <defs>
        <radialGradient id="liveCircle" cx="35%" cy="30%">
          <stop offset="0%" stopColor="#3a1a1a"/><stop offset="100%" stopColor="#1a0505"/>
        </radialGradient>
      </defs>
    </svg>
  ),
  cockfight: ({ size = 40 }) => (
    <span style={{ fontSize: size * 0.7, lineHeight: 1 }} title="Cockfight">🐓</span>
  ),
  fishing: ({ size = 40 }) => (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      {/* Water */}
      <ellipse cx="32" cy="48" rx="24" ry="8" fill="url(#water)"/>
      {/* Fish */}
      <ellipse cx="30" cy="38" rx="12" ry="7" fill="url(#fishBody)"/>
      <polygon points="42,38 50,32 50,44" fill="url(#fishTail)"/>
      <circle cx="22" cy="36" r="2" fill="white"/>
      <circle cx="22" cy="36" r="1" fill="#1a0a2e"/>
      {/* Hook */}
      <path d="M32 10 Q32 28 38 34" stroke="#FFD700" strokeWidth="2" fill="none"/>
      <path d="M38 34 Q44 40 38 44" stroke="#FFD700" strokeWidth="2" fill="none"/>
      {/* Rod */}
      <line x1="8" y1="8" x2="32" y2="10" stroke="#b8860b" strokeWidth="2"/>
      <defs>
        <linearGradient id="water" x1="0" y1="0" x2="1" y2="0" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#0066cc" stopOpacity="0.6"/><stop offset="100%" stopColor="#0044aa" stopOpacity="0.6"/>
        </linearGradient>
        <linearGradient id="fishBody" x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#FFD700"/><stop offset="100%" stopColor="#FF8C00"/>
        </linearGradient>
        <linearGradient id="fishTail" x1="0" y1="0" x2="1" y2="0" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#FF8C00"/><stop offset="100%" stopColor="#FF4500"/>
        </linearGradient>
      </defs>
    </svg>
  ),
  card: ({ size = 40 }) => (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      {/* Back card */}
      <rect x="18" y="12" width="32" height="44" rx="5" fill="url(#cardBack)" stroke="#FFD700" strokeWidth="1.5" transform="rotate(-8 34 34)"/>
      {/* Front card */}
      <rect x="14" y="10" width="32" height="44" rx="5" fill="white" stroke="#FFD700" strokeWidth="1.5"/>
      <text x="20" y="26" fontSize="12" fontWeight="bold" fill="#cc0000">A</text>
      <text x="28" y="38" fontSize="16" fill="#cc0000">♥</text>
      <text x="36" y="50" fontSize="12" fontWeight="bold" fill="#cc0000" transform="rotate(180 39 47)">A</text>
      <defs>
        <linearGradient id="cardBack" x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#1a0a6e"/><stop offset="100%" stopColor="#0d0535"/>
        </linearGradient>
      </defs>
    </svg>
  ),
  table: ({ size = 40 }) => (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      {/* Roulette wheel */}
      <circle cx="32" cy="32" r="24" fill="url(#wheelOuter)" stroke="#FFD700" strokeWidth="2"/>
      <circle cx="32" cy="32" r="18" fill="url(#wheelInner)"/>
      {[0,30,60,90,120,150,180,210,240,270,300,330].map((deg,i) => (
        <line key={i} x1="32" y1="14" x2="32" y2="18"
          stroke={i%2===0?'#cc0000':'#1a1a1a'} strokeWidth="3"
          transform={`rotate(${deg} 32 32)`}/>
      ))}
      <circle cx="32" cy="32" r="6" fill="url(#wheelCenter)" stroke="#FFD700" strokeWidth="1"/>
      <circle cx="32" cy="32" r="2" fill="#FFD700"/>
      <defs>
        <radialGradient id="wheelOuter" cx="40%" cy="35%">
          <stop offset="0%" stopColor="#3a2a00"/><stop offset="100%" stopColor="#1a1200"/>
        </radialGradient>
        <radialGradient id="wheelInner" cx="40%" cy="35%">
          <stop offset="0%" stopColor="#1a6e1a"/><stop offset="100%" stopColor="#0a3a0a"/>
        </radialGradient>
        <radialGradient id="wheelCenter" cx="40%" cy="35%">
          <stop offset="0%" stopColor="#ffe566"/><stop offset="100%" stopColor="#b8860b"/>
        </radialGradient>
      </defs>
    </svg>
  ),
  sports: ({ size = 40 }) => (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <circle cx="32" cy="32" r="24" fill="url(#sportsGrad)" stroke="#FFD700" strokeWidth="2"/>
      {/* Soccer ball pattern */}
      <circle cx="32" cy="32" r="24" fill="none" stroke="white" strokeWidth="0.5" strokeDasharray="4 4"/>
      <polygon points="32,14 38,22 34,30 30,30 26,22" fill="#1a1a1a"/>
      <polygon points="14,26 22,22 26,30 22,38 14,38" fill="#1a1a1a"/>
      <polygon points="50,26 42,22 38,30 42,38 50,38" fill="#1a1a1a"/>
      <polygon points="32,50 38,42 34,34 30,34 26,42" fill="#1a1a1a"/>
      <defs>
        <radialGradient id="sportsGrad" cx="35%" cy="30%">
          <stop offset="0%" stopColor="#ffffff"/><stop offset="100%" stopColor="#cccccc"/>
        </radialGradient>
      </defs>
    </svg>
  ),
  arcade: ({ size = 40 }) => (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      {/* Joystick base */}
      <rect x="12" y="36" width="40" height="20" rx="6" fill="url(#arcadeBase)" stroke="#FFD700" strokeWidth="1.5"/>
      {/* Stick */}
      <rect x="29" y="18" width="6" height="20" rx="3" fill="url(#stickGrad)"/>
      <circle cx="32" cy="16" r="7" fill="url(#stickTop)" stroke="#FFD700" strokeWidth="1"/>
      {/* Buttons */}
      {[[20,44,'#FF4444'],[32,44,'#FFD700'],[44,44,'#44FF44']].map(([x,y,c],i) => (
        <circle key={i} cx={x} cy={y} r="5" fill={c} stroke="rgba(0,0,0,0.3)" strokeWidth="1"/>
      ))}
      <defs>
        <linearGradient id="arcadeBase" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#2d1b4e"/><stop offset="100%" stopColor="#1a0a2e"/>
        </linearGradient>
        <linearGradient id="stickGrad" x1="0" y1="0" x2="1" y2="0" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#888"/><stop offset="100%" stopColor="#444"/>
        </linearGradient>
        <radialGradient id="stickTop" cx="35%" cy="30%">
          <stop offset="0%" stopColor="#ff6666"/><stop offset="100%" stopColor="#cc0000"/>
        </radialGradient>
      </defs>
    </svg>
  ),
  cockfighting: ({ size = 40 }) => (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      {/* Shield/badge shape */}
      <path d="M32 6 L54 16 L54 36 Q54 52 32 58 Q10 52 10 36 L10 16 Z" fill="url(#shieldGrad)" stroke="#FFD700" strokeWidth="2"/>
      {/* Rooster silhouette */}
      <ellipse cx="32" cy="38" rx="10" ry="12" fill="#cc2200"/>
      <circle cx="32" cy="24" r="7" fill="#cc2200"/>
      {/* Comb */}
      <path d="M28 18 Q30 12 32 16 Q33 10 35 15 Q37 11 36 18" fill="#FF4444"/>
      {/* Beak */}
      <polygon points="38,24 44,26 38,28" fill="#FFD700"/>
      {/* Eye */}
      <circle cx="35" cy="23" r="2" fill="white"/>
      <circle cx="35" cy="23" r="1" fill="#1a0a2e"/>
      {/* Tail feathers */}
      <path d="M22 32 Q14 24 16 18 Q20 28 22 32" fill="#FF6600"/>
      <path d="M22 34 Q12 28 12 20 Q18 30 22 34" fill="#FFD700"/>
      <defs>
        <linearGradient id="shieldGrad" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#3a1a00"/><stop offset="100%" stopColor="#1a0800"/>
        </linearGradient>
      </defs>
    </svg>
  ),
  all: ({ size = 40 }) => (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      {/* Trophy */}
      <path d="M20 8 H44 V30 Q44 46 32 50 Q20 46 20 30 Z" fill="url(#trophyGold)" stroke="#b8860b" strokeWidth="1.5"/>
      {/* Handles */}
      <path d="M20 14 Q10 14 10 24 Q10 32 20 32" stroke="#FFD700" strokeWidth="3" fill="none"/>
      <path d="M44 14 Q54 14 54 24 Q54 32 44 32" stroke="#FFD700" strokeWidth="3" fill="none"/>
      {/* Base */}
      <rect x="26" y="50" width="12" height="4" rx="1" fill="#b8860b"/>
      <rect x="22" y="54" width="20" height="4" rx="2" fill="url(#trophyBase)"/>
      {/* Star */}
      <text x="32" y="34" textAnchor="middle" fontSize="16" fill="#1a0a2e">★</text>
      <defs>
        <linearGradient id="trophyGold" x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#ffe566"/><stop offset="50%" stopColor="#FFD700"/><stop offset="100%" stopColor="#b8860b"/>
        </linearGradient>
        <linearGradient id="trophyBase" x1="0" y1="0" x2="1" y2="0" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#b8860b"/><stop offset="100%" stopColor="#8B6914"/>
        </linearGradient>
      </defs>
    </svg>
  ),
};

// Per-game SVG icons keyed by slug
const GAME_ICONS = {
  // Slots — fruit/classic symbols
  'fortune-tiger':    ({ size=56 }) => <SlotSymbolIcon size={size} symbol="🐯" bg={['#FF6B35','#FFD700']} />,
  'fortune-ox':       ({ size=56 }) => <SlotSymbolIcon size={size} symbol="🐂" bg={['#C41E3A','#FFD700']} />,
  'fortune-mouse':    ({ size=56 }) => <SlotSymbolIcon size={size} symbol="🐭" bg={['#FF69B4','#C71585']} />,
  'gates-of-olympus': ({ size=56 }) => <SlotSymbolIcon size={size} symbol="⚡" bg={['#4B0082','#FFD700']} />,
  'starlight-princess':({ size=56 }) => <SlotSymbolIcon size={size} symbol="⭐" bg={['#FF69B4','#FFD700']} />,
  'sweet-bonanza':    ({ size=56 }) => <SlotSymbolIcon size={size} symbol="🍭" bg={['#FF69B4','#FF1493']} />,
  'wild-bandito':     ({ size=56 }) => <SlotSymbolIcon size={size} symbol="🤠" bg={['#8B4513','#FFD700']} />,
  'mahjong-ways':     ({ size=56 }) => <SlotSymbolIcon size={size} symbol="🀄" bg={['#DC143C','#FFD700']} />,
  'mahjong-ways-2':   ({ size=56 }) => <SlotSymbolIcon size={size} symbol="🀄" bg={['#B22222','#FFD700']} />,
  'dragon-legend':    ({ size=56 }) => <SlotSymbolIcon size={size} symbol="🐉" bg={['#FF4500','#FFD700']} />,
  'lucky-neko':       ({ size=56 }) => <SlotSymbolIcon size={size} symbol="🐱" bg={['#FF69B4','#FFD700']} />,
  'bali-vacation':    ({ size=56 }) => <SlotSymbolIcon size={size} symbol="🌴" bg={['#00CED1','#FFD700']} />,
  'caishen-wins':     ({ size=56 }) => <SlotSymbolIcon size={size} symbol="💰" bg={['#FF0000','#FFD700']} />,
  'double-fortune':   ({ size=56 }) => <SlotSymbolIcon size={size} symbol="🎴" bg={['#FF1493','#FFD700']} />,
  'gem-saviour':      ({ size=56 }) => <SlotSymbolIcon size={size} symbol="💎" bg={['#9370DB','#FFD700']} />,
  'dragon-fortune':   ({ size=56 }) => <SlotSymbolIcon size={size} symbol="🐲" bg={['#FF4500','#FFD700']} />,
  // Live
  'dragon-tiger':     ({ size=56 }) => <SlotSymbolIcon size={size} symbol="🐯" bg={['#FF4500','#FF6347']} />,
  'speed-baccarat':   ({ size=56 }) => <SlotSymbolIcon size={size} symbol="🃏" bg={['#00CED1','#0044aa']} />,
  'baccarat':         ({ size=56 }) => <SlotSymbolIcon size={size} symbol="♦" bg={['#cc0000','#FFD700']} />,
  'monopoly-live':    ({ size=56 }) => <SlotSymbolIcon size={size} symbol="🎩" bg={['#FF69B4','#4B0082']} />,
  'crazy-time':       ({ size=56 }) => <SlotSymbolIcon size={size} symbol="🎡" bg={['#FF1493','#FF69B4']} />,
  'lightning-roulette':({ size=56 }) => <SlotSymbolIcon size={size} symbol="⚡" bg={['#FFD700','#FF8C00']} />,
  'dream-catcher':    ({ size=56 }) => <SlotSymbolIcon size={size} symbol="🎯" bg={['#00CED1','#4B0082']} />,
  // Card
  'blackjack-vip':    ({ size=56 }) => <SlotSymbolIcon size={size} symbol="♠" bg={['#4B0082','#1a0a2e']} />,
  // Fishing
  'fishing-god':      ({ size=56 }) => <SlotSymbolIcon size={size} symbol="🐠" bg={['#0066cc','#00CED1']} />,
  'ocean-king':       ({ size=56 }) => <SlotSymbolIcon size={size} symbol="👑" bg={['#0044aa','#FFD700']} />,
  'golden-dragon':    ({ size=56 }) => <SlotSymbolIcon size={size} symbol="🐉" bg={['#FF8C00','#FFD700']} />,
  'fish-hunter':      ({ size=56 }) => <SlotSymbolIcon size={size} symbol="🎣" bg={['#006699','#00CED1']} />,
  // Sic Bo / Table
  'sic-bo':           ({ size=56 }) => <SlotSymbolIcon size={size} symbol="🎲" bg={['#1a6e1a','#FFD700']} />,
  'european-roulette':({ size=56 }) => <SlotSymbolIcon size={size} symbol="🎡" bg={['#1a6e1a','#FFD700']} />,
  'american-roulette':({ size=56 }) => <SlotSymbolIcon size={size} symbol="🎡" bg={['#cc0000','#FFD700']} />,
  'craps':            ({ size=56 }) => <SlotSymbolIcon size={size} symbol="🎲" bg={['#2d1b4e','#FFD700']} />,
  // Poker
  'texas-holdem':     ({ size=56 }) => <SlotSymbolIcon size={size} symbol="♣" bg={['#1a6e1a','#FFD700']} />,
  'teen-patti':       ({ size=56 }) => <SlotSymbolIcon size={size} symbol="🃏" bg={['#cc0000','#FFD700']} />,
  'andar-bahar':      ({ size=56 }) => <SlotSymbolIcon size={size} symbol="🎴" bg={['#FF8C00','#FFD700']} />,
};

// Reusable: glossy badge with symbol — casino icon style
const SlotSymbolIcon = ({ size, symbol, bg }) => {
  const uid = `${bg[0].replace(/[^a-z0-9]/gi,'')}_${bg[1].replace(/[^a-z0-9]/gi,'')}`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <defs>
        <radialGradient id={`bg_${uid}`} cx="35%" cy="30%">
          <stop offset="0%" stopColor={bg[0]}/>
          <stop offset="100%" stopColor={bg[1]}/>
        </radialGradient>
        <radialGradient id={`shine_${uid}`} cx="40%" cy="20%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.35)"/>
          <stop offset="60%" stopColor="rgba(255,255,255,0)"/>
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill="none" stroke="#FFD700" strokeWidth="1" strokeOpacity="0.5"/>
      <circle cx="32" cy="32" r="28" fill={`url(#bg_${uid})`}/>
      <circle cx="32" cy="32" r="28" fill={`url(#shine_${uid})`}/>
      <circle cx="32" cy="32" r="24" fill="none" stroke="rgba(255,215,0,0.4)" strokeWidth="1"/>
      <text x="32" y="42" textAnchor="middle" fontSize="26">{symbol}</text>
      <path d="M14 48 Q32 56 50 48" stroke="#FFD700" strokeWidth="1.5" fill="none" strokeOpacity="0.6"/>
    </svg>
  );
};

// Category icon renderer
const CategoryIcon = ({ category, size = 40 }) => {
  const Icon = CasinoIcons[category] || CasinoIcons.slots;
  return <Icon size={size} />;
};

// Game card icon — uses per-slug icon or falls back to category icon
const GameIcon = ({ slug, category, size = 56 }) => {
  const Icon = GAME_ICONS[slug];
  if (Icon) return <Icon size={size} />;
  const CatIcon = CasinoIcons[category] || CasinoIcons.slots;
  return <CatIcon size={size} />;
};

// CasinoPlus-style game categories
const CATEGORIES = [
  { id: 'all',          name: 'All Games',    color: '#FFD700' },
  { id: 'slots',        name: 'Slots',        color: '#FF1493' },
  { id: 'live',         name: 'Live Casino',  color: '#00D9FF' },
  { id: 'fishing',      name: 'Fishing',      color: '#00D9FF' },
  { id: 'cockfight',    name: 'Cockfight',    color: '#FF6B35' },
  { id: 'card',         name: 'Card Games',   color: '#FF1493' },
  { id: 'table',        name: 'Table Games',  color: '#00D9FF' },
  { id: 'sports',       name: 'Sports',       color: '#00D9FF' },
  { id: 'arcade',       name: 'Arcade',       color: '#FF1493' },
  { id: 'cockfighting', name: 'Cockfighting', color: '#FF1493' },
];

// Game type → category mapping
const typeToCategory = (type) => {
  if (!type) return 'slots';
  const t = type.toLowerCase();
  if (t === 'live') return 'live';
  if (t === 'fishing') return 'fishing';
  if (t === 'cockfight' || t === 'sabong') return 'cockfight';
  if (t === 'card') return 'card';
  if (t === 'table') return 'table';
  if (t === 'cockfighting' || t === 'cock-fighting') return 'cockfighting';
  return 'slots'; // slot / slots
};

// CasinoPlus-style featured games with gradient backgrounds
const FEATURED_GAMES = [
  { id: 'fortune-tiger', name: 'Fortune Tiger', category: 'slots', type: 'slots', bg: 'linear-gradient(135deg, #FF6B35 0%, #F7931E 50%, #FFD700 100%)', hot: true, provider: 'PG Soft', rtp: 96.8 },
  { id: 'fortune-ox', name: 'Fortune Ox', category: 'slots', type: 'slots', bg: 'linear-gradient(135deg, #C41E3A 0%, #8B0000 50%, #FFD700 100%)', new: true, provider: 'PG Soft', rtp: 96.5 },
  { id: 'fortune-mouse', name: 'Fortune Mouse', category: 'slots', type: 'slots', bg: 'linear-gradient(135deg, #FF69B4 0%, #FF1493 50%, #C71585 100%)', provider: 'PG Soft', rtp: 96.8 },
  { id: 'gates-of-olympus', name: 'Gates of Olympus', category: 'slots', type: 'slots', bg: 'linear-gradient(135deg, #4B0082 0%, #8B008B 50%, #FFD700 100%)', hot: true, provider: 'Pragmatic', rtp: 96.5 },
  { id: 'starlight-princess', name: 'Starlight Princess', category: 'slots', type: 'slots', bg: 'linear-gradient(135deg, #FF69B4 0%, #FFB6C1 50%, #FFD700 100%)', provider: 'Pragmatic', rtp: 96.5 },
  { id: 'sweet-bonanza', name: 'Sweet Bonanza', category: 'slots', type: 'slots', bg: 'linear-gradient(135deg, #FF69B4 0%, #FFB6C1 50%, #FFD700 100%)', hot: true, provider: 'Pragmatic', rtp: 96.5 },
  { id: 'wild-bandito', name: 'Wild Bandito', category: 'slots', type: 'slots', bg: 'linear-gradient(135deg, #8B4513 0%, #D2691E 50%, #FFD700 100%)', new: true, provider: 'PG Soft', rtp: 96.7 },
  { id: 'mahjong-ways', name: 'Mahjong Ways', category: 'slots', type: 'slots', bg: 'linear-gradient(135deg, #DC143C 0%, #B22222 50%, #FFD700 100%)', hot: true, provider: 'PG Soft', rtp: 96.9 },
  { id: 'mahjong-ways-2', name: 'Mahjong Ways 2', category: 'slots', type: 'slots', bg: 'linear-gradient(135deg, #DC143C 0%, #B22222 50%, #FFD700 100%)', provider: 'PG Soft', rtp: 96.95 },
  { id: 'dragon-legend', name: 'Dragon Legend', category: 'slots', type: 'slots', bg: 'linear-gradient(135deg, #FF4500 0%, #FF6347 50%, #FFD700 100%)', provider: 'PG Soft', rtp: 97.0 },
  { id: 'lucky-neko', name: 'Lucky Neko', category: 'slots', type: 'slots', bg: 'linear-gradient(135deg, #FF69B4 0%, #FFB6C1 50%, #FFD700 100%)', provider: 'PG Soft', rtp: 96.4 },
  { id: 'bali-vacation', name: 'Bali Vacation', category: 'slots', type: 'slots', bg: 'linear-gradient(135deg, #00CED1 0%, #40E0D0 50%, #FFD700 100%)', provider: 'PG Soft', rtp: 96.7 },
  { id: 'caishen-wins', name: 'Caishen Wins', category: 'slots', type: 'slots', bg: 'linear-gradient(135deg, #FF0000 0%, #DC143C 50%, #FFD700 100%)', provider: 'PG Soft', rtp: 96.8 },
  { id: 'double-fortune', name: 'Double Fortune', category: 'slots', type: 'slots', bg: 'linear-gradient(135deg, #FF1493 0%, #C71585 50%, #FFD700 100%)', provider: 'PG Soft', rtp: 96.9 },
  { id: 'gem-saviour', name: 'Gem Saviour', category: 'slots', type: 'slots', bg: 'linear-gradient(135deg, #9370DB 0%, #8A2BE2 50%, #FFD700 100%)', provider: 'PG Soft', rtp: 96.7 },
  { id: 'dragon-fortune', name: 'Dragon Fortune', category: 'slots', type: 'slots', bg: 'linear-gradient(135deg, #FF4500 0%, #FF6347 50%, #FFD700 100%)', provider: 'REELX', rtp: 95.5 },
  { id: 'dragon-tiger', name: 'Dragon Tiger', category: 'live', type: 'live', bg: 'linear-gradient(135deg, #FF4500 0%, #FF6347 50%, #FFD700 100%)', hot: true, provider: 'Evolution', rtp: 96.5 },
  { id: 'speed-baccarat', name: 'Speed Baccarat', category: 'live', type: 'live', bg: 'linear-gradient(135deg, #00CED1 0%, #40E0D0 50%, #FFD700 100%)', hot: true, provider: 'SA Gaming', rtp: 98.9 },
  { id: 'blackjack-vip', name: 'Blackjack VIP', category: 'card', type: 'card', bg: 'linear-gradient(135deg, #4B0082 0%, #8B008B 50%, #FFD700 100%)', new: true, provider: 'Ezugi', rtp: 99.5 },
  { id: 'monopoly-live', name: 'Monopoly Live', category: 'live', type: 'live', bg: 'linear-gradient(135deg, #FF69B4 0%, #FFB6C1 50%, #FFD700 100%)', hot: true, provider: 'Evolution', rtp: 96.2 },
];

// CasinoPlus-style banners
const BANNERS = [
  { id: 1, title: 'Welcome Bonus 200%', subtitle: 'Up to ₱50,000 on first deposit!', color: '#FFD700' },
  { id: 2, title: 'Daily Cashback 10%', subtitle: 'Get 10% cashback every day!', color: '#00D9FF' },
  { id: 3, title: 'VIP Rewards', subtitle: 'Exclusive perks for VIP members', color: '#FF1493' },
  { id: 4, title: 'Weekly Tournament', subtitle: 'Win up to ₱1,000,000!', color: '#FFD700' },
];

// Jackpot counter — fetches real total from DB, then ticks up slowly
// Module-level cache — survives component unmount/remount (login navigation)
// sessionStorage seeds the value on page refresh so counter never resets to 0
let _jackpotCache = parseFloat(sessionStorage.getItem('jackpot') || '0');
let _jackpotInterval = null;

const JackpotCounter = ({ value }) => (
  <div style={{ background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.15), rgba(184, 134, 11, 0.1))', border: '2px solid rgba(255, 215, 0, 0.4)', borderRadius: '16px', padding: '16px 24px', textAlign: 'center', marginBottom: '24px' }}>
    <div style={{ fontSize: '12px', color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '4px' }}>🏆 Progressive Jackpot 🏆</div>
    <div style={{ fontSize: '32px', fontWeight: '900', background: 'linear-gradient(135deg, #ffd700, #ffed4a, #ffd700)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
      ₱{value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </div>
  </div>
);

export default function Home() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const socketRef = useRef(null);

  const logoUrl = useLogo();
  const [balance, setBalance] = useState(0);
  const [balancePulse, setBalancePulse] = useState(false);
  const [dbGames, setDbGames] = useState([]);
  const [jackpotTotal, setJackpotTotal] = useState(0);
  const [jackpot, setJackpot] = useState(_jackpotCache);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [bannerIndex, setBannerIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Fetch games and jackpot total from DB
  useEffect(() => {
    Promise.all([
      gameAPI.list(),
      gameAPI.jackpotTotal().catch(() => ({ data: { total: 0 } }))
    ]).then(([gamesRes, jackpotRes]) => {
      setDbGames(gamesRes.data);
      const total = parseFloat(jackpotRes.data.total) || 0;
      setJackpotTotal(total);
      // Only seed from DB if cache is empty (first ever load)
      if (_jackpotCache === 0) {
        _jackpotCache = total;
        sessionStorage.setItem('jackpot', total.toString());
        setJackpot(total);
      } else if (total > _jackpotCache) {
        // DB value is higher (e.g. another user won and reset) — sync up
        _jackpotCache = total;
        sessionStorage.setItem('jackpot', total.toString());
        setJackpot(total);
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // Tick jackpot down slowly, then reset to a higher value when it hits the floor
  useEffect(() => {
    if (_jackpotInterval) clearInterval(_jackpotInterval);
    _jackpotInterval = setInterval(() => {
      _jackpotCache -= Math.random() * 1.5;
      if (_jackpotCache < 50000) {
        // Someone "won" — reset to a new higher amount
        _jackpotCache = 80000 + Math.random() * 50000;
      }
      sessionStorage.setItem('jackpot', _jackpotCache.toString());
      setJackpot(_jackpotCache);
    }, 300);
    return () => {};
  }, []);

  // Fetch balance & setup socket for logged-in users
  useEffect(() => {
    if (!user) return;

    // Fetch balance
    walletAPI.balance().then(({ data }) => setBalance(Number(data.balance) || 0)).catch(() => {});

    // Socket for real-time updates
    socketRef.current = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socketRef.current.on('connect', () => socketRef.current.emit('join', user.id));
    socketRef.current.on('wallet:update', ({ balance: newBalance }) => {
      setBalance(Number(newBalance) || 0);
      setBalancePulse(true);
      setTimeout(() => setBalancePulse(false), 500);
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [user]);

  // Banner rotation
  useEffect(() => {
    const interval = setInterval(() => setBannerIndex(prev => (prev + 1) % BANNERS.length), 5000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    await logout();
    setShowUserMenu(false);
    navigate('/login');
  };

  // Build game list from DB only — FEATURED_GAMES used only for hot/new badges & gradients
  const FEATURED_META = Object.fromEntries(FEATURED_GAMES.map(g => [g.id, g]));
  const allGames = dbGames.map(g => {
    const meta = FEATURED_META[g.slug] || {};
    const category = typeToCategory(g.type);
    return {
      id: g.slug,
      slug: g.slug,
      name: g.name,
      category,
      type: g.type,
      rtp: g.rtp,
      provider: meta.provider || 'REELX',
      hot: meta.hot || false,
      new: meta.new || false,
      bg: meta.bg || 'linear-gradient(135deg, #1a1a2e, #0d0515)',
      thumbnail_url: g.thumbnail_url || null,
    };
  });

  const filteredGames = allGames.filter(game => {
    const matchesCategory = activeCategory === 'all' || game.category === activeCategory;
    const matchesSearch = game.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const banner = BANNERS[bannerIndex];
  const formatBalance = (val) => Number(val || 0).toLocaleString('en', { minimumFractionDigits: 2 });

  return (
    <div className="home-page" style={{ minHeight: '100vh' }}>
      {/* Desktop Header */}
      <header className="desktop-header" style={{ background: 'linear-gradient(180deg, rgba(13, 2, 33, 0.98), rgba(26, 10, 46, 0.95))', borderBottom: '1px solid rgba(255, 215, 0, 0.2)', position: 'sticky', top: 0, zIndex: 1000 }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '12px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {/* Logo */}
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '16px', textDecoration: 'none' }}>
            {logoUrl
              ? <img src={logoUrl} alt="Logo" style={{ height: '52px', maxWidth: '180px', objectFit: 'contain', filter: 'drop-shadow(0 0 10px rgba(255,215,0,0.5))' }} />
              : (
                <>
                  <div style={{ width: '50px', height: '50px', background: 'linear-gradient(135deg, #ffd700, #b8860b)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', boxShadow: '0 0 30px rgba(255, 215, 0, 0.4)' }}>🐉</div>
                  <div>
                    <div style={{ fontSize: '28px', fontWeight: '900', background: 'linear-gradient(135deg, #ffd700, #ffed4a, #ffd700)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>REELX</div>
                    <div style={{ fontSize: '10px', color: 'var(--gold)', letterSpacing: '3px' }}>PREMIUM GAMING</div>
                  </div>
                </>
              )
            }
          </Link>

          {/* Navigation */}
          <nav style={{ display: 'flex', gap: '32px' }}>
            {['Games', 'Live Casino', 'Sports', 'Promotions', 'VIP'].map(item => (
              <a key={item} href="#" style={{ color: 'white', textDecoration: 'none', fontSize: '14px', fontWeight: '600', opacity: item === 'Games' ? 1 : 0.7, borderBottom: item === 'Games' ? '2px solid var(--gold)' : 'none', paddingBottom: '4px' }}>{item}</a>
            ))}
          </nav>

          {/* User Actions */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {user ? (
              <>
                {/* Balance */}
                <div onClick={() => navigate('/wallet')} style={{ padding: '10px 20px', background: balancePulse ? 'rgba(0, 245, 160, 0.2)' : 'rgba(255, 215, 0, 0.1)', borderRadius: '25px', border: `2px solid ${balancePulse ? '#00f5a0' : 'rgba(255, 215, 0, 0.3)'}`, cursor: 'pointer', transition: 'all 0.3s' }}>
                  <span style={{ fontSize: '12px', color: balancePulse ? '#00f5a0' : 'var(--gold)' }}>{balancePulse ? '💰 +' : 'Balance: '}</span>
                  <span style={{ color: balancePulse ? '#00f5a0' : 'var(--gold)', fontWeight: '700' }}>₱{formatBalance(balance)}</span>
                </div>
                <button onClick={() => navigate('/wallet')} style={{ padding: '10px 24px', background: 'linear-gradient(135deg, #ffd700, #b8860b)', border: 'none', borderRadius: '25px', color: '#1a0a2e', fontWeight: '700', cursor: 'pointer' }}>Deposit</button>
                {/* User Menu */}
                <div style={{ position: 'relative' }}>
                  <button onClick={() => setShowUserMenu(!showUserMenu)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(255, 215, 0, 0.3)', borderRadius: '25px', color: 'white', cursor: 'pointer' }}>
                    <span style={{ width: '32px', height: '32px', background: 'linear-gradient(135deg, #ff2d75, #00f5d4)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', color: '#1a0a2e' }}>{user.username?.[0]?.toUpperCase() || 'U'}</span>
                    <span>{user.username}</span>
                    ▼
                  </button>
                  {showUserMenu && (
                    <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', background: '#1a0a2e', border: '1px solid rgba(255, 215, 0, 0.3)', borderRadius: '12px', padding: '8px', minWidth: '150px', zIndex: 100 }}>
                      <Link to="/wallet" onClick={() => setShowUserMenu(false)} style={{ display: 'block', padding: '10px 16px', color: 'white', textDecoration: 'none', borderRadius: '8px' }}>💳 Wallet</Link>
                      <Link to="/promotions" onClick={() => setShowUserMenu(false)} style={{ display: 'block', padding: '10px 16px', color: 'white', textDecoration: 'none', borderRadius: '8px' }}>🎁 Promotions</Link>
                      <Link to="/profile" onClick={() => setShowUserMenu(false)} style={{ display: 'block', padding: '10px 16px', color: 'white', textDecoration: 'none', borderRadius: '8px' }}>👤 Profile</Link>
                      {user.role_id >= 2 && <Link to="/admin" onClick={() => setShowUserMenu(false)} style={{ display: 'block', padding: '10px 16px', color: 'var(--gold)', textDecoration: 'none', borderRadius: '8px' }}>🔧 Admin</Link>}
                      <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)', margin: '4px 0' }} />
                      <button onClick={handleLogout} style={{ width: '100%', padding: '10px 16px', background: 'rgba(255, 71, 87, 0.2)', border: 'none', borderRadius: '8px', color: '#ff4757', cursor: 'pointer', textAlign: 'left' }}>🚪 Logout</button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <button onClick={() => navigate('/login')} style={{ padding: '10px 24px', background: 'linear-gradient(135deg, #ffd700, #b8860b)', border: 'none', borderRadius: '25px', color: '#1a0a2e', fontWeight: '700', cursor: 'pointer' }}>Login</button>
                <button onClick={() => navigate('/register')} style={{ padding: '10px 24px', background: 'transparent', border: '2px solid var(--gold)', borderRadius: '25px', color: 'var(--gold)', fontWeight: '700', cursor: 'pointer' }}>Register</button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Header */}
      <div className="mobile-header" style={{ background: 'linear-gradient(180deg, #1a0a2e, #0d0221)', padding: '16px', position: 'sticky', top: 0, zIndex: 100, borderBottom: '1px solid rgba(255, 215, 0, 0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
            {logoUrl
              ? <img src={logoUrl} alt="Logo" style={{ height: '40px', maxWidth: '130px', objectFit: 'contain', filter: 'drop-shadow(0 0 8px rgba(255,215,0,0.5))' }} />
              : (
                <>
                  <div style={{ width: '40px', height: '40px', background: 'linear-gradient(135deg, #ffd700, #b8860b)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>🐉</div>
                  <span style={{ fontSize: '20px', fontWeight: '900', background: 'linear-gradient(135deg, #ffd700, #ffed4a)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>REELX</span>
                </>
              )
            }
          </Link>
          {user ? (
            <div onClick={() => navigate('/wallet')} style={{ padding: '8px 16px', background: balancePulse ? 'rgba(0, 245, 160, 0.2)' : 'rgba(255, 215, 0, 0.1)', borderRadius: '20px', border: `1px solid ${balancePulse ? '#00f5a0' : 'rgba(255, 215, 0, 0.3)'}`, cursor: 'pointer' }}>
              <span style={{ color: balancePulse ? '#00f5a0' : 'var(--gold)', fontWeight: '700' }}>₱{formatBalance(balance)}</span>
            </div>
          ) : (
            <button onClick={() => navigate('/login')} style={{ padding: '8px 20px', background: 'linear-gradient(135deg, #ffd700, #b8860b)', border: 'none', borderRadius: '20px', color: '#1a0a2e', fontWeight: '700', cursor: 'pointer' }}>Login</button>
          )}
        </div>
      </div>

      {/* Mobile Search Bar */}
      <div className="mobile-search" style={{ padding: '12px 16px' }}>
        <input type="text" placeholder="🔍 Search games..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ width: '100%', padding: '12px 16px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', color: 'white', fontSize: '14px' }} />
      </div>

      {/* Mobile Banner Carousel */}
      <div className="mobile-banner" style={{ margin: '0 16px 16px', padding: '20px', background: `linear-gradient(135deg, #1a0a2e, #2d1b4e)`, borderRadius: '16px', border: `2px solid ${banner.color}`, boxShadow: `0 0 30px ${banner.color}30` }}>
        <div style={{ fontSize: '22px', fontWeight: '900', color: banner.color, marginBottom: '6px' }}>{banner.title}</div>
        <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)' }}>{banner.subtitle}</div>
        <div style={{ display: 'flex', gap: '6px', marginTop: '12px' }}>
          {BANNERS.map((_, i) => (<div key={i} style={{ width: i === bannerIndex ? '20px' : '8px', height: '8px', borderRadius: '4px', background: i === bannerIndex ? banner.color : 'rgba(255,255,255,0.3)', transition: 'width 0.3s' }} />))}
        </div>
      </div>

      {/* Jackpot Counter */}
      <div className="jackpot-section" style={{ padding: '0 16px' }}>
        <JackpotCounter value={jackpot} />
      </div>

      {/* Desktop Hero Section */}
      <section className="desktop-hero" style={{ background: 'linear-gradient(135deg, #0d0221, #1a0a2e, #0d0221)', padding: '60px 32px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '10%', left: '5%', fontSize: '150px', opacity: '0.05', transform: 'rotate(-15deg)' }}>🐉</div>
        <div style={{ position: 'absolute', top: '20%', right: '5%', fontSize: '200px', opacity: '0.03', transform: 'scaleX(-1)' }}>🐲</div>
        <div style={{ maxWidth: '1400px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <div style={{ background: 'linear-gradient(90deg, rgba(255, 45, 117, 0.2), rgba(255, 215, 0, 0.2))', padding: '12px 24px', borderRadius: '50px', display: 'inline-flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
            <span style={{ background: '#ff2d75', padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: '700' }}>NEW</span>
            <span style={{ fontSize: '13px' }}>🎁 Claim your 200% Welcome Bonus up to ₱50,000!</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '60px', alignItems: 'center' }}>
            <div>
              <h1 style={{ fontSize: '52px', fontWeight: '900', lineHeight: '1.1', marginBottom: '20px' }}>
                <span style={{ background: 'linear-gradient(135deg, #ffd700, #ffed4a)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Win Big</span><br />
                <span style={{ color: 'white' }}>With Philippines'</span><br />
                <span style={{ background: 'linear-gradient(135deg, #ff2d75, #00f5d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>#1 Casino</span>
              </h1>
              <p style={{ fontSize: '16px', color: 'var(--text-muted)', marginBottom: '32px', maxWidth: '500px' }}>Experience the thrill of premium gaming with 500+ slots, live dealers, and instant withdrawals.</p>
              <div style={{ display: 'flex', gap: '16px' }}>
                {user ? (
                  <button onClick={() => navigate('/wallet')} style={{ padding: '16px 40px', background: 'linear-gradient(135deg, #ffd700, #b8860b)', border: 'none', borderRadius: '30px', color: '#1a0a2e', fontSize: '16px', fontWeight: '800', cursor: 'pointer', boxShadow: '0 0 40px rgba(255, 215, 0, 0.4)' }}>💳 Deposit Now</button>
                ) : (
                  <>
                    <button onClick={() => navigate('/register')} style={{ padding: '16px 40px', background: 'linear-gradient(135deg, #ffd700, #b8860b)', border: 'none', borderRadius: '30px', color: '#1a0a2e', fontSize: '16px', fontWeight: '800', cursor: 'pointer', boxShadow: '0 0 40px rgba(255, 215, 0, 0.4)' }}>🎮 Play Now</button>
                    <button onClick={() => navigate('/login')} style={{ padding: '16px 40px', background: 'transparent', border: '2px solid var(--secondary)', borderRadius: '30px', color: 'var(--secondary)', fontSize: '16px', fontWeight: '700', cursor: 'pointer' }}>Login</button>
                  </>
                )}
              </div>
              <div style={{ display: 'flex', gap: '40px', marginTop: '40px' }}>
                {[{ value: '500+', label: 'Games' }, { value: '₱1B+', label: 'Paid Out' }, { value: '100K+', label: 'Players' }].map((stat, i) => (
                  <div key={i}>
                    <div style={{ fontSize: '28px', fontWeight: '900', color: 'var(--gold)' }}>{stat.value}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <JackpotCounter value={jackpot} />
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', borderRadius: '24px', padding: '24px', border: '1px solid rgba(255, 215, 0, 0.1)' }}>
                <div style={{ fontSize: '14px', fontWeight: '700', marginBottom: '16px', color: 'var(--gold)' }}>🔥 TRENDING NOW</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                  {allGames.filter(g => g.hot).slice(0, 6).map((game, i) => (
                    <Link to={`/game/${game.slug}`} key={i} style={{ textDecoration: 'none' }}>
                      <div style={{ background: 'linear-gradient(145deg, #2d1b4e, #1a0a2e)', borderRadius: '14px', padding: '12px', textAlign: 'center', border: '1px solid rgba(255, 215, 0, 0.1)', overflow: 'hidden' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px', height: '40px', alignItems: 'center', position: 'relative' }}>
                          {game.thumbnail_url
                            ? <img src={game.thumbnail_url} alt={game.name} style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '6px' }} />
                            : <GameIcon slug={game.slug} category={game.category} size={40} />}
                        </div>
                        <div style={{ fontSize: '11px', fontWeight: '600', color: 'white' }}>{game.name}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories Bar */}
      <section style={{ background: '#0d0221', padding: '20px 32px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          {CATEGORIES.map(cat => (
            <button key={cat.id} onClick={() => setActiveCategory(cat.id)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', background: activeCategory === cat.id ? 'linear-gradient(135deg, #ffd700, #b8860b)' : 'rgba(255, 255, 255, 0.03)', border: activeCategory === cat.id ? 'none' : '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '25px', color: activeCategory === cat.id ? '#1a0a2e' : 'white', fontWeight: '600', fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s' }}>
              <CategoryIcon category={cat.id} size={22} />
              <span>{cat.name}</span>
            </button>
          ))}
          <div className="desktop-search" style={{ marginLeft: 'auto' }}>
            <input type="text" placeholder="🔍 Search games..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ width: '250px', padding: '12px 20px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '25px', color: 'white', fontSize: '13px' }} />
          </div>
        </div>
      </section>

      {/* Hot Games - Mobile */}
      <div className="mobile-hot-games" style={{ padding: '0 16px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700' }}>🔥 Hot Games</h3>
          <span style={{ fontSize: '12px', color: 'var(--gold)' }}>See All →</span>
        </div>
        <div style={{ display: 'flex', overflowX: 'auto', gap: '12px', WebkitOverflowScrolling: 'touch' }}>
          {allGames.filter(g => g.hot).slice(0, 6).map((game, i) => (
            <Link to={`/game/${game.slug}`} key={i} style={{ flexShrink: 0, width: '110px', textDecoration: 'none' }}>
              <div style={{ width: '110px', height: '110px', background: 'linear-gradient(145deg, #2d1b4e, #1a0a2e)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px', border: '2px solid rgba(255, 215, 0, 0.2)', position: 'relative', overflow: 'hidden' }}>
                {game.thumbnail_url
                  ? <img src={game.thumbnail_url} alt={game.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <GameIcon slug={game.slug} category={game.category} size={64} />}
                <div style={{ position: 'absolute', top: '6px', right: '6px', background: '#ff2d75', padding: '2px 6px', borderRadius: '6px', fontSize: '8px', fontWeight: '700', zIndex: 1 }}>HOT</div>
              </div>
              <div style={{ fontSize: '11px', fontWeight: '600', color: 'white', textAlign: 'center' }}>{game.name}</div>
            </Link>
          ))}
        </div>
      </div>

      {/* Games Grid */}
      <section style={{ background: '#0d0221', padding: '40px 32px' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <h3 className="section-title" style={{ fontSize: '18px', fontWeight: '700', marginBottom: '20px' }}>🎮 {activeCategory === 'all' ? 'All Games' : CATEGORIES.find(c => c.id === activeCategory)?.name}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '16px' }}>
            {filteredGames.map((game, i) => (
              <Link to={`/game/${game.slug}`} key={i} style={{ textDecoration: 'none' }}>
                <div style={{ background: game.bg || 'linear-gradient(145deg, #1a0a2e, #0d0515)', borderRadius: '18px', overflow: 'hidden', border: '1px solid rgba(255, 215, 0, 0.1)', transition: 'transform 0.2s, box-shadow 0.2s' }}>
                  <div style={{ height: '140px', background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
                    {game.thumbnail_url
                      ? <img src={game.thumbnail_url} alt={game.name} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
                      : <GameIcon slug={game.slug} category={game.category} size={80} />}
                    {game.hot && <div style={{ position: 'absolute', top: '10px', right: '10px', background: '#ff2d75', padding: '4px 10px', borderRadius: '8px', fontSize: '10px', fontWeight: '800', zIndex: 1 }}>🔥 HOT</div>}
                    {game.new && !game.hot && <div style={{ position: 'absolute', top: '10px', right: '10px', background: '#00f5d4', color: '#0d0221', padding: '4px 10px', borderRadius: '8px', fontSize: '10px', fontWeight: '800', zIndex: 1 }}>✨ NEW</div>}
                  </div>
                  <div style={{ padding: '14px', background: 'rgba(0,0,0,0.5)' }}>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: 'white', marginBottom: '4px' }}>{game.name}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{game.provider}</span>
                      <span style={{ fontSize: '10px', color: 'var(--secondary)' }}>RTP {game.rtp}%</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ background: '#050010', padding: '40px 32px', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>Licensed by PAGCOR • 18+ Only • Play Responsibly</div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', flexWrap: 'wrap' }}>
            {['Terms', 'Privacy', 'Responsible Gaming', 'Contact'].map(item => (<a key={item} href="#" style={{ fontSize: '12px', color: 'var(--text-muted)', textDecoration: 'none' }}>{item}</a>))}
          </div>
          <div style={{ marginTop: '20px', fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>© 2024 REELX. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}
