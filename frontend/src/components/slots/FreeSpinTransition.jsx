import React, { useEffect, useRef, useCallback } from 'react';
import gsap from 'gsap';

export default function FreeSpinTransition({ 
  spinsAwarded = 0, 
  onComplete,
  skipAllowed = true 
}) {
  const containerRef = useRef(null);
  const overlayRef = useRef(null);
  const flashRef = useRef(null);
  const titleRef = useRef(null);
  const spinsRef = useRef(null);
  const subRef = useRef(null);
  const particlesRef = useRef(null);
  const timelineRef = useRef(null);

  const skip = useCallback(() => {
    if (skipAllowed && timelineRef.current) {
      timelineRef.current.timeScale(3);
    }
  }, [skipAllowed]);

  useEffect(() => {
    if (!containerRef.current) return;

    const tl = gsap.timeline({
      onComplete: () => {
        if (onComplete) onComplete();
      }
    });
    timelineRef.current = tl;

    // Create particles
    const particles = [];
    const palette = ['#38d9ff', '#00f5d4', '#ffd700', '#ffffff', '#ff7f50'];
    const container = particlesRef.current;
    
    for (let i = 0; i < 50; i++) {
      const particle = document.createElement('div');
      particle.style.cssText = `
        position: absolute;
        width: ${4 + Math.random() * 6}px;
        height: ${4 + Math.random() * 6}px;
        background: ${palette[i % palette.length]};
        border-radius: 50%;
        left: 50%;
        top: 50%;
        opacity: 0;
        pointer-events: none;
      `;
      container.appendChild(particle);
      particles.push({
        el: particle,
        angle: (i / 50) * Math.PI * 2,
        distance: 150 + Math.random() * 200,
        duration: 0.8 + Math.random() * 0.4
      });
    }

    // Phase 1: Darken overlay (0-0.3s)
    tl.set(overlayRef.current, { opacity: 0 });
    tl.to(overlayRef.current, {
      opacity: 1,
      duration: 0.3,
      ease: 'power2.out'
    });

    // Phase 2: Radial flash (0.2-0.5s)
    tl.set(flashRef.current, { scale: 0, opacity: 0.8 });
    tl.to(flashRef.current, {
      scale: 3,
      opacity: 0,
      duration: 0.4,
      ease: 'power2.out'
    }, 0.2);

    // Phase 3: Title zoom in with overshoot (0.3-0.7s)
    tl.set(titleRef.current, { scale: 0, opacity: 0 });
    tl.to(titleRef.current, {
      scale: 1,
      opacity: 1,
      duration: 0.4,
      ease: 'back.out(2.5)'
    }, 0.3);

    // Phase 4: Spins count with bounce (0.5-0.9s)
    tl.set(spinsRef.current, { scale: 0, opacity: 0 });
    tl.to(spinsRef.current, {
      scale: 1.2,
      opacity: 1,
      duration: 0.35,
      ease: 'back.out(3)'
    }, 0.5);
    tl.to(spinsRef.current, {
      scale: 1,
      duration: 0.2,
      ease: 'power2.out'
    }, 0.85);

    // Phase 5: Subtitle fade (0.7-0.9s)
    tl.set(subRef.current, { opacity: 0, y: 20 });
    tl.to(subRef.current, {
      opacity: 1,
      y: 0,
      duration: 0.25,
      ease: 'power2.out'
    }, 0.7);

    // Phase 6: Particle burst (0.4-1.2s)
    particles.forEach((p, i) => {
      const x = Math.cos(p.angle) * p.distance;
      const y = Math.sin(p.angle) * p.distance;
      tl.to(p.el, {
        x: x,
        y: y,
        opacity: 0,
        duration: p.duration,
        ease: 'power2.out'
      }, 0.4 + i * 0.005);
    });

    // Phase 7: Hold and pulse (1.2-2.5s)
    tl.to(titleRef.current, {
      scale: 1.05,
      duration: 0.3,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: 3
    }, 1.2);

    // Phase 8: Fade out (2.5-2.9s)
    tl.to([overlayRef.current, titleRef.current, spinsRef.current, subRef.current], {
      opacity: 0,
      duration: 0.4,
      ease: 'power2.in'
    }, 2.5);

    // Cleanup particles
    tl.add(() => {
      particles.forEach(p => p.el.remove());
    }, 2.9);

    return () => {
      tl.kill();
      particles.forEach(p => p.el.remove());
    };
  }, [onComplete]);

  return (
    <div 
      ref={containerRef}
      onClick={skip}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: skipAllowed ? 'pointer' : 'default'
      }}
    >
      {/* Dark overlay */}
      <div 
        ref={overlayRef}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at center, rgba(0,0,0,0.85), rgba(0,0,0,0.98))',
          opacity: 0
        }}
      />

      {/* Radial flash */}
      <div 
        ref={flashRef}
        style={{
          position: 'absolute',
          width: 200,
          height: 200,
          background: 'radial-gradient(circle, rgba(56,217,255,0.9) 0%, rgba(56,217,255,0) 70%)',
          borderRadius: '50%',
          pointerEvents: 'none'
        }}
      />

      {/* Content container */}
      <div style={{
        position: 'relative',
        textAlign: 'center',
        zIndex: 1
      }}>
        {/* Title */}
        <div 
          ref={titleRef}
          style={{
            fontSize: '52px',
            fontWeight: '900',
            fontFamily: 'Arial Black, sans-serif',
            background: 'linear-gradient(135deg, #38d9ff, #00f5d4)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textShadow: '0 0 40px rgba(56,217,255,0.5)',
            letterSpacing: '4px',
            textTransform: 'uppercase',
            marginBottom: '20px'
          }}
        >
          🎁 FREE SPINS 🎁
        </div>

        {/* Spins count */}
        <div 
          ref={spinsRef}
          style={{
            fontSize: '72px',
            fontWeight: '900',
            fontFamily: 'Arial Black, sans-serif',
            color: '#ffd700',
            textShadow: '0 0 30px rgba(255,215,0,0.8), 0 4px 20px rgba(0,0,0,0.5)',
            marginBottom: '16px'
          }}
        >
          {spinsAwarded}
        </div>

        {/* Subtitle */}
        <div 
          ref={subRef}
          style={{
            fontSize: '24px',
            fontWeight: '700',
            color: '#00f5d4',
            letterSpacing: '2px'
          }}
        >
          {spinsAwarded === 1 ? 'FREE SPIN AWARDED!' : 'FREE SPINS AWARDED!'}
        </div>
      </div>

      {/* Particles container */}
      <div 
        ref={particlesRef}
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          overflow: 'hidden'
        }}
      />

      {/* Skip hint */}
      {skipAllowed && (
        <div style={{
          position: 'absolute',
          bottom: '40px',
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: '14px',
          color: 'rgba(255,255,255,0.5)',
          letterSpacing: '1px'
        }}>
          TAP TO SKIP
        </div>
      )}
    </div>
  );
}
