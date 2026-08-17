import React, { useEffect, useRef } from 'react';
import { Application, Assets, Container, Graphics, Sprite, Text, TextStyle, Texture } from 'pixi.js';

// V6 uses a GPU-friendly WebP/PNG-style texture-atlas pipeline (PNG atlas + JSON metadata)
// for deterministic, cacheable symbol artwork. The artwork is original and bundled locally.
// V3 used original procedural/vector artwork instead of emoji. The artwork is
// generated locally so the game does not depend on copied third-party assets.
const FALLBACK_IDS = ['wild', 'scatter', 'seven', 'bar', 'bell', 'cherry', 'lemon', 'orange', 'plum', 'grape'];
const DEFAULT_COLORS = {
  wild: 0xff5b35,
  scatter: 0x38d9ff,
  seven: 0xff3d81,
  bar: 0xc58b42,
  bell: 0xffd34d,
  cherry: 0xff4f6f,
  lemon: 0xffd84a,
  orange: 0xff9f35,
  plum: 0xb25cff,
  grape: 0x8c4cff,
};

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

function addDiamond(g, x, y, w, h, fill, stroke = 0xffffff) {
  g.poly([x, y - h / 2, x + w / 2, y, x, y + h / 2, x - w / 2, y]);
  g.fill({ color: fill });
  g.stroke({ color: stroke, alpha: 0.6, width: Math.max(1, w * 0.035) });
}

function addLeaf(g, x, y, size, color) {
  g.ellipse(x, y, size * 0.34, size * 0.16);
  g.fill({ color });
  g.rotation = -0.35;
}

function drawSymbolArt(id, size, color) {
  const g = new Graphics();
  const dark = shade(color, 0.38);
  const light = lighten(color, 1.45);
  const white = 0xfff9df;
  const gold = 0xffd85b;
  const s = size;

  // Premium medallion base.
  g.circle(0, 0, s * 0.39);
  g.fill({ color: 0x0a0616, alpha: 0.92 });
  g.stroke({ color: gold, alpha: 0.75, width: s * 0.025 });
  g.circle(0, 0, s * 0.33);
  g.fill({ color: dark, alpha: 0.94 });
  g.stroke({ color: light, alpha: 0.42, width: s * 0.012 });

  if (id === 'wild') {
    // Original flame/dragon-crest silhouette.
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
    addDiamond(g, 0, -s * 0.02, s * 0.43, s * 0.48, light, white);
    addDiamond(g, -s * 0.07, -s * 0.02, s * 0.20, s * 0.36, 0xffffff, 0xffffff);
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
    addLeaf(g, s * 0.12, -s * 0.17, s * 0.26, 0x65b94f);
  } else if (id === 'plum') {
    g.circle(0, s * 0.05, s * 0.18); g.fill({ color: light });
    g.circle(-s * 0.07, 0, s * 0.045); g.fill({ color: 0xffffff, alpha: 0.28 });
    g.arc(0, s * 0.05, s * 0.12, 0, Math.PI); g.stroke({ color: dark, width: s * 0.018 });
    addLeaf(g, s * 0.10, -s * 0.16, s * 0.25, 0x65b94f);
  } else if (id === 'grape') {
    const points = [[-0.09,-0.12],[0.09,-0.12],[-0.13,0.02],[0,0.02],[0.13,0.02],[-0.08,0.15],[0.08,0.15],[0,0.28]];
    points.forEach(([x,y]) => { g.circle(x*s, y*s, s*0.075); g.fill({ color: light }); g.stroke({ color: white, alpha: 0.22, width: s*0.008 }); });
    addLeaf(g, -s*0.02, -s*0.23, s*0.28, 0x65b94f);
  }

  return g;
}

function createSymbol(textureMap, themeSymbols, id, size) {
  const color = symbolColor(themeSymbols, id);
  const box = new Container();

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

  return { box, glow: aura, art, color };
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
  message = ''
}) {
  const hostRef = useRef(null);
  const stateRef = useRef({});
  const propsRef = useRef({ reels, reelStates, spinning, winningLines, themeSymbols });
  propsRef.current = { reels, reelStates, spinning, winningLines, themeSymbols, lastWin, showBigWin, freeSpins, message };

  useEffect(() => {
    let destroyed = false;
    const app = new Application();
    const state = { app, width: 0, height, reels: [], particles: [], lastTime: performance.now(), initialized: false, reelBuildKey: '', fx: null, lastWin: 0, showBigWin: false, freeSpins: 0, lastMessage: '' };
    state.textureMap = {};
    stateRef.current = state;

    const mount = async () => {
      await app.init({ resizeTo: hostRef.current, background: 0x090514, antialias: true, resolution: Math.min(window.devicePixelRatio || 1, 2), autoDensity: true });
      if (destroyed) return;
      hostRef.current.appendChild(app.canvas);
      app.canvas.style.width = '100%';
      app.canvas.style.height = `${height}px`;
      app.canvas.style.display = 'block';
      app.canvas.style.borderRadius = '18px';
      app.canvas.style.touchAction = 'manipulation';

      let spriteSheet = null;
      try {
        spriteSheet = await Assets.load('/assets/slots/symbols.json');
        state.textureMap = spriteSheet?.textures || {};
      } catch (assetError) {
        console.warn('V6 texture atlas failed to load; using fallback textures.', assetError);
      }

      const root = new Container(); app.stage.addChild(root); state.root = root;
      const ambient = new Container(); root.addChild(ambient); state.particles = makeParticles(ambient, 700, height, 85);
      const frame = new Graphics(); root.addChild(frame); state.frame = frame;
      const innerGlow = new Graphics(); root.addChild(innerGlow); state.innerGlow = innerGlow;
      const reelsLayer = new Container(); root.addChild(reelsLayer); state.reelsLayer = reelsLayer;
      const shade = new Graphics(); root.addChild(shade); state.shade = shade;
      const topSheen = new Graphics(); root.addChild(topSheen); state.topSheen = topSheen;
      const fxLayer = new Container(); root.addChild(fxLayer); state.fxLayer = fxLayer;
      state.fx = createFXLayer(fxLayer, app.screen.width, height);

      state.resize = () => layout(state);
      window.addEventListener('resize', state.resize);
      layout(state);
      app.ticker.add(() => tick(state));
      state.initialized = true;
      syncReels(state, propsRef.current.reels, propsRef.current.reelStates, propsRef.current.themeSymbols, propsRef.current.winningLines);
      syncFX(state, propsRef.current);
      if (onReady) onReady();
    };

    mount();
    return () => {
      destroyed = true;
      window.removeEventListener('resize', state.resize);
      app.destroy(true, { children: true, texture: false, textureSource: false });
      stateRef.current = {};
    };
  }, [height, onReady]);

  useEffect(() => {
    const s = stateRef.current;
    if (!s.initialized) return;
    syncReels(s, reels, reelStates, themeSymbols, winningLines);
    syncFX(s, { lastWin, showBigWin, freeSpins, message });
  }, [reels, reelStates, themeSymbols, winningLines, lastWin, showBigWin, freeSpins, message]);

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
      r.x = i * (reelWidth + gap);
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
    r.offset = 0; r.velocity = 0; r.target = 0; r.running = false; r.stopping = false; r.lastState = false; r.themeSymbols = themeSymbols; r.textureMap = s.textureMap;
    s.reelsLayer.addChild(r);
    return r;
  }

  function syncReels(s, nextReels, nextStates, themeSymbols, winning) {
    while (s.reels.length < 5) s.reels.push(buildReel(s, s.reels.length, themeSymbols));
    s.reels.forEach((r, i) => {
      r.themeSymbols = themeSymbols;
      const isRunning = !!nextStates?.[i];
      const final = (nextReels?.[i] || []).slice(0, 3).map(x => typeof x === 'string' ? x : x?.id || 'cherry');
      if (isRunning && !r.lastState) startReel(s, r, final);
      else if (!isRunning && r.lastState) stopReel(s, r, final);
      r.lastState = isRunning;
      r.final = final;
      r.winningRows = winningRowsForColumn(winning, i);
    });
    layout(s);
  }

  function startReel(s, r, final) {
    r.running = true; r.stopping = false; r.velocity = 20 + r.index * 1.7; r.offset = 0;
    rebuildStrip(r, final, 20, s.cell);
    r.shake = 0;
  }

  function stopReel(s, r, final) {
    r.running = false;
    const rowH = s.cell + s.gap;
    rebuildStrip(r, final, 10, s.cell);
    const target = (r.strip.children.length - 3) * rowH;
    r.offset = Math.max(0, target - rowH * 3.3);
    r.target = target;
    r.stopStart = performance.now(); r.stopFrom = r.offset; r.stopDuration = 620 + r.index * 85;
    r.stopping = true; r.velocity = 0;
  }

  function rebuildStrip(r, final, extra, cell) {
    r.strip.removeChildren(); r.symbols = [];
    const pool = Object.keys(r.themeSymbols || {}).length ? Object.keys(r.themeSymbols) : FALLBACK_IDS;
    const ids = [];
    for (let i = 0; i < extra; i++) ids.push(pool[Math.floor(Math.random() * pool.length)]);
    ids.push(...final, ...final);
    ids.forEach((id, i) => {
      const item = createSymbol(r.textureMap, r.themeSymbols, id, cell);
      item.box.y = i * (cell + r.gap); item.box.x = 0;
      r.strip.addChild(item.box); r.symbols.push(item);
    });
  }

  function winningRowsForColumn(lines, column) {
    const rows = [];
    (lines || []).forEach(line => { if (Array.isArray(line) && line[column] != null) rows.push(Number(line[column])); });
    return rows;
  }


  function createFXLayer(layer, width, height) {
    const overlay = new Graphics();
    const rays = new Graphics();
    const title = new Text({ text: '', style: new TextStyle({ fontFamily: 'Arial Black, Arial, sans-serif', fontSize: 42, fontWeight: '900', fill: 0xfff3a6, stroke: { color: 0x6b1b00, width: 5 }, dropShadow: { color: 0x000000, alpha: 0.8, blur: 8, distance: 3, angle: Math.PI / 2 } }) });
    title.anchor.set(0.5);
    const amount = new Text({ text: '', style: new TextStyle({ fontFamily: 'Arial Black, Arial, sans-serif', fontSize: 54, fontWeight: '900', fill: 0xffffff, stroke: { color: 0xb45309, width: 5 }, dropShadow: { color: 0xffb300, alpha: 0.9, blur: 16, distance: 0 } }) });
    amount.anchor.set(0.5);
    const sub = new Text({ text: '', style: new TextStyle({ fontFamily: 'Arial Black, Arial, sans-serif', fontSize: 18, fontWeight: '900', fill: 0xfff8dc, letterSpacing: 2, dropShadow: { color: 0x000000, alpha: 0.8, blur: 4, distance: 2 } }) });
    sub.anchor.set(0.5);
    const burst = new Container();
    const winEnergy = new Graphics();
    const scatterRing = new Graphics();
    const freeRing = new Graphics();
    const shineSweep = new Graphics();
    const multiplier = new Text({ text: '', style: new TextStyle({ fontFamily: 'Arial Black, Arial, sans-serif', fontSize: 26, fontWeight: '900', fill: 0xffffff, stroke: { color: 0x7c2d12, width: 3 }, dropShadow: { color: 0xffd75a, alpha: 0.9, blur: 8, distance: 0 } }) });
    multiplier.anchor.set(0.5);
    const coins = [];
    const confetti = [];
    for (let i=0;i<42;i++) {
      const c = new Graphics();
      c.circle(0,0,2+Math.random()*3); c.fill({color:[0xffd75a,0xffffff,0x75e7ff,0xff7f50][i%4],alpha:0.9});
      c.visible=false; burst.addChild(c); coins.push(c);
    }
    for (let i=0;i<28;i++) {
      const c = new Graphics();
      c.roundRect(-3,-6,6,12,2); c.fill({color:[0xffd75a,0xff6b6b,0x75e7ff,0xa78bfa][i%4],alpha:0.9});
      c.visible=false; burst.addChild(c); confetti.push(c);
    }
    layer.addChild(overlay, rays, winEnergy, scatterRing, freeRing, shineSweep, burst, title, amount, sub, multiplier);
    overlay.visible=false; rays.visible=false; winEnergy.visible=false; scatterRing.visible=false; freeRing.visible=false; shineSweep.visible=false; title.visible=false; amount.visible=false; sub.visible=false; multiplier.visible=false;
    return { overlay, rays, winEnergy, scatterRing, freeRing, shineSweep, burst, title, amount, sub, multiplier, coins, confetti, mode:'idle', start:0, amountValue:0, width, height, freeSpinBanner:false, lastScatterKey:'', lastFreeKey:'' };
  }

  function syncFX(s, props) {
    if (!s.fx) return;
    const now = performance.now();
    if (props.showBigWin && !s.showBigWin) {
      startBigWinFX(s, Number(props.lastWin)||0);
    }
    if (!props.showBigWin && s.showBigWin) {
      // Keep a short fade tail rather than snapping off.
      if (s.fx.mode === 'bigwin') s.fx.mode = 'fade';
    }
    if ((Number(props.freeSpins)||0) > (Number(s.freeSpins)||0) && !props.spinning) {
      startFreeSpinFX(s, Number(props.freeSpins)||0);
    }
    const msg = String(props.message || '').toLowerCase();
    if ((msg.includes('scatter') || msg.includes('free spin')) && msg !== s.lastMessage && !props.spinning) {
      // A short celebratory transition without changing the game result.
      startFreeSpinFX(s, Number(props.freeSpins) || 1);
    }
    if (props.lastWin > 0 && props.lastWin !== s.lastWin && !props.showBigWin) {
      startWinFX(s, Number(props.lastWin)||0);
    }
    s.lastWin = Number(props.lastWin)||0;
    s.showBigWin = !!props.showBigWin;
    s.freeSpins = Number(props.freeSpins)||0;
    s.lastMessage = props.message || '';
  }

  function prepareFXBurst(fx, mode, amount) {
    fx.mode=mode; fx.start=performance.now(); fx.amountValue=amount;
    fx.overlay.visible=true; fx.rays.visible=true; fx.title.visible=true; fx.amount.visible=true; fx.sub.visible=true;
    fx.winEnergy.visible = mode !== 'free';
    fx.scatterRing.visible = mode === 'win' || mode === 'bigwin';
    fx.freeRing.visible = mode === 'free';
    fx.shineSweep.visible = mode !== 'win';
    fx.multiplier.visible = mode === 'bigwin';
    fx.title.text = mode==='free' ? 'FREE SPINS' : mode==='bigwin' ? 'BIG WIN' : 'WIN';
    fx.amount.text = amount > 0 ? (mode==='free' ? `+${Math.round(amount)}` : `₱${Math.round(amount).toLocaleString('en-PH')}`) : '';
    fx.sub.text = mode==='free' ? 'BONUS ROUND' : mode==='bigwin' ? 'AMAZING HIT!' : 'CONGRATULATIONS';
    fx.multiplier.text = mode==='bigwin' ? `x${Math.max(2, Math.min(20, Math.round((amount || 1) / 100)))}` : '';
    fx.coins.forEach((c,i)=>{ c.visible=true; c.x=0;c.y=0;c.alpha=1;c.scale.set(1);c.vx=(Math.random()-.5)*(6+Math.random()*8);c.vy=-4-Math.random()*8;c.spin=(Math.random()-.5)*.25; });
    fx.confetti.forEach((c,i)=>{ c.visible=true;c.x=0;c.y=0;c.alpha=1;c.vx=(Math.random()-.5)*9;c.vy=-5-Math.random()*9;c.spin=(Math.random()-.5)*.4; });
  }

  function startBigWinFX(s, amount) { prepareFXBurst(s.fx,'bigwin',amount); }
  function startWinFX(s, amount) { prepareFXBurst(s.fx,'win',amount); }
  function startFreeSpinFX(s, count) { prepareFXBurst(s.fx,'free',count); }

  function updateFX(s, now) {
    const fx=s.fx; if(!fx) return;
    if (fx.mode==='idle') return;
    const t=(now-fx.start)/1000;
    const w=s.width, h=s.height, cx=w/2, cy=h*0.48;
    fx.overlay.clear(); fx.rays.clear();
    if (fx.mode==='fade') {
      const a=Math.max(0,1-(now-fx.start)/350); fx.overlay.visible=true; fx.overlay.alpha=a; fx.title.alpha=a; fx.amount.alpha=a; fx.sub.alpha=a; fx.rays.alpha=a;
      if(a<=0){fx.mode='idle';fx.overlay.visible=fx.rays.visible=fx.winEnergy.visible=fx.scatterRing.visible=fx.freeRing.visible=fx.shineSweep.visible=fx.title.visible=fx.amount.visible=fx.sub.visible=fx.multiplier.visible=false; fx.coins.forEach(c=>c.visible=false);fx.confetti.forEach(c=>c.visible=false);fx.overlay.alpha=1;fx.title.alpha=fx.amount.alpha=fx.sub.alpha=fx.rays.alpha=1;} return;
    }
    const duration=fx.mode==='bigwin'?2.15:fx.mode==='free'?1.65:1.25;
    const p=Math.min(1,t/duration);
    const pulse=1+Math.sin(t*18)*0.025;
    const scale=p<0.22 ? 0.45+(p/0.22)*0.75 : p<0.34 ? 1.2-(p-0.22)/0.12*0.18 : 1.02+Math.sin(t*4)*0.035;
    fx.overlay.alpha=Math.min(0.72,0.18+p*0.48);
    fx.overlay.rect(0,0,w,h); fx.overlay.fill({color:fx.mode==='free'?0x0a5c62:0x4b1800,alpha:0.30});
    fx.rays.x=cx;fx.rays.y=cy;fx.rays.alpha=Math.max(0,1-p); fx.rays.rotation=t*.28;
    for(let i=0;i<18;i++){ const a=i*Math.PI/9; const r1=35, r2=Math.max(w,h)*0.7; fx.rays.moveTo(Math.cos(a)*r1,Math.sin(a)*r1);fx.rays.lineTo(Math.cos(a)*r2,Math.sin(a)*r2); }
    fx.rays.stroke({color:fx.mode==='free'?0x55f6e8:0xffd75a,alpha:0.10,width:Math.max(3,w*.012)});
    fx.title.x=cx;fx.title.y=cy-55;fx.title.scale.set(scale*pulse);fx.title.alpha=p<0.12?p/0.12:1-p*.15;
    fx.amount.x=cx;fx.amount.y=cy+5;fx.amount.scale.set(scale*pulse);fx.amount.alpha=fx.title.alpha;
    fx.sub.x=cx;fx.sub.y=cy+58;fx.sub.alpha=fx.title.alpha;

    // V5 layered energy effects: these are intentionally generated at runtime,
    // so the game does not require copied third-party artwork.
    const ringT = Math.min(1, p * 1.35);
    fx.scatterRing.clear();
    fx.scatterRing.x=cx; fx.scatterRing.y=cy+8; fx.scatterRing.alpha=(1-ringT)*0.9;
    fx.scatterRing.circle(0,0,28+ringT*Math.max(90,w*.34));
    fx.scatterRing.stroke({color:0xffd75a,width:Math.max(2,w*.009),alpha:0.8});
    fx.scatterRing.rotation=t*2.5;

    fx.freeRing.clear();
    fx.freeRing.x=cx; fx.freeRing.y=cy+8; fx.freeRing.alpha=(1-ringT)*0.95;
    fx.freeRing.circle(0,0,25+ringT*Math.max(110,w*.38));
    fx.freeRing.stroke({color:0x55f6e8,width:Math.max(3,w*.012),alpha:0.75});
    fx.freeRing.rotation=-t*1.8;

    fx.winEnergy.clear();
    fx.winEnergy.x=cx; fx.winEnergy.y=cy+5; fx.winEnergy.alpha=(1-p)*0.9;
    for(let i=0;i<12;i++){
      const a=i*Math.PI/6 + t*0.9; const len=25+(Math.sin(t*7+i)*0.5+0.5)*Math.max(50,w*.16);
      fx.winEnergy.moveTo(Math.cos(a)*24,Math.sin(a)*24);
      fx.winEnergy.lineTo(Math.cos(a)*len,Math.sin(a)*len);
    }
    fx.winEnergy.stroke({color:0xfff1a8,width:Math.max(2,w*.006),alpha:0.8});

    fx.shineSweep.clear();
    fx.shineSweep.x=w*(p*1.45-0.25); fx.shineSweep.y=0; fx.shineSweep.rotation=-0.18; fx.shineSweep.alpha=(1-p)*0.35;
    fx.shineSweep.rect(-20,0,40,h); fx.shineSweep.fill({color:0xffffff,alpha:0.5});

    fx.multiplier.x=cx; fx.multiplier.y=cy+105; fx.multiplier.scale.set(0.7+Math.min(0.35,p)*Math.sin(t*9)*0.08); fx.multiplier.alpha=fx.amount.alpha;
    fx.coins.forEach((c,i)=>{ if(!c.visible)return; c.x+=c.vx; c.y+=c.vy; c.vy+=0.22; c.rotation+=c.spin; c.alpha=Math.max(0,1-p*1.05); if(c.y>h) c.visible=false; });
    fx.confetti.forEach((c,i)=>{ if(!c.visible)return; c.x+=c.vx;c.y+=c.vy;c.vy+=0.24;c.rotation+=c.spin;c.alpha=Math.max(0,1-p*1.1); if(c.y>h)c.visible=false; });
    if(t>duration){fx.mode='fade';fx.start=now;}
  }

  function tick(s) {
    if (!s.initialized) return;
    const now = performance.now();
    const dt = Math.min(32, now - s.lastTime); s.lastTime = now;

    s.particles.forEach((q, i) => {
      q.x += q.vx * dt; q.y += q.vy * dt; q.phase += 0.018 * dt;
      q.alpha = q.baseAlpha * (0.65 + 0.35 * (0.5 + 0.5 * Math.sin(q.phase + i)));
      if (q.y < -12) { q.y = s.height + 12; q.x = Math.random() * s.width; }
      if (q.x < -10) q.x = s.width + 10;
      if (q.x > s.width + 10) q.x = -10;
    });

    s.topSheen.alpha = 0.11 + Math.sin(now * 0.0015) * 0.05;
    updateFX(s, now);

    s.reels.forEach(r => {
      const rowH = s.cell + s.gap;
      if (r.running) {
        r.offset += r.velocity * dt / 16;
        const max = Math.max(rowH, (r.strip.children.length - 3) * rowH);
        if (r.offset > max) r.offset = 0;
      } else if (r.stopping) {
        const elapsed = now - r.stopStart;
        const t = Math.min(1, elapsed / r.stopDuration);
        const eased = 1 - Math.pow(1 - t, 4);
        r.offset = r.stopFrom + (r.target - r.stopFrom) * eased;
        if (t >= 1) { r.stopping = false; r.offset = r.target; r.shake = 1; }
      }
      r.strip.y = -r.offset;
      r.symbols.forEach((item, idx) => {
        const row = idx - Math.floor(r.offset / rowH);
        const isVisible = row >= -1 && row <= 3;
        item.box.alpha = isVisible ? 1 : 0.06;
        const finalRow = idx - (r.symbols.length - 3);
        const winning = !r.running && !r.stopping && r.winningRows?.includes(finalRow);
        if (winning) {
          const pulse = 1 + Math.sin(now * 0.012 + idx) * 0.075;
          item.box.scale.set(pulse);
          item.glow.alpha = 0.28 + Math.sin(now * 0.014 + idx) * 0.15;
          item.art.rotation = Math.sin(now * 0.003 + idx) * 0.018;
        } else {
          item.box.scale.set(1); item.glow.alpha = r.running ? 0.035 : 0.09; item.art.rotation = 0;
        }
      });
      if (r.shake > 0) { r.x += (Math.random() - 0.5) * 3.2 * r.shake; r.shake *= 0.80; }
    });
  }

  return <div ref={hostRef} style={{ width: '100%', height, position: 'relative' }} />;
}
