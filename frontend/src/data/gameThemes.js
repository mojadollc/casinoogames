// Single source of truth for all slot game theme data.
// Imported by SlotGame, GamePlay, and any future game components.

// ─────────────────────────────────────────────────────────────────────────────
// Default payout/weight tables (matching backend engine)
// ─────────────────────────────────────────────────────────────────────────────
export const PAYOUT_VALUES = [
  { 3: 2,  4: 10, 5: 50 },   // scatter
  { 3: 5,  4: 20, 5: 100 },  // wild/high1
  { 3: 4,  4: 15, 5: 75 },   // high2
  { 3: 3,  4: 12, 5: 60 },   // mid
  { 3: 2,  4: 8,  5: 40 },   // ace
  { 3: 2,  4: 7,  5: 35 },   // king
  { 3: 1,  4: 6,  5: 30 },   // queen
  { 3: 1,  4: 5,  5: 25 },   // jack
];

export const WEIGHT_VALUES = [2, 4, 5, 6, 8, 8, 9, 10];

function buildTheme(meta, defs) {
  const symbols = {};
  const payouts = {};
  const weights = {};
  const order = [];
  defs.forEach((d, i) => {
    symbols[d.id] = { ...d };
    payouts[d.id] = PAYOUT_VALUES[i] || PAYOUT_VALUES[PAYOUT_VALUES.length - 1];
    weights[d.id] = WEIGHT_VALUES[i] || WEIGHT_VALUES[WEIGHT_VALUES.length - 1];
    order.push(d.id);
  });
  const scatter = defs.find(d => d.type === 'scatter');
  const wild = defs.find(d => d.type === 'wild');
  // Images are loaded from /assets/slots/{theme}/{symbol}.webp or .png
  // If no image, falls back to emoji
  return { ...meta, symbols, payouts, weights, order, scatterId: scatter?.id, wildId: wild?.id };
}

// ─────────────────────────────────────────────────────────────────────────────
// Theme definitions — each symbol now has emoji, type, card, multiplier
// ─────────────────────────────────────────────────────────────────────────────
export const SLOT_THEMES = {
  'fortune-tiger': buildTheme(
    { id: 'fortune-tiger', title: 'Fortune Tiger', accent: '#FF6B35', bg: 'linear-gradient(135deg, #FF6B35 0%, #F7931E 50%, #FFD700 100%)' },
    [
      { id: 'scatter', emoji: '🧧', name: 'Red Envelope', type: 'scatter', color: '#ff0000' },
      { id: 'wild',    emoji: '🐅', name: 'Tiger Wild',  type: 'wild', color: '#ff6b00', multiplier: 2 },
      { id: 'seven',   emoji: '🐯', name: 'Golden Tiger', color: '#ffd700' },
      { id: 'bar',     emoji: '🎪', name: 'Lantern', color: '#ff4757' },
      { id: 'ace',     emoji: 'A',  name: 'Ace', card: true, color: '#e0e0f0' },
      { id: 'king',    emoji: 'K',  name: 'King', card: true, color: '#e0e0f0' },
      { id: 'queen',   emoji: 'Q',  name: 'Queen', card: true, color: '#e0e0f0' },
      { id: 'jack',    emoji: 'J',  name: 'Jack', card: true, color: '#e0e0f0' },
    ]
  ),

  'fortune-ox': buildTheme(
    { id: 'fortune-ox', title: 'Fortune Ox', accent: '#C41E3A', bg: 'linear-gradient(135deg, #C41E3A 0%, #8B0000 50%, #FFD700 100%)' },
    [
      { id: 'scatter', emoji: '💰', name: 'Gold Ingot', type: 'scatter', color: '#ffd700' },
      { id: 'wild',    emoji: '🐂', name: 'Ox Wild', type: 'wild', color: '#c41e3a', multiplier: 2 },
      { id: 'seven',   emoji: '🐃', name: 'Water Buffalo', color: '#8b4513' },
      { id: 'bar',     emoji: '🌾', name: 'Rice', color: '#daa520' },
      { id: 'ace',     emoji: 'A', name: 'Ace', card: true, color: '#e0e0f0' },
      { id: 'king',    emoji: 'K', name: 'King', card: true, color: '#e0e0f0' },
      { id: 'queen',   emoji: 'Q', name: 'Queen', card: true, color: '#e0e0f0' },
      { id: 'jack',    emoji: 'J', name: 'Jack', card: true, color: '#e0e0f0' },
    ]
  ),

  'fortune-mouse': buildTheme(
    { id: 'fortune-mouse', title: 'Fortune Mouse', accent: '#FF69B4', bg: 'linear-gradient(135deg, #FF69B4 0%, #FF1493 50%, #C71585 100%)' },
    [
      { id: 'scatter', emoji: '🧀', name: 'Golden Cheese', type: 'scatter', color: '#ffd700' },
      { id: 'wild',    emoji: '🐭', name: 'Mouse Wild', type: 'wild', color: '#ff9999', multiplier: 2 },
      { id: 'seven',   emoji: '🐀', name: 'Rat King', color: '#4a4a4a' },
      { id: 'bar',     emoji: '🍚', name: 'Rice Bowl', color: '#fffacd' },
      { id: 'ace',     emoji: 'A', name: 'Ace', card: true, color: '#e0e0f0' },
      { id: 'king',    emoji: 'K', name: 'King', card: true, color: '#e0e0f0' },
      { id: 'queen',   emoji: 'Q', name: 'Queen', card: true, color: '#e0e0f0' },
      { id: 'jack',    emoji: 'J', name: 'Jack', card: true, color: '#e0e0f0' },
    ]
  ),

  'gates-of-olympus': buildTheme(
    { id: 'gates-of-olympus', title: 'Gates of Olympus', accent: '#7B2FBE', bg: 'linear-gradient(135deg, #4B0082 0%, #8B008B 50%, #FFD700 100%)' },
    [
      { id: 'scatter', emoji: '🏛️', name: 'Temple', type: 'scatter', color: '#4169e1' },
      { id: 'wild',    emoji: '⚔️', name: 'Zeus Lightning', type: 'wild', color: '#ff0000', multiplier: 2 },
      { id: 'seven',   emoji: '👑', name: 'Crown', color: '#ffd700' },
      { id: 'bar',     emoji: '🦅', name: 'Eagle', color: '#8b4513' },
      { id: 'ace',     emoji: 'A', name: 'Ace', card: true, color: '#e0e0f0' },
      { id: 'king',    emoji: 'K', name: 'King', card: true, color: '#e0e0f0' },
      { id: 'queen',   emoji: 'Q', name: 'Queen', card: true, color: '#e0e0f0' },
      { id: 'jack',    emoji: 'J', name: 'Jack', card: true, color: '#e0e0f0' },
    ]
  ),

  'starlight-princess': buildTheme(
    { id: 'starlight-princess', title: 'Starlight Princess', accent: '#FF69B4', bg: 'linear-gradient(135deg, #FF69B4 0%, #FFB6C1 50%, #FFD700 100%)' },
    [
      { id: 'scatter', emoji: '⭐', name: 'Star', type: 'scatter', color: '#ffd700' },
      { id: 'wild',    emoji: '👸', name: 'Princess Wild', type: 'wild', color: '#ff69b4', multiplier: 2 },
      { id: 'seven',   emoji: '👑', name: 'Crown', color: '#ff1493' },
      { id: 'bar',     emoji: '💫', name: 'Sparkle', color: '#da70d6' },
      { id: 'ace',     emoji: 'A', name: 'Ace', card: true, color: '#e0e0f0' },
      { id: 'king',    emoji: 'K', name: 'King', card: true, color: '#e0e0f0' },
      { id: 'queen',   emoji: 'Q', name: 'Queen', card: true, color: '#e0e0f0' },
      { id: 'jack',    emoji: 'J', name: 'Jack', card: true, color: '#e0e0f0' },
    ]
  ),

  'sweet-bonanza': buildTheme(
    { id: 'sweet-bonanza', title: 'Sweet Bonanza', accent: '#FF69B4', bg: 'linear-gradient(135deg, #FF69B4 0%, #FFB6C1 50%, #FFD700 100%)' },
    [
      { id: 'scatter', emoji: '🍬', name: 'Candy Scatter', type: 'scatter', color: '#ff1493' },
      { id: 'wild',    emoji: '🍭', name: 'Lollipop Wild', type: 'wild', color: '#ff69b4', multiplier: 2 },
      { id: 'seven',   emoji: '🎂', name: 'Cake', color: '#ffdab9' },
      { id: 'bar',     emoji: '🍩', name: 'Donut', color: '#d2691e' },
      { id: 'ace',     emoji: 'A', name: 'Ace', card: true, color: '#e0e0f0' },
      { id: 'king',    emoji: 'K', name: 'King', card: true, color: '#e0e0f0' },
      { id: 'queen',   emoji: 'Q', name: 'Queen', card: true, color: '#e0e0f0' },
      { id: 'jack',    emoji: 'J', name: 'Jack', card: true, color: '#e0e0f0' },
    ]
  ),

  'wild-bandito': buildTheme(
    { id: 'wild-bandito', title: 'Wild Bandito', accent: '#D2691E', bg: 'linear-gradient(135deg, #8B4513 0%, #D2691E 50%, #FFD700 100%)' },
    [
      { id: 'scatter', emoji: '💰', name: 'Money Bag', type: 'scatter', color: '#ffd700' },
      { id: 'wild',    emoji: '🤠', name: 'Bandito Wild', type: 'wild', color: '#ffa500', multiplier: 2 },
      { id: 'seven',   emoji: '🌵', name: 'Cactus', color: '#228b22' },
      { id: 'bar',     emoji: '🪣', name: 'Gold Pan', color: '#daa520' },
      { id: 'ace',     emoji: 'A', name: 'Ace', card: true, color: '#e0e0f0' },
      { id: 'king',    emoji: 'K', name: 'King', card: true, color: '#e0e0f0' },
      { id: 'queen',   emoji: 'Q', name: 'Queen', card: true, color: '#e0e0f0' },
      { id: 'jack',    emoji: 'J', name: 'Jack', card: true, color: '#e0e0f0' },
    ]
  ),

  'mahjong-ways': buildTheme(
    { id: 'mahjong-ways', title: 'Mahjong Ways', accent: '#DC143C', bg: 'linear-gradient(135deg, #DC143C 0%, #B22222 50%, #FFD700 100%)' },
    [
      { id: 'scatter', emoji: '🎴', name: 'Mahjong Tile', type: 'scatter', color: '#00ff00' },
      { id: 'wild',    emoji: '🀄', name: 'Red Dragon', type: 'wild', color: '#ff0000', multiplier: 2 },
      { id: 'seven',   emoji: '🀇', name: 'Character One', color: '#0000ff' },
      { id: 'bar',     emoji: '🀙', name: 'Bamboo One', color: '#008000' },
      { id: 'ace',     emoji: 'A', name: 'Ace', card: true, color: '#e0e0f0' },
      { id: 'king',    emoji: 'K', name: 'King', card: true, color: '#e0e0f0' },
      { id: 'queen',   emoji: 'Q', name: 'Queen', card: true, color: '#e0e0f0' },
      { id: 'jack',    emoji: 'J', name: 'Jack', card: true, color: '#e0e0f0' },
    ]
  ),

  'mahjong-ways-2': buildTheme(
    { id: 'mahjong-ways-2', title: 'Mahjong Ways 2', accent: '#DC143C', bg: 'linear-gradient(135deg, #DC143C 0%, #B22222 50%, #FFD700 100%)' },
    [
      { id: 'scatter', emoji: '🎴', name: 'Golden Tile', type: 'scatter', color: '#ffd700' },
      { id: 'wild',    emoji: '🀄', name: 'Red Dragon', type: 'wild', color: '#ff0000', multiplier: 2 },
      { id: 'seven',   emoji: '🀇', name: 'Character Wan', color: '#0000ff' },
      { id: 'bar',     emoji: '🀙', name: 'Bamboo Suo', color: '#228b22' },
      { id: 'ace',     emoji: 'A', name: 'Ace', card: true, color: '#e0e0f0' },
      { id: 'king',    emoji: 'K', name: 'King', card: true, color: '#e0e0f0' },
      { id: 'queen',   emoji: 'Q', name: 'Queen', card: true, color: '#e0e0f0' },
      { id: 'jack',    emoji: 'J', name: 'Jack', card: true, color: '#e0e0f0' },
    ]
  ),

  'dragon-legend': buildTheme(
    { id: 'dragon-legend', title: 'Dragon Legend', accent: '#FF4500', bg: 'linear-gradient(135deg, #FF4500 0%, #FF6347 50%, #FFD700 100%)' },
    [
      { id: 'scatter', emoji: '🥚', name: 'Dragon Egg', type: 'scatter', color: '#ffd700' },
      { id: 'wild',    emoji: '🐉', name: 'Dragon Wild', type: 'wild', color: '#ff4500', multiplier: 2 },
      { id: 'seven',   emoji: '🐲', name: 'Fire Dragon', color: '#ff0000' },
      { id: 'bar',     emoji: '🔥', name: 'Flame', color: '#ff6347' },
      { id: 'ace',     emoji: 'A', name: 'Ace', card: true, color: '#e0e0f0' },
      { id: 'king',    emoji: 'K', name: 'King', card: true, color: '#e0e0f0' },
      { id: 'queen',   emoji: 'Q', name: 'Queen', card: true, color: '#e0e0f0' },
      { id: 'jack',    emoji: 'J', name: 'Jack', card: true, color: '#e0e0f0' },
    ]
  ),

  'lucky-neko': buildTheme(
    { id: 'lucky-neko', title: 'Lucky Neko', accent: '#FF69B4', bg: 'linear-gradient(135deg, #FF69B4 0%, #FFB6C1 50%, #FFD700 100%)' },
    [
      { id: 'scatter', emoji: '🐟', name: 'Fish', type: 'scatter', color: '#ffa500' },
      { id: 'wild',    emoji: '🐱', name: 'Lucky Cat Wild', type: 'wild', color: '#ff69b4', multiplier: 2 },
      { id: 'seven',   emoji: '😺', name: 'Golden Neko', color: '#ffd700' },
      { id: 'bar',     emoji: '🎁', name: 'Gift Box', color: '#ff0000' },
      { id: 'ace',     emoji: 'A', name: 'Ace', card: true, color: '#e0e0f0' },
      { id: 'king',    emoji: 'K', name: 'King', card: true, color: '#e0e0f0' },
      { id: 'queen',   emoji: 'Q', name: 'Queen', card: true, color: '#e0e0f0' },
      { id: 'jack',    emoji: 'J', name: 'Jack', card: true, color: '#e0e0f0' },
    ]
  ),

  'bali-vacation': buildTheme(
    { id: 'bali-vacation', title: 'Bali Vacation', accent: '#00CED1', bg: 'linear-gradient(135deg, #00CED1 0%, #40E0D0 50%, #FFD700 100%)' },
    [
      { id: 'scatter', emoji: '🌺', name: 'Hibiscus', type: 'scatter', color: '#ff1493' },
      { id: 'wild',    emoji: '🏝️', name: 'Island Wild', type: 'wild', color: '#00ced1', multiplier: 2 },
      { id: 'seven',   emoji: '🌴', name: 'Palm Tree', color: '#228b22' },
      { id: 'bar',     emoji: '🏄', name: 'Surfboard', color: '#1e90ff' },
      { id: 'ace',     emoji: 'A', name: 'Ace', card: true, color: '#e0e0f0' },
      { id: 'king',    emoji: 'K', name: 'King', card: true, color: '#e0e0f0' },
      { id: 'queen',   emoji: 'Q', name: 'Queen', card: true, color: '#e0e0f0' },
      { id: 'jack',    emoji: 'J', name: 'Jack', card: true, color: '#e0e0f0' },
    ]
  ),

  'caishen-wins': buildTheme(
    { id: 'caishen-wins', title: 'Caishen Wins', accent: '#FF0000', bg: 'linear-gradient(135deg, #FF0000 0%, #DC143C 50%, #FFD700 100%)' },
    [
      { id: 'scatter', emoji: '💰', name: 'Gold Ingot', type: 'scatter', color: '#ffd700' },
      { id: 'wild',    emoji: '🧧', name: 'Caishen Wild', type: 'wild', color: '#ff0000', multiplier: 2 },
      { id: 'seven',   emoji: '🏮', name: 'Lantern', color: '#ff4500' },
      { id: 'bar',     emoji: '💎', name: 'Jade', color: '#00ced1' },
      { id: 'ace',     emoji: 'A', name: 'Ace', card: true, color: '#e0e0f0' },
      { id: 'king',    emoji: 'K', name: 'King', card: true, color: '#e0e0f0' },
      { id: 'queen',   emoji: 'Q', name: 'Queen', card: true, color: '#e0e0f0' },
      { id: 'jack',    emoji: 'J', name: 'Jack', card: true, color: '#e0e0f0' },
    ]
  ),

  'double-fortune': buildTheme(
    { id: 'double-fortune', title: 'Double Fortune', accent: '#FF1493', bg: 'linear-gradient(135deg, #FF1493 0%, #C71585 50%, #FFD700 100%)' },
    [
      { id: 'scatter', emoji: '💎', name: 'Jewel', type: 'scatter', color: '#ff1493' },
      { id: 'wild',    emoji: '🎎', name: 'Double Wild', type: 'wild', color: '#ff69b4', multiplier: 2 },
      { id: 'seven',   emoji: '❤️', name: 'Heart', color: '#dc143c' },
      { id: 'bar',     emoji: '🪭', name: 'Double Fan', color: '#ff4500' },
      { id: 'ace',     emoji: 'A', name: 'Ace', card: true, color: '#e0e0f0' },
      { id: 'king',    emoji: 'K', name: 'King', card: true, color: '#e0e0f0' },
      { id: 'queen',   emoji: 'Q', name: 'Queen', card: true, color: '#e0e0f0' },
      { id: 'jack',    emoji: 'J', name: 'Jack', card: true, color: '#e0e0f0' },
    ]
  ),

  'gem-saviour': buildTheme(
    { id: 'gem-saviour', title: 'Gem Saviour', accent: '#9370DB', bg: 'linear-gradient(135deg, #9370DB 0%, #8A2BE2 50%, #FFD700 100%)' },
    [
      { id: 'scatter', emoji: '💎', name: 'Emerald', type: 'scatter', color: '#00ff7f' },
      { id: 'wild',    emoji: '⚔️', name: 'Sword Wild', type: 'wild', color: '#4169e1', multiplier: 2 },
      { id: 'seven',   emoji: '🔮', name: 'Crystal', color: '#9400d3' },
      { id: 'bar',     emoji: '🛡️', name: 'Shield', color: '#c0c0c0' },
      { id: 'ace',     emoji: 'A', name: 'Ace', card: true, color: '#e0e0f0' },
      { id: 'king',    emoji: 'K', name: 'King', card: true, color: '#e0e0f0' },
      { id: 'queen',   emoji: 'Q', name: 'Queen', card: true, color: '#e0e0f0' },
      { id: 'jack',    emoji: 'J', name: 'Jack', card: true, color: '#e0e0f0' },
    ]
  ),

  'dragon-fortune': buildTheme(
    { id: 'dragon-fortune', title: 'Dragon Fortune', accent: '#FF4500', bg: 'linear-gradient(135deg, #FF4500 0%, #FF6347 50%, #FFD700 100%)' },
    [
      { id: 'scatter', emoji: '🥚', name: 'Dragon Egg', type: 'scatter', color: '#ffd700' },
      { id: 'wild',    emoji: '🐉', name: 'Dragon Wild', type: 'wild', color: '#ff0000', multiplier: 2 },
      { id: 'seven',   emoji: '💎', name: 'Blue Orb', color: '#4169e1' },
      { id: 'bar',     emoji: '🔥', name: 'Fire', color: '#ff4500' },
      { id: 'ace',     emoji: 'A', name: 'Ace', card: true, color: '#e0e0f0' },
      { id: 'king',    emoji: 'K', name: 'King', card: true, color: '#e0e0f0' },
      { id: 'queen',   emoji: 'Q', name: 'Queen', card: true, color: '#e0e0f0' },
      { id: 'jack',    emoji: 'J', name: 'Jack', card: true, color: '#e0e0f0' },
    ]
  ),
};

// ─────────────────────────────────────────────────────────────────────────────
// Legacy exports for backwards compatibility
// ─────────────────────────────────────────────────────────────────────────────
export const SLOT_SYMBOL_THEMES = Object.fromEntries(
  Object.entries(SLOT_THEMES).map(([slug, theme]) => [slug, theme.symbols])
);

export const DEFAULT_SLOT_SYMBOLS = {
  wild:    { emoji: '🐉', color: '#ffd700', name: 'Wild', type: 'wild', multiplier: 2 },
  scatter: { emoji: '💎', color: '#00f5d4', name: 'Scatter', type: 'scatter' },
  seven:   { emoji: '7️⃣', color: '#ff2d75', name: 'Seven' },
  bar:     { emoji: '📊', color: '#cd7f32', name: 'Bar' },
  bell:    { emoji: '🔔', color: '#ffd700', name: 'Bell' },
  cherry:  { emoji: '🍒', color: '#ff2d75', name: 'Cherry' },
  lemon:   { emoji: '🍋', color: '#fee440', name: 'Lemon' },
  orange:  { emoji: '🍊', color: '#ff9f1c', name: 'Orange' },
  plum:    { emoji: '🟣', color: '#9b59b6', name: 'Plum' },
  grape:   { emoji: '🍇', color: '#8e44ad', name: 'Grape' },
};

export const SLOT_GAME_THEMES = Object.fromEntries(
  Object.entries(SLOT_THEMES).map(([slug, theme]) => [slug, { bg: theme.bg, accent: theme.accent }])
);

export const SLOT_GAME_SLUGS = Object.keys(SLOT_THEMES);

export function getSymbolsForGame(slug) {
  return SLOT_THEMES[slug]?.symbols || DEFAULT_SLOT_SYMBOLS;
}

export function getThemeForGame(slug) {
  return SLOT_THEMES[slug] || { bg: 'linear-gradient(135deg, #1a1a2e, #16213e)', accent: '#FFD700', symbols: DEFAULT_SLOT_SYMBOLS };
}

export function getTheme(slug) {
  return SLOT_THEMES[slug] || null;
}

export function randomSymbol(theme) {
  const total = theme.order.reduce((s, id) => s + theme.weights[id], 0);
  let r = Math.random() * total;
  for (const id of theme.order) {
    r -= theme.weights[id];
    if (r <= 0) return id;
  }
  return theme.order[theme.order.length - 1];
}

export function makeReelStrip(theme, length = 14) {
  return Array.from({ length }, () => randomSymbol(theme));
}

export function spinReels(theme) {
  const reels = [];
  for (let c = 0; c < 5; c++) {
    reels.push([randomSymbol(theme), randomSymbol(theme), randomSymbol(theme)]);
  }
  return reels;
}

export function evaluateWin(reels, bet, theme) {
  const payouts = theme.payouts;
  const scatterId = theme.scatterId;
  const centerLine = reels.map(col => col[1]);
  let lineWin = 0;
  let winSymbol = null;
  let count = 0;
  const linePositions = [];

  const first = centerLine[0];
  if (first && first !== scatterId) {
    let c = 0;
    for (let i = 0; i < 5; i++) {
      if (centerLine[i] === first) {
        c++;
        linePositions.push([i, 1]);
      } else break;
    }
    if (c >= 3 && payouts[first]?.[c]) {
      lineWin = payouts[first][c] * bet;
      winSymbol = first;
      count = c;
    }
  }

  let scatterCount = 0;
  const scatterPositions = [];
  for (let c = 0; c < 5; c++) {
    for (let r = 0; r < 3; r++) {
      if (reels[c][r] === scatterId) {
        scatterCount++;
        scatterPositions.push([c, r]);
      }
    }
  }

  let scatterWin = 0;
  let freeSpins = 0;
  if (scatterCount >= 3 && payouts[scatterId]) {
    scatterWin = (payouts[scatterId][Math.min(scatterCount, 5)] || 0) * bet;
    freeSpins = 10;
  }

  return {
    lineWin,
    winSymbol,
    count,
    linePositions,
    scatterWin,
    scatterCount,
    scatterPositions,
    freeSpins,
    totalWin: lineWin + scatterWin,
  };
}
