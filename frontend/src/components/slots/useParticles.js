import { useRef, useEffect, useCallback } from 'react';

const COIN_COLORS = [0xFFD700, 0xFFED4A, 0xFFA500, 0xFFFFFF, 0xFFC200];
const CONFETTI_COLORS = [0xFF2D75, 0x00F5D4, 0xFFD700, 0x9B59B6, 0x00BFFF, 0xFF6B6B];

function isMobile() {
  return (navigator.hardwareConcurrency || 4) < 4 || window.innerWidth < 768;
}

export default function useParticles(canvasRef) {
  const appRef = useRef(null);
  const particlesRef = useRef([]);
  const rafRef = useRef(null);
  const readyRef = useRef(false);

  useEffect(() => {
    if (!canvasRef?.current) return;
    let app;

    (async () => {
      try {
        const PIXI = await import('pixi.js');
        app = new PIXI.Application();
        await app.init({
          canvas: canvasRef.current,
          width: window.innerWidth,
          height: window.innerHeight,
          backgroundAlpha: 0,
          antialias: false,
          resolution: 1,
        });
        appRef.current = app;
        readyRef.current = true;

        // Resize handler
        const onResize = () => {
          app.renderer.resize(window.innerWidth, window.innerHeight);
        };
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
      } catch (_) {}
    })();

    return () => {
      readyRef.current = false;
      if (app) app.destroy(false);
    };
  }, [canvasRef]);

  const spawnParticles = useCallback((config) => {
    if (!readyRef.current || !appRef.current) return;
    const PIXI = appRef.current.renderer.constructor._plugin?.PIXI;

    // Fallback: use canvas 2D if PixiJS not ready
    const canvas = canvasRef?.current;
    if (!canvas) return;
    const c2d = canvas.getContext('2d');
    if (!c2d) return;

    const mobile = isMobile();
    const count = mobile ? Math.floor(config.count / 2) : config.count;
    const particles = [];

    for (let i = 0; i < count; i++) {
      const angle = config.spread
        ? (Math.random() * Math.PI * 2)
        : (config.angle || -Math.PI / 2) + (Math.random() - 0.5) * (config.spread || Math.PI);

      const speed = config.minSpeed + Math.random() * (config.maxSpeed - config.minSpeed);
      const color = config.colors[Math.floor(Math.random() * config.colors.length)];

      particles.push({
        x: config.x,
        y: config.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: config.minSize + Math.random() * (config.maxSize - config.minSize),
        color,
        alpha: 1,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.3,
        gravity: config.gravity ?? 0.4,
        life: 1,
        decay: 0.012 + Math.random() * 0.015,
        shape: config.shape || 'circle',
      });
    }

    particlesRef.current.push(...particles);

    const tick = () => {
      c2d.clearRect(0, 0, canvas.width, canvas.height);
      particlesRef.current = particlesRef.current.filter(p => p.life > 0);

      for (const p of particlesRef.current) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity;
        p.vx *= 0.99;
        p.rotation += p.rotSpeed;
        p.life -= p.decay;
        p.alpha = Math.max(0, p.life);

        c2d.save();
        c2d.globalAlpha = p.alpha;
        c2d.translate(p.x, p.y);
        c2d.rotate(p.rotation);

        const hex = '#' + p.color.toString(16).padStart(6, '0');
        c2d.fillStyle = hex;

        if (p.shape === 'coin') {
          c2d.beginPath();
          c2d.ellipse(0, 0, p.size, p.size * 0.6, 0, 0, Math.PI * 2);
          c2d.fill();
          // Shine
          c2d.fillStyle = 'rgba(255,255,255,0.4)';
          c2d.beginPath();
          c2d.ellipse(-p.size * 0.2, -p.size * 0.15, p.size * 0.3, p.size * 0.2, -0.5, 0, Math.PI * 2);
          c2d.fill();
        } else if (p.shape === 'rect') {
          c2d.fillRect(-p.size / 2, -p.size * 0.3, p.size, p.size * 0.6);
        } else {
          c2d.beginPath();
          c2d.arc(0, 0, p.size, 0, Math.PI * 2);
          c2d.fill();
        }

        c2d.restore();
      }

      if (particlesRef.current.length > 0) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        c2d.clearRect(0, 0, canvas.width, canvas.height);
      }
    };

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
  }, [canvasRef]);

  const triggerCoinBurst = useCallback((x, y) => {
    spawnParticles({
      x, y,
      count: isMobile() ? 30 : 60,
      colors: COIN_COLORS,
      minSpeed: 3, maxSpeed: 10,
      minSize: 5, maxSize: 12,
      gravity: 0.35,
      spread: Math.PI * 2,
      shape: 'coin',
    });
  }, [spawnParticles]);

  const triggerBigWinBurst = useCallback((x, y) => {
    // Coins upward
    spawnParticles({
      x, y,
      count: isMobile() ? 80 : 200,
      colors: COIN_COLORS,
      minSpeed: 5, maxSpeed: 18,
      minSize: 6, maxSize: 16,
      gravity: 0.3,
      angle: -Math.PI / 2,
      spread: Math.PI * 1.4,
      shape: 'coin',
    });
    // Confetti
    setTimeout(() => spawnParticles({
      x, y,
      count: isMobile() ? 60 : 150,
      colors: CONFETTI_COLORS,
      minSpeed: 4, maxSpeed: 14,
      minSize: 4, maxSize: 10,
      gravity: 0.2,
      spread: Math.PI * 2,
      shape: 'rect',
    }), 150);
  }, [spawnParticles]);

  const clear = useCallback(() => {
    particlesRef.current = [];
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const canvas = canvasRef?.current;
    if (canvas) {
      const c2d = canvas.getContext('2d');
      c2d?.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [canvasRef]);

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  return { triggerCoinBurst, triggerBigWinBurst, clear };
}
