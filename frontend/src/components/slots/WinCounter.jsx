import React, { useRef, useEffect, useState } from 'react';
import { gsap } from 'gsap';

/**
 * Props:
 *   amount   — final win amount (number)
 *   large    — boolean: big win style vs small win style
 *   onDone   — callback when count finishes
 */
export default function WinCounter({ amount, large = false, onDone }) {
  const [display, setDisplay] = useState(0);
  const objRef = useRef({ val: 0 });
  const elRef = useRef(null);

  useEffect(() => {
    if (!amount) return;
    objRef.current.val = 0;
    setDisplay(0);

    // Duration scales with amount size — bigger wins count longer for drama
    const duration = large
      ? Math.min(3.5, 1.5 + amount / 5000)
      : Math.min(1.5, 0.6 + amount / 2000);

    const tween = gsap.to(objRef.current, {
      val: amount,
      duration,
      ease: large ? 'power2.out' : 'power1.out',
      onUpdate() {
        setDisplay(Math.floor(objRef.current.val));
      },
      onComplete() {
        setDisplay(amount);
        // Punch scale on finish
        if (elRef.current) {
          gsap.fromTo(elRef.current,
            { scale: 1 },
            { scale: large ? 1.25 : 1.1, duration: 0.15, yoyo: true, repeat: 1, ease: 'power2.out',
              onComplete: () => onDone?.() }
          );
        } else {
          onDone?.();
        }
      },
    });

    return () => tween.kill();
  }, [amount, large]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={elRef}
      style={{
        display: 'inline-block',
        transformOrigin: 'center',
        fontVariantNumeric: 'tabular-nums',
        fontSize: large ? 48 : 28,
        fontWeight: 900,
        letterSpacing: large ? 2 : 1,
        background: 'linear-gradient(135deg, #FFD700, #FFED4A, #FFD700)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        filter: `drop-shadow(0 0 ${large ? 20 : 10}px rgba(255,215,0,0.7))`,
        lineHeight: 1,
      }}
    >
      ₱{display.toLocaleString()}
    </div>
  );
}
