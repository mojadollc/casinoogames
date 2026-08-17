import React, { useRef, useCallback, useState } from 'react';
import gsap from 'gsap';

const CHIP_VALUES = [10, 25, 50, 100, 250, 500, 1000];

export default function BetControls({
  bet = 10,
  minBet = 10,
  maxBet = 1000,
  balance = 0,
  disabled = false,
  onChange
}) {
  const minusRef = useRef(null);
  const plusRef = useRef(null);
  const displayRef = useRef(null);

  const handleMinus = useCallback(() => {
    if (disabled) return;
    const newBet = Math.max(minBet, bet - minBet);
    if (newBet !== bet) {
      onChange?.(newBet);
      // Bump animation
      gsap.fromTo(displayRef.current, { scale: 0.9 }, { scale: 1, duration: 0.2, ease: 'back.out(2)' });
    }
    // Button press
    gsap.to(minusRef.current, { scale: 0.85, duration: 0.1, ease: 'power2.out' });
    gsap.to(minusRef.current, { scale: 1, duration: 0.2, ease: 'elastic.out(1, 0.4)', delay: 0.1 });
  }, [bet, minBet, disabled, onChange]);

  const handlePlus = useCallback(() => {
    if (disabled) return;
    const newBet = Math.min(maxBet, bet + minBet, balance);
    if (newBet !== bet) {
      onChange?.(newBet);
      // Bump animation
      gsap.fromTo(displayRef.current, { scale: 1.1 }, { scale: 1, duration: 0.2, ease: 'back.out(2)' });
    }
    // Button press
    gsap.to(plusRef.current, { scale: 0.85, duration: 0.1, ease: 'power2.out' });
    gsap.to(plusRef.current, { scale: 1, duration: 0.2, ease: 'elastic.out(1, 0.4)', delay: 0.1 });
  }, [bet, minBet, maxBet, balance, disabled, onChange]);

  const handleChip = useCallback((value) => {
    if (disabled || value > balance) return;
    onChange?.(value);
    // Pop animation on display
    gsap.fromTo(displayRef.current, 
      { scale: 0.8, opacity: 0.5 }, 
      { scale: 1, opacity: 1, duration: 0.25, ease: 'back.out(3)' }
    );
  }, [disabled, balance, onChange]);

  // Filter chips based on min/max bet
  const visibleChips = CHIP_VALUES.filter(v => v >= minBet && v <= maxBet);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      marginBottom: '16px'
    }}>
      {/* Main Bet Display */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '20px',
        padding: '14px 20px',
        background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.12), rgba(255, 215, 0, 0.05))',
        borderRadius: '20px',
        border: '1px solid rgba(255, 215, 0, 0.25)'
      }}>
        {/* Minus Button */}
        <button
          ref={minusRef}
          onClick={handleMinus}
          disabled={disabled || bet <= minBet}
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            border: 'none',
            background: bet <= minBet || disabled
              ? 'linear-gradient(135deg, #1a1a2e, #0d0d1a)'
              : 'linear-gradient(135deg, #ffd700, #b8860b)',
            color: bet <= minBet || disabled ? '#333' : '#1a0a2e',
            fontSize: '26px',
            fontWeight: '900',
            cursor: bet <= minBet || disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.5 : 1,
            boxShadow: bet <= minBet || disabled
              ? 'inset 0 2px 8px rgba(0,0,0,0.4)'
              : '0 2px 10px rgba(255, 215, 0, 0.3), inset 0 1px 4px rgba(255, 255, 255, 0.3)',
            transition: 'background 0.2s ease'
          }}
        >
          −
        </button>

        {/* Bet Display */}
        <div ref={displayRef} style={{ textAlign: 'center', minWidth: '80px' }}>
          <div style={{
            fontSize: '9px',
            color: 'rgba(255, 215, 0, 0.7)',
            letterSpacing: '2px',
            fontWeight: '600',
            marginBottom: '2px'
          }}>
            BET AMOUNT
          </div>
          <div style={{
            fontSize: '32px',
            fontWeight: '900',
            color: 'var(--gold)',
            textShadow: '0 2px 8px rgba(255, 215, 0, 0.3)'
          }}>
            ₱{bet.toLocaleString()}
          </div>
        </div>

        {/* Plus Button */}
        <button
          ref={plusRef}
          onClick={handlePlus}
          disabled={disabled || bet >= maxBet || bet >= balance}
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            border: 'none',
            background: bet >= maxBet || bet >= balance || disabled
              ? 'linear-gradient(135deg, #1a1a2e, #0d0d1a)'
              : 'linear-gradient(135deg, #ffd700, #b8860b)',
            color: bet >= maxBet || bet >= balance || disabled ? '#333' : '#1a0a2e',
            fontSize: '26px',
            fontWeight: '900',
            cursor: bet >= maxBet || bet >= balance || disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.5 : 1,
            boxShadow: bet >= maxBet || bet >= balance || disabled
              ? 'inset 0 2px 8px rgba(0,0,0,0.4)'
              : '0 2px 10px rgba(255, 215, 0, 0.3), inset 0 1px 4px rgba(255, 255, 255, 0.3)',
            transition: 'background 0.2s ease'
          }}
        >
          +
        </button>
      </div>

      {/* Quick Bet Chips */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '8px',
        flexWrap: 'wrap'
      }}>
        {visibleChips.slice(0, 6).map(value => {
          const isSelected = bet === value;
          const isDisabled = disabled || value > balance;
          
          return (
            <Chip
              key={value}
              value={value}
              selected={isSelected}
              disabled={isDisabled}
              onClick={() => handleChip(value)}
            />
          );
        })}
      </div>
    </div>
  );
}

function Chip({ value, selected, disabled, onClick }) {
  const ref = useRef(null);

  const handlePointerDown = useCallback(() => {
    if (disabled) return;
    gsap.to(ref.current, { scale: 0.9, duration: 0.1 });
  }, [disabled]);

  const handlePointerUp = useCallback(() => {
    gsap.to(ref.current, { scale: 1, duration: 0.2, ease: 'elastic.out(1, 0.5)' });
  }, []);

  return (
    <button
      ref={ref}
      onClick={onClick}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      disabled={disabled}
      style={{
        padding: '10px 16px',
        borderRadius: '14px',
        border: selected ? 'none' : '1px solid rgba(255, 215, 0, 0.25)',
        background: selected
          ? 'linear-gradient(135deg, #ffd700, #b8860b)'
          : disabled
            ? 'rgba(30, 30, 50, 0.5)'
            : 'rgba(255, 215, 0, 0.08)',
        color: selected
          ? '#1a0a2e'
          : disabled
            ? 'rgba(255, 215, 0, 0.25)'
            : 'var(--gold)',
        fontWeight: '700',
        fontSize: '13px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        boxShadow: selected
          ? '0 2px 12px rgba(255, 215, 0, 0.4), inset 0 1px 3px rgba(255, 255, 255, 0.3)'
          : 'none',
        transition: 'all 0.2s ease',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Shine effect for selected */}
      {selected && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: '-100%',
          width: '100%',
          height: '100%',
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
          animation: 'chipShine 2s infinite'
        }} />
      )}
      ₱{value.toLocaleString()}
    </button>
  );
}
