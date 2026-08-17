import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { gameAPI, walletAPI } from '../../services/api';
import Reels from '../../components/slots/Reels';
import { getThemeForGame, spinReels } from '../../data/gameThemes';
import useSlotSounds from '../../components/slots/useSlotSounds';

export default function SlotGame() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { play: playSound, setMuted, isMuted } = useSlotSounds();
  
  const [game, setGame] = useState(null);
  const [balance, setBalance] = useState(0);
  const [bet, setBet] = useState(10);
  const [spinning, setSpinning] = useState(false);
  const [lastWin, setLastWin] = useState(0);
  const [freeSpins, setFreeSpins] = useState(0);
  const [message, setMessage] = useState('');
  const [showPaytable, setShowPaytable] = useState(false);
  const [autoSpin, setAutoSpin] = useState(false);
  const [highlightPositions, setHighlightPositions] = useState([]);

  const theme = getThemeForGame(slug);
  const [reels, setReels] = useState(() => spinReels(theme));
  const [spinningReels, setSpinningReels] = useState([false, false, false, false, false]);
  const symbols = theme?.symbols || {};
  const accentColor = theme?.accent || '#FFD700';

  useEffect(() => {
    walletAPI.balance().then(({ data }) => setBalance(Number(data.balance) || 0)).catch(() => {});
    gameAPI.details(slug).then(({ data }) => {
      setGame(data);
      setBet(Number(data.min_bet));
    }).catch(() => navigate('/'));
  }, [slug, navigate]);

  // Auto-spin with cleanup
  useEffect(() => {
    if (!autoSpin || spinning || balance < bet) return;
    const timer = setTimeout(() => !spinning && balance >= bet && spin(), 1200);
    return () => clearTimeout(timer);
  }, [autoSpin, spinning, balance, bet]);

  const spin = async () => {
    if (spinning || balance < bet || !game) return;
    
    setSpinning(true);
    setSpinningReels([true, true, true, true, true]);
    setHighlightPositions([]);
    setMessage('');
    setLastWin(0);
    playSound('spin');

    try {
      const { data } = await gameAPI.spin(game.id, bet);

      // Stagger reel stops (200ms apart), then apply result
      const gridReels = data.grid
        ? data.grid.map(col => col.map(s => s.id))
        : spinReels(theme);

      [0, 1, 2, 3, 4].forEach(i => {
        setTimeout(() => {
          setSpinningReels(prev => prev.map((v, j) => j === i ? false : v));
          if (i === 4) {
            setReels(gridReels);
            setSpinning(false);
            setBalance(data.balance ?? balance - bet + (data.totalWin || 0));
            setLastWin(data.totalWin || 0);

            if (data.totalWin > 0) {
              playSound(data.totalWin >= bet * 15 ? 'bigwin' : 'win');
              setMessage(`Win ₱${data.totalWin.toLocaleString()}`);
              if (data.linePositions) setHighlightPositions(data.linePositions);
            }
            if (data.freeSpinsAwarded > 0) {
              setFreeSpins(prev => prev + data.freeSpinsAwarded);
              playSound('scatter');
              setMessage(`+${data.freeSpinsAwarded} Free Spins!`);
            }
          }
        }, i * 220 + 400);
      });
    } catch (err) {
      setSpinningReels([false, false, false, false, false]);
      setSpinning(false);
      setMessage(err.response?.data?.error || 'Spin failed');
    }
  };

  const useFreeSpin = async () => {
    if (spinning || freeSpins <= 0 || !game) return;
    
    setSpinning(true);
    setSpinningReels([true, true, true, true, true]);
    setHighlightPositions([]);
    setFreeSpins(prev => prev - 1);
    playSound('spin');

    try {
      const { data } = await gameAPI.freeSpin(game.id);
      const gridReels = data.grid
        ? data.grid.map(col => col.map(s => s.id))
        : spinReels(theme);

      [0, 1, 2, 3, 4].forEach(i => {
        setTimeout(() => {
          setSpinningReels(prev => prev.map((v, j) => j === i ? false : v));
          if (i === 4) {
            setReels(gridReels);
            setSpinning(false);
            setBalance(data.balance ?? balance);
            setLastWin(data.totalWin || 0);
            if (data.totalWin > 0) {
              playSound('win');
              setMessage(`Free Spin Win ₱${data.totalWin.toLocaleString()}`);
            }
          }
        }, i * 220 + 400);
      });
    } catch (err) {
      setSpinningReels([false, false, false, false, false]);
      setSpinning(false);
      setMessage(err.response?.data?.error || 'Free spin failed');
    }
  };

  if (!game) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div style={{
      minHeight: '100vh',
      background: `linear-gradient(180deg, #0a001a 0%, #1a0a30 50%, #0a001a 100%)`,
      padding: '12px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 14px',
        background: 'rgba(255, 215, 0, 0.08)',
        borderRadius: '12px',
        border: `1px solid ${accentColor}40`,
      }}>
        <button onClick={() => navigate('/')} style={{
          background: `linear-gradient(135deg, ${accentColor}, #b8860b)`,
          border: 'none',
          borderRadius: '8px',
          padding: '8px 14px',
          color: '#1a0a2e',
          fontWeight: '700',
          fontSize: '13px',
          cursor: 'pointer',
        }}>← Back</button>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '10px', color: accentColor, opacity: 0.8, letterSpacing: '1px' }}>BALANCE</div>
          <div style={{
            fontSize: '20px',
            fontWeight: '800',
            color: accentColor,
          }}>₱{balance.toLocaleString('en', { minimumFractionDigits: 2 })}</div>
        </div>

        <button onClick={() => navigate('/wallet')} style={{
          background: 'linear-gradient(135deg, #00f5d4, #00d4aa)',
          border: 'none',
          borderRadius: '8px',
          padding: '8px 14px',
          color: '#0a001a',
          fontWeight: '700',
          fontSize: '13px',
          cursor: 'pointer',
        }}>+ Deposit</button>
      </div>

      {/* Game Title */}
      <div style={{ textAlign: 'center' }}>
        <h1 style={{
          fontSize: '22px',
          fontWeight: '900',
          color: accentColor,
          letterSpacing: '2px',
          textTransform: 'uppercase',
          marginBottom: '4px',
        }}>{theme?.title || game.name}</h1>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
          <span style={{
            padding: '3px 10px',
            background: `${accentColor}15`,
            borderRadius: '10px',
            fontSize: '11px',
            color: accentColor,
            fontWeight: '600',
          }}>RTP {game.rtp}%</span>
          <span style={{
            padding: '3px 10px',
            background: 'rgba(0, 245, 212, 0.12)',
            borderRadius: '10px',
            fontSize: '11px',
            color: '#00f5d4',
            fontWeight: '600',
          }}>₱{game.min_bet} - ₱{game.max_bet}</span>
        </div>
      </div>

      {/* Slot Reels */}
      <div style={{
        background: 'linear-gradient(145deg, #12082a, #1a0a35)',
        borderRadius: '20px',
        border: `2px solid ${accentColor}50`,
        boxShadow: `inset 0 0 30px rgba(0,0,0,0.5), 0 0 20px ${accentColor}15`,
        padding: '10px',
      }}>
        <Reels
          reels={reels}
          spinningReels={spinningReels}
          highlightPositions={highlightPositions}
          theme={theme}
        />
      </div>

      {/* Win Message */}
      {message && (
        <div style={{
          textAlign: 'center',
          padding: '12px',
          background: lastWin > 0 ? `${accentColor}20` : 'rgba(255, 255, 255, 0.05)',
          borderRadius: '12px',
          color: lastWin > 0 ? accentColor : 'rgba(255, 255, 255, 0.7)',
          fontSize: '16px',
          fontWeight: '700',
        }}>{message}</div>
      )}

      {/* Bet Controls */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        padding: '10px',
        background: 'rgba(255, 255, 255, 0.03)',
        borderRadius: '12px',
      }}>
        <button onClick={() => setBet(Math.max(Number(game.min_bet), bet - Number(game.min_bet)))} disabled={spinning} style={{
          width: '44px',
          height: '44px',
          borderRadius: '50%',
          background: `linear-gradient(135deg, ${accentColor}, #b8860b)`,
          border: 'none',
          color: '#1a0a2e',
          fontSize: '22px',
          fontWeight: '800',
          cursor: spinning ? 'not-allowed' : 'pointer',
          opacity: spinning ? 0.5 : 1,
        }}>-</button>

        <div style={{ textAlign: 'center', minWidth: '80px' }}>
          <div style={{ fontSize: '10px', color: '#8888aa', textTransform: 'uppercase' }}>Bet</div>
          <div style={{ fontSize: '22px', fontWeight: '800', color: accentColor }}>₱{bet}</div>
        </div>

        <button onClick={() => setBet(Math.min(Number(game.max_bet), bet + Number(game.min_bet)))} disabled={spinning || bet + Number(game.min_bet) > balance} style={{
          width: '44px',
          height: '44px',
          borderRadius: '50%',
          background: `linear-gradient(135deg, ${accentColor}, #b8860b)`,
          border: 'none',
          color: '#1a0a2e',
          fontSize: '22px',
          fontWeight: '800',
          cursor: spinning ? 'not-allowed' : 'pointer',
          opacity: spinning ? 0.5 : 1,
        }}>+</button>
      </div>

      {/* Spin Controls */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '14px' }}>
        <button onClick={() => setAutoSpin(!autoSpin)} disabled={spinning || balance < bet} style={{
          width: '50px',
          height: '50px',
          borderRadius: '50%',
          background: autoSpin ? 'linear-gradient(135deg, #00f5d4, #00d4aa)' : 'rgba(255, 215, 0, 0.1)',
          border: `2px solid ${autoSpin ? '#00f5d4' : accentColor}50`,
          color: autoSpin ? '#0a001a' : accentColor,
          fontSize: '18px',
          cursor: spinning || balance < bet ? 'not-allowed' : 'pointer',
          opacity: spinning || balance < bet ? 0.4 : 1,
        }}>{autoSpin ? '⏹' : '🔄'}</button>

        <button onClick={spin} disabled={spinning || balance < bet} style={{
          width: '100px',
          height: '100px',
          borderRadius: '50%',
          background: spinning || balance < bet
            ? 'linear-gradient(145deg, #333, #222)'
            : `linear-gradient(145deg, ${accentColor}, #ff9500)`,
          border: spinning || balance < bet ? '4px solid #444' : `4px solid ${accentColor}80`,
          color: spinning || balance < bet ? '#666' : '#1a0a2e',
          fontSize: '18px',
          fontWeight: '900',
          cursor: spinning || balance < bet ? 'not-allowed' : 'pointer',
          boxShadow: spinning || balance < bet ? 'none' : `0 0 30px ${accentColor}60`,
          transition: 'all 0.2s',
        }}>{spinning ? '...' : 'SPIN'}</button>

        <button onClick={freeSpins > 0 ? useFreeSpin : () => setShowPaytable(true)} disabled={spinning} style={{
          width: '50px',
          height: '50px',
          borderRadius: '50%',
          background: freeSpins > 0 ? 'linear-gradient(135deg, #00f5d4, #00d4aa)' : 'rgba(255, 215, 0, 0.1)',
          border: `2px solid ${freeSpins > 0 ? '#00f5d4' : accentColor}50`,
          color: freeSpins > 0 ? '#0a001a' : accentColor,
          fontSize: '18px',
          cursor: spinning ? 'not-allowed' : 'pointer',
          position: 'relative',
        }}>
          {freeSpins > 0 ? '🎁' : '📋'}
          {freeSpins > 0 && <span style={{
            position: 'absolute',
            top: '-4px',
            right: '-4px',
            background: '#ff2d75',
            color: 'white',
            fontSize: '10px',
            padding: '2px 6px',
            borderRadius: '10px',
            fontWeight: '700',
          }}>{freeSpins}</span>}
        </button>
      </div>

      {/* Bottom buttons */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
        <button onClick={() => setMuted(!isMuted)} style={{
          padding: '6px 14px',
          borderRadius: '18px',
          border: `1px solid ${accentColor}30`,
          background: isMuted ? 'rgba(255, 71, 87, 0.12)' : `${accentColor}08`,
          color: isMuted ? '#ff4757' : accentColor,
          fontSize: '12px',
          fontWeight: '600',
          cursor: 'pointer',
        }}>{isMuted ? '🔇' : '🔊'} {isMuted ? 'Unmute' : 'Sound'}</button>

        <button onClick={() => setShowPaytable(true)} style={{
          padding: '6px 14px',
          borderRadius: '18px',
          border: `1px solid ${accentColor}30`,
          background: `${accentColor}08`,
          color: accentColor,
          fontSize: '12px',
          fontWeight: '600',
          cursor: 'pointer',
        }}>📋 Paytable</button>
      </div>

      {/* No Balance */}
      {balance <= 0 && (
        <div style={{
          padding: '10px',
          background: 'rgba(255, 71, 87, 0.1)',
          borderRadius: '10px',
          textAlign: 'center',
          color: '#ff4757',
          fontSize: '13px',
          fontWeight: '600',
        }}>
          💸 No balance! <span onClick={() => navigate('/wallet')} style={{ color: accentColor, cursor: 'pointer', textDecoration: 'underline' }}>Deposit now</span>
        </div>
      )}

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
          padding: '20px',
        }} onClick={() => setShowPaytable(false)}>
          <div style={{
            background: '#1a0a2e',
            borderRadius: '16px',
            padding: '20px',
            maxWidth: '360px',
            width: '100%',
            maxHeight: '80vh',
            overflowY: 'auto',
            border: `1px solid ${accentColor}30`,
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '800', color: accentColor }}>📋 PAYTABLE</h3>
              <button onClick={() => setShowPaytable(false)} style={{
                background: 'rgba(255, 71, 87, 0.15)',
                border: 'none',
                borderRadius: '50%',
                width: '28px',
                height: '28px',
                color: '#ff4757',
                fontSize: '16px',
                cursor: 'pointer',
              }}>✕</button>
            </div>

            <div style={{ display: 'grid', gap: '10px' }}>
              {Object.entries(symbols).slice(0, 8).map(([key, sym]) => (
                <div key={key} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: '10px',
                }}>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '28px',
                    background: `${sym.color || accentColor}20`,
                    borderRadius: '8px',
                  }}>{sym.emoji}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#fff' }}>{sym.name}</div>
                    <div style={{ fontSize: '10px', color: '#8888aa' }}>
                      {sym.type === 'scatter' ? '3+ = Free Spins' : sym.type === 'wild' ? 'Substitutes' : `${sym.multiplier || 1}x multiplier`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
