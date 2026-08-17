import React, { useEffect, useRef } from 'react';
import { Application, Assets, Container, Graphics, Sprite, Text, TextStyle, Texture, BlurFilter } from 'pixi.js';
import gsap from 'gsap';

const FALLBACK_IDS = ['wild', 'scatter', 'seven', 'bar', 'bell', 'cherry', 'lemon', 'orange', 'plum', 'grape'];
const DEFAULT_COLORS = {
  wild: 0xff5b35, scatter: 0x38d9ff, seven: 0xff3d81, bar: 0xc58b42,
  bell: 0xffd34d, cherry: 0xff4f6f, lemon: 0xffd84a, orange: 0xff9f35, plum: 0xb25cff, grape: 0x8c4cff,
};

// Win tier thresholds (multiplier of bet)
const WIN_TIERS = {
  NORMAL: { min: 1, max: 4.99, label: 'WIN', color: 0xfff3a6, scale: 1, duration: 1.25 },
  BIG: { min: 5, max: 14.99, label: 'BIG WIN', color: 0xffd75a, scale: 1.15, duration: 2.0 },
  MEGA: { min: 15, max: 49.99, label: 'MEGA WIN', color: 0xff7f50, scale: 1.3, duration: 2.8 },
  SUPER: { min: 50, max: Infinity, label: 'SUPER WIN', color: 0xff3d81, scale: 1.5, duration: 3.5 }
};

function classifyWinTier(winAmount, bet) {
  const multiplier = winAmount / Math.max(1, bet);
  if (multiplier >= WIN_TIERS.SUPER.min) return 'SUPER';
  if (multiplier >= WIN_TIERS.MEGA.min) return 'MEGA';
  if (multiplier >= WIN_TIERS.BIG.min) return 'BIG';
  return 'NORMAL';
}

function hexToNumber(value) {
  if (typeof value === 'number') return value;
  const s = String(value || '').replace('#', '');
  const n = parseInt(s, 16);
  return Number.isFinite(n) ? n : 0xffd75a;
}

function symbolColor(themeSymbols, id) {
  return hexToNumber(themeSymbols?.[id]?.color || DEFAULT_COLORS[id] || 0xffd75a);
}

function shade(color, factor = 0.55) {
  const r = Math.max(0, Math.min(255, ((color >> 16) & 255) * factor));
  const g = Math.max(0, Math.min(255, ((color >> 8) & 255) * factor));
  const b = Math.max(0, Math.min(255, (color & 255) * factor));
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}

function lighten(color, factor = 1.25) {
  const r = Math.max(0, Math.min(255, ((color >> 16) & 255) * factor));
  const g = Math.max(0, Math.min(255, ((color >> 8) & 255) * factor));
  const b = Math.max(0, Math.min(255, (color & 255) * factor));
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}

function drawSymbolArt(id, size, color) {
  const g = new Graphics();
  const dark = shade(color, 0.38);
  const light = lighten(color, 1.45);
  const white = 0xfff9df;
  const gold = 0xffd85b;
  const s = size;

  g.circle(0, 0, s * 0.39);
  g.fill({ color: 0x0a0616, alpha: 0.92 });
  g.stroke({ color: gold, alpha: 0.75, width: s * 0.025 });
  g.circle(0, 0, s * 0.33);
  g.fill({ color: dark, alpha: 0.94 });
  g.stroke({ color: light, alpha: 0.42, width: s * 0.012 });

  if (id === 'wild') {
    g.moveTo(-s * 0.12, s * 0.25);
    g.bezierCurveTo(-s * 0.30, s * 0.03, -s * 0.18, -s * 0.08, -s * 0.03, -s * 0.28);
    g.bezierCurveTo(s * 0.02, -s * 0.12, s * 0.18, -s * 0.18, s * 0.24, -s * 0.34);
    g.bezierCurveTo(s * 0.33, -s * 0.08, s * 0.23, s * 0.13, s * 0.08, s * 0.27);
    g.bezierCurveTo(s * 0.02, s * 0.33, -s * 0.06, s * 0.32, -s * 0.12, s * 0.25);
    g.fill({ color: light });
    g.stroke({ color: gold, width: s * 0.012, alpha: 0.8 });
    const t = new Text({ text: 'WILD', style: new TextStyle({ fontFamily: 'Arial Black', fontSize: s * 0.115, fontWeight: '900', fill: white, letterSpacing: 1 }) });
    t.anchor.set(0.5); t.y = s * 0.16; g.addChild(t);
  } else if (id === 'scatter') {
    g.poly([0, -s * 0.26, s * 0.215, 0, 0, s * 0.26, -s * 0.215, 0]);
    g.fill({ color: light });
    g.stroke({ color: white, alpha: 0.6, width: s * 0.015 });
    g.poly([0, -s * 0.16, s * 0.10, 0, 0, s * 0.16, -s * 0.10, 0]);
    g.fill({ color: 0xffffff, alpha: 0.4 });
    const t = new Text({ text: 'SCATTER', style: new TextStyle({ fontFamily: 'Arial Black', fontSize: s * 0.075, fontWeight: '900', fill: white, letterSpacing: 0.8 }) });
    t.anchor.set(0.5); t.y = s * 0.25; g.addChild(t);
  } else if (id === 'seven') {
    const t = new Text({ text: '7', style: new TextStyle({ fontFamily: 'Arial Black', fontSize: s * 0.58, fontWeight: '900', fill: light, stroke: { color: 0x7d1f38, width: s * 0.025 }, dropShadow: { color: 0x000000, alpha: 0.6, blur: 3, distance: 2, angle: Math.PI / 4 } }) });
    t.anchor.set(0.5); t.y = -s * 0.02; g.addChild(t);
    const crown = new Graphics();
    crown.poly([-s * 0.17, s * 0.19, -s * 0.10, s * 0.10, 0, s * 0.19, s * 0.10, s * 0.10, s * 0.17, s * 0.19]);
    crown.fill({ color: gold }); g.addChild(crown);
  } else if (id === 'bar') {
    [-0.18, 0, 0.18].forEach((yy, i) => {
      g.roundRect(-s * 0.23, s * yy - s * 0.045, s * 0.46, s * 0.09, s * 0.025);
      g.fill({ color: i === 1 ? white : light });
      g.stroke({ color: gold, alpha: 0.55, width: s * 0.008 });
    });
    const t = new Text({ text: 'BAR', style: new TextStyle({ fontFamily: 'Arial Black', fontSize: s * 0.10, fontWeight: '900', fill: dark }) });
    t.anchor.set(0.5); g.addChild(t);
  } else if (id === 'bell') {
    g.moveTo(-s * 0.18, s * 0.14);
    g.lineTo(-s * 0.12, -s * 0.13);
    g.quadraticCurveTo(0, -s * 0.30, s * 0.12, -s * 0.13);
    g.lineTo(s * 0.18, s * 0.14);
    g.closePath(); g.fill({ color: light }); g.stroke({ color: gold, width: s * 0.012 });
    g.ellipse(0, s * 0.15, s * 0.22, s * 0.05); g.fill({ color: gold });
    g.circle(0, s * 0.22, s * 0.045); g.fill({ color: gold });
  } else if (id === 'cherry') {
    g.circle(-s * 0.11, s * 0.10, s * 0.12); g.fill({ color: light }); g.stroke({ color: white, alpha: 0.45, width: s * 0.012 });
    g.circle(s * 0.11, s * 0.10, s * 0.12); g.fill({ color: light }); g.stroke({ color: white, alpha: 0.45, width: s * 0.012 });
    g.moveTo(-s * 0.10, 0); g.quadraticCurveTo(0, -s * 0.22, s * 0.10, 0); g.stroke({ color: 0x54b948, width: s * 0.025 });
    g.ellipse(0, -s * 0.22, s * 0.10, s * 0.045); g.fill({ color: 0x68c957 });
  } else if (id === 'lemon' || id === 'orange') {
    g.ellipse(0, s * 0.04, s * 0.19, s * 0.25); g.fill({ color: light }); g.stroke({ color: gold, width: s * 0.012 });
    g.arc(0, s * 0.04, s * 0.12, -2.4, 0.2); g.stroke({ color: 0xffffff, alpha: 0.35, width: s * 0.015 });
  } else if (id === 'plum') {
    g.circle(0, s * 0.05, s * 0.18); g.fill({ color: light });
    g.circle(-s * 0.07, 0, s * 0.045); g.fill({ color: 0xffffff, alpha: 0.28 });
    g.arc(0, s * 0.05, s * 0.12, 0, Math.PI); g.stroke({ color: dark, width: s * 0.018 });
  } else if (id === 'grape') {
    const pts = [[-0.09,-0.12],[0.09,-0.12],[-0.13,0.02],[0,0.02],[0.13,0.02],[-0.08,0.15],[0.08,0.15],[0,0.28]];
    pts.forEach(([x,y]) => { g.circle(x*s, y*s, s*0.075); g.fill({ color: light }); g.stroke({ color: white, alpha: 0.22, width: s*0.008 }); });
  }
  return g;
}

function createSymbol(textureMap, themeSymbols, id, size) {
  const color = symbolColor(themeSymbols, id);
  const box = new Container();
  
  // Glow overlay for win animation (hidden by default)
  const winGlow = new Graphics();
  winGlow.circle(0, 0, size * 0.52);
  winGlow.fill({ color: 0xffd75a, alpha: 0 });
  winGlow.visible = false;
  box.addChild(winGlow);
  
  const aura = new Graphics();
  aura.circle(0, 0, size * 0.44);
  aura.fill({ color, alpha: 0.075 });
  aura.stroke({ color: 0xffd75a, alpha: 0.16, width: Math.max(1, size * 0.008) });
  box.addChild(aura);
  const texture = textureMap?.[id] || Texture.WHITE;
  const art = new Sprite(texture);
  art.anchor.set(0.5);
  const sourceW = texture.width || 256;
  const sourceH = texture.height || 256;
  art.width = size * 0.86;
  art.height = art.width * (sourceH / sourceW);
  art.tint = textureMap?.[id] ? 0xffffff : color;
  box.addChild(art);
  const shine = new Graphics();
  shine.arc(0, 0, size * 0.38, -2.65, -1.15);
  shine.stroke({ color: 0xffffff, alpha: 0.25, width: Math.max(1, size * 0.012) });
  box.addChild(shine);
  return { box, glow: aura, art, color, winGlow };
}

function makeParticles(container, width, height, count = 80) {
  const particles = [];
  const palette = [0xffd75a, 0xfff2b3, 0xffffff, 0x75e7ff, 0xff7f50];
  for (let i = 0; i < count; i++) {
    const p = new Graphics();
    const size = 1.2 + Math.random() * 3.8;
    p.circle(0, 0, size);
    p.fill({ color: palette[i % palette.length], alpha: 0.65 });
    p.x = Math.random() * width;
    p.y = Math.random() * height;
    p.vx = (Math.random() - 0.5) * 0.45;
    p.vy = -0.10 - Math.random() * 0.55;
    p.phase = Math.random() * Math.PI * 2;
    p.baseAlpha = 0.2 + Math.random() * 0.45;
    container.addChild(p);
    particles.push(p);
  }
  return particles;
}

// GSAP-powered reel animation timeline
function createReelTimeline(reel, cell, gap, finalSymbols, textureMap, themeSymbols) {
  const tl = gsap.timeline();
  const rowH = cell + gap;
  const stripLength = 20;
  
  // Build strip with extra symbols for spinning illusion
  reel.strip.removeChildren();
  reel.symbols = [];
  const pool = Object.keys(themeSymbols || {}).length ? Object.keys(themeSymbols) : FALLBACK_IDS;
  const ids = [];
  for (let i = 0; i < stripLength; i++) ids.push(pool[Math.floor(Math.random() * pool.length)]);
  ids.push(...finalSymbols);
  
  ids.forEach((id, i) => {
    const item = createSymbol(textureMap, themeSymbols, id, cell);
    item.box.y = i * rowH;
    item.box.x = 0;
    reel.strip.addChild(item.box);
    reel.symbols.push(item);
  });
  
  const totalHeight = (ids.length - 3) * rowH;
  const targetY = totalHeight;
  
  // Add motion blur filter
  const blurFilter = new BlurFilter();
  blurFilter.blurY = 0;
  reel.strip.filters = [blurFilter];
  
  // Phase 1: Acceleration
  tl.to(reel.strip, {
    y: -totalHeight * 0.3,
    duration: 0.25,
    ease: 'power2.in',
    onUpdate: () => {
      blurFilter.blurY = Math.min(6, Math.abs(reel.velocity || 0) * 0.3);
    }
  });
  
  // Phase 2: Cruise (full speed blur)
  tl.to(blurFilter, {
    blurY: 6,
    duration: 0.1,
    ease: 'none'
  }, '-=0.1');
  
  // Phase 3: Deceleration with overshoot
  tl.to(reel.strip, {
    y: -targetY - rowH * 0.15, // overshoot
    duration: 0.35,
    ease: 'power3.out'
  });
  
  // Phase 4: Bounce back
  tl.to(reel.strip, {
    y: -targetY,
    duration: 0.2,
    ease: 'back.out(1.5)',
    onStart: () => {
      blurFilter.blurY = 0;
    }
  });
  
  // Remove blur
  tl.to(blurFilter, {
    blurY: 0,
    duration: 0.15,
    ease: 'none'
  }, '-=0.2');
  
  // Add slight shake on landing
  tl.to(reel, {
    x: `+=${3}`,
    duration: 0.05,
    yoyo: true,
    repeat: 3,
    ease: 'none'
  }, '-=0.1');
  
  reel.timeline = tl;
  return tl;
}

// GSAP win symbol animation: pulse + glow + brightness
function animateWinSymbol(item, index, isScatter) {
  const tl = gsap.timeline();
  item.winTimeline = tl;
  
  // Show win glow
  item.winGlow.visible = true;
  
  if (isScatter) {
    // Scatter special: rotate + pulse + particle burst effect
    tl.to(item.box, {
      scaleX: 1.25,
      scaleY: 1.25,
      rotation: Math.PI * 0.15,
      duration: 0.35,
      ease: 'back.out(2)'
    });
    tl.to(item.winGlow, {
      alpha: 0.6,
      duration: 0.25,
      ease: 'power2.out'
    }, 0);
    tl.to(item.box, {
      rotation: 0,
      scaleX: 1.15,
      scaleY: 1.15,
      duration: 0.4,
      ease: 'elastic.out(1, 0.5)'
    });
    tl.to(item.winGlow, {
      alpha: 0.35,
      duration: 0.3
    }, '-=0.2');
    // Pulse loop
    tl.to(item.box, {
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 0.5,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1
    });
    tl.to(item.winGlow, {
      alpha: 0.5,
      duration: 0.5,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1
    }, '<');
  } else {
    // Regular win: scale pulse + glow pulse + brightness
    tl.to(item.box, {
      scaleX: 1.15,
      scaleY: 1.15,
      duration: 0.2,
      ease: 'power2.out'
    });
    tl.to(item.winGlow, {
      alpha: 0.45,
      duration: 0.15,
      ease: 'power2.out'
    }, 0);
    // Brighten via glow
    tl.to(item.glow, {
      alpha: 0.4,
      duration: 0.2,
      ease: 'power2.out'
    }, 0);
    // Pulse loop
    tl.to(item.box, {
      scaleX: 1.1,
      scaleY: 1.1,
      duration: 0.35,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1,
      delay: 0.1
    });
    tl.to(item.winGlow, {
      alpha: 0.3,
      duration: 0.35,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1
    }, '<');
  }
  
  return tl;
}

// Trigger win animations on reels after spin stops
function triggerWinAnimations(reels, winningLines, scatterPositions) {
  reels.forEach((r, colIdx) => {
    if (!r.symbols) return;
    const winRows = winningLines ? [...new Set(winningLines.filter(l => Array.isArray(l)).map(l => l[colIdx]).filter(x => x != null))] : [];
    const scatterRows = (scatterPositions || []).filter(s => s.col === colIdx).map(s => s.row);
    
    r.symbols.forEach((item, idx) => {
      const finalRow = idx - (r.symbols.length - 3);
      const isWinning = winRows.includes(finalRow);
      const isScatter = scatterRows.includes(finalRow);
      
      if (isWinning || isScatter) {
        // Kill any existing animation
        item.winTimeline?.kill();
        item.box.alpha = 1;
        animateWinSymbol(item, idx, isScatter);
      }
    });
  });
}

// Dedicated scatter animation sequence with particle burst & screen shake
function animateScatterSequence(scatterPositions, reels, reelsLayer, onFreeSpinTrigger) {
  if (!scatterPositions || scatterPositions.length === 0) return null;
  
  const tl = gsap.timeline();
  const scatterItems = [];
  
  // Collect all scatter symbol containers
  scatterPositions.forEach(({ col, row }) => {
    const reel = reels[col];
    if (!reel?.symbols) return;
    const item = reel.symbols[reel.symbols.length - 3 + row];
    if (item) scatterItems.push({ item, col, row });
  });
  
  if (scatterItems.length === 0) return null;
  
  // Phase 1: Staggered highlight each scatter with glow + scale + rotation
  scatterItems.forEach(({ item }, i) => {
    const delay = i * 0.15;
    
    // Kill any existing win timeline
    item.winTimeline?.kill();
    item.winGlow.visible = true;
    item.winGlow.alpha = 0;
    
    // Scale up with rotation
    tl.to(item.box, {
      scaleX: 1.35,
      scaleY: 1.35,
      rotation: Math.PI * 0.25,
      duration: 0.3,
      delay,
      ease: 'power2.out'
    }, i === 0 ? 0 : `<${delay}`);
    
    // Glow pulse
    tl.to(item.winGlow, {
      alpha: 0.7,
      duration: 0.2,
      delay,
      ease: 'power2.out'
    }, '<');
    
    // Rotation return with elastic
    tl.to(item.box, {
      rotation: 0,
      duration: 0.4,
      ease: 'elastic.out(1, 0.4)'
    });
    
    // Create particle burst for this scatter
    const particles = createScatterParticles(item.box, reelsLayer);
    tl.add(() => {
      animateScatterParticles(particles);
    }, '-=0.2');
  });
  
  // Phase 2: Screen shake if 3+ scatters (free spin trigger)
  if (scatterItems.length >= 3) {
    tl.to(reelsLayer, {
      x: `+=${8}`,
      duration: 0.05,
      ease: 'power2.out',
      yoyo: true,
      repeat: 5
    }, '-=0.2');
    
    tl.to(reelsLayer, {
      y: `+=${4}`,
      duration: 0.04,
      ease: 'power2.out',
      yoyo: true,
      repeat: 3
    }, '<');
  }
  
  // Phase 3: Pulse loop for all scatters until free spin FX takes over
  scatterItems.forEach(({ item }) => {
    tl.to(item.box, {
      scaleX: 1.25,
      scaleY: 1.25,
      duration: 0.4,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1
    }, '-=0.3');
    
    tl.to(item.winGlow, {
      alpha: 0.5,
      duration: 0.4,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1
    }, '<');
  });
  
  // Store timeline for cleanup
  scatterItems.forEach(({ item }) => {
    item.scatterTimeline = tl;
  });
  
  return tl;
}

// Create particle burst around scatter position
function createScatterParticles(symbolBox, reelsLayer) {
  const particles = [];
  const palette = [0x38d9ff, 0x00f5d4, 0xffffff, 0xffd75a, 0xff7f50];
  
  for (let i = 0; i < 16; i++) {
    const p = new Graphics();
    const size = 2 + Math.random() * 4;
    p.circle(0, 0, size);
    p.fill({ color: palette[i % palette.length], alpha: 0.9 });
    p.x = symbolBox.x;
    p.y = symbolBox.y;
    p.visible = false;
    reelsLayer.addChild(p);
    particles.push({
      graphic: p,
      vx: (Math.random() - 0.5) * 10,
      vy: (Math.random() - 0.5) * 10 - 3,
      life: 1
    });
  }
  
  return particles;
}

// Animate scatter particles outward
function animateScatterParticles(particles) {
  particles.forEach(({ graphic, vx, vy }) => {
    graphic.visible = true;
    
    gsap.to(graphic, {
      x: `+=${vx * 25}`,
      y: `+=${vy * 25}`,
      alpha: 0,
      duration: 0.6,
      ease: 'power2.out',
      onComplete: () => {
        graphic.destroy();
      }
    });
  });
}

// Reset all symbol states (before new spin)
function resetSymbolStates(reels) {
  reels.forEach(r => {
    if (!r.symbols) return;
    r.symbols.forEach(item => {
      item.winTimeline?.kill();
      item.winTimeline = null;
      gsap.killTweensOf(item.box);
      gsap.killTweensOf(item.winGlow);
      gsap.killTweensOf(item.glow);
      item.box.alpha = 1;
      item.box.scale.set(1);
      item.box.rotation = 0;
      item.winGlow.visible = false;
      item.winGlow.alpha = 0;
      item.glow.alpha = 0.075;
    });
  });
}

export default function PixiSlotReels({
  reels = [],
  reelStates = [false, false, false, false, false],
  spinning = false,
  winningLines = [],
  themeSymbols = {},
  height = 330,
  onReady,
  onLoadingChange,
  onDebugStats,
  lastWin = 0,
  showBigWin = false,
  freeSpins = 0,
  message = '',
  bet = 10
}) {
  const hostRef = useRef(null);
  const stateRef = useRef({});
  const propsRef = useRef({ reels, reelStates, spinning, winningLines, themeSymbols, bet });
  propsRef.current = { reels, reelStates, spinning, winningLines, themeSymbols, lastWin, showBigWin, freeSpins, message, bet };

  useEffect(() => {
    let destroyed = false;
    const app = new Application();
    const state = { app, width: 0, height, reels: [], particles: [], lastTime: performance.now(), initialized: false, fx: null, lastWin: 0, showBigWin: false, freeSpins: 0, lastMessage: '', currentHeight: height, fps: 0, frameCount: 0, lastFpsTime: performance.now(), assetStatus: {} };
    state.textureMap = {};
    stateRef.current = state;

    const mount = async () => {
      // Report loading start
      if (onLoadingChange) onLoadingChange({ loading: true, progress: 0, stage: 'init' });
      
      await app.init({ resizeTo: hostRef.current, background: 0x090514, antialias: true, resolution: Math.min(window.devicePixelRatio || 1, 2), autoDensity: true });
      if (destroyed) return;
      
      if (onLoadingChange) onLoadingChange({ loading: true, progress: 30, stage: 'canvas' });
      
      hostRef.current.appendChild(app.canvas);
      updateCanvasSize();

      if (onLoadingChange) onLoadingChange({ loading: true, progress: 50, stage: 'assets' });
      
      state.assetStatus = { 'symbols.json': 'loading' };
      try {
        const spriteSheet = await Assets.load('/assets/slots/symbols.json');
        state.textureMap = spriteSheet?.textures || {};
        state.assetStatus['symbols.json'] = 'loaded';
      } catch (assetError) {
        console.warn('Texture atlas failed to load; using procedural art.', assetError);
        state.assetStatus['symbols.json'] = 'error';
      }
      
      if (onLoadingChange) onLoadingChange({ loading: true, progress: 70, stage: 'scene' });

      const root = new Container(); app.stage.addChild(root); state.root = root;
      const ambient = new Container(); root.addChild(ambient); state.particles = makeParticles(ambient, 700, height, 85);
      const frame = new Graphics(); root.addChild(frame); state.frame = frame;
      const innerGlow = new Graphics(); root.addChild(innerGlow); state.innerGlow = innerGlow;
      const reelsLayer = new Container(); root.addChild(reelsLayer); state.reelsLayer = reelsLayer;
      const shade = new Graphics(); root.addChild(shade); state.shade = shade;
      const topSheen = new Graphics(); root.addChild(topSheen); state.topSheen = topSheen;
      const fxLayer = new Container(); root.addChild(fxLayer); state.fxLayer = fxLayer;
      state.fx = createFXLayer(fxLayer, app.screen.width, height);

      // Resize handler
      state.handleResize = () => {
        updateCanvasSize();
        layout(state);
      };
      
      // Orientation change handler with delay for accurate dimensions
      state.handleOrientationChange = () => {
        setTimeout(() => {
          updateCanvasSize();
          layout(state);
        }, 150);
      };
      
      window.addEventListener('resize', state.handleResize);
      window.addEventListener('orientationchange', state.handleOrientationChange);
      layout(state);
      
      if (onLoadingChange) onLoadingChange({ loading: true, progress: 90, stage: 'finalizing' });
      
      app.ticker.add(() => tick(state, onDebugStats));
      state.initialized = true;
      syncReels(state, propsRef.current.reels, propsRef.current.reelStates, propsRef.current.themeSymbols, propsRef.current.winningLines);
      syncFX(state, propsRef.current);
      
      // Report loading complete
      if (onLoadingChange) onLoadingChange({ loading: false, progress: 100, stage: 'ready' });
      if (onReady) onReady();
    };

    // Helper to update canvas size
    const updateCanvasSize = () => {
      if (!app.canvas) return;
      app.canvas.style.width = '100%';
      app.canvas.style.height = `${height}px`;
      app.canvas.style.display = 'block';
      app.canvas.style.borderRadius = '18px';
      app.canvas.style.touchAction = 'manipulation';
      state.currentHeight = height;
    };

    mount();
    return () => {
      destroyed = true;
      
      // Remove event listeners
      window.removeEventListener('resize', state.handleResize);
      window.removeEventListener('orientationchange', state.handleOrientationChange);
      
      // Kill all GSAP tweens on FX layer elements
      if (state.fx) {
        gsap.killTweensOf([state.fx.title, state.fx.amount, state.fx.multiplier]);
        gsap.killTweensOf([state.fx.title?.scale, state.fx.amount?.scale, state.fx.multiplier?.scale]);
        state.fx.coins?.forEach(c => gsap.killTweensOf(c));
        state.fx.confetti?.forEach(c => gsap.killTweensOf(c));
      }
      
      // Kill all reel timelines and symbol animations
      state.reels?.forEach(r => {
        r.timeline?.kill();
        r.symbols?.forEach(item => {
          item.winTimeline?.kill();
          item.scatterTimeline?.kill();
          gsap.killTweensOf(item.box);
          gsap.killTweensOf(item.winGlow);
          gsap.killTweensOf(item.glow);
        });
      });
      
      // Kill scatter timeline
      state.scatterTimeline?.kill();
      
      // Kill delayed calls for scatter/win animations
      state.scatterDelayedCall?.kill();
      state.winDelayedCall?.kill();
      
      // Kill all GSAP tweens globally for safety
      gsap.globalTimeline.clear();
      
      // Clear all children from containers before destroying
      state.reelsLayer?.removeChildren();
      state.root?.removeChildren();
      
      // Destroy PixiJS application with proper options
      app.destroy(true, { 
        children: true, 
        texture: false, 
        textureSource: false,
        context: false
      });
      
      // Clear state reference
      stateRef.current = {};
    };
  }, [height, onReady, onLoadingChange]);

  useEffect(() => {
    const s = stateRef.current;
    if (!s.initialized) return;
    syncReels(s, reels, reelStates, themeSymbols, winningLines);
    syncFX(s, { lastWin, showBigWin, freeSpins, message, spinning });
  }, [reels, reelStates, themeSymbols, winningLines, lastWin, showBigWin, freeSpins, message, spinning]);

  function layout(s) {
    if (!s.app?.canvas) return;
    const width = s.app.screen.width;
    s.width = width;
    const h = height;
    const padding = Math.max(8, Math.min(20, width * 0.025));
    const gap = Math.max(3, width * 0.008);
    const reelWidth = Math.max(48, (width - padding * 2 - gap * 4) / 5);
    const cell = Math.min(reelWidth * 0.82, (h - 28) / 3.15);
    s.cell = cell; s.gap = gap;

    s.frame.clear();
    s.frame.roundRect(padding / 2, 5, width - padding, h - 10, 20);
    s.frame.fill({ color: 0x12081f, alpha: 0.98 });
    s.frame.stroke({ color: 0xffd75a, alpha: 0.72, width: 2.2 });
    s.frame.roundRect(padding / 2 + 4, 9, width - padding - 8, h - 18, 16);
    s.frame.stroke({ color: 0xffffff, alpha: 0.08, width: 1 });

    s.innerGlow.clear();
    s.innerGlow.roundRect(padding + 2, 18, width - padding * 2 - 4, h - 36, 16);
    s.innerGlow.fill({ color: 0x4d1c7d, alpha: 0.11 });

    s.reelsLayer.x = width / 2 - (5 * reelWidth + 4 * gap) / 2 + reelWidth / 2;
    s.reelsLayer.y = h / 2;
    s.reels.forEach((r, i) => {
      r.baseX = i * (reelWidth + gap);
      r.x = r.baseX;
      r.reelWidth = reelWidth; r.cell = cell; r.gap = gap;
      r.viewport.clear();
      r.viewport.roundRect(-reelWidth / 2, -h * 0.46, reelWidth, h * 0.92, 12);
      r.viewport.fill({ color: 0x05030b, alpha: 0.96 });
      r.viewport.stroke({ color: 0xffd75a, alpha: 0.16, width: 1 });
    });

    s.shade.clear();
    s.shade.rect(0, 0, width, 30); s.shade.fill({ color: 0x05030a, alpha: 0.78 });
    s.shade.rect(0, h - 30, width, 30); s.shade.fill({ color: 0x05030a, alpha: 0.78 });
    s.topSheen.clear();
    s.topSheen.roundRect(padding + 10, 13, width - padding * 2 - 20, 3, 2);
    s.topSheen.fill({ color: 0xffefb0, alpha: 0.16 });
  }

  function buildReel(s, index, themeSymbols) {
    const r = new Container();
    const viewport = new Graphics();
    const strip = new Container();
    r.addChild(viewport); r.addChild(strip);
    r.viewport = viewport; r.strip = strip; r.index = index; r.symbols = []; r.textureMap = s.textureMap;
    r.themeSymbols = themeSymbols; r.textureMap = s.textureMap;
    r.timeline = null; r.lastState = false; r.winningRows = [];
    s.reelsLayer.addChild(r);
    return r;
  }

  function syncReels(s, nextReels, nextStates, themeSymbols, winning) {
    while (s.reels.length < 5) s.reels.push(buildReel(s, s.reels.length, themeSymbols));
    
    // Track if any reel is newly starting
    const anyStarting = nextStates?.some((state, i) => state && !s.reels[i]?.lastState);
    
    if (anyStarting) {
      // Reset all symbol states before new spin
      resetSymbolStates(s.reels);
      // Clear scatter timeline reference
      s.scatterTimeline?.kill();
      s.scatterTimeline = null;
    }
    
    // Collect all scatters across all reels
    let allScatters = [];
    let allStopped = true;
    
    s.reels.forEach((r, i) => {
      r.themeSymbols = themeSymbols;
      const isRunning = !!nextStates?.[i];
      if (isRunning) allStopped = false;
      
      const final = (nextReels?.[i] || []).slice(0, 3).map(x => typeof x === 'string' ? x : x?.id || 'cherry');
      
      if (isRunning && !r.lastState) {
        // Start GSAP timeline
        r.timeline?.kill();
        const delay = i * 0.15; // Staggered start
        const tl = createReelTimeline(r, s.cell, s.gap, final, s.textureMap, themeSymbols);
        tl.delay(delay);
      } else if (!isRunning && r.lastState) {
        // Reel stopped - detect scatter positions from final symbols
        final.forEach((id, rowIdx) => {
          if (id === 'scatter') allScatters.push({ col: i, row: rowIdx });
        });
      }
      
      r.lastState = isRunning;
      r.final = final;
      r.winningRows = winningRowsForColumn(winning, i);
    });
    
    // After all reels stop, trigger animations
    if (allStopped && allScatters.length > 0 && !s.scatterTimeline) {
      // Scatter sequence with dedicated animation
      // Store delayed call reference for cleanup
      s.scatterDelayedCall?.kill();
      s.scatterDelayedCall = gsap.delayedCall(0.35, () => {
        s.scatterTimeline = animateScatterSequence(allScatters, s.reels, s.reelsLayer);
        // Also animate regular wins
        triggerWinAnimations(s.reels, winning, allScatters);
      });
    } else if (allStopped && winning?.length > 0) {
      // Just win animations, no scatters
      // Store delayed call reference for cleanup
      s.winDelayedCall?.kill();
      s.winDelayedCall = gsap.delayedCall(0.3, () => {
        triggerWinAnimations(s.reels, winning, []);
      });
    }
    
    layout(s);
  }

  function winningRowsForColumn(lines, column) {
    const rows = [];
    (lines || []).forEach(line => { if (Array.isArray(line) && line[column] != null) rows.push(Number(line[column])); });
    return rows;
  }

  // FX Layer (simplified for this phase)
  function createFXLayer(layer, width, height) {
    const overlay = new Graphics();
    const rays = new Graphics();
    const title = new Text({ text: '', style: new TextStyle({ fontFamily: 'Arial Black', fontSize: 42, fontWeight: '900', fill: 0xfff3a6, stroke: { color: 0x6b1b00, width: 5 }, dropShadow: { color: 0x000000, alpha: 0.8, blur: 8 } }) });
    title.anchor.set(0.5);
    const amount = new Text({ text: '', style: new TextStyle({ fontFamily: 'Arial Black', fontSize: 54, fontWeight: '900', fill: 0xffffff, stroke: { color: 0xb45309, width: 5 }, dropShadow: { color: 0xffb300, alpha: 0.9, blur: 16 } }) });
    amount.anchor.set(0.5);
    const sub = new Text({ text: '', style: new TextStyle({ fontFamily: 'Arial Black', fontSize: 18, fontWeight: '900', fill: 0xfff8dc, letterSpacing: 2 }) });
    sub.anchor.set(0.5);
    const multiplier = new Text({ text: '', style: new TextStyle({ fontFamily: 'Arial Black', fontSize: 26, fontWeight: '900', fill: 0xffffff, stroke: { color: 0x7c2d12, width: 3 } }) });
    multiplier.anchor.set(0.5);
    const burst = new Container();
    const coins = [], confetti = [];
    for (let i = 0; i < 42; i++) {
      const c = new Graphics(); c.circle(0, 0, 2 + Math.random() * 3); c.fill({ color: [0xffd75a, 0xffffff, 0x75e7ff, 0xff7f50][i % 4], alpha: 0.9 });
      c.visible = false; burst.addChild(c); coins.push(c);
    }
    for (let i = 0; i < 28; i++) {
      const c = new Graphics(); c.roundRect(-3, -6, 6, 12, 2); c.fill({ color: [0xffd75a, 0xff6b6b, 0x75e7ff, 0xa78bfa][i % 4], alpha: 0.9 });
      c.visible = false; burst.addChild(c); confetti.push(c);
    }
    layer.addChild(overlay, rays, burst, title, amount, sub, multiplier);
    overlay.visible = rays.visible = title.visible = amount.visible = sub.visible = multiplier.visible = false;
    return { overlay, rays, burst, title, amount, sub, multiplier, coins, confetti, mode: 'idle', start: 0, amountValue: 0, width, height };
  }

  function syncFX(s, props) {
    if (!s.fx) return;
    const amt = Number(props.lastWin) || 0;
    const bet = Number(propsRef.current.bet) || 10;
    
    if (props.showBigWin && !s.showBigWin) {
      startWinFXWithTier(s, amt, bet);
    }
    if (!props.showBigWin && s.showBigWin && s.fx.mode !== 'idle') {
      s.fx.mode = 'fade';
    }
    if (amt > 0 && amt !== s.lastWin && !props.showBigWin) {
      startWinFXWithTier(s, amt, bet);
    }
    s.lastWin = amt;
    s.showBigWin = !!props.showBigWin;
  }

  function startWinFXWithTier(s, amt, bet) {
    const tier = classifyWinTier(amt, bet);
    prepareFXBurst(s.fx, tier, amt, bet);
  }

  function prepareFXBurst(fx, tier, amt, bet) {
    const tierConfig = WIN_TIERS[tier] || WIN_TIERS.NORMAL;
    const multiplier = Math.max(1, Math.round(amt / Math.max(1, bet)));
    
    fx.mode = tier;
    fx.start = performance.now();
    fx.amountValue = amt;
    fx.tier = tier;
    
    fx.overlay.visible = true;
    fx.rays.visible = true;
    fx.title.visible = true;
    fx.amount.visible = true;
    fx.sub.visible = true;
    fx.multiplier.visible = true;
    
    // Reset alpha/scale for GSAP animation
    fx.title.alpha = 0;
    fx.amount.alpha = 0;
    fx.multiplier.alpha = 0;
    fx.title.scale.set(0.5);
    fx.amount.scale.set(0.5);
    fx.multiplier.scale.set(0.5);
    
    // Set tier-specific styling
    fx.title.text = tierConfig.label;
    fx.title.style.fill = tierConfig.color;
    fx.amount.text = `₱${Math.round(amt).toLocaleString('en-PH')}`;
    fx.sub.text = getTierSubtitle(tier);
    fx.multiplier.text = `x${multiplier}`;
    fx.multiplier.style.fill = tierConfig.color;
    
    // GSAP: Animate title (scale up → overshoot → hold)
    gsap.to(fx.title, {
      alpha: 1,
      duration: 0.25,
      ease: 'power2.out'
    });
    gsap.to(fx.title.scale, {
      x: tierConfig.scale,
      y: tierConfig.scale,
      duration: 0.4,
      ease: 'back.out(2.5)'
    });
    
    // GSAP: Animate amount (delayed, scale up with overshoot)
    gsap.to(fx.amount, {
      alpha: 1,
      duration: 0.3,
      delay: 0.15,
      ease: 'power2.out'
    });
    gsap.to(fx.amount.scale, {
      x: tierConfig.scale * 1.1,
      y: tierConfig.scale * 1.1,
      duration: 0.5,
      delay: 0.15,
      ease: 'back.out(2)'
    });
    gsap.to(fx.amount.scale, {
      x: tierConfig.scale,
      y: tierConfig.scale,
      duration: 0.25,
      delay: 0.65,
      ease: 'power2.out'
    });
    
    // GSAP: Animate multiplier (last, glow effect)
    gsap.to(fx.multiplier, {
      alpha: 1,
      duration: 0.25,
      delay: 0.35,
      ease: 'power2.out'
    });
    gsap.to(fx.multiplier.scale, {
      x: 1.2,
      y: 1.2,
      duration: 0.3,
      delay: 0.35,
      ease: 'back.out(3)'
    });
    gsap.to(fx.multiplier.scale, {
      x: 1,
      y: 1,
      duration: 0.2,
      delay: 0.65,
      ease: 'power2.out'
    });
    
    // Spawn particles
    fx.coins.forEach((c, i) => {
      c.visible = true;
      c.x = 0;
      c.y = 0;
      c.alpha = 1;
      c.vx = (Math.random() - 0.5) * (tier === 'SUPER' ? 18 : tier === 'MEGA' ? 14 : 12);
      c.vy = -5 - Math.random() * (tier === 'SUPER' ? 14 : tier === 'MEGA' ? 11 : 10);
    });
    fx.confetti.forEach((c, i) => {
      c.visible = true;
      c.x = 0;
      c.y = 0;
      c.alpha = 1;
      c.vx = (Math.random() - 0.5) * (tier === 'SUPER' ? 20 : tier === 'MEGA' ? 16 : 14);
      c.vy = -6 - Math.random() * (tier === 'SUPER' ? 14 : tier === 'MEGA' ? 12 : 10);
    });
    
    // Store config for update loop
    fx.tierConfig = tierConfig;
  }
  
  function getTierSubtitle(tier) {
    switch (tier) {
      case 'SUPER': return 'INCREDIBLE!!!';
      case 'MEGA': return 'AMAZING!!';
      case 'BIG': return 'GREAT!';
      default: return 'NICE!';
    }
  }

  function updateFX(s, now) {
    const fx = s.fx; if (!fx || fx.mode === 'idle') return;
    const t = (now - fx.start) / 1000;
    const w = s.width, h = s.height, cx = w / 2, cy = h * 0.48;
    
    if (fx.mode === 'fade') {
      const a = Math.max(0, 1 - (now - fx.start) / 400);
      fx.title.alpha = fx.amount.alpha = fx.sub.alpha = fx.multiplier.alpha = a;
      if (a <= 0) {
        fx.mode = 'idle';
        fx.tier = null;
        fx.tierConfig = null;
        fx.overlay.visible = fx.rays.visible = fx.title.visible = fx.amount.visible = fx.sub.visible = fx.multiplier.visible = false;
        fx.coins.forEach(c => c.visible = false);
        fx.confetti.forEach(c => c.visible = false);
        gsap.killTweensOf([fx.title, fx.amount, fx.multiplier]);
        gsap.killTweensOf([fx.title.scale, fx.amount.scale, fx.multiplier.scale]);
      }
      return;
    }
    
    const tierConfig = fx.tierConfig || WIN_TIERS.NORMAL;
    const duration = tierConfig.duration;
    const p = Math.min(1, t / duration);
    const pulse = 1 + Math.sin(t * 18) * 0.025;
    
    fx.overlay.clear();
    fx.overlay.rect(0, 0, w, h);
    const overlayColor = fx.tier === 'SUPER' ? 0x4a0033 : fx.tier === 'MEGA' ? 0x4a1a00 : 0x4b1800;
    fx.overlay.fill({ color: overlayColor, alpha: 0.30 });
    fx.overlay.alpha = Math.min(0.75, 0.18 + p * 0.52);
    
    fx.rays.clear();
    fx.rays.x = cx; fx.rays.y = cy;
    fx.rays.alpha = Math.max(0, 1 - p);
    fx.rays.rotation = t * (fx.tier === 'SUPER' ? 0.45 : fx.tier === 'MEGA' ? 0.35 : 0.28);
    const rayCount = fx.tier === 'SUPER' ? 24 : fx.tier === 'MEGA' ? 20 : 18;
    for (let i = 0; i < rayCount; i++) {
      const a = i * Math.PI / (rayCount / 2);
      fx.rays.moveTo(Math.cos(a) * 35, Math.sin(a) * 35);
      fx.rays.lineTo(Math.cos(a) * Math.max(w, h) * 0.7, Math.sin(a) * Math.max(w, h) * 0.7);
    }
    fx.rays.stroke({ color: tierConfig.color, alpha: 0.12, width: Math.max(3, w * 0.012) });
    
    fx.title.x = cx; fx.title.y = cy - 55;
    fx.amount.x = cx; fx.amount.y = cy + 8;
    fx.sub.x = cx; fx.sub.y = cy + 60;
    fx.multiplier.x = cx; fx.multiplier.y = cy + 100;
    
    // Pulse effect on title/amount during hold
    if (t > 0.5) {
      const pulseScale = tierConfig.scale * (1 + Math.sin(t * 6) * 0.03);
      fx.title.scale.x = fx.title.scale.y = pulseScale;
    }
    
    fx.coins.forEach(c => {
      if (!c.visible) return;
      c.x += c.vx;
      c.y += c.vy;
      c.vy += 0.22;
      c.alpha = Math.max(0, 1 - p * 1.05);
      if (c.y > h) c.visible = false;
    });
    fx.confetti.forEach(c => {
      if (!c.visible) return;
      c.x += c.vx;
      c.y += c.vy;
      c.vy += 0.24;
      c.rotation += 0.1;
      c.alpha = Math.max(0, 1 - p * 1.1);
      if (c.y > h) c.visible = false;
    });
    
    if (t > duration) {
      fx.mode = 'fade';
      fx.start = now;
    }
  }

  function tick(s, onDebugStats) {
    if (!s.initialized) return;
    const now = performance.now();
    
    // FPS calculation
    s.frameCount++;
    if (now - s.lastFpsTime >= 1000) {
      s.fps = s.frameCount * 1000 / (now - s.lastFpsTime);
      s.frameCount = 0;
      s.lastFpsTime = now;
    }
    
    s.particles.forEach((q, i) => {
      q.x += q.vx * 0.5;
      q.y += q.vy * 0.5;
      q.phase += 0.018;
      q.alpha = q.baseAlpha * (0.65 + 0.35 * Math.sin(q.phase + i));
      if (q.y < -12) { q.y = s.height + 12; q.x = Math.random() * s.width; }
    });
    
    s.topSheen.alpha = 0.11 + Math.sin(now * 0.0015) * 0.05;
    updateFX(s, now);
    
      // Winning animations handled by GSAP timelines in animateWinSymbols()
    // Just dim non-winning symbols here
    s.reels.forEach(r => {
      if (!r.symbols || r.lastState) return;
      r.symbols.forEach((item, idx) => {
        const finalRow = idx - (r.symbols.length - 3);
        const isWinning = r.winningRows?.includes(finalRow);
        if (!isWinning) {
          // Dim non-winning symbols
          gsap.to(item.box, { alpha: 0.45, duration: 0.3, ease: 'power2.out' });
        }
      });
    });
    
    // Report debug stats (throttled to ~10fps)
    if (onDebugStats && now - (s.lastDebugReport || 0) >= 100) {
      s.lastDebugReport = now;
      onDebugStats({
        fps: s.fps || 0,
        particleCount: s.particles?.length || 0,
        assetStatus: s.assetStatus || {},
        symbolCount: s.reels?.reduce((sum, r) => sum + (r.symbols?.length || 0), 0) || 0,
        width: s.width,
        height: s.currentHeight,
        initialized: s.initialized
      });
    }
  }

  return <div ref={hostRef} style={{ width: '100%', height, position: 'relative' }} />;
}
