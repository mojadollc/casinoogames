import React, { useRef, useEffect, useCallback } from 'react';
import gsap from 'gsap';

export default function SpinButton({ 
  onClick, 
  disabled = false, 
  spinning = false,
  balance = 0,
  bet = 10
}) {
  const buttonRef = useRef(null);
  const glowRef = useRef(null);
  const iconRef = useRef(null);
  const timelineRef = useRef(null);

  const canSpin = !disabled && !spinning && balance >= bet && balance > 0;

  // Idle pulse animation when ready
  useEffect(() => {
    if (!buttonRef.current) return;
    
    if (canSpin && !spinning) {
      // Gentle pulse glow
      timelineRef.current = gsap.timeline({ repeat: -1, yoyo: true });
      timelineRef.current.to(glowRef.current, {
        opacity: 0.8,
        scale: 1.1,
        duration: 1.2,
        ease: 'sine.inOut'
      });
    } else {
      timelineRef.current?.kill();
      gsap.set(glowRef.current, { opacity: 0.3, scale: 1 });
    }

    return () => {
      timelineRef.current?.kill();
    };
  }, [canSpin, spinning]);

  // Spinning animation
  useEffect(() => {
    if (!iconRef.current) return;
    
    if (spinning) {
      gsap.to(iconRef.current, {
        rotation: 360,
        duration: 0.8,
        ease: 'none',
        repeat: -1
      });
    } else {
      gsap.killTweensOf(iconRef.current);
      gsap.set(iconRef.current, { rotation: 0 });
    }

    return () => {
      gsap.killTweensOf(iconRef.current);
    };
  }, [spinning]);

  const handlePointerDown = useCallback(() => {
    if (!canSpin) return;
    
    gsap.to(buttonRef.current, {
      scale: 0.92,
      duration: 0.1,
      ease: 'power2.out'
    });
    gsap.to(glowRef.current, {
      scale: 0.95,
      opacity: 1,
      duration: 0.1,
      ease: 'power2.out'
    });
  }, [canSpin]);

  const handlePointerUp = useCallback(() => {
    gsap.to(buttonRef.current, {
      scale: 1,
      duration: 0.3,
      ease: 'elastic.out(1, 0.4)'
    });
    gsap.to(glowRef.current, {
      scale: 1,
      duration: 0.3,
      ease: 'elastic.out(1, 0.4)'
    });
  }, []);

  const handleClick = useCallback(() => {
    if (canSpin) {
      // Quick flash on click
      gsap.fromTo(buttonRef.current, 
        { filter: 'brightness(1.5)' },
        { filter: 'brightness(1)', duration: 0.2 }
      );
      onClick?.();
    }
  }, [canSpin, onClick]);

  const handleMouseEnter = useCallback(() => {
    if (!canSpin) return;
    gsap.to(buttonRef.current, {
      scale: 1.05,
      duration: 0.2,
      ease: 'power2.out'
    });
  }, [canSpin]);

  const handleMouseLeave = useCallback(() => {
    gsap.to(buttonRef.current, {
      scale: 1,
      duration: 0.2,
      ease: 'power2.out'
    });
  }, []);

  return (
    <button
      ref={buttonRef}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={() => {
        handlePointerUp();
        handleMouseLeave();
      }}
      onMouseEnter={handleMouseEnter}
      disabled={!canSpin}
      style={{
        position: 'relative',
        width: '100px',
        height: '100px',
        borderRadius: '50%',
        border: 'none',
        cursor: canSpin ? 'pointer' : 'not-allowed',
        background: canSpin
          ? 'linear-gradient(135deg, #ffd700, #ffed4a, #ffd700)'
          : 'linear-gradient(135deg, #2a1a4a, #1a0a2e)',
        boxShadow: canSpin
          ? '0 4px 20px rgba(255, 215, 0, 0.4), inset 0 2px 10px rgba(255, 255, 255, 0.3)'
          : 'inset 0 2px 10px rgba(0, 0, 0, 0.3)',
        padding: 0,
        overflow: 'visible',
        transition: 'background 0.3s ease'
      }}
    >
      {/* Outer glow */}
      <div
        ref={glowRef}
        style={{
          position: 'absolute',
          inset: -8,
          borderRadius: '50%',
          background: canSpin
            ? 'radial-gradient(circle, rgba(255, 215, 0, 0.5) 0%, transparent 70%)'
            : 'none',
          pointerEvents: 'none',
          opacity: 0.5
        }}
      />

      {/* Inner ring */}
      <div style={{
        position: 'absolute',
        inset: 3,
        borderRadius: '50%',
        border: canSpin ? '3px solid rgba(255, 255, 255, 0.5)' : '3px solid rgba(255, 255, 255, 0.1)'
      }} />

      {/* Content */}
      <div
        ref={iconRef}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          fontSize: canSpin ? '18px' : '24px',
          fontWeight: '900',
          color: canSpin ? '#1a0a2e' : '#444',
          textTransform: 'uppercase',
          letterSpacing: '2px',
          textShadow: canSpin ? '0 1px 2px rgba(255, 255, 255, 0.5)' : 'none'
        }}
      >
        {spinning ? '🎰' : 'SPIN'}
      </div>
    </button>
  );
}
