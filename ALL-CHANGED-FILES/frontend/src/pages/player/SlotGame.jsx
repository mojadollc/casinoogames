import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { gameAPI, walletAPI } from '../../services/api';

// Symbol definitions — MUST match game-engine/engine.js DEFAULT_CONFIG ids
const SYMBOLS = {
  wild:    { icon: '🐉', color: '#ffd700', value: 100, name: 'Wild' },
  scatter: { icon: '💎', color: '#00f5d4', value: 25,  name: 'Scatter' },
  seven:   { icon: '7️⃣', color: '#ff2d75', value: 75,  name: 'Seven' },
  bar:     { icon: '📊', color: '#cd7f32', value: 40,  name: 'Bar' },
  bell:    { icon: '🔔', color: '#ffd700', value: 25,  name: 'Bell' },
  cherry:  { icon: '🍒', color: '#ff2d75', value: 18,  name: 'Cherry' },
  lemon:   { icon: '🍋', color: '#fee440', value: 10,  name: 'Lemon' },
  orange:  { icon: '🍊', color: '#ff9f1c', value: 10,  name: 'Orange' },
  plum:    { icon: '🟣', color: '#9b59b6', value: 7,   name: 'Plum' },
  grape:   { icon: '🍇', color: '#8e44ad', value: 7,   name: 'Grape' }
};

const SYMBOL_KEYS = Object.keys(SYMBOLS);

// Audio context
let audioContext = null;
const getAudioContext = () => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
};

const playSound = (type) => {
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);

  if (type === 'spin') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  } else if (type === 'stop') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.1);
  } else if (type === 'win') {
    [523, 659, 784, 1047].forEach((freq, i) => {
      setTimeout(() => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g);
        g.connect(ctx.destination);
        o.type = 'sine';
        o.frequency.setValueAtTime(freq, ctx.currentTime);
        g.gain.setValueAtTime(0.2, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        o.start(ctx.currentTime);
        o.stop(ctx.currentTime + 0.3);
      }, i * 100);
    });
  } else if (type === 'bigwin') {
    for (let i = 0; i < 12; i++) {
      setTimeout(() => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g);
        g.connect(ctx.destination);
        o.type = 'square';
        o.frequency.setValueAtTime(400 + i * 80, ctx.currentTime);
        g.gain.setValueAtTime(0.1, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        o.start(ctx.currentTime);
        o.stop(ctx.currentTime + 0.1);
      }, i * 60);
    }
  }
};

export default function SlotGame() {
  const { slug } = useParams();
  const navigate = useNavigate();
  
  const [game, setGame] = useState(null);
  const [balance, setBalance] = useState(0);
  const [bet, setBet] = useState(10);
  const [reels, setReels] = useState(Array(5).fill(null).map(() => Array(3).fill('cherry')));
  const [spinning, setSpinning] = useState(false);
  const [reelStates, setReelStates] = useState([true, true, true, true, true]);
  const [lastWin, setLastWin] = useState(0);
  const [freeSpins, setFreeSpins] = useState(0);
  const [message, setMessage] = useState('');
  const [winningLines, setWinningLines] = useState([]);
  const [showBigWin, setShowBigWin] = useState(false);
  const [autoSpin, setAutoSpin] = useState(false);
  const [showPaytable, setShowPaytable] = useState(false);

  useEffect(() => {
    walletAPI.balance().then(({ data }) => setBalance(Number(data.balance) || 0)).catch(() => {});
    gameAPI.details(slug).then(({ data }) => {
      setGame(data);
      setBet(Number(data.min_bet));
      // Initialize reels with random symbols
      const initialReels = Array(5).fill(null).map(() => 
        Array(3).fill(null).map(() => SYMBOL_KEYS[Math.floor(Math.random() * SYMBOL_KEYS.length)])
      );
      setReels(initialReels);
      setReelStates([false, false, false, false, false]);
    }).catch(() => navigate('/'));
  }, [slug, navigate]);

  // Auto spin
  useEffect(() => {
    if (autoSpin && !spinning && balance >= bet) {
      const timer = setTimeout(() => spin(), 1000);
      return () => clearTimeout(timer);
    } else if (autoSpin && (spinning || balance < bet)) {
      setAutoSpin(false);
    }
  }, [autoSpin, spinning, balance, bet]);

  const spinReels = async (finalReels) => {
    setSpinning(true);
    setWinningLines([]);
    setLastWin(0);
    setMessage('');
    setShowBigWin(false);
    
    playSound('spin');

    // Animate each reel stopping sequentially
    for (let i = 0; i < 5; i++) {
      setReelStates(prev => prev.map((s, idx) => idx <= i ? false : true));
      
      // Spin this reel
      const spinInterval = setInterval(() => {
        setReels(prev => {
          const newReels = [...prev];
          newReels[i] = [
            SYMBOL_KEYS[Math.floor(Math.random() * SYMBOL_KEYS.length)],
            SYMBOL_KEYS[Math.floor(Math.random() * SYMBOL_KEYS.length)],
            SYMBOL_KEYS[Math.floor(Math.random() * SYMBOL_KEYS.length)]
          ];
          return newReels;
        });
      }, 50);

      await new Promise(r => setTimeout(r, 200 + i * 150));
      clearInterval(spinInterval);
      
      // Set final symbols for this reel
      setReels(prev => {
        const newReels = [...prev];
        newReels[i] = finalReels[i];
        return newReels;
      });
      
      playSound('stop');
      await new Promise(r => setTimeout(r, 100));
    }

    setSpinning(false);
    setReelStates([false, false, false, false, false]);
  };

  // Convert backend grid [{id,name}, ...] columns into string-id reels
  const normalizeGrid = (grid) => {
    if (!grid || !Array.isArray(grid)) return generateRandomReels();
    return grid.map(col =>
      (col || []).map(cell => {
        if (typeof cell === 'string') return cell;
        if (cell && cell.id) return cell.id;
        return 'cherry';
      })
    );
  };

  const spin = async () => {
    if (spinning || balance < bet) return;

    try {
      const { data } = await gameAPI.spin(game.id, bet);
      const finalGrid = normalizeGrid(data.grid);
      await spinReels(finalGrid);
      
      setBalance(data.balance ?? data.newBalance ?? balance);
      setLastWin(data.totalWin || 0);

      if (data.totalWin > 0) {
        if (data.totalWin >= bet * 25) {
          setShowBigWin(true);
          playSound('bigwin');
          setMessage(`🌟 BIG WIN! ₱${data.totalWin.toLocaleString()}! 🌟`);
        } else if (data.totalWin >= bet * 10) {
          playSound('win');
          setMessage(`⭐ NICE WIN! ₱${data.totalWin.toLocaleString()}! ⭐`);
        } else {
          playSound('win');
          setMessage(`🎉 Win! ₱${data.totalWin.toLocaleString()}`);
        }
        
        // Highlight winning paylines from engine response when available
        if (data.paylineWins && data.paylineWins.length > 0) {
          setWinningLines(data.paylineWins.map(w => w.payline));
        } else if (data.grid) {
          setWinningLines([[0, 1, 2, 3, 4]]);
        }
      }

      if (data.freeSpinsAwarded > 0) {
        setFreeSpins(prev => prev + data.freeSpinsAwarded);
        setMessage(prev => (prev || '') + ` 🎁 +${data.freeSpinsAwarded} Free Spins!`);
      }
    } catch (err) {
      setMessage(err.response?.data?.error || 'Spin failed');
      setSpinning(false);
    }
  };

  const generateRandomReels = () => {
    return Array(5).fill(null).map(() => 
      Array(3).fill(null).map(() => SYMBOL_KEYS[Math.floor(Math.random() * SYMBOL_KEYS.length)])
    );
  };

  const useFreeSpin = async () => {
    if (spinning || freeSpins <= 0) return;
    
    setFreeSpins(prev => prev - 1);
    try {
      const { data } = await gameAPI.freeSpin(game.id);
      const finalGrid = normalizeGrid(data.grid);
      await spinReels(finalGrid);
      setBalance(data.balance ?? data.newBalance ?? balance);
      setLastWin(data.totalWin || 0);
      setFreeSpins(data.freeSpinsRemaining ?? Math.max(0, freeSpins - 1));
      
      if (data.totalWin > 0) {
        playSound('win');
        setMessage(`🎁 Free Spin Win! ₱${data.totalWin.toLocaleString()}`);
      }
      if (data.freeSpinsAwarded > 0) {
        setFreeSpins(prev => prev + data.freeSpinsAwarded);
      }
    } catch (err) {
      setMessage(err.response?.data?.error || 'Free spin failed');
      setSpinning(false);
    }
  };

  if (!game) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #0a001a 0%, #1a0a30 40%, #0a001a 100%)',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background Effects */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(circle at 50% 30%, rgba(255, 215, 0, 0.05) 0%, transparent 50%)',
        pointerEvents: 'none'
      }} />

      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
        padding: '12px 16px',
        background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.1), rgba(255, 215, 0, 0.05))',
        borderRadius: '16px',
        border: '1px solid rgba(255, 215, 0, 0.3)'
      }}>
        <button onClick={() => navigate('/')} style={{
          background: 'linear-gradient(135deg, #ffd700, #b8860b)',
          border: 'none',
          borderRadius: '10px',
          padding: '10px 16px',
          color: '#1a0a2e',
          fontWeight: '800',
          fontSize: '13px',
          cursor: 'pointer'
        }}>
          <Link to="/" style={{ color: '#1a0a2e', textDecoration: 'none', fontWeight: '800', fontSize: '13px' }}>← Home</Link>
        </button>
        
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '10px', color: 'var(--gold)', opacity: 0.8, letterSpacing: '1px' }}>BALANCE</div>
          <div style={{
            fontSize: '22px',
            fontWeight: '900',
            background: 'linear-gradient(135deg, #ffd700, #ffed4a)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>₱{balance.toLocaleString('en', { minimumFractionDigits: 2 })}</div>
        </div>

        <button onClick={() => navigate('/wallet')} style={{
          background: 'linear-gradient(135deg, #00f5d4, #00d4aa)',
          border: 'none',
          borderRadius: '10px',
          padding: '10px 16px',
          color: '#0a001a',
          fontWeight: '800',
          fontSize: '13px',
          cursor: 'pointer'
        }}>Deposit</button>
      </div>

      {/* Game Title */}
      <div style={{ textAlign: 'center', marginBottom: '16px' }}>
        <h1 style={{
          fontSize: '28px',
          fontWeight: '900',
          background: 'linear-gradient(135deg, #ffd700, #ffed4a, #ffd700)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          letterSpacing: '3px',
          textTransform: 'uppercase'
        }}>🐉 {game.name} 🐉</h1>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '8px' }}>
          <span style={{
            padding: '4px 12px',
            background: 'rgba(255, 215, 0, 0.15)',
            borderRadius: '12px',
            fontSize: '11px',
            color: 'var(--gold)',
            fontWeight: '600'
          }}>RTP {game.rtp}%</span>
          <span style={{
            padding: '4px 12px',
            background: 'rgba(0, 245, 212, 0.15)',
            borderRadius: '12px',
            fontSize: '11px',
            color: '#00f5d4',
            fontWeight: '600'
          }}>₱{game.min_bet} - ₱{game.max_bet}</span>
        </div>
      </div>

      {/* Slot Machine */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative'
      }}>
        {/* Jackpot Display */}
        <div style={{
          textAlign: 'center',
          marginBottom: '16px',
          padding: '12px',
          background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.2), rgba(255, 215, 0, 0.1))',
          borderRadius: '16px',
          border: '2px solid rgba(255, 215, 0, 0.4)'
        }}>
          <div style={{ fontSize: '10px', color: 'var(--gold)', letterSpacing: '2px', marginBottom: '4px' }}>
            🏆 PROGRESSIVE JACKPOT 🏆
          </div>
          <div style={{
            fontSize: '32px',
            fontWeight: '900',
            background: 'linear-gradient(135deg, #ffd700, #ffed4a, #ffd700)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            animation: 'pulse 2s ease-in-out infinite'
          }}>
            ₱1,234,567.89
          </div>
        </div>

        {/* Reels Container */}
        <div style={{
          flex: 1,
          padding: '24px 12px',
          background: 'linear-gradient(145deg, #12082a, #1a0a35)',
          borderRadius: '24px',
          border: '3px solid',
          borderImage: 'linear-gradient(135deg, #ffd700, #b8860b, #ffd700) 1',
          position: 'relative',
          marginBottom: '16px'
        }}>
          {/* Win Line Indicator */}
          <div style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: '50%',
            height: '4px',
            background: 'linear-gradient(90deg, transparent, var(--gold), transparent)',
            transform: 'translateY(-50%)',
            boxShadow: '0 0 20px rgba(255, 215, 0, 0.5)'
          }} />

          {/* Reels */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '6px',
            position: 'relative',
            zIndex: 1
          }}>
            {reels && reels.map((col, ci) => (
              <div key={ci} style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                padding: '8px 4px',
                background: 'linear-gradient(180deg, rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.3))',
                borderRadius: '12px',
                transition: 'transform 0.2s'
              }}>
                {col && col.map((symKey, ri) => {
                  const sym = SYMBOLS[symKey] || SYMBOLS.cherry;
                  const isWinning = winningLines.some(line => line && line[ci] === ri);
                  const isSpinning = reelStates[ci];

                  return (
                    <div key={ri} style={{
                      width: '64px',
                      height: '64px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '38px',
                      borderRadius: '10px',
                      background: isWinning
                        ? `linear-gradient(145deg, ${sym.color}40, ${sym.color}20)`
                        : 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))',
                      border: isWinning ? `2px solid ${sym.color}` : '2px solid rgba(255, 255, 255, 0.1)',
                      boxShadow: isWinning ? `0 0 15px ${sym.color}, inset 0 0 10px ${sym.color}30` : 'none',
                      animation: isSpinning ? 'symbolSpin 0.08s linear infinite' : isWinning ? 'winPulse 0.4s ease infinite' : 'none',
                      filter: isWinning ? `drop-shadow(0 0 8px ${sym.color})` : 'none',
                      transition: 'all 0.3s'
                    }}>
                      {sym.icon}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Machine Frame Decorations */}
          <div style={{
            position: 'absolute',
            top: '8px',
            left: '8px',
            fontSize: '24px',
            opacity: 0.3
          }}>🐉</div>
          <div style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            fontSize: '24px',
            opacity: 0.3,
            transform: 'scaleX(-1)'
          }}>🐉</div>
        </div>

        {/* Win Display */}
        {lastWin > 0 && (
          <div style={{
            textAlign: 'center',
            marginBottom: '16px',
            padding: '16px',
            background: 'rgba(255, 215, 0, 0.2)',
            borderRadius: '16px',
            border: '2px solid var(--gold)',
            animation: 'winPop 0.5s ease-out'
          }}>
            <div style={{
              fontSize: showBigWin ? '36px' : '28px',
              fontWeight: '900',
              background: 'linear-gradient(135deg, #ffd700, #ffed4a, #ffd700)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              🎉 ₱{lastWin.toLocaleString()} 🎉
            </div>
            {!showBigWin && <div style={{ color: 'var(--gold)', fontSize: '12px', marginTop: '4px' }}>{message}</div>}
          </div>
        )}

        {/* Message */}
        {message && lastWin === 0 && (
          <div style={{
            textAlign: 'center',
            marginBottom: '16px',
            color: message.includes('Win') || message.includes('WIN') ? 'var(--gold)' : 'rgba(255, 255, 255, 0.7)',
            fontSize: '16px',
            fontWeight: '700'
          }}>{message}</div>
        )}

        {/* Bet Controls */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          marginBottom: '16px',
          padding: '12px',
          background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.1), rgba(255, 215, 0, 0.05))',
          borderRadius: '16px',
          border: '1px solid rgba(255, 215, 0, 0.3)'
        }}>
          <button onClick={() => setBet(Math.max(Number(game.min_bet), bet - Number(game.min_bet)))} disabled={spinning} style={{
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #ffd700, #b8860b)',
            border: 'none',
            color: '#1a0a2e',
            fontSize: '22px',
            fontWeight: '900',
            cursor: spinning ? 'not-allowed' : 'pointer',
            opacity: spinning ? 0.5 : 1
          }}>−</button>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '10px', color: 'rgba(255, 215, 0, 0.8)', letterSpacing: '1px' }}>BET</div>
            <div style={{
              fontSize: '28px',
              fontWeight: '900',
              color: 'var(--gold)'
            }}>₱{bet}</div>
          </div>

          <button onClick={() => setBet(Math.min(Number(game.max_bet), bet + Number(game.min_bet)))} disabled={spinning || bet + Number(game.min_bet) > balance} style={{
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #ffd700, #b8860b)',
            border: 'none',
            color: '#1a0a2e',
            fontSize: '22px',
            fontWeight: '900',
            cursor: spinning || bet + Number(game.min_bet) > balance ? 'not-allowed' : 'pointer',
            opacity: spinning || bet + Number(game.min_bet) > balance ? 0.3 : 1
          }}>+</button>
        </div>

        {/* Quick Bet Chips */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '8px',
          marginBottom: '16px',
          flexWrap: 'wrap'
        }}>
          {[10, 50, 100, 500, 1000].filter(v => v >= Number(game.min_bet) && v <= Number(game.max_bet)).map(v => (
            <button key={v} onClick={() => setBet(v)} disabled={spinning || v > balance} style={{
              padding: '8px 16px',
              borderRadius: '12px',
              background: bet === v ? 'linear-gradient(135deg, #ffd700, #b8860b)' : v > balance ? 'rgba(255, 255, 255, 0.02)' : 'rgba(255, 215, 0, 0.1)',
              border: bet === v ? 'none' : '1px solid rgba(255, 215, 0, 0.3)',
              color: bet === v ? '#1a0a2e' : v > balance ? 'rgba(255, 215, 0, 0.3)' : 'var(--gold)',
              fontWeight: '700',
              fontSize: '12px',
              cursor: spinning || v > balance ? 'not-allowed' : 'pointer',
              opacity: spinning ? 0.5 : 1
            }}>₱{v}</button>
          ))}
        </div>

        {/* Balance Warning */}
        {balance <= 0 && (
          <div style={{
            marginBottom: '16px',
            padding: '12px',
            background: 'rgba(255, 71, 87, 0.2)',
            borderRadius: '12px',
            textAlign: 'center',
            color: '#ff4757',
            fontWeight: '700',
            fontSize: '14px'
          }}>
            💸 No balance! <span onClick={() => navigate('/wallet')} style={{ color: 'var(--gold)', cursor: 'pointer', textDecoration: 'underline' }}>Deposit now</span>
          </div>
        )}

        {/* Spin Buttons */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '12px',
          marginBottom: '16px'
        }}>
          {/* Auto Spin */}
          <button onClick={() => setAutoSpin(!autoSpin)} disabled={spinning || balance < bet} style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: autoSpin ? 'linear-gradient(135deg, #00f5d4, #00d4aa)' : 'linear-gradient(135deg, #2a1a4a, #1a0a2e)',
            border: '2px solid',
            borderColor: autoSpin ? '#00f5d4' : 'rgba(255, 215, 0, 0.3)',
            color: autoSpin ? '#0a001a' : 'var(--gold)',
            fontSize: '14px',
            fontWeight: '700',
            cursor: balance < bet ? 'not-allowed' : 'pointer',
            opacity: balance < bet ? 0.3 : 1,
            lineHeight: 1
          }}>
            {autoSpin ? '⏹' : '🔄'}
          </button>

          {/* Main Spin Button */}
          <button onClick={spin} disabled={spinning || balance < bet || balance <= 0} style={{
            width: '100px',
            height: '100px',
            borderRadius: '50%',
            background: spinning || balance < bet || balance <= 0
              ? 'linear-gradient(135deg, #2a1a4a, #1a0a2e)'
              : 'linear-gradient(135deg, #ffd700, #ffed4a, #ffd700)',
            border: '4px solid',
            borderColor: spinning || balance < bet || balance <= 0 ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.4)',
            color: spinning || balance < bet || balance <= 0 ? '#666' : '#1a0a2e',
            fontSize: '18px',
            fontWeight: '900',
            cursor: spinning || balance < bet || balance <= 0 ? 'not-allowed' : 'pointer',
            boxShadow: spinning || balance < bet || balance <= 0 ? 'none' : '0 0 40px rgba(255, 215, 0, 0.6)',
            textTransform: 'uppercase',
            letterSpacing: '2px',
            animation: spinning ? 'spinPulse 0.3s ease infinite' : 'none'
          }}>
            {spinning ? '🎰' : 'SPIN'}
          </button>

          {/* Free Spin */}
          <button onClick={freeSpins > 0 ? useFreeSpin : () => setShowPaytable(true)} disabled={spinning} style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: freeSpins > 0 ? 'linear-gradient(135deg, #00f5d4, #00d4aa)' : 'linear-gradient(135deg, #2a1a4a, #1a0a2e)',
            border: '2px solid',
            borderColor: freeSpins > 0 ? '#00f5d4' : 'rgba(255, 215, 0, 0.3)',
            color: freeSpins > 0 ? '#0a001a' : 'var(--gold)',
            fontSize: '14px',
            fontWeight: '700',
            cursor: 'pointer',
            position: 'relative'
          }}>
            {freeSpins > 0 ? '🎁' : '📋'}
            {freeSpins > 0 && (
              <span style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                background: '#ff2d75',
                color: 'white',
                fontSize: '10px',
                padding: '2px 6px',
                borderRadius: '10px',
                fontWeight: '700'
              }}>{freeSpins}</span>
            )}
          </button>
        </div>

        {/* Paytable */}
        {showPaytable && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}>
            <div style={{
              background: 'linear-gradient(145deg, #1a0a2e, #0d0515)',
              borderRadius: '24px',
              padding: '24px',
              maxWidth: '400px',
              width: '100%',
              maxHeight: '80vh',
              overflowY: 'auto',
              border: '2px solid rgba(255, 215, 0, 0.3)'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px'
              }}>
                <h3 style={{
                  fontSize: '20px',
                  fontWeight: '900',
                  background: 'linear-gradient(135deg, #ffd700, #ffed4a)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent'
                }}>📋 PAYTABLE</h3>
                <button onClick={() => setShowPaytable(false)} style={{
                  background: 'rgba(255, 71, 87, 0.2)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  color: '#ff4757',
                  fontSize: '18px',
                  cursor: 'pointer'
                }}>✕</button>
              </div>

              <div style={{ display: 'grid', gap: '12px' }}>
                {Object.entries(SYMBOLS).map(([key, sym]) => (
                  <div key={key} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    borderRadius: '12px'
                  }}>
                    <div style={{
                      width: '48px',
                      height: '48px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '34px',
                      background: `linear-gradient(135deg, ${sym.color}30, ${sym.color}10)`,
                      borderRadius: '10px'
                    }}>{sym.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', fontWeight: '700', color: 'white' }}>{sym.name}</div>
                      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>
                        {key === 'wild' ? 'Substitutes all symbols' : key === 'scatter' ? '3+ anywhere = Free Spins' : '3 / 4 / 5 of a kind'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ padding: '4px 10px', background: 'rgba(255,215,0,0.15)', borderRadius: '8px', color: 'var(--gold)', fontWeight: '700', fontSize: '13px' }}>
                        {key === 'wild' || key === 'scatter' ? `up to ${sym.value}x` : `up to ${sym.value}x`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Animations */}
      <style>{`
        @keyframes symbolSpin {
          0% { transform: translateY(-10px); opacity: 0.4; }
          50% { transform: translateY(0); opacity: 1; }
          100% { transform: translateY(10px); opacity: 0.4; }
        }
        @keyframes winPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        @keyframes spinPulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 40px rgba(255, 215, 0, 0.6); }
          50% { transform: scale(1.05); box-shadow: 0 0 60px rgba(255, 215, 0, 0.8); }
        }
        @keyframes winPop {
          0% { transform: scale(0.8); opacity: 0; }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}
