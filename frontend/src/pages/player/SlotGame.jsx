import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { gameAPI, walletAPI } from '../../services/api';
import PixiSlotReels from '../../components/slots/PixiSlotReels';
import FreeSpinTransition from '../../components/slots/FreeSpinTransition';
import BigWinOverlay from '../../components/slots/BigWinOverlay';
import SpinButton from '../../components/slots/SpinButton';
import BetControls from '../../components/slots/BetControls';
import useSlotSounds from '../../components/slots/useSlotSounds';
import useSlotResponsiveHeight from '../../hooks/useSlotResponsiveHeight';
import { getSymbolsForGame, SLOT_SYMBOL_THEMES, DEFAULT_SLOT_SYMBOLS } from '../../data/gameThemes';
import DebugOverlay from '../../components/slots/DebugOverlay';

function ActionButton({ icon, active, disabled, onClick, badge, size = 56 }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: active 
          ? 'linear-gradient(135deg, #00f5d4, #00d4aa)' 
          : 'linear-gradient(135deg, #2a1a4a, #1a0a2e)',
        border: '2px solid',
        borderColor: active ? '#00f5d4' : 'rgba(255, 215, 0, 0.3)',
        color: active ? '#0a001a' : 'var(--gold)',
        fontSize: '14px',
        fontWeight: '700',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        position: 'relative',
        transition: 'all 0.2s ease'
      }}
    >
      {icon}
      {badge != null && badge > 0 && (
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
        }}>{badge}</span>
      )}
    </button>
  );
}

export default function SlotGame() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { play: playSound, setMuted, isMuted } = useSlotSounds();
  
  // Debug mode via URL param
  const debugMode = searchParams.get('debugGame') === 'true';
  
  const [game, setGame] = useState(null);
  const [balance, setBalance] = useState(0);
  const [bet, setBet] = useState(10);
  const [reels, setReels] = useState(Array(5).fill(null).map(() => Array(3).fill('cherry')));
  const [spinning, setSpinning] = useState(false);
  const [reelStates, setReelStates] = useState([false, false, false, false, false]);
  const [lastWin, setLastWin] = useState(0);
  const [freeSpins, setFreeSpins] = useState(0);
  const [message, setMessage] = useState('');
  const [winningLines, setWinningLines] = useState([]);
  const [showBigWin, setShowBigWin] = useState(false);
  const [autoSpin, setAutoSpin] = useState(false);
  const [showPaytable, setShowPaytable] = useState(false);
  const [showFreeSpinTransition, setShowFreeSpinTransition] = useState(false);
  const [pendingFreeSpins, setPendingFreeSpins] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStage, setLoadingStage] = useState('init');
  
  // Debug stats from PixiSlotReels
  const [debugStats, setDebugStats] = useState({
    fps: 0,
    particleCount: 0,
    assetStatus: {},
    symbolCount: 0,
    width: 0,
    height: 0,
    initialized: false
  });
  
  // Generate spin ID for tracking
  const [spinId, setSpinId] = useState('');

  const SYMBOLS = getSymbolsForGame(slug);
  const themeSymbols = SLOT_SYMBOL_THEMES[slug] || DEFAULT_SLOT_SYMBOLS;
  
  // Responsive height calculation
  const { height: slotHeight, isLandscape, orientation } = useSlotResponsiveHeight(280, 420);

  // Cleanup on unmount - cancel autoSpin and clear any pending operations
  useEffect(() => {
    return () => {
      // Auto-spin timer is cleaned up by its own useEffect
      // Just ensure we stop any ongoing spin
      setAutoSpin(false);
      setSpinning(false);
    };
  }, []);

  useEffect(() => {
    walletAPI.balance().then(({ data }) => setBalance(Number(data.balance) || 0)).catch(() => {});
    gameAPI.details(slug).then(({ data }) => {
      setGame(data);
      setBet(Number(data.min_bet));
      const keys = Object.keys(themeSymbols);
      const initialReels = Array(5).fill(null).map(() => 
        Array(3).fill(null).map(() => keys[Math.floor(Math.random() * keys.length)])
      );
      setReels(initialReels);
      setReelStates([false, false, false, false, false]);
    }).catch(() => navigate('/'));
  }, [slug, navigate, themeSymbols]);

  // Auto-spin effect with proper cleanup
  useEffect(() => {
    let autoSpinTimer = null;
    
    if (autoSpin && !spinning && balance >= bet) {
      autoSpinTimer = setTimeout(() => spin(), 1000);
    } else if (autoSpin && (spinning || balance < bet)) {
      setAutoSpin(false);
    }
    
    return () => {
      if (autoSpinTimer) clearTimeout(autoSpinTimer);
    };
  }, [autoSpin, spinning, balance, bet]);

  const spinReels = async (finalReels) => {
    setSpinning(true);
    setWinningLines([]);
    setLastWin(0);
    setMessage('');
    setShowBigWin(false);
    
    // Generate new spin ID for debug tracking
    setSpinId(`spin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
    
    playSound('whoosh');
    setReelStates([true, true, true, true, true]);

    for (let i = 0; i < 5; i++) {
      await new Promise(r => setTimeout(r, 300 + i * 180));
      setReelStates(prev => {
        const next = [...prev];
        next[i] = false;
        return next;
      });
      setReels(prev => {
        const newReels = [...prev];
        newReels[i] = finalReels[i];
        return newReels;
      });
      playSound('clack');
    }

    await new Promise(r => setTimeout(r, 200));
    setSpinning(false);
    setReelStates([false, false, false, false, false]);
  };

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
        
        if (data.paylineWins && data.paylineWins.length > 0) {
          setWinningLines(data.paylineWins.map(w => w.payline));
        } else if (data.grid) {
          setWinningLines([[0, 1, 2, 3, 4]]);
        }
      }

      if (data.freeSpinsAwarded > 0) {
        setPendingFreeSpins(data.freeSpinsAwarded);
        setShowFreeSpinTransition(true);
        playSound('scatter');
      }
    } catch (err) {
      setMessage(err.response?.data?.error || 'Spin failed');
      setSpinning(false);
    }
  };

  const generateRandomReels = () => {
    const keys = Object.keys(themeSymbols);
    return Array(5).fill(null).map(() => 
      Array(3).fill(null).map(() => keys[Math.floor(Math.random() * keys.length)])
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
        setPendingFreeSpins(data.freeSpinsAwarded);
        setShowFreeSpinTransition(true);
        playSound('scatter');
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
        }}>← Home</button>
        
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
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
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

        {/* PixiJS Reels Container */}
        <div style={{
          flex: 1,
          padding: '10px',
          background: 'linear-gradient(145deg, #12082a, #1a0a35)',
          borderRadius: '24px',
          border: '3px solid #b8860b',
          boxShadow: 'inset 0 0 35px rgba(0,0,0,.55), 0 0 28px rgba(255,215,0,.12)',
          position: 'relative',
          marginBottom: '16px',
          overflow: 'hidden'
        }}>
          <div style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background: 'radial-gradient(circle at 50% 45%, rgba(255,215,0,.10), transparent 52%)',
            zIndex: 0
          }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <PixiSlotReels
              reels={reels}
              reelStates={reelStates}
              spinning={spinning}
              winningLines={winningLines}
              themeSymbols={themeSymbols}
              lastWin={lastWin}
              showBigWin={showBigWin}
              freeSpins={freeSpins}
              message={message}
              bet={bet}
              height={slotHeight}
              onLoadingChange={({ loading, progress, stage }) => {
                setIsLoading(loading);
                setLoadingProgress(progress);
                setLoadingStage(stage);
              }}
              onDebugStats={debugMode ? setDebugStats : undefined}
            />
          </div>
          <div style={{
            position: 'absolute',
            left: '5%',
            right: '5%',
            top: '50%',
            height: '2px',
            transform: 'translateY(-50%)',
            background: 'linear-gradient(90deg, transparent, rgba(255,215,0,.72), transparent)',
            boxShadow: '0 0 16px rgba(255,215,0,.6)',
            pointerEvents: 'none',
            zIndex: 2
          }} />
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
        <BetControls
          bet={bet}
          minBet={Number(game.min_bet)}
          maxBet={Number(game.max_bet)}
          balance={balance}
          disabled={spinning}
          onChange={setBet}
        />

        {/* Balance Warning */}
        {balance <= 0 && (
          <div style={{
            marginBottom: '12px',
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
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginBottom: '12px' }}>
          <ActionButton
            icon={autoSpin ? '⏹' : '🔄'}
            active={autoSpin}
            disabled={spinning || balance < bet}
            onClick={() => setAutoSpin(!autoSpin)}
            size={52}
          />

          <SpinButton
            onClick={spin}
            disabled={spinning || balance < bet}
            spinning={spinning}
            balance={balance}
            bet={bet}
          />

          <ActionButton
            icon={freeSpins > 0 ? '🎁' : '📋'}
            active={freeSpins > 0}
            disabled={spinning}
            onClick={freeSpins > 0 ? useFreeSpin : () => setShowPaytable(true)}
            badge={freeSpins > 0 ? freeSpins : null}
            size={52}
          />
        </div>

        {/* Mute Toggle */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '8px' }}>
          <button
            onClick={() => setMuted(!isMuted)}
            style={{
              padding: '8px 16px',
              borderRadius: '20px',
              border: '1px solid rgba(255, 215, 0, 0.2)',
              background: isMuted ? 'rgba(255, 71, 87, 0.15)' : 'rgba(255, 215, 0, 0.08)',
              color: isMuted ? '#ff4757' : 'var(--gold)',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {isMuted ? '🔇' : '🔊'} {isMuted ? 'Unmute' : 'Sound'}
          </button>
          <button
            onClick={() => setShowPaytable(true)}
            style={{
              padding: '8px 16px',
              borderRadius: '20px',
              border: '1px solid rgba(255, 215, 0, 0.2)',
              background: 'rgba(255, 215, 0, 0.08)',
              color: 'var(--gold)',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            📋 Paytable
          </button>
        </div>

        {/* Paytable Modal */}
        {showPaytable && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.92)',
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
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
                        up to {sym.value}x
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
        @keyframes chipShine {
          0% { left: -100%; }
          50%, 100% { left: 100%; }
        }
        @keyframes logoFloat {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-10px) rotate(5deg); }
        }
        @keyframes dotPulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>

      {/* Loading Overlay */}
      {isLoading && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'radial-gradient(circle at center, #1a0a30, #0a001a)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }}>
          {/* Animated logo */}
          <div style={{
            fontSize: '64px',
            marginBottom: '24px',
            animation: 'logoFloat 2s ease-in-out infinite'
          }}>🎰</div>
          
          {/* Title */}
          <div style={{
            fontSize: '32px',
            fontWeight: '900',
            background: 'linear-gradient(135deg, #ffd700, #ffed4a)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '32px',
            letterSpacing: '4px'
          }}>LOADING</div>
          
          {/* Progress bar container */}
          <div style={{
            width: '200px',
            height: '6px',
            background: 'rgba(255, 215, 0, 0.15)',
            borderRadius: '3px',
            overflow: 'hidden',
            marginBottom: '16px'
          }}>
            {/* Progress bar fill */}
            <div style={{
              width: `${loadingProgress}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #ffd700, #ffed4a)',
              borderRadius: '3px',
              transition: 'width 0.3s ease',
              boxShadow: '0 0 10px rgba(255, 215, 0, 0.5)'
            }} />
          </div>
          
          {/* Stage text */}
          <div style={{
            fontSize: '12px',
            color: 'rgba(255, 215, 0, 0.6)',
            letterSpacing: '2px',
            textTransform: 'uppercase'
          }}>
            {loadingStage === 'init' && 'Initializing...'}
            {loadingStage === 'canvas' && 'Creating canvas...'}
            {loadingStage === 'assets' && 'Loading assets...'}
            {loadingStage === 'scene' && 'Building scene...'}
            {loadingStage === 'finalizing' && 'Almost ready...'}
            {loadingStage === 'ready' && 'Ready!'}
          </div>
          
          {/* Spinning dots */}
          <div style={{
            marginTop: '20px',
            display: 'flex',
            gap: '8px'
          }}>
            {[0, 1, 2].map(i => (
              <div
                key={i}
                style={{
                  width: '8px',
                  height: '8px',
                  background: '#ffd700',
                  borderRadius: '50%',
                  animation: `dotPulse 1s ease-in-out ${i * 0.2}s infinite`
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Free Spin Transition Overlay */}
      {showFreeSpinTransition && (
        <FreeSpinTransition
          spinsAwarded={pendingFreeSpins}
          onComplete={() => {
            setShowFreeSpinTransition(false);
            setFreeSpins(prev => prev + pendingFreeSpins);
            setPendingFreeSpins(0);
          }}
        />
      )}

      {/* Big Win Overlay */}
      {showBigWin && lastWin > 0 && (
        <BigWinOverlay
          amount={lastWin}
          bet={bet}
          onClose={() => {
            setShowBigWin(false);
          }}
        />
      )}

      {/* Debug Overlay */}
      {debugMode && (
        <DebugOverlay
          fps={debugStats.fps}
          reelState={reelStates}
          spinId={spinId}
          particleCount={debugStats.particleCount}
          assetStatus={debugStats.assetStatus}
          balance={balance}
          bet={bet}
          lastWin={lastWin}
          spinning={spinning}
          stats={{
            symbols: debugStats.symbolCount,
            width: debugStats.width,
            height: debugStats.height,
            initialized: debugStats.initialized ? 'Yes' : 'No',
            freeSpins,
            autoSpin: autoSpin ? 'On' : 'Off'
          }}
        />
      )}
    </div>
  );
}
