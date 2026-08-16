import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { gameAPI, walletAPI } from '../../services/api';
import { SYMBOL_COLORS } from '../../components/slots/SlotSymbols';

// Game-specific themed symbol sets (emoji icons per game)
const GAME_SYMBOL_THEMES = {
  'fortune-tiger': {
    wild: { icon: '🐅', name: 'Tiger Wild', value: 100 },
    scatter: { icon: '🧧', name: 'Lucky Red Envelope', value: 25 },
    seven: { icon: '🐯', name: 'Golden Tiger', value: 75 },
    bar: { icon: '🎪', name: 'Lantern', value: 40 },
    bell: { icon: '🎋', name: 'Bamboo', value: 25 },
    cherry: { icon: '🍊', name: 'Mandarin', value: 18 },
    lemon: { icon: '🏯', name: 'Temple', value: 10 },
    orange: { icon: '🎎', name: 'Daruma', value: 10 },
    plum: { icon: '🪭', name: 'Fan', value: 7 },
    grape: { icon: '🎐', name: 'Wind Chime', value: 7 }
  },
  'fortune-ox': {
    wild: { icon: '🐂', name: 'Ox Wild', value: 100 },
    scatter: { icon: '💰', name: 'Gold Ingot', value: 25 },
    seven: { icon: '🐃', name: 'Water Buffalo', value: 75 },
    bar: { icon: '🌾', name: 'Rice', value: 40 },
    bell: { icon: '🏔️', name: 'Mountain', value: 25 },
    cherry: { icon: '🥬', name: 'Cabbage', value: 18 },
    lemon: { icon: '🧺', name: 'Basket', value: 10 },
    orange: { icon: '🎋', name: 'Bamboo', value: 10 },
    plum: { icon: '🪷', name: 'Lotus', value: 7 },
    grape: { icon: '☔', name: 'Umbrella', value: 7 }
  },
  'fortune-mouse': {
    wild: { icon: '🐭', name: 'Mouse Wild', value: 100 },
    scatter: { icon: '🧀', name: 'Golden Cheese', value: 25 },
    seven: { icon: '🐀', name: 'Rat King', value: 75 },
    bar: { icon: '🍚', name: 'Rice Bowl', value: 40 },
    bell: { icon: '🧧', name: 'Red Packet', value: 25 },
    cherry: { icon: '🥮', name: 'Mooncake', value: 18 },
    lemon: { icon: '🏮', name: 'Lantern', value: 10 },
    orange: { icon: '🧨', name: 'Firecracker', value: 10 },
    plum: { icon: '🎎', name: 'Doll', value: 7 },
    grape: { icon: '🪙', name: 'Coin', value: 7 }
  },
  'gates-of-olympus': {
    wild: { icon: '⚔️', name: 'Zeus Lightning', value: 100 },
    scatter: { icon: '🏛️', name: 'Temple', value: 25 },
    seven: { icon: '👑', name: 'Crown', value: 75 },
    bar: { icon: '🦅', name: 'Eagle', value: 40 },
    bell: { icon: '⚡', name: 'Lightning Bolt', value: 25 },
    cherry: { icon: '🛡️', name: 'Shield', value: 18 },
    lemon: { icon: '🏺', name: 'Amphora', value: 10 },
    orange: { icon: '🌊', name: 'Wave', value: 10 },
    plum: { icon: '🦉', name: 'Owl', value: 7 },
    grape: { icon: '🍇', name: 'Grapes', value: 7 }
  },
  'starlight-princess': {
    wild: { icon: '👸', name: 'Princess Wild', value: 100 },
    scatter: { icon: '⭐', name: 'Star', value: 25 },
    seven: { icon: '👑', name: 'Crown', value: 75 },
    bar: { icon: '💫', name: 'Sparkle', value: 40 },
    bell: { icon: '🌙', name: 'Moon', value: 25 },
    cherry: { icon: '💎', name: 'Diamond', value: 18 },
    lemon: { icon: '🌸', name: 'Cherry Blossom', value: 10 },
    orange: { icon: '🎀', name: 'Ribbon', value: 10 },
    plum: { icon: '💒', name: 'Castle', value: 7 },
    grape: { icon: '🦄', name: 'Unicorn', value: 7 }
  },
  'sweet-bonanza': {
    wild: { icon: '🍭', name: 'Lollipop Wild', value: 100 },
    scatter: { icon: '🍬', name: 'Candy Scatter', value: 25 },
    seven: { icon: '🎂', name: 'Cake', value: 75 },
    bar: { icon: '🍩', name: 'Donut', value: 40 },
    bell: { icon: '🧁', name: 'Cupcake', value: 25 },
    cherry: { icon: '🍪', name: 'Cookie', value: 18 },
    lemon: { icon: '🍦', name: 'Ice Cream', value: 10 },
    orange: { icon: '🍫', name: 'Chocolate', value: 10 },
    plum: { icon: '🧃', name: 'Juice Box', value: 7 },
    grape: { icon: '🍇', name: 'Grape', value: 7 }
  },
  'wild-bandito': {
    wild: { icon: '🤠', name: 'Bandito Wild', value: 100 },
    scatter: { icon: '💰', name: 'Money Bag', value: 25 },
    seven: { icon: '🌵', name: 'Cactus', value: 75 },
    bar: { icon: '🪣', name: 'Gold Pan', value: 40 },
    bell: { icon: '🦎', name: 'Lizard', value: 25 },
    cherry: { icon: '🐎', name: 'Horse', value: 18 },
    lemon: { icon: '🌄', name: 'Sunset', value: 10 },
    orange: { icon: '🎯', name: 'Target', value: 10 },
    plum: { icon: '🪨', name: 'Rock', value: 7 },
    grape: { icon: '🤠', name: 'Cowboy Hat', value: 7 }
  },
  'mahjong-ways': {
    wild: { icon: '🀄', name: 'Red Dragon', value: 100 },
    scatter: { icon: '🎴', name: 'Mahjong Tile', value: 25 },
    seven: { icon: '🀇', name: 'Character One', value: 75 },
    bar: { icon: '🀙', name: 'Bamboo One', value: 40 },
    bell: { icon: '🀡', name: 'Dot One', value: 25 },
    cherry: { icon: '🀐', name: 'Wind Tile', value: 18 },
    lemon: { icon: '🀅', name: 'Dragon Tile', value: 10 },
    orange: { icon: '🀝', name: 'Bamboo Tile', value: 10 },
    plum: { icon: '🀒', name: 'Number Tile', value: 7 },
    grape: { icon: '🏛️', name: 'Mahjong Table', value: 7 }
  },
  'mahjong-ways-2': {
    wild: { icon: '🀄', name: 'Red Dragon', value: 100 },
    scatter: { icon: '🎴', name: 'Golden Tile', value: 25 },
    seven: { icon: '🀇', name: 'Character Wan', value: 75 },
    bar: { icon: '🀙', name: 'Bamboo Suo', value: 40 },
    bell: { icon: '🀡', name: 'Dots Tong', value: 25 },
    cherry: { icon: '🏮', name: 'Lantern', value: 18 },
    lemon: { icon: '🧧', name: 'Red Envelope', value: 10 },
    orange: { icon: '🏯', name: 'Pagoda', value: 10 },
    plum: { icon: '🪭', name: 'Fan', value: 7 },
    grape: { icon: '🌸', name: 'Sakura', value: 7 }
  },
  'dragon-legend': {
    wild: { icon: '🐉', name: 'Dragon Wild', value: 100 },
    scatter: { icon: '🐉', name: 'Dragon Egg', value: 25 },
    seven: { icon: '🐲', name: 'Fire Dragon', value: 75 },
    bar: { icon: '🔥', name: 'Flame', value: 40 },
    bell: { icon: '⚔️', name: 'Sword', value: 25 },
    cherry: { icon: '💎', name: 'Jade Orb', value: 18 },
    lemon: { icon: '🏯', name: 'Temple', value: 10 },
    orange: { icon: '🥋', name: 'Yin Yang', value: 10 },
    plum: { icon: '📿', name: 'Prayer Beads', value: 7 },
    grape: { icon: '🎋', name: 'Bamboo', value: 7 }
  },
  'lucky-neko': {
    wild: { icon: '🐱', name: 'Lucky Cat Wild', value: 100 },
    scatter: { icon: '🐟', name: 'Fish', value: 25 },
    seven: { icon: '😺', name: 'Golden Neko', value: 75 },
    bar: { icon: '🎁', name: 'Gift Box', value: 40 },
    bell: { icon: '🏮', name: 'Lantern', value: 25 },
    cherry: { icon: '🧧', name: 'Red Envelope', value: 18 },
    lemon: { icon: '🌸', name: 'Sakura', value: 10 },
    orange: { icon: '🏯', name: 'Shrine', value: 10 },
    plum: { icon: '🪭', name: 'Fan', value: 7 },
    grape: { icon: '🎐', name: 'Wind Bell', value: 7 }
  },
  'bali-vacation': {
    wild: { icon: '🏝️', name: 'Island Wild', value: 100 },
    scatter: { icon: '🌺', name: 'Hibiscus', value: 25 },
    seven: { icon: '🌴', name: 'Palm Tree', value: 75 },
    bar: { icon: '🏄', name: 'Surfboard', value: 40 },
    bell: { icon: '🐚', name: 'Seashell', value: 25 },
    cherry: { icon: '🍹', name: 'Cocktail', value: 18 },
    lemon: { icon: '🌅', name: 'Sunset', value: 10 },
    orange: { icon: '🥥', name: 'Coconut', value: 10 },
    plum: { icon: '🐢', name: 'Turtle', value: 7 },
    grape: { icon: '🐠', name: 'Tropical Fish', value: 7 }
  },
  'caishen-wins': {
    wild: { icon: '🧧', name: 'Caishen Wild', value: 100 },
    scatter: { icon: '💰', name: 'Gold Ingot', value: 25 },
    seven: { icon: '🏮', name: 'Lantern', value: 75 },
    bar: { icon: '💎', name: 'Jade', value: 40 },
    bell: { icon: '🪙', name: 'Coin', value: 25 },
    cherry: { icon: '📜', name: 'Scroll', value: 18 },
    lemon: { icon: '🏯', name: 'Temple', value: 10 },
    orange: { icon: '🧨', name: 'Firecracker', value: 10 },
    plum: { icon: '🎎', name: 'Statue', value: 7 },
    grape: { icon: '🎋', name: 'Bamboo', value: 7 }
  },
  'double-fortune': {
    wild: { icon: '🎎', name: 'Double Wild', value: 100 },
    scatter: { icon: '💎', name: 'Jewel', value: 25 },
    seven: { icon: '❤️', name: 'Heart', value: 75 },
    bar: { icon: '🪭', name: 'Double Fan', value: 40 },
    bell: { icon: '🧧', name: 'Red Envelope', value: 25 },
    cherry: { icon: '🏮', name: 'Lantern', value: 18 },
    lemon: { icon: '🌸', name: 'Blossom', value: 10 },
    orange: { icon: '🪙', name: 'Coin', value: 10 },
    plum: { icon: '🎐', name: 'Chime', value: 7 },
    grape: { icon: '🏯', name: 'Pagoda', value: 7 }
  },
  'gem-saviour': {
    wild: { icon: '⚔️', name: 'Sword Wild', value: 100 },
    scatter: { icon: '💎', name: 'Emerald', value: 25 },
    seven: { icon: '🔮', name: 'Crystal', value: 75 },
    bar: { icon: '🛡️', name: 'Shield', value: 40 },
    bell: { icon: '💅', name: 'Amethyst', value: 25 },
    cherry: { icon: '💛', name: 'Topaz', value: 18 },
    lemon: { icon: '💙', name: 'Sapphire', value: 10 },
    orange: { icon: '❤️', name: 'Ruby', value: 10 },
    plum: { icon: '💎', name: 'Diamond', value: 7 },
    grape: { icon: '📿', name: 'Necklace', value: 7 }
  },
  'dragon-fortune': {
    wild: { icon: '🐉', name: 'Dragon Wild', value: 100 },
    scatter: { icon: '🥚', name: 'Dragon Egg', value: 25 },
    seven: { icon: '💎', name: 'Blue Orb', value: 75 },
    bar: { icon: '🔥', name: 'Fire', value: 40 },
    bell: { icon: '💧', name: 'Water', value: 25 },
    cherry: { icon: '🌳', name: 'Earth', value: 18 },
    lemon: { icon: '💨', name: 'Wind', value: 10 },
    orange: { icon: '⚡', name: 'Thunder', value: 10 },
    plum: { icon: '❄️', name: 'Ice', value: 7 },
    grape: { icon: '🌀', name: 'Void', value: 7 }
  }
};

// Default symbols for unlisted games
const DEFAULT_SYMBOLS = {
  wild: { icon: '🐉', name: 'Wild', value: 100 },
  scatter: { icon: '💎', name: 'Scatter', value: 25 },
  seven: { icon: '7️⃣', name: 'Seven', value: 75 },
  bar: { icon: '📊', name: 'Bar', value: 40 },
  bell: { icon: '🔔', name: 'Bell', value: 25 },
  cherry: { icon: '🍒', name: 'Cherry', value: 18 },
  lemon: { icon: '🍋', name: 'Lemon', value: 10 },
  orange: { icon: '🍊', name: 'Orange', value: 10 },
  plum: { icon: '🟣', name: 'Plum', value: 7 },
  grape: { icon: '🍇', name: 'Grape', value: 7 }
};

// Game-specific gradient backgrounds (matching game thumbnails)
const GAME_THEMES = {
  'fortune-tiger': { bg: 'linear-gradient(135deg, #FF6B35 0%, #F7931E 50%, #FFD700 100%)', accent: '#FF6B35', icon: '🐅' },
  'fortune-ox': { bg: 'linear-gradient(135deg, #C41E3A 0%, #8B0000 50%, #FFD700 100%)', accent: '#C41E3A', icon: '🐂' },
  'fortune-mouse': { bg: 'linear-gradient(135deg, #FF69B4 0%, #FF1493 50%, #C71585 100%)', accent: '#FF69B4', icon: '🐭' },
  'gates-of-olympus': { bg: 'linear-gradient(135deg, #4B0082 0%, #8B008B 50%, #FFD700 100%)', accent: '#4B0082', icon: '⚔️' },
  'starlight-princess': { bg: 'linear-gradient(135deg, #FF69B4 0%, #FFB6C1 50%, #FFD700 100%)', accent: '#FF69B4', icon: '👸' },
  'sweet-bonanza': { bg: 'linear-gradient(135deg, #FF69B4 0%, #FFB6C1 50%, #FFD700 100%)', accent: '#FF69B4', icon: '🍭' },
  'wild-bandito': { bg: 'linear-gradient(135deg, #8B4513 0%, #D2691E 50%, #FFD700 100%)', accent: '#8B4513', icon: '🤠' },
  'mahjong-ways': { bg: 'linear-gradient(135deg, #DC143C 0%, #B22222 50%, #FFD700 100%)', accent: '#DC143C', icon: '🀄' },
  'mahjong-ways-2': { bg: 'linear-gradient(135deg, #DC143C 0%, #B22222 50%, #FFD700 100%)', accent: '#DC143C', icon: '🀄' },
  'dragon-legend': { bg: 'linear-gradient(135deg, #FF4500 0%, #FF6347 50%, #FFD700 100%)', accent: '#FF4500', icon: '🐉' },
  'lucky-neko': { bg: 'linear-gradient(135deg, #FF69B4 0%, #FFB6C1 50%, #FFD700 100%)', accent: '#FF69B4', icon: '🐱' },
  'bali-vacation': { bg: 'linear-gradient(135deg, #00CED1 0%, #40E0D0 50%, #FFD700 100%)', accent: '#00CED1', icon: '🏝️' },
  'caishen-wins': { bg: 'linear-gradient(135deg, #FF0000 0%, #DC143C 50%, #FFD700 100%)', accent: '#FF0000', icon: '🧧' },
  'double-fortune': { bg: 'linear-gradient(135deg, #FF1493 0%, #C71585 50%, #FFD700 100%)', accent: '#FF1493', icon: '🎎' },
  'gem-saviour': { bg: 'linear-gradient(135deg, #9370DB 0%, #8A2BE2 50%, #FFD700 100%)', accent: '#9370DB', icon: '⚔️' },
  'dragon-fortune': { bg: 'linear-gradient(135deg, #FF4500 0%, #FF6347 50%, #FFD700 100%)', accent: '#FF4500', icon: '🐉' },
  'default': { bg: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)', accent: '#FFD700', icon: '🐉' }
};

// Get themed symbol for a symbol ID
const getThemedSymbol = (slug, symbolId) => {
  const theme = GAME_SYMBOL_THEMES[slug];
  if (theme && theme[symbolId]) return theme[symbolId];
  return DEFAULT_SYMBOLS[symbolId] || { icon: '❓', name: symbolId, value: 5 };
};

// Audio context for sound effects
const createAudioContext = () => {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  return new AudioContext();
};

let audioContext = null;

const playSpinSound = () => {
  if (!audioContext) audioContext = createAudioContext();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(800, audioContext.currentTime + 0.1);
  oscillator.frequency.exponentialRampToValueAtTime(200, audioContext.currentTime + 0.2);
  gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.2);
};

const playReelStopSound = () => {
  if (!audioContext) audioContext = createAudioContext();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  oscillator.type = 'triangle';
  oscillator.frequency.setValueAtTime(550, audioContext.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(220, audioContext.currentTime + 0.1);
  gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.1);
};

const playWinSound = () => {
  if (!audioContext) audioContext = createAudioContext();
  const notes = [523.25, 659.25, 783.99, 1046.50];
  notes.forEach((freq, i) => {
    setTimeout(() => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(freq, audioContext.currentTime);
      gainNode.gain.setValueAtTime(0.25, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    }, i * 100);
  });
};

const playJackpotSound = () => {
  if (!audioContext) audioContext = createAudioContext();
  for (let i = 0; i < 8; i++) {
    setTimeout(() => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(400 + (i * 100), audioContext.currentTime);
      gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.15);
    }, i * 80);
  }
};

export default function GamePlay() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState(null);
  const [grid, setGrid] = useState(null);
  const [displayGrid, setDisplayGrid] = useState(null);
  const [bet, setBet] = useState(10);
  const [balance, setBalance] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [spinProgress, setSpinProgress] = useState({});
  const [lastWin, setLastWin] = useState(0);
  const [freeSpins, setFreeSpins] = useState(0);
  const [message, setMessage] = useState('');
  const [winningSymbols, setWinningSymbols] = useState([]);
  const [jackpotWon, setJackpotWon] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [bigWin, setBigWin] = useState(false);
  const [gameType, setGameType] = useState('slots');
  const [showPaytable, setShowPaytable] = useState(false);
  const [spinBtnPressed, setSpinBtnPressed] = useState(false);
  const [displayWin, setDisplayWin] = useState(0);

  const spinningSymbols = useRef(null);

  const getGameTheme = useCallback(() => {
    if (!slug) return GAME_THEMES['default'];
    const gameSlug = slug.toLowerCase();
    for (const [key, theme] of Object.entries(GAME_THEMES)) {
      if (gameSlug.includes(key)) return theme;
    }
    return GAME_THEMES['default'];
  }, [slug]);

  const gameTheme = getGameTheme();
  const currentSymbols = GAME_SYMBOL_THEMES[slug] || DEFAULT_SYMBOLS;

  useEffect(() => {
    walletAPI.balance().then(({ data }) => setBalance(Number(data.balance) || 0)).catch(() => {});
    gameAPI.details(slug).then(({ data }) => {
      setGame(data);
      setGameType(data.type || 'slots');
      setBet(Number(data.min_bet));
      setDisplayGrid(Array(5).fill(null).map(() =>
        Array(3).fill(null).map(() => ({ id: 'cherry', name: 'Cherry' }))
      ));
    }).catch(() => navigate('/'));
  }, [slug, navigate]);

  // Reel strip animation is handled by <AnimatedReel /> — no random flicker interval needed.

  const triggerConfetti = () => {
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 4000);
  };

  const quickBets = [10, 50, 100, 500, 1000];

  const animateReels = async (finalGrid) => {
    // Final symbols known before animation so each reel lands correctly
    setGrid(finalGrid);
    setDisplayGrid(finalGrid);
    playSpinSound();
    setSpinProgress({ 0: true, 1: true, 2: true, 3: true, 4: true });

    const BASE = 400;       // first reel keeps spinning this long
    const STAGGER = 300;    // each next reel spins a bit longer
    const STOP_ANIM = 800;  // bounce settle time per reel

    for (let i = 0; i < 5; i++) {
      await new Promise(r => setTimeout(r, i === 0 ? BASE : STAGGER));
      playReelStopSound();
      setSpinProgress(prev => ({ ...prev, [i]: false })); // triggers bounce stop
    }
    await new Promise(r => setTimeout(r, STOP_ANIM));
  };

  // Sequential stop delays (cumulative ms after API returns)
  // Wider gaps = more dramatic CLACK-CLACK-CLACK feel
  const STOP_DELAYS = [0, 200, 420, 680, 980];

  const animateWinCounter = (target) => {
    setDisplayWin(0);
    const steps = 30;
    const step = target / steps;
    let current = 0;
    let count = 0;
    const t = setInterval(() => {
      count++;
      current = count >= steps ? target : Math.round(step * count);
      setDisplayWin(current);
      if (count >= steps) clearInterval(t);
    }, 40);
  };

  const spin = async () => {
    if (spinning) return;
    // Button press feedback
    setSpinBtnPressed(true);
    setTimeout(() => setSpinBtnPressed(false), 150);

    setSpinning(true);
    setLastWin(0);
    setDisplayWin(0);
    setMessage('');
    setWinningSymbols([]);
    setJackpotWon(false);
    setBigWin(false);
    // Start all reels spinning immediately
    setSpinProgress({ 0: true, 1: true, 2: true, 3: true, 4: true });
    playSpinSound();

    try {
      const { data } = await gameAPI.spin(game.id, bet);
      // Stop reels sequentially with staggered delays
      for (let i = 0; i < 5; i++) {
        await new Promise(r => setTimeout(r, i === 0 ? STOP_DELAYS[0] : STOP_DELAYS[i] - STOP_DELAYS[i-1]));
        playReelStopSound();
        setSpinProgress(prev => ({ ...prev, [i]: false }));
        setDisplayGrid(prev => {
          const next = prev ? [...prev] : [];
          next[i] = data.grid[i];
          return next;
        });
      }
      await new Promise(r => setTimeout(r, 350));
      setDisplayGrid(data.grid);
      setBalance(data.balance);
      setLastWin(data.totalWin);

      if (data.totalWin > 0) {
        playWinSound();
        animateWinCounter(data.totalWin);
        if (data.totalWin >= bet * 25) {
          setBigWin(true);
          triggerConfetti();
          setMessage(`BIG WIN! ₱${data.totalWin.toLocaleString()}`);
        } else if (data.totalWin >= bet * 10) {
          setBigWin(true);
          setMessage(`NICE WIN! ₱${data.totalWin.toLocaleString()}`);
        } else {
          setMessage(`You won ₱${data.totalWin.toLocaleString()}`);
        }
        if (data.paylineWins && data.paylineWins.length > 0 && data.grid) {
          const PAYLINES = [
            [1,1,1,1,1],[0,0,0,0,0],[2,2,2,2,2],[0,1,2,1,0],[2,1,0,1,2],
            [0,0,1,2,2],[2,2,1,0,0],[1,0,0,0,1],[1,2,2,2,1],[0,1,1,1,0],
            [2,1,1,1,2],[1,0,1,0,1],[1,2,1,2,1],[0,1,0,1,0],[2,1,2,1,2],
            [1,1,0,1,1],[1,1,2,1,1],[0,0,1,0,0],[2,2,1,2,2],[0,2,0,2,0]
          ];
          const winPositions = new Set();
          data.paylineWins.forEach(w => {
            const payline = PAYLINES[w.payline];
            if (payline) {
              for (let col = 0; col < w.count; col++) {
                winPositions.add(`${col}-${payline[col]}`);
              }
            }
          });
          setWinningSymbols([...winPositions]);
        } else {
          setWinningSymbols([]);
        }
      }
      if (data.freeSpinsAwarded > 0) {
        setFreeSpins(prev => prev + data.freeSpinsAwarded);
        setMessage(prev => prev + ` +${data.freeSpinsAwarded} Free Spins!`);
      }
      if (data.jackpotWon) {
        setJackpotWon(true);
        playJackpotSound();
        triggerConfetti();
        setMessage(`JACKPOT!!! ₱${data.jackpotWon.toLocaleString()}`);
      }
    } catch (err) {
      setMessage(err.response?.data?.error || 'Spin failed');
    }
    setTimeout(() => setSpinning(false), 300);
  };

  const useFreeSpin = async () => {
    if (spinning) return;
    setSpinning(true);
    setLastWin(0);
    setMessage('');
    setJackpotWon(false);

    try {
      const { data } = await gameAPI.freeSpin(game.id);
      await animateReels(data.grid);
      setGrid(data.grid);
      setDisplayGrid(data.grid);
      setBalance(data.balance);
      setLastWin(data.totalWin);
      setFreeSpins(data.freeSpinsRemaining);
      if (data.totalWin > 0) {
        playWinSound();
        setMessage(`Free spin win: ₱${data.totalWin.toLocaleString()}`);
        if (data.totalWin >= bet * 25) triggerConfetti();
      }
    } catch (err) {
      setMessage(err.response?.data?.error || 'Free spin failed');
      // Do not wipe free spins on network/API error — only clear if server says none left
      if (err.response?.status === 400) {
        setFreeSpins(0);
      }
    }
    setTimeout(() => setSpinning(false), 300);
  };

  if (!game) return <div className="loading"><div className="spinner" /></div>;

  const isSlotGame = gameType === 'slots';

  return (
    <div className="game-page" style={{
      background: 'linear-gradient(180deg, #0D0D1A 0%, #1A1A2E 50%, #0D0D1A 100%)',
      minHeight: '100vh',
      padding: '16px'
    }}>
      {/* Confetti */}
      {showConfetti && <Confetti />}

      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
        padding: '12px 16px',
        background: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '12px',
        border: '1px solid rgba(255, 215, 0, 0.2)'
      }}>
        <button
          onClick={() => navigate('/')}
          style={{
            background: 'linear-gradient(135deg, #FFD700, #B8860B)',
            border: 'none',
            borderRadius: '8px',
            padding: '8px 16px',
            color: '#1A1A2E',
            fontWeight: '700',
            fontSize: '14px',
            cursor: 'pointer'
          }}
        >
          Back
        </button>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase' }}>Balance</div>
          <div style={{ fontSize: '18px', fontWeight: '800', color: '#FFD700' }}>
            ₱{Number(balance).toLocaleString('en', { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Game Header */}
      <div style={{ textAlign: 'center', marginBottom: '16px' }}>
        <h2 style={{
          fontSize: '24px',
          fontWeight: '900',
          background: 'linear-gradient(135deg, #FFD700, #FFA500)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '8px'
        }}>
          {gameTheme.icon} {game.name} {gameTheme.icon}
        </h2>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
          <span style={{
            padding: '4px 12px',
            background: 'rgba(255, 215, 0, 0.1)',
            borderRadius: '20px',
            fontSize: '12px',
            color: '#FFD700',
            border: '1px solid rgba(255, 215, 0, 0.3)'
          }}>
            RTP {game.rtp}%
          </span>
          <span style={{
            padding: '4px 12px',
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '20px',
            fontSize: '12px',
            color: '#FFF'
          }}>
            ₱{game.min_bet} - ₱{game.max_bet}
          </span>
        </div>
      </div>

      {/* Slot Machine Frame */}
      <div style={{
        position: 'relative',
        padding: '6px',
        background: gameTheme.bg,
        borderRadius: '16px',
        marginBottom: '16px',
        boxShadow: `0 0 30px ${gameTheme.accent}40`
      }}>
        <div style={{
          padding: '3px',
          background: '#0D0D1A',
          borderRadius: '13px'
        }}>
          <div style={{
            padding: '16px 8px',
            background: 'linear-gradient(180deg, #0D0D1A 0%, #1A1A2E 50%, #0D0D1A 100%)',
            borderRadius: '10px',
            position: 'relative'
          }}>
            {/* Payline indicator */}
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '8px',
              right: '8px',
              height: '2px',
              background: 'linear-gradient(90deg, transparent, rgba(255, 215, 0, 0.5), transparent)',
              transform: 'translateY(-50%)',
              zIndex: 1
            }} />

            {/* Reels — animated strip scroll with themed emoji symbols */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '10px',
              position: 'relative',
              zIndex: 2,
              padding: '4px 0'
            }}>
              {displayGrid && displayGrid.map((col, ci) => {
                const winningRows = [0, 1, 2].filter(ri =>
                  winningSymbols.includes(`${ci}-${ri}`) && !spinProgress[ci]
                );
                return (
                  <ThemedReel
                    key={ci}
                    finalSymbols={col}
                    spinning={!!spinProgress[ci]}
                    cellSize={58}
                    gap={6}
                    winningRows={winningRows}
                    accent={gameTheme.accent}
                    gameSlug={slug}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Win Display */}
      {lastWin > 0 && (
        <div style={{
          textAlign: 'center',
          marginBottom: '16px',
          animation: 'winPop 0.5s cubic-bezier(0.34,1.56,0.64,1) both'
        }}>
          <div style={{
            fontSize: jackpotWon ? '36px' : bigWin ? '32px' : '28px',
            fontWeight: '900',
            background: jackpotWon
              ? 'linear-gradient(135deg, #FF1493, #FFD700, #00D9FF, #FFD700, #FF1493)'
              : 'linear-gradient(135deg, #FFD700, #FFA500, #FFD700)',
            backgroundSize: jackpotWon ? '300% 300%' : '200% auto',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            animation: jackpotWon ? 'rainbowGlow 0.5s ease infinite' : 'goldShine 2s linear infinite',
            filter: 'drop-shadow(0 0 20px rgba(255, 215, 0, 0.8))'
          }}>
            {jackpotWon ? 'JACKPOT! ' : bigWin ? 'BIG WIN! ' : ''}₱{displayWin > 0 ? displayWin.toLocaleString() : lastWin.toLocaleString()}
          </div>
        </div>
      )}

      {message && (
        <p style={{
          textAlign: 'center',
          color: jackpotWon || bigWin ? '#FFD700' : '#00D9FF',
          fontSize: '14px',
          margin: '8px 0 16px',
          fontWeight: '600'
        }}>
          {message}
        </p>
      )}

      {/* Bet Controls */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        marginBottom: '16px',
        padding: '12px',
        background: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '12px',
        border: '1px solid rgba(255, 215, 0, 0.2)'
      }}>
        <button
          onClick={() => setBet(Math.max(Number(game.min_bet), bet - Number(game.min_bet)))}
          disabled={spinning}
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #FFD700, #B8860B)',
            border: 'none',
            color: '#1A1A2E',
            fontSize: '24px',
            fontWeight: '900',
            cursor: spinning ? 'not-allowed' : 'pointer',
            opacity: spinning ? 0.5 : 1
          }}
        >
          -
        </button>
        <div style={{ textAlign: 'center', minWidth: '100px' }}>
          <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase' }}>Bet</div>
          <div style={{ fontSize: '24px', fontWeight: '900', color: '#FFD700' }}>₱{bet}</div>
        </div>
        <button
          onClick={() => setBet(Math.min(Number(game.max_bet), bet + Number(game.min_bet)))}
          disabled={spinning || bet + Number(game.min_bet) > balance}
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #FFD700, #B8860B)',
            border: 'none',
            color: '#1A1A2E',
            fontSize: '24px',
            fontWeight: '900',
            cursor: (spinning || bet + Number(game.min_bet) > balance) ? 'not-allowed' : 'pointer',
            opacity: (spinning || bet + Number(game.min_bet) > balance) ? 0.5 : 1
          }}
        >
          +
        </button>
      </div>

      {/* Quick Bet Chips */}
      <div style={{
        display: 'flex',
        gap: '8px',
        justifyContent: 'center',
        marginBottom: '16px',
        flexWrap: 'wrap'
      }}>
        {quickBets
          .filter(v => v >= Number(game.min_bet) && v <= Number(game.max_bet))
          .map(v => (
            <button
              key={v}
              onClick={() => setBet(v)}
              disabled={spinning || v > balance}
              style={{
                padding: '8px 16px',
                borderRadius: '20px',
                background: bet === v
                  ? 'linear-gradient(135deg, #FFD700, #B8860B)'
                  : 'rgba(255, 215, 0, 0.1)',
                border: bet === v ? '2px solid #FFF' : '2px solid rgba(255, 215, 0, 0.5)',
                color: bet === v ? '#1A1A2E' : '#FFD700',
                fontSize: '13px',
                fontWeight: '700',
                cursor: (spinning || v > balance) ? 'not-allowed' : 'pointer',
                opacity: spinning ? 0.5 : 1
              }}
            >
              ₱{v}
            </button>
          ))}
      </div>

      {/* Spin Button */}
      <div style={{ textAlign: 'center', marginBottom: '16px' }}>
        <button
          onClick={spin}
          disabled={spinning || balance < bet || balance <= 0}
          style={{
            width: '120px',
            height: '120px',
            borderRadius: '50%',
            background: spinning
              ? 'linear-gradient(145deg, #333, #222)'
              : (balance < bet || balance <= 0)
                ? 'linear-gradient(145deg, #333, #222)'
                : 'linear-gradient(145deg, #FFD700, #FFA500, #FFD700)',
            border: (spinning || balance < bet || balance <= 0) ? '4px solid #444' : '5px solid rgba(255, 255, 255, 0.3)',
            color: (spinning || balance < bet || balance <= 0) ? '#666' : '#1A1A2E',
            fontSize: '18px',
            fontWeight: '900',
            cursor: (spinning || balance < bet || balance <= 0) ? 'not-allowed' : 'pointer',
            boxShadow: spinning
              ? 'none'
              : spinBtnPressed
                ? '0 0 50px rgba(255,215,0,0.9), inset 0 0 30px rgba(255,255,255,0.4)'
                : '0 0 30px rgba(255, 215, 0, 0.6), inset 0 0 20px rgba(255, 255, 255, 0.2)',
            transform: spinBtnPressed ? 'scale(0.92)' : 'scale(1)',
            transition: spinBtnPressed ? 'transform 0.08s ease, box-shadow 0.08s ease' : 'transform 0.15s ease, box-shadow 0.15s ease',
            textTransform: 'uppercase',
            letterSpacing: '2px',
            animation: spinning ? 'spinPulse 0.3s ease infinite' : 'none'
          }}
        >
          {spinning ? '...' : 'SPIN'}
        </button>
      </div>

      {/* Free Spins Button */}
      {freeSpins > 0 && (
        <button
          onClick={useFreeSpin}
          disabled={spinning}
          style={{
            width: '100%',
            padding: '14px',
            background: 'linear-gradient(135deg, #00D9FF, #0099CC)',
            border: 'none',
            borderRadius: '12px',
            color: '#0D0D1A',
            fontSize: '14px',
            fontWeight: '800',
            cursor: spinning ? 'not-allowed' : 'pointer',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            marginBottom: '16px',
            opacity: spinning ? 0.5 : 1
          }}
        >
          Free Spin ({freeSpins} left)
        </button>
      )}

      {/* Paytable Toggle */}
      <button
        onClick={() => setShowPaytable(!showPaytable)}
        style={{
          width: '100%',
          padding: '12px',
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 215, 0, 0.2)',
          borderRadius: '12px',
          color: '#FFD700',
          fontSize: '14px',
          fontWeight: '600',
          cursor: 'pointer'
        }}
      >
        {showPaytable ? '▲ Hide Paytable' : '▼ Show Paytable'}
      </button>

      {/* Paytable - Game-themed symbols */}
      {showPaytable && (
        <div style={{
          marginTop: '12px',
          padding: '16px',
          background: 'rgba(255, 255, 255, 0.03)',
          borderRadius: '12px',
          border: '1px solid rgba(255, 215, 0, 0.1)'
        }}>
          <div style={{ display: 'grid', gap: '10px' }}>
            {Object.entries(currentSymbols).slice(0, 6).map(([key, sym]) => (
              <div key={key} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 12px',
                background: 'rgba(255, 215, 0, 0.05)',
                borderRadius: '10px'
              }}>
                <span style={{ fontSize: '28px', width: '36px', textAlign: 'center' }}>{sym.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#FFF' }}>{sym.name}</div>
                  <div style={{ fontSize: '11px', color: '#888' }}>
                    {key === 'wild' ? 'Substitutes all symbols' : key === 'scatter' ? '3+ = Free Spins' : `${sym.value}x payout`}
                  </div>
                </div>
                <div style={{ padding: '4px 10px', background: 'rgba(255, 215, 0, 0.15)', borderRadius: '8px', color: '#FFD700', fontWeight: '700', fontSize: '12px' }}>
                  up to {sym.value}x
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Low Balance Warning */}
      {balance <= 0 && (
        <div style={{
          marginTop: '16px',
          padding: '12px',
          background: 'rgba(255, 71, 87, 0.1)',
          border: '1px solid #FF4757',
          borderRadius: '12px',
          textAlign: 'center',
          color: '#FF4757',
          fontSize: '13px',
          fontWeight: '600'
        }}>
          No balance! <span onClick={() => navigate('/wallet')} style={{ color: '#FFD700', cursor: 'pointer', textDecoration: 'underline' }}>Deposit</span> to play.
        </div>
      )}

      {/* Styles */}
      <style>{`
        @keyframes reelStripSpin {
          0%   { transform: translateY(0); }
          100% { transform: translateY(-192px); }
        }
        .reel-strip-spin {
          animation: reelStripSpin 0.12s linear infinite;
        }
        @keyframes slotWinPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
        @keyframes themedWinPulse {
          0%, 100% { transform: scale(1.08); box-shadow: 0 0 20px currentColor; }
          50% { transform: scale(1.12); box-shadow: 0 0 30px currentColor; }
        }
        @keyframes symbolSpin {
          0% { transform: translateY(-10px); opacity: 0.3; }
          50% { transform: translateY(0); opacity: 1; }
          100% { transform: translateY(10px); opacity: 0.3; }
        }
        @keyframes winPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
        @keyframes goldShine {
          0% { background-position: 200% center; }
          100% { background-position: -200% center; }
        }
        @keyframes rainbowGlow {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes spinPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        @keyframes winPop {
          0% { transform: scale(0); opacity: 0; }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ThemedReel — real spinning animation via setInterval
function ThemedReel({ finalSymbols, spinning, cellSize = 58, gap = 6, winningRows = [], accent = '#FFD700', gameSlug }) {
  const CELL = cellSize + gap;
  const VIEW_H = cellSize * 3 + gap * 2;
  const wrapRef = useRef(null);
  const stripRef = useRef(null);
  const intervalRef = useRef(null);
  const posRef = useRef(0);
  const speedRef = useRef(0);
  const prevSpinning = useRef(false);
  const [displaySyms, setDisplaySyms] = useState(() =>
    finalSymbols?.slice(0,3).map(s => (s&&s.id)||s||'cherry') ?? randomThemedSymbols(gameSlug)
  );
  const [isMoving, setIsMoving] = useState(false);

  function buildStrip(syms) {
    const el = stripRef.current;
    if (!el) return;
    el.innerHTML = '';
    syms.forEach(id => {
      const themed = getThemedSymbol(gameSlug, id);
      const cell = document.createElement('div');
      cell.style.cssText = `width:${cellSize}px;height:${cellSize}px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:${Math.round(cellSize*0.6)}px;border-radius:12px;background:linear-gradient(145deg,rgba(26,10,46,0.9),rgba(13,5,21,0.9));border:2px solid rgba(255,215,0,0.2);box-shadow:0 2px 8px rgba(0,0,0,0.5);user-select:none;`;
      cell.textContent = themed.icon;
      el.appendChild(cell);
    });
  }

  useEffect(() => {
    const wasSpinning = prevSpinning.current;
    prevSpinning.current = spinning;

    if (spinning && !wasSpinning) {
      // START
      if (intervalRef.current) clearInterval(intervalRef.current);
      posRef.current = 0;
      speedRef.current = 0;
      const syms = Array.from({length:30}, () => randomThemedSymbols(gameSlug)[0]);
      buildStrip(syms);
      setIsMoving(true);
      if (wrapRef.current) {
        wrapRef.current.style.borderColor = accent;
        wrapRef.current.style.boxShadow = `inset 0 0 20px ${accent}55,0 0 12px ${accent}44`;
      }
      // Real slot machine: ~600px/sec = 10px/frame at 60fps
      // CELL=64px → TARGET=0.15*64≈9.6px/frame ≈ 576px/sec
      const TARGET = CELL * 0.15;
      // Accelerate over ~500ms (30 frames)
      const ACCEL = TARGET / 30;
      const STRIP_PX = 30 * CELL;
      intervalRef.current = setInterval(() => {
        if (speedRef.current < TARGET) {
          speedRef.current = Math.min(TARGET, speedRef.current + ACCEL);
        }
        posRef.current += speedRef.current;
        if (posRef.current >= STRIP_PX - VIEW_H) {
          posRef.current = 0;
          buildStrip(Array.from({length:30}, () => randomThemedSymbols(gameSlug)[0]));
        }
        if (stripRef.current) {
          stripRef.current.style.transform = `translateY(-${posRef.current.toFixed(1)}px)`;
          // blur: 0 at start → 1.5px at full speed (subtle, readable)
          stripRef.current.style.filter = `blur(${((speedRef.current/TARGET)*1.5).toFixed(1)}px)`;
        }
      }, 16);
    }

    if (!spinning && wasSpinning) {
      // STOP — ease-out deceleration over ~320ms then snap
      const stopSpeed = speedRef.current || (CELL * 0.15);
      const DECEL_FRAMES = 20; // 20 × 16ms = 320ms coast-to-stop
      let frame = 0;
      clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        frame++;
        // Ease-out curve: fast at first, slow at end
        const t = frame / DECEL_FRAMES;
        const eased = 1 - (t * t); // quadratic ease-out
        const currentSpeed = stopSpeed * eased;
        posRef.current += currentSpeed;
        const STRIP_PX = 30 * CELL;
        if (posRef.current >= STRIP_PX - VIEW_H) posRef.current = 0;
        if (stripRef.current) {
          stripRef.current.style.transform = `translateY(-${posRef.current.toFixed(1)}px)`;
          stripRef.current.style.filter = `blur(${(eased * 1.5).toFixed(1)}px)`;
        }
        if (frame >= DECEL_FRAMES) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
          const finals = finalSymbols?.slice(0,3).map(s=>(s&&s.id)||s||'cherry') ?? randomThemedSymbols(gameSlug);
          setDisplaySyms(finals);
          setIsMoving(false);
          if (wrapRef.current) {
            wrapRef.current.style.borderColor = 'rgba(255,215,0,0.2)';
            wrapRef.current.style.boxShadow = 'inset 0 0 10px rgba(0,0,0,0.6)';
          }
        }
      }, 16);
    }
  }, [spinning]); // eslint-disable-line

  useEffect(() => () => clearInterval(intervalRef.current), []);

  return (
    <div ref={wrapRef} style={{
      width: cellSize + 8,
      height: VIEW_H,
      overflow: 'hidden',
      borderRadius: 14,
      position: 'relative',
      flexShrink: 0,
      background: 'linear-gradient(180deg,rgba(0,0,0,0.6),rgba(15,15,30,0.4),rgba(0,0,0,0.6))',
      border: '1px solid rgba(255,215,0,0.2)',
      boxShadow: 'inset 0 0 10px rgba(0,0,0,0.6)',
      transition: 'border-color 0.15s, box-shadow 0.15s',
    }}>
      <div style={{position:'absolute',top:0,left:0,right:0,height:16,zIndex:3,background:'linear-gradient(180deg,rgba(0,0,0,0.9),transparent)',pointerEvents:'none'}} />
      <div style={{position:'absolute',bottom:0,left:0,right:0,height:16,zIndex:3,background:'linear-gradient(0deg,rgba(0,0,0,0.9),transparent)',pointerEvents:'none'}} />
      {isMoving && (
        <div ref={stripRef} style={{display:'flex',flexDirection:'column',gap,paddingTop:gap/2,willChange:'transform'}} />
      )}
      {!isMoving && (
        <div style={{display:'flex',flexDirection:'column',gap,paddingTop:gap/2}}>
          {displaySyms.map((symId, ri) => {
            const themed = getThemedSymbol(gameSlug, symId);
            const color = SYMBOL_COLORS[symId] || '#FFD700';
            const isWinning = winningRows.includes(ri);
            return (
              <div key={ri} style={{
                width:cellSize,height:cellSize,flexShrink:0,
                display:'flex',alignItems:'center',justifyContent:'center',
                fontSize:Math.round(cellSize*0.6),borderRadius:12,
                background:isWinning?`linear-gradient(145deg,${color}30,${color}15)`:'linear-gradient(145deg,rgba(26,10,46,0.9),rgba(13,5,21,0.9))',
                border:isWinning?`2px solid ${color}`:'2px solid rgba(255,215,0,0.2)',
                boxShadow:isWinning?`0 0 20px ${color},inset 0 0 10px ${color}20`:'0 2px 8px rgba(0,0,0,0.5)',
                animation:isWinning?'themedWinPulse 0.4s ease infinite':'none',
                transform:isWinning?'scale(1.08)':'scale(1)',
                transition:'all 0.3s',
              }}>{themed.icon}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function randomThemedSymbols(gameSlug) {
  const keys = Object.keys(GAME_SYMBOL_THEMES[gameSlug] || DEFAULT_SYMBOLS);
  return [0, 1, 2].map(() => keys[Math.floor(Math.random() * keys.length)]);
}

// Confetti component
function Confetti() {
  const colors = ['#FFD700', '#FF1493', '#00D9FF', '#FFA500', '#FF69B4', '#FFF'];
  const confetti = Array.from({ length: 60 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 2,
    color: colors[Math.floor(Math.random() * colors.length)],
    size: 6 + Math.random() * 10,
    duration: 2 + Math.random() * 2
  }));

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9999 }}>
      {confetti.map(c => (
        <div
          key={c.id}
          style={{
            position: 'absolute',
            left: `${c.left}%`,
            top: '-20px',
            width: c.size,
            height: c.size,
            backgroundColor: c.color,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
            animation: `confetti ${c.duration}s ease-out forwards`,
            animationDelay: `${c.delay}s`
          }}
        />
      ))}
      <style>{`
        @keyframes confetti {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}