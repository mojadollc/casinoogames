import React, { useEffect, useRef, useCallback } from 'react';
import { Application, Assets, Container, Graphics, Sprite, Text, TextStyle, Texture } from 'pixi.js';
import gsap from 'gsap';

// Per-theme image folders: /assets/slots/{theme}/{symbol}.webp or .png
// Falls back to procedural art if image not found.
const FALLBACK_IDS = ['wild', 'scatter', 'seven', 'bar', 'bell', 'cherry', 'lemon', 'orange', 'plum', 'grape'];
const DEFAULT_COLORS = {
  wild: 0xff5b35, scatter: 0x38d9ff, seven: 0xff3d81, bar: 0xc58b42, bell: 0xffd34d,
  cherry: 0xff4f6f, lemon: 0xffd84a, orange: 0xff9f35, plum: 0xb25cff, grape: 0x8c4cff,
};

function hexToNumber(v) {
  if (typeof v === 'number') return v;
  const s = String(v || '').replace('#', '');
  const n = parseInt(s, 16);
  return Number.isFinite(n) ? n : 0xffd75a;
}

function symbolColor(themeSymbols, id) {
  const tc = themeSymbols?.[id]?.color;
  return tc ? hexToNumber(tc) : DEFAULT_COLORS[id] || 0xffd75a;
}

function shade(c, f = 0.55) {
  const r = Math.min(255, Math.round(((c >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((c >> 8) & 255) * f));
  const b = Math.min(255, Math.round((c & 255) * f));
  return (r << 16) | (g << 8) | b;
}

function lighten(c, f = 1.25) {
  const r = Math.min(255, Math.round(((c >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((c >> 8) & 255) * f));
  const b = Math.min(255, Math.round((c & 255) * f));
  return (r << 16) | (g << 8) | b;
}

// Premium medallion base for fallback symbols
function drawSymbolArt(id, size, color) {
  const g = new Graphics();
  const dark = shade(color, 0.38);
  const light = lighten(color, 1.45);
  const gold = 0xffd85b;

  g.circle(0, 0, size * 0.42);
  g.fill({ color: 0x0a0616, alpha: 0.94 });
  g.stroke({ color: gold, alpha: 0.8, width: size * 0.03 });
  g.circle(0, 0, size * 0.35);
  g.fill({ color: dark, alpha: 0.96 });
  g.stroke({ color: light, alpha: 0.4, width: size * 0.012 });

  const label = id === 'wild' ? 'WILD' : id === 'scatter' ? 'SCATTER' : id.toUpperCase().slice(0, 3);
  const t = new Text({
    text: label,
    style: new TextStyle({
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: size * 0.22,
      fontWeight: '900',
      fill: light,
      stroke: { color: 0x000000, width: 2 },
      dropShadow: { color: 0x000000, alpha: 0.6, blur: 4, distance: 2 },
    }),
  });
  t.anchor.set(0.5);
  t.y = size * 0.02;
  g.addChild(t);
  return g;

// Load theme-specific texture atlas or individual PNGs
async function loadThemeTextures(theme, ids) {
  const base = `/assets/slots/${theme}/`;
  const map = {};

  // Try loading per-symbol WebP/PNG files
  for (const id of ids) {
    for (const ext of ['webp', 'png']) {
      try {
        const tex = await Assets.load(`${base}${id}.${ext}`);
        if (tex) { map[id] = tex; break; }
      } catch (e) { /* ignore */ }
    }
  }

  // Fallback: try a unified atlas (symbols.json)
  if (Object.keys(map).length === 0) {
    try {
      const sheet = await Assets.load(`${base}symbols.json`);
      if (sheet?.textures) Object.assign(map, sheet.textures);
    } catch (e) { /* ignore */ }
  }

  // Final fallback: shared atlas
  if (Object.keys(map).length === 0) {
    try {
      const sheet = await Assets.load('/assets/slots/symbols.json');
      if (sheet?.textures) Object.assign(map, sheet.textures);
    } catch (e) { /* ignore */ }
  }

  return map;
}

// Create a symbol sprite with glow
function createSymbol(textureMap, themeSymbols, id, size) {
  const color = symbolColor(themeSymbols, id);
  const box = new Container();

  // Glow ring
  const glow = new Graphics();
  glow.circle(0, 0, size * 0.46);
  glow.fill({ color, alpha: 0.12 });
  glow.stroke({ color: 0xffd75a, alpha: 0.2, width: size * 0.012 });
  box.addChild(glow);

  // Symbol image or fallback art
  const tex = textureMap?.[id];
  let art;
  if (tex && tex !== Texture.WHITE) {
    art = new Sprite(tex);
    art.anchor.set(0.5);
    const scale = (size * 0.88) / Math.max(tex.width || 256, tex.height || 256);
    art.width = tex.width * scale;
    art.height = tex.height * scale;
  } else {
    art = drawSymbolArt(id, size * 0.68, color);
  }
  box.addChild(art);

  // Shine arc
  const shine = new Graphics();
  shine.arc(0, 0, size * 0.4, -2.6, -1.1);
  shine.stroke({ color: 0xffffff, alpha: 0.28, width: size * 0.014 });
  box.addChild(shine);

  return { box, glow, art, color };
}

// GSAP-powered reel strip
function buildReelStrip(ids, textureMap, themeSymbols, cell, gap, startY) {
  const strip = new Container();
  const symbols = [];
  ids.forEach((id, i) => {
    const s = createSymbol(textureMap, themeSymbols, id, cell);
    s.box.y = i * (cell + gap);
    s.box.x = 0;
    strip.addChild(s.box);
    symbols.push(s);
  });
  strip.y = startY;
  return { strip, symbols };
}

export default function PixiSlotReels({
  reels = [],
  reelStates = [false, false, false, false, false],
  spinning = false,
  winningLines = [],
  themeSymbols = {},
  height = 330,
  onReady,
  lastWin = 0,
  showBigWin = false,
  freeSpins = 0,
  message = '',
  theme = 'default',
}) {
  const hostRef = useRef(null);
  const stateRef = useRef({});
  const propsRef = useRef({ reels, reelStates, spinning, winningLines, themeSymbols, lastWin, showBigWin, freeSpins, message, theme });
  propsRef.current = { reels, reelStates, spinning, winningLines, themeSymbols, lastWin, showBigWin, freeSpins, message, theme };

  // Initialize Pixi app
  useEffect(() => {
    let destroyed = false;
    const app = new Application();
    const state = {
      app,
      width: 0,
      height,
      reels: [],
      particles: [],
      lastTime: performance.now(),
      initialized: false,
      textureMap: {},
      fxLayer: null,
      fx: null,
      gsapTweens: [],
    };
    stateRef.current = state;

    const mount = async () => {
      await app.init({
        resizeTo: hostRef.current,
        background: 0x090514,
        antialias: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        autoDensity: true,
      });
      if (destroyed) return;

      hostRef.current.appendChild(app.canvas);
      app.canvas.style.width = '100%';
      app.canvas.style.height = `${height}px`;
      app.canvas.style.borderRadius = '14px';

      // Load theme-specific textures
      const symbolIds = Object.keys(themeSymbols).length > 0 ? Object.keys(themeSymbols) : FALLBACK_IDS;
      state.textureMap = await loadThemeTextures(theme, symbolIds);

      const root = new Container();
      app.stage.addChild(root);
      state.root = root;

      // Ambient particles
      const ambient = new Container();
      root.addChild(ambient);
      state.particles = makeParticles(ambient, 600, height, 60);

      // Frame border
      const frame = new Graphics();
      root.addChild(frame);
      state.frame = frame;

      // Reels container
      const reelsLayer = new Container();
      root.addChild(reelsLayer);
      state.reelsLayer = reelsLayer;

      // FX layer (win explosions)
      const fxLayer = new Container();
      root.addChild(fxLayer);
      state.fxLayer = fxLayer;
      state.fx = createFXLayer(fxLayer, 600, height);

      // Top/bottom fade masks
      const shade = new Graphics();
      root.addChild(shade);
      state.shade = shade;

      layout(state);
      app.ticker.add(() => tick(state));
      state.initialized = true;

      // Create initial 5 reels
      for (let i = 0; i < 5; i++) buildReel(state, i);

      syncReels(state, propsRef.current.reels, propsRef.current.reelStates, propsRef.current.winningLines);
      if (onReady) onReady();
    };

    mount();

    return () => {
      destroyed = true;
      state.gsapTweens.forEach(t => t.kill());
      app.destroy(true, { children: true, texture: false, textureSource: false });
      stateRef.current = {};
    };
  }, [height, theme, onReady]);

  // Update when props change
  useEffect(() => {
    const s = stateRef.current;
    if (!s.initialized) return;
    syncReels(s, reels, reelStates, winningLines);
    if (lastWin !== s.lastWin || showBigWin !== s.showBigWin || freeSpins !== s.freeSpins || message !== s.lastMessage) {
      syncFX(s, { lastWin, showBigWin, freeSpins, message });
    }
  }, [reels, reelStates, winningLines, lastWin, showBigWin, freeSpins, message]);

  // Layout reels
  function layout(s) {
    if (!s.app?.canvas) return;
    const w = s.app.screen.width;
    s.width = w;
    const h = height;
    const pad = Math.max(8, Math.min(16, w * 0.02));
    const gap = Math.max(4, w * 0.01);
    const reelW = Math.max(50, (w - pad * 2 - gap * 4) / 5);
    const cell = Math.min(reelW * 0.85, (h - 24) / 3.1);
    s.cell = cell;
    s.gap = gap;
    s.reelW = reelW;

    s.frame.clear();
    s.frame.roundRect(pad, 8, w - pad * 2, h - 16, 16);
    s.frame.fill({ color: 0x12081f, alpha: 0.98 });
    s.frame.stroke({ color: 0xffd75a, alpha: 0.7, width: 2.5 });

    s.shade.clear();
    s.shade.rect(0, 0, w, 28);
    s.shade.fill({ color: 0x05030a, alpha: 0.82 });
    s.shade.rect(0, h - 28, w, 28);
    s.shade.fill({ color: 0x05030a, alpha: 0.82 });

    s.reels.forEach((r, i) => {
      r.x = pad + i * (reelW + gap) + reelW / 2;
      r.y = h / 2;
    });
  }

  function buildReel(s, index) {
    const r = new Container();
    const viewport = new Graphics();
    const stripContainer = new Container();
    r.addChild(viewport);
    r.addChild(stripContainer);
    r.viewport = viewport;
    r.stripContainer = stripContainer;
    r.strip = null;
    r.symbols = [];
    r.index = index;
    r.spinning = false;
    r.targetY = 0;
    r.vy = 0;
    s.reelsLayer.addChild(r);
    s.reels[index] = r;
    return r;
  }

  function syncReels(s, nextReels, nextStates, winning) {
    const props = propsRef.current;
    while (s.reels.length < 5) buildReel(s, s.reels.length);

    s.reels.forEach((r, i) => {
      const shouldSpin = !!nextStates?.[i];
      const final = (nextReels?.[i] || []).slice(0, 3).map(x => (typeof x === 'string' ? x : x?.id || 'cherry'));

      if (shouldSpin && !r.spinning) {
        startReelSpin(s, r, final);
      } else if (!shouldSpin && r.spinning) {
        stopReelSpin(s, r, final);
      }

      // Highlight winning symbols
      const winRows = winningRowsForColumn(winning, i);
      r.symbols.forEach((sym, idx) => {
        const row = idx - (r.symbols.length - 3);
        const isWin = winRows.includes(row) && !r.spinning;
        if (isWin) {
          gsap.to(sym.box.scale, { x: 1.12, y: 1.12, duration: 0.3, ease: 'back.out' });
          gsap.to(sym.glow, { alpha: 0.6, duration: 0.2 });
        } else {
          gsap.to(sym.box.scale, { x: 1, y: 1, duration: 0.25 });
          gsap.to(sym.glow, { alpha: r.spinning ? 0.08 : 0.15, duration: 0.2 });
        }
      });
    });
    layout(s);
  }

  function startReelSpin(s, r, finalIds) {
    r.spinning = true;
    const cell = s.cell;
    const gap = s.gap;
    const rowH = cell + gap;
    const pool = Object.keys(propsRef.current.themeSymbols).length > 0 ? Object.keys(propsRef.current.themeSymbols) : FALLBACK_IDS;

    // Build long random strip
    const ids = [];
    for (let i = 0; i < 25; i++) ids.push(pool[Math.floor(Math.random() * pool.length)]);
    ids.push(...finalIds);

    r.stripContainer.removeChildren();
    const { strip, symbols } = buildReelStrip(ids, s.textureMap, propsRef.current.themeSymbols, cell, gap, 0);
    r.stripContainer.addChild(strip);
    r.strip = strip;
    r.symbols = symbols;
    r.targetY = -((ids.length - 3) * rowH);
    r.vy = 0;

    // GSAP infinite spin
    gsap.killTweensOf(r.strip);
    r.spinTween = gsap.to(r.strip, {
      y: r.targetY,
      duration: 0.8,
      ease: 'none',
      repeat: -1,
      onRepeat: () => {
        r.strip.y = 0;
      },
    });
  }

  function stopReelSpin(s, r, finalIds) {
    r.spinning = false;
    if (r.spinTween) r.spinTween.kill();

    const cell = s.cell;
    const gap = s.gap;
    const rowH = cell + gap;
    const pool = Object.keys(propsRef.current.themeSymbols).length > 0 ? Object.keys(propsRef.current.themeSymbols) : FALLBACK_IDS;

    // Rebuild strip with final symbols at bottom
    const ids = [];
    for (let i = 0; i < 12; i++) ids.push(pool[Math.floor(Math.random() * pool.length)]);
    ids.push(...finalIds);

    r.stripContainer.removeChildren();
    const { strip, symbols } = buildReelStrip(ids, s.textureMap, propsRef.current.themeSymbols, cell, gap, 0);
    r.stripContainer.addChild(strip);
    r.strip = strip;
    r.symbols = symbols;

    const targetY = -((ids.length - 3) * rowH);
    const startY = -((ids.length - 6) * rowH);
    strip.y = startY;

    gsap.to(strip, {
      y: targetY,
      duration: 0.45 + r.index * 0.08,
      ease: 'back.out(0.6)',
      onComplete: () => {
        // Small bounce on stop
        gsap.fromTo(r.stripContainer, { y: -4 }, { y: 0, duration: 0.1, ease: 'elastic.out' });
      },
    });
  }

  function winningRowsForColumn(lines, col) {
    const rows = [];
    (lines || []).forEach(line => {
      if (Array.isArray(line) && line[col] != null) rows.push(Number(line[col]));
    });
    return rows;
  }

  // === FX SYSTEM ===
  function createFXLayer(layer, w, h) {
    const txt = new Text({
      text: '',
      style: new TextStyle({
        fontFamily: 'Arial Black, Arial, sans-serif',
        fontSize: 48,
        fontWeight: '900',
        fill: 0xfff3a6,
        stroke: { color: 0x6b1b00, width: 6 },
        dropShadow: { color: 0x000000, alpha: 0.8, blur: 10 },
      }),
    });
    txt.anchor.set(0.5);
    const amount = new Text({
      text: '',
      style: new TextStyle({
        fontFamily: 'Arial Black, Arial, sans-serif',
        fontSize: 56,
        fontWeight: '900',
        fill: 0xffffff,
        stroke: { color: 0xb45309, width: 5 },
      }),
    });
    amount.anchor.set(0.5);
    const burst = new Container();
    layer.addChild(burst, txt, amount);
    return { layer, txt, amount, burst, mode: 'idle', start: 0, coins: [] };
  }

  function syncFX(s, props) {
    if (!s.fx) return;
    if (props.showBigWin && !s.showBigWin) startBigWinFX(s, props.lastWin);
    if (props.freeSpins > s.freeSpins && !props.spinning) startFreeSpinFX(s, props.freeSpins);
    s.lastWin = props.lastWin || 0;
    s.showBigWin = props.showBigWin;
    s.freeSpins = props.freeSpins || 0;
    s.lastMessage = props.message || '';
  }

  function startBigWinFX(s, win) {
    const fx = s.fx;
    fx.mode = 'bigwin';
    fx.start = performance.now();
    fx.txt.text = 'BIG WIN!';
    fx.txt.visible = true;
    fx.amount.text = `₱${Math.round(win).toLocaleString()}`;
    fx.amount.visible = true;

    gsap.fromTo(fx.txt.scale, { x: 0.3, y: 0.3 }, { x: 1.15, y: 1.15, duration: 0.5, ease: 'back.out' });
    gsap.fromTo(fx.txt, { alpha: 0 }, { alpha: 1, duration: 0.3 });
    gsap.fromTo(fx.amount.scale, { x: 0, y: 0 }, { x: 1, y: 1, duration: 0.6, delay: 0.2, ease: 'elastic.out' });
    spawnCoinBurst(fx.burst, s.width, s.height);

    setTimeout(() => {
      gsap.to(fx.txt, { alpha: 0, duration: 0.4 });
      gsap.to(fx.amount, { alpha: 0, duration: 0.4, onComplete: () => {
        fx.txt.visible = false;
        fx.amount.visible = false;
      }});
    }, 2500);
  }

  function startFreeSpinFX(s, count) {
    const fx = s.fx;
    fx.txt.text = `+${count} FREE SPINS!`;
    fx.txt.visible = true;
    gsap.fromTo(fx.txt.scale, { x: 0.5, y: 0.5 }, { x: 1.1, y: 1.1, duration: 0.4, ease: 'back.out' });
    gsap.fromTo(fx.txt, { alpha: 0 }, { alpha: 1, duration: 0.25 });
    setTimeout(() => gsap.to(fx.txt, { alpha: 0, duration: 0.35 }), 1800);
  }

  function spawnCoinBurst(container, w, h) {
    const colors = [0xffd75a, 0xffffff, 0x75e7ff];
    for (let i = 0; i < 35; i++) {
      const coin = new Graphics();
      coin.circle(0, 0, 3 + Math.random() * 5);
      coin.fill({ color: colors[i % colors.length], alpha: 0.85 });
      coin.x = w / 2;
      coin.y = h / 2;
      container.addChild(coin);
      gsap.to(coin, {
        x: w / 2 + (Math.random() - 0.5) * w * 0.7,
        y: h + 40,
        alpha: 0,
        duration: 1.2 + Math.random() * 0.6,
        ease: 'power2.out',
        onComplete: () => coin.destroy(),
      });
    }
  }

  // Ambient particles
  function makeParticles(container, w, h, count) {
    const particles = [];
    for (let i = 0; i < count; i++) {
      const p = new Graphics();
      p.circle(0, 0, 0.8 + Math.random() * 2.5);
      p.fill({ color: [0xffd75a, 0xffffff, 0x75e7ff][i % 3], alpha: 0.4 });
      p.x = Math.random() * w;
      p.y = Math.random() * h;
      p.vx = (Math.random() - 0.5) * 0.3;
      p.vy = -0.05 - Math.random() * 0.4;
      container.addChild(p);
      particles.push(p);
    }
    return particles;
  }

  function tick(s) {
    if (!s.initialized) return;
    const now = performance.now();
    s.particles.forEach((p, i) => {
      p.x += p.vx;
      p.y += p.vy;
      if (p.y < -8) { p.y = s.height + 8; p.x = Math.random() * s.width; }
      if (p.x < -8) p.x = s.width + 8;
      if (p.x > s.width + 8) p.x = -8;
    });
  }

  return <div ref={hostRef} style={{ width: '100%', height, position: 'relative' }} />;
}
