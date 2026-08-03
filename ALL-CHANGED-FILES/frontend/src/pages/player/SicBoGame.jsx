import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { gameAPI, walletAPI } from '../../services/api';

// Dice Face Component
const DiceFace = ({ value, rolling, delay }) => {
  const dots = [];
  const positions = {
    1: [[50, 50]],
    2: [[25, 25], [75, 75]],
    3: [[25, 25], [50, 50], [75, 75]],
    4: [[25, 25], [75, 25], [25, 75], [75, 75]],
    5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
    6: [[25, 25], [75, 25], [25, 50], [75, 50], [25, 75], [75, 75]]
  };

  return (
    <div style={{
      width: '72px',
      height: '72px',
      background: 'linear-gradient(145deg, #ffffff, #e0e0e0)',
      borderRadius: '14px',
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      boxShadow: rolling 
        ? '0 8px 30px rgba(255, 215, 0, 0.5)' 
        : '0 4px 15px rgba(0, 0, 0, 0.4), inset 0 2px 0 rgba(255, 255, 255, 0.5)',
      transform: rolling ? `rotate(${Math.random() * 360}deg)` : 'rotate(0deg)',
      transition: 'all 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      animation: rolling ? `diceRoll 0.1s ease-in-out ${delay}s infinite` : 'none'
    }}>
      {positions[value]?.map(([x, y], i) => (
        <div key={i} style={{
          position: 'absolute',
          left: `${x}%`,
          top: `${y}%`,
          width: '12px',
          height: '12px',
          background: 'radial-gradient(circle at 30% 30%, #ff2d75, #c41e3a)',
          borderRadius: '50%',
          transform: 'translate(-50%, -50%)',
          boxShadow: 'inset 0 -2px 4px rgba(0, 0, 0, 0.3)'
        }} />
      ))}
    </div>
  );
};

// Betting Chip Component
const Chip = ({ value, selected, onClick, disabled }) => {
  const chipColors = {
    10: { bg: 'linear-gradient(135deg, #3498db, #2980b9)', border: '#3498db' },
    25: { bg: 'linear-gradient(135deg, #e74c3c, #c0392b)', border: '#e74c3c' },
    50: { bg: 'linear-gradient(135deg, #2ecc71, #27ae60)', border: '#2ecc71' },
    100: { bg: 'linear-gradient(135deg, #9b59b6, #8e44ad)', border: '#9b59b6' },
    500: { bg: 'linear-gradient(135deg, #f39c12, #e67e22)', border: '#f39c12' }
  };

  const color = chipColors[value] || chipColors[10];

  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: selected ? '56px' : '50px',
      height: selected ? '56px' : '50px',
      borderRadius: '50%',
      background: color.bg,
      border: selected ? '3px solid #ffd700' : `2px solid ${color.border}`,
      color: 'white',
      fontWeight: '900',
      fontSize: '12px',
      cursor: disabled ? 'not-allowed' : 'pointer',
      boxShadow: selected 
        ? '0 0 20px rgba(255, 215, 0, 0.8), 0 4px 15px rgba(0, 0, 0, 0.3)'
        : '0 4px 10px rgba(0, 0, 0, 0.3)',
      transform: selected ? 'scale(1.1)' : 'scale(1)',
      transition: 'all 0.2s',
      opacity: disabled ? 0.4 : 1,
      position: 'relative'
    }}>
      ₱{value}
      <div style={{
        position: 'absolute',
        inset: '4px',
        border: '3px dashed rgba(255, 255, 255, 0.3)',
        borderRadius: '50%'
      }} />
    </button>
  );
};

export default function SicBoGame() {
  const { slug } = useParams();
  const navigate = useNavigate();

  const [game, setGame] = useState(null);
  const [balance, setBalance] = useState(0);
  const [dice, setDice] = useState([1, 2, 3]);
  const [rolling, setRolling] = useState(false);
  const [selectedChip, setSelectedChip] = useState(10);
  const [bets, setBets] = useState({});
  const [lastWin, setLastWin] = useState(0);
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState([]);

  // Calculate total bet
  const totalBet = Object.values(bets).reduce((sum, val) => sum + val, 0);

  useEffect(() => {
    walletAPI.balance().then(({ data }) => setBalance(Number(data.balance) || 0)).catch(() => {});
    gameAPI.details(slug).then(({ data }) => setGame(data)).catch(() => navigate('/'));
  }, [slug, navigate]);

  const placeBet = (betType) => {
    if (rolling || balance < totalBet + selectedChip) return;
    setBets(prev => ({ ...prev, [betType]: (prev[betType] || 0) + selectedChip }));
  };

  const clearBets = () => {
    setBets({});
    setMessage('');
  };

  const roll = async () => {
    if (rolling || Object.keys(bets).length === 0 || balance < totalBet) return;

    setRolling(true);
    setMessage('');
    setLastWin(0);

    // Animate dice rolling while waiting for server
    const rollInterval = setInterval(() => {
      setDice([
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1
      ]);
    }, 100);

    try {
      // Server-authoritative dice + payout (respects admin win_rate / force_outcome)
      const { data } = await gameAPI.play(game.id, { betAmount: totalBet, bets });

      await new Promise(r => setTimeout(r, 1500));
      clearInterval(rollInterval);

      const finalDice = Array.isArray(data.dice) && data.dice.length === 3
        ? data.dice
        : [1, 2, 3];
      const total = data.total ?? finalDice.reduce((a, b) => a + b, 0);
      const winnings = data.totalWin || 0;

      setDice(finalDice);
      setBalance(data.balance);
      setLastWin(winnings);
      setHistory(prev => [{ dice: finalDice, total, time: new Date() }, ...prev.slice(0, 9)]);

      if (winnings > 0) {
        setMessage(`🎉 You won ₱${winnings.toLocaleString()}!`);
      } else {
        setMessage('😔 No win this round');
      }
    } catch (err) {
      clearInterval(rollInterval);
      setMessage(err.response?.data?.error || 'Roll failed');
    }

    setBets({});
    setRolling(false);
  };

  // Generate dice values that satisfy a given bet type
  const getDiceForBet = (betType) => {
    if (betType === 'big') {
      const total = 11 + Math.floor(Math.random() * 7);
      return splitTotal(total);
    }
    if (betType === 'small') {
      const total = 4 + Math.floor(Math.random() * 7);
      return splitTotal(total);
    }
    if (betType === 'odd') {
      const odds = [5, 7, 9, 11, 13, 15];
      return splitTotal(odds[Math.floor(Math.random() * odds.length)]);
    }
    if (betType === 'even') {
      const evens = [6, 8, 10, 12, 14, 16];
      return splitTotal(evens[Math.floor(Math.random() * evens.length)]);
    }
    if (betType === 'triple') {
      const v = Math.floor(Math.random() * 6) + 1;
      return [v, v, v];
    }
    if (betType === 'double') {
      const v = Math.floor(Math.random() * 6) + 1;
      const other = (v % 6) + 1;
      return [v, v, other];
    }
    if (betType.startsWith('total_')) {
      const target = parseInt(betType.split('_')[1]);
      return splitTotal(target);
    }
    return [Math.floor(Math.random()*6)+1, Math.floor(Math.random()*6)+1, Math.floor(Math.random()*6)+1];
  };

  const splitTotal = (total) => {
    const clamped = Math.max(3, Math.min(18, total));
    const d1 = Math.max(1, Math.min(6, Math.floor(clamped / 3)));
    const d2 = Math.max(1, Math.min(6, Math.floor((clamped - d1) / 2)));
    const d3 = Math.max(1, Math.min(6, clamped - d1 - d2));
    return [d1, d2, d3];
  };

  const getDiceAvoidingBets = (bets) => {
    // Try up to 20 times to find dice that don't match any bet
    for (let attempt = 0; attempt < 20; attempt++) {
      const d = [Math.floor(Math.random()*6)+1, Math.floor(Math.random()*6)+1, Math.floor(Math.random()*6)+1];
      const t = d.reduce((a,b) => a+b, 0);
      const hasDouble = d.some((v, i) => d.indexOf(v) !== i);
      const isTriple = d[0] === d[1] && d[1] === d[2];
      const matches = (
        (bets.big && t >= 11 && t <= 17) ||
        (bets.small && t >= 4 && t <= 10) ||
        (bets.odd && t % 2 === 1) ||
        (bets.even && t % 2 === 0) ||
        bets[`total_${t}`] ||
        (bets.triple && isTriple) ||
        (bets.double && hasDouble)
      );
      if (!matches) return d;
    }
    return [1, 2, 3]; // fallback
  };

  if (!game) return <div className="loading"><div className="spinner" /></div>;

  const total = dice.reduce((a, b) => a + b, 0);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #0a001a 0%, #1a1a0a 50%, #0a001a 100%)',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column'
    }}>
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
        <Link to="/" style={{
          display: 'inline-flex', alignItems: 'center',
          background: 'linear-gradient(135deg, #ffd700, #b8860b)',
          borderRadius: '10px',
          padding: '10px 16px',
          color: '#1a0a2e',
          fontWeight: '800',
          fontSize: '13px',
          textDecoration: 'none'
        }}>← Home</Link>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '10px', color: 'var(--gold)', opacity: 0.8 }}>BALANCE</div>
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

      {/* Title */}
      <div style={{ textAlign: 'center', marginBottom: '16px' }}>
        <h1 style={{
          fontSize: '28px',
          fontWeight: '900',
          background: 'linear-gradient(135deg, #ffd700, #ffed4a, #ffd700)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          letterSpacing: '3px'
        }}>🎲 SIC BO 🎲</h1>
        <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)', marginTop: '4px' }}>
          RTP {game.rtp}% | ₱{game.min_bet} - ₱{game.max_bet}
        </div>
      </div>

      {/* Dice Area */}
      <div style={{
        padding: '24px',
        background: 'linear-gradient(145deg, #1a0a2e, #0d0515)',
        borderRadius: '24px',
        border: '2px solid rgba(255, 215, 0, 0.3)',
        marginBottom: '16px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Decorative pattern */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255, 215, 0, 0.02) 10px, rgba(255, 215, 0, 0.02) 20px)',
          pointerEvents: 'none'
        }} />

        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '16px',
          marginBottom: '16px',
          position: 'relative',
          zIndex: 1
        }}>
          {dice.map((value, i) => (
            <DiceFace key={i} value={value} rolling={rolling} delay={i * 0.1} />
          ))}
        </div>

        <div style={{
          textAlign: 'center',
          padding: '12px',
          background: 'rgba(255, 215, 0, 0.1)',
          borderRadius: '12px',
          position: 'relative',
          zIndex: 1
        }}>
          <div style={{ fontSize: '12px', color: 'rgba(255, 215, 0, 0.8)', marginBottom: '4px' }}>TOTAL</div>
          <div style={{
            fontSize: '36px',
            fontWeight: '900',
            background: 'linear-gradient(135deg, #ffd700, #ffed4a)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>{total}</div>
        </div>
      </div>

      {/* Betting Table */}
      <div style={{
        flex: 1,
        background: 'linear-gradient(145deg, rgba(0, 100, 50, 0.3), rgba(0, 50, 25, 0.4))',
        borderRadius: '24px',
        padding: '16px',
        marginBottom: '16px',
        border: '3px solid rgba(139, 90, 43, 0.5)'
      }}>
        {/* Big/Small & Odd/Even */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '8px',
          marginBottom: '16px'
        }}>
          {[
            { type: 'small', label: 'SMALL\n4-10', color: '#3498db' },
            { type: 'big', label: 'BIG\n11-17', color: '#e74c3c' },
            { type: 'odd', label: 'ODD', color: '#9b59b6' },
            { type: 'even', label: 'EVEN', color: '#2ecc71' }
          ].map(bet => (
            <button key={bet.type} onClick={() => placeBet(bet.type)} disabled={rolling} style={{
              padding: '12px 8px',
              background: bets[bet.type] ? `linear-gradient(135deg, ${bet.color}, ${bet.color}cc)` : 'rgba(0, 0, 0, 0.3)',
              border: bets[bet.type] ? '2px solid #ffd700' : '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '12px',
              color: 'white',
              fontWeight: '700',
              fontSize: '11px',
              cursor: rolling ? 'not-allowed' : 'pointer',
              textAlign: 'center',
              whiteSpace: 'pre-line',
              boxShadow: bets[bet.type] ? '0 0 20px rgba(255, 215, 0, 0.5)' : 'none',
              transition: 'all 0.2s'
            }}>
              {bet.label}
              {bets[bet.type] && (
                <div style={{
                  marginTop: '4px',
                  padding: '2px 8px',
                  background: 'rgba(0, 0, 0, 0.3)',
                  borderRadius: '8px',
                  fontSize: '10px'
                }}>₱{bets[bet.type]}</div>
              )}
            </button>
          ))}
        </div>

        {/* Total Numbers */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ textAlign: 'center', color: 'rgba(255, 255, 255, 0.7)', fontSize: '11px', marginBottom: '8px', letterSpacing: '2px' }}>SPECIFIC TOTAL</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
            {[4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17].map(num => (
              <button key={num} onClick={() => placeBet(`total_${num}`)} disabled={rolling} style={{
                padding: '8px 4px',
                background: bets[`total_${num}`] ? 'linear-gradient(135deg, #ffd700, #b8860b)' : 'rgba(255, 255, 255, 0.05)',
                border: bets[`total_${num}`] ? '2px solid #fff' : '1px solid rgba(255, 215, 0, 0.3)',
                borderRadius: '8px',
                color: bets[`total_${num}`] ? '#1a0a2e' : 'var(--gold)',
                fontWeight: '700',
                fontSize: '12px',
                cursor: rolling ? 'not-allowed' : 'pointer',
                boxShadow: bets[`total_${num}`] ? '0 0 15px rgba(255, 215, 0, 0.5)' : 'none',
                transition: 'all 0.2s',
                position: 'relative'
              }}>
                {num}
                {bets[`total_${num}`] && (
                  <div style={{
                    position: 'absolute',
                    top: '-6px',
                    right: '-6px',
                    background: '#ff2d75',
                    padding: '2px 6px',
                    borderRadius: '8px',
                    fontSize: '8px',
                    fontWeight: '700'
                  }}>₱{bets[`total_${num}`]}</div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Double/Triple */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
          <button onClick={() => placeBet('double')} disabled={rolling} style={{
            padding: '14px',
            background: bets['double'] ? 'linear-gradient(135deg, #f39c12, #e67e22)' : 'rgba(0, 0, 0, 0.3)',
            border: bets['double'] ? '2px solid #ffd700' : '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '12px',
            color: 'white',
            fontWeight: '700',
            fontSize: '13px',
            cursor: rolling ? 'not-allowed' : 'pointer',
            boxShadow: bets['double'] ? '0 0 20px rgba(255, 215, 0, 0.5)' : 'none',
            transition: 'all 0.2s'
          }}>
            🎲 ANY DOUBLE (8x)
            {bets['double'] && <div style={{ fontSize: '11px', marginTop: '4px' }}>₱{bets['double']}</div>}
          </button>
          <button onClick={() => placeBet('triple')} disabled={rolling} style={{
            padding: '14px',
            background: bets['triple'] ? 'linear-gradient(135deg, #ff2d75, #e74c3c)' : 'rgba(0, 0, 0, 0.3)',
            border: bets['triple'] ? '2px solid #ffd700' : '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '12px',
            color: 'white',
            fontWeight: '700',
            fontSize: '13px',
            cursor: rolling ? 'not-allowed' : 'pointer',
            boxShadow: bets['triple'] ? '0 0 20px rgba(255, 215, 0, 0.5)' : 'none',
            transition: 'all 0.2s'
          }}>
            🎲🎲🎲 ANY TRIPLE (30x)
            {bets['triple'] && <div style={{ fontSize: '11px', marginTop: '4px' }}>₱{bets['triple']}</div>}
          </button>
        </div>
      </div>

      {/* Chip Selection */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '10px',
        marginBottom: '16px'
      }}>
        {[10, 25, 50, 100, 500].map(value => (
          <Chip key={value} value={value} selected={selectedChip === value} onClick={() => setSelectedChip(value)} disabled={rolling || balance < value} />
        ))}
      </div>

      {/* Message & Win Display */}
      {message && (
        <div style={{
          textAlign: 'center',
          marginBottom: '16px',
          padding: '12px',
          background: lastWin > 0 ? 'rgba(0, 245, 160, 0.2)' : 'rgba(255, 71, 87, 0.2)',
          borderRadius: '12px',
          border: `2px solid ${lastWin > 0 ? '#00f5a0' : '#ff4757'}`
        }}>
          <div style={{ color: lastWin > 0 ? '#00f5a0' : '#ff4757', fontWeight: '700' }}>
            {message}
          </div>
          {lastWin > 0 && (
            <div style={{
              marginTop: '8px',
              fontSize: '28px',
              fontWeight: '900',
              background: 'linear-gradient(135deg, #ffd700, #ffed4a)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>+₱{lastWin.toLocaleString()}</div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '12px' }}>
        <button onClick={clearBets} disabled={rolling || Object.keys(bets).length === 0} style={{
          flex: 1,
          padding: '16px',
          background: 'rgba(255, 71, 87, 0.2)',
          border: '2px solid #ff4757',
          borderRadius: '16px',
          color: '#ff4757',
          fontWeight: '800',
          fontSize: '14px',
          cursor: rolling || Object.keys(bets).length === 0 ? 'not-allowed' : 'pointer',
          opacity: rolling || Object.keys(bets).length === 0 ? 0.4 : 1
        }}>CLEAR</button>
        <button onClick={roll} disabled={rolling || Object.keys(bets).length === 0} style={{
          flex: 2,
          padding: '16px',
          background: rolling || Object.keys(bets).length === 0
            ? 'linear-gradient(135deg, #333, #222)'
            : 'linear-gradient(135deg, #ffd700, #ffed4a, #ffd700)',
          border: rolling || Object.keys(bets).length === 0 ? 'none' : '2px solid #fff',
          borderRadius: '16px',
          color: rolling || Object.keys(bets).length === 0 ? '#666' : '#1a0a2e',
          fontWeight: '900',
          fontSize: '16px',
          cursor: rolling || Object.keys(bets).length === 0 ? 'not-allowed' : 'pointer',
          boxShadow: rolling || Object.keys(bets).length === 0 ? 'none' : '0 0 30px rgba(255, 215, 0, 0.5)'
        }}>
          {rolling ? '🎲 ROLLING...' : `ROLL (₱${totalBet})`}
        </button>
      </div>

      {/* Styles */}
      <style>{`
        @keyframes diceRoll {
          0% { transform: rotate(0deg) scale(1); }
          25% { transform: rotate(90deg) scale(1.1); }
          50% { transform: rotate(180deg) scale(1); }
          75% { transform: rotate(270deg) scale(1.1); }
          100% { transform: rotate(360deg) scale(1); }
        }
      `}</style>
    </div>
  );
}
