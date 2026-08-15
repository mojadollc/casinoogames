import React, { useRef, useEffect, useCallback } from 'react';
import { gsap } from 'gsap';
import WinCounter from './WinCounter';
import useParticles from './useParticles';

/**
 * Props:
 *   amount    — win amount (number)
 *   bet       — bet amount, used to classify win tier
 *   onClose   — callback when overlay dismisses
 */
export default function BigWinOverlay({ amount, bet, onClose }) {
  const overlayRef = useRef(null);
  const titleRef = useRef(null);
  const subRef = useRef(null);
  const canvasRef = useRef(null);
  const autoCloseRef = useRef(null);
  const { triggerBigWinBurst } = useParticles(canvasRef);

  const multiplier = bet > 0 ? amount / bet : 0;
  const isMega = multiplier >= 50;
  const isSuper = multiplier >= 25;

  const label = isMega ? '💎 MEGA WIN 💎' : isSuper ? '🌟 SUPER WIN 🌟' : '🎉 BIG WIN 🎉';
  const accentColor = isMega ? '#00F5D4' : '#FFD700';

  const dismiss = useCallback(() => {
    if (autoCloseRef.current) clearTimeout(autoCloseRef.current);
    if (!overlayRef.current) { onClose?.(); return; }
    gsap.to(overlayRef.current, {
      opacity: 0, scale: 1.05, duration: 0.35, ease: 'power2.in',
      onComplete: onClose,
    });
  }, [onClose]);

  useEffect(() => {
    const overlay = overlayRef.current;
    const title = titleRef.current;
    const sub = subRef.current;
    if (!overlay || !title) return;

    // Entrance sequence
    const tl = gsap.timeline();

    // 1. Backdrop fades in
    tl.fromTo(overlay,
      { opacity: 0 },
      { opacity: 1, duration: 0.25, ease: 'power2.out' }
    );

    // 2. Title slams in from above with elastic bounce
    tl.fromTo(title,
      { y: -120, scale: 0.4, opacity: 0, rotationX: 45 },
      { y: 0, scale: 1, opacity: 1, rotationX: 0, duration: 0.6, ease: 'elastic.out(1, 0.5)' },
      '-=0.05'
    );

    // 3. Sub-label fades up
    if (sub) {
      tl.fromTo(sub,
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.3, ease: 'power2.out' },
        '-=0.3'
      );
    }

    // 4. Fire particles after title lands
    tl.call(() => {
      triggerBigWinBurst(window.innerWidth / 2, window.innerHeight * 0.45);
    }, null, '-=0.1');

    // Auto-dismiss after 5s
    autoCloseRef.current = setTimeout(dismiss, 5000);

    return () => {
      tl.kill();
      if (autoCloseRef.current) clearTimeout(autoCloseRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={overlayRef}
      onClick={dismiss}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(ellipse at center, rgba(20,5,40,0.97) 0%, rgba(5,1,13,0.99) 100%)',
        cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      {/* Particle canvas — full screen, behind content */}
      <canvas
        ref={canvasRef}
        width={window.innerWidth}
        height={window.innerHeight}
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* Radial glow behind text */}
      <div style={{
        position: 'absolute',
        width: 400,
        height: 400,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${accentColor}22 0%, transparent 70%)`,
        animation: 'bigWinPulse 1.2s ease-in-out infinite',
        pointerEvents: 'none',
        zIndex: 1,
      }} />

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 2, textAlign: 'center', padding: '0 24px' }}>
        {/* WIN label */}
        <div
          ref={titleRef}
          style={{
            fontSize: isMega ? 52 : 44,
            fontWeight: 900,
            letterSpacing: 4,
            textTransform: 'uppercase',
            background: isMega
              ? 'linear-gradient(135deg, #00F5D4, #FFD700, #FF2D75, #00F5D4)'
              : 'linear-gradient(135deg, #FFD700, #FFED4A, #FFB300, #FFD700)',
            backgroundSize: '300% 300%',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: `drop-shadow(0 0 30px ${accentColor})`,
            animation: 'bigWinShine 2s linear infinite',
            marginBottom: 8,
            transformOrigin: 'center',
          }}
        >
          {label}
        </div>

        {/* Amount counter */}
        <div style={{ marginTop: 16, marginBottom: 12 }}>
          <WinCounter amount={amount} large />
        </div>

        {/* Multiplier badge */}
        <div
          ref={subRef}
          style={{
            display: 'inline-block',
            padding: '6px 20px',
            borderRadius: 20,
            background: `rgba(255,215,0,0.15)`,
            border: `1px solid ${accentColor}88`,
            color: accentColor,
            fontSize: 16,
            fontWeight: 700,
            marginBottom: 32,
          }}
        >
          {multiplier.toFixed(1)}× your bet
        </div>

        {/* Tap to continue */}
        <div style={{
          color: 'rgba(255,255,255,0.45)',
          fontSize: 13,
          letterSpacing: 2,
          textTransform: 'uppercase',
          animation: 'bigWinBlink 1.5s ease-in-out infinite',
        }}>
          Tap anywhere to continue
        </div>
      </div>

      <style>{`
        @keyframes bigWinPulse {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.3); opacity: 1; }
        }
        @keyframes bigWinShine {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes bigWinBlink {
          0%, 100% { opacity: 0.45; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
