const crypto = require('crypto');

// ─────────────────────────────────────────────────────────────────────────────
// Cryptographically secure RNG
// ─────────────────────────────────────────────────────────────────────────────
class SecureRNG {
  generate(min, max) {
    const range = max - min + 1;
    const bytes = crypto.randomBytes(4);
    const value = bytes.readUInt32BE(0);
    return min + (value % range);
  }

  generateSeed() {
    return crypto.randomBytes(32).toString('hex');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Default payout/weight tables (per symbol tier)
// Index 0 = scatter (highest payout, lowest weight)
// ─────────────────────────────────────────────────────────────────────────────
const PAYOUT_VALUES = [
  { 3: 2,  4: 10, 5: 50 },   // scatter
  { 3: 5,  4: 20, 5: 100 },  // high1 (wild-equivalent)
  { 3: 4,  4: 15, 5: 75 },   // high2
  { 3: 3,  4: 12, 5: 60 },   // mid1
  { 3: 2,  4: 8,  5: 40 },   // ace
  { 3: 2,  4: 7,  5: 35 },   // king
  { 3: 1,  4: 6,  5: 30 },   // queen
  { 3: 1,  4: 5,  5: 25 },   // jack
];
const WEIGHT_VALUES = [2, 4, 5, 6, 8, 8, 9, 10];

// ─────────────────────────────────────────────────────────────────────────────
// Build a complete theme from symbol definitions
// ─────────────────────────────────────────────────────────────────────────────
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

  return {
    ...meta,
    symbols,
    payouts,
    weights,
    order,
    scatterId: scatter?.id || 'scatter',
    wildId: wild?.id || null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Built-in themes (matching frontend gameThemes.js slugs)
// ─────────────────────────────────────────────────────────────────────────────
const THEMES = {
  'fortune-tiger': buildTheme(
    { id: 'fortune-tiger', title: 'Fortune Tiger', accent: '#FF6B35' },
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
    { id: 'fortune-ox', title: 'Fortune Ox', accent: '#C41E3A' },
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
    { id: 'fortune-mouse', title: 'Fortune Mouse', accent: '#FF69B4' },
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
    { id: 'gates-of-olympus', title: 'Gates of Olympus', accent: '#7B2FBE' },
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
    { id: 'starlight-princess', title: 'Starlight Princess', accent: '#FF69B4' },
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
    { id: 'sweet-bonanza', title: 'Sweet Bonanza', accent: '#FF69B4' },
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
    { id: 'wild-bandito', title: 'Wild Bandito', accent: '#D2691E' },
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
    { id: 'mahjong-ways', title: 'Mahjong Ways', accent: '#DC143C' },
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
    { id: 'mahjong-ways-2', title: 'Mahjong Ways 2', accent: '#DC143C' },
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
    { id: 'dragon-legend', title: 'Dragon Legend', accent: '#FF4500' },
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
    { id: 'lucky-neko', title: 'Lucky Neko', accent: '#FF69B4' },
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
    { id: 'bali-vacation', title: 'Bali Vacation', accent: '#00CED1' },
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
    { id: 'caishen-wins', title: 'Caishen Wins', accent: '#FF0000' },
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
    { id: 'double-fortune', title: 'Double Fortune', accent: '#FF1493' },
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
    { id: 'gem-saviour', title: 'Gem Saviour', accent: '#9370DB' },
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
    { id: 'dragon-fortune', title: 'Dragon Fortune', accent: '#FF4500' },
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

// Default theme for unknown games
const DEFAULT_THEME = THEMES['fortune-tiger'];

function getTheme(themeId) {
  return THEMES[themeId] || DEFAULT_THEME;
}

// ─────────────────────────────────────────────────────────────────────────────
// Core engine
// ─────────────────────────────────────────────────────────────────────────────
class GameEngine {
  constructor(config, gameSettings = {}) {
    // config can be a theme object or { symbols, theme } where theme is the themeId
    this.theme = config?.symbols ? getTheme(config.theme || 'fortune-tiger') : getTheme(config || 'fortune-tiger');
    this.rng = new SecureRNG();

    // Admin control settings
    this.settings = {
      winRate: gameSettings.win_rate ?? 25,
      forceOutcome: gameSettings.force_outcome ?? null,
      minPayout: gameSettings.min_payout ?? 0,
      maxPayout: gameSettings.max_payout ?? 30,
      rtpTarget: gameSettings.rtp ?? 92,
      playerClass: gameSettings.player_class || 'normal',
      dryRun: gameSettings.dry_run || false,
      payoutCap: gameSettings.payout_cap ?? 0,
    };
  }

  // Weighted random symbol selection
  randomSymbol() {
    const weights = this.theme.weights;
    const order = this.theme.order;
    const total = order.reduce((sum, id) => sum + weights[id], 0);
    let r = this.rng.generate(1, total);
    for (const id of order) {
      r -= weights[id];
      if (r <= 0) return id;
    }
    return order[order.length - 1];
  }

  // Generate 5x3 reel grid
  spinReels() {
    const reels = [];
    for (let c = 0; c < 5; c++) {
      reels.push([this.randomSymbol(), this.randomSymbol(), this.randomSymbol()]);
    }
    return reels;
  }

  // Generate winning grid (force match on center line with a random mid-tier symbol)
  generateWinningGrid() {
    const reels = this.spinReels();
    // Pick a random symbol from mid-tier range (index 1–4) so wins vary
    const midTier = this.theme.order.slice(1, Math.min(5, this.theme.order.length));
    const winSymbol = midTier[this.rng.generate(0, midTier.length - 1)];
    for (let i = 0; i < 5; i++) reels[i][1] = winSymbol;
    return reels;
  }

  // Generate losing grid — fully random per cell, just ensure no 3+ center-line match
  generateLosingGrid() {
    const order = this.theme.order.filter(id => id !== this.theme.scatterId);
    let attempts = 0;
    while (attempts++ < 20) {
      const reels = [];
      for (let c = 0; c < 5; c++) {
        reels.push([
          order[this.rng.generate(0, order.length - 1)],
          order[this.rng.generate(0, order.length - 1)],
          order[this.rng.generate(0, order.length - 1)],
        ]);
      }
      // Verify center row has no 3+ consecutive match
      const center = reels.map(col => col[1]);
      let maxRun = 1, run = 1;
      for (let i = 1; i < 5; i++) {
        run = center[i] === center[i - 1] ? run + 1 : 1;
        if (run > maxRun) maxRun = run;
      }
      if (maxRun < 3) return reels;
    }
    // Safe fallback: stagger symbols so no 3 match
    return Array.from({ length: 5 }, (_, c) => [
      order[c % order.length],
      order[(c + 2) % order.length],
      order[(c + 1) % order.length],
    ]);
  }

  // Evaluate win: center line + scatter payout
  evaluateWin(reels, bet) {
    const { payouts, scatterId } = this.theme;

    // Center line win
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

    // Scatter count
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

  // Main spin entry point
  spin(betAmount, isFreeSpin = false, sessionStats = { totalBet: 0, totalWin: 0, spins: 0 }) {
    const seed = this.rng.generateSeed();
    let reels;
    let forcedOutcome = null;

    const isForceLoss = this.settings.forceOutcome === 'loss';
    const isForceWin = this.settings.forceOutcome === 'win' || this.settings.forceOutcome === 'big_win';
    const isForceJackpot = this.settings.forceOutcome === 'jackpot';

    // Payout cap check
    if (this.settings.payoutCap > 0 && sessionStats.totalWin >= this.settings.payoutCap) {
      reels = this.generateLosingGrid();
      forcedOutcome = 'loss_cap';
    }
    // Forced outcomes
    else if (isForceWin) {
      reels = this.generateWinningGrid();
      forcedOutcome = this.settings.forceOutcome === 'big_win' ? 'big_win_forced' : 'win_forced';
    }
    else if (isForceLoss) {
      reels = this.generateLosingGrid();
      forcedOutcome = 'loss_forced';
    }
    else if (isForceJackpot) {
      reels = this.spinReels();
      // Fill with wilds on center line
      for (let i = 0; i < 5; i++) reels[i][1] = this.theme.wildId || this.theme.order[1];
      forcedOutcome = 'jackpot_forced';
    }
    // Win rate control
    else {
      const winRoll = this.rng.generate(1, 100);
      if (winRoll <= this.settings.winRate) {
        reels = this.settings.playerClass === 'vip' ? this.generateWinningGrid() : this.spinReels();
      } else {
        reels = this.generateLosingGrid();
      }
    }

    // Evaluate
    const result = this.evaluateWin(reels, betAmount);

    // Zero out wins on forced loss
    if (forcedOutcome === 'loss_forced' || forcedOutcome === 'loss_cap') {
      result.lineWin = 0;
      result.scatterWin = 0;
      result.totalWin = 0;
      result.freeSpins = 0;
    }

    // Apply min/max payout bounds
    if (result.totalWin > 0) {
      const mult = result.totalWin / betAmount;
      if (mult < this.settings.minPayout) result.totalWin = betAmount * this.settings.minPayout;
      if (this.settings.maxPayout > 0 && mult > this.settings.maxPayout) result.totalWin = betAmount * this.settings.maxPayout;
    }

    // Free spin multiplier
    if (isFreeSpin) result.totalWin *= 2;

    // VIP bonus
    if (this.settings.playerClass === 'vip' && result.totalWin > 0) {
      result.totalWin *= 1.1;
    }

    result.totalWin = parseFloat(result.totalWin.toFixed(2));

    // Jackpot contribution
    const jackpotContribution = betAmount * 0.01;

    return {
      seed,
      grid: reels.map(col => col.map(id => ({ id, name: this.theme.symbols[id]?.name || id }))),
      paylineWins: result.lineWin > 0 ? [{ payline: 0, symbol: result.winSymbol, count: result.count, payout: result.lineWin / betAmount }] : [],
      scatters: { count: result.scatterCount, positions: result.scatterPositions },
      totalWin: result.totalWin,
      freeSpinsAwarded: result.freeSpins,
      bonusTriggered: result.freeSpins > 0,
      jackpotContribution,
      isFreeSpin,
      betAmount,
      forcedOutcome,
      playerClass: this.settings.playerClass,
      dryRun: this.settings.dryRun,
    };
  }

  checkJackpot(currentJackpot) {
    const odds = this.settings.playerClass === 'vip' ? 50000 : 100000;
    return this.rng.generate(1, odds) === 1 ? currentJackpot : 0;
  }
}

module.exports = { GameEngine, SecureRNG, THEMES, getTheme, buildTheme, PAYOUT_VALUES, WEIGHT_VALUES };
