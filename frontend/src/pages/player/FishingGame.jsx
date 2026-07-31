import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { gameAPI, walletAPI } from '../../services/api';

// Fish types with values (display only — actual payout comes from backend)
const FISH_TYPES = {
  small:  { icon: '🐟', value: 1.2,  speed: 3,   size: 30 },
  medium: { icon: '🐠', value: 1.5,  speed: 2,   size: 40 },
  large:  { icon: '🦈', value: 2,    speed: 1.5, size: 50 },
  golden: { icon: '🐡', value: 3,    speed: 2.5, size: 45 },
  boss:   { icon: '🐋', value: 8,    speed: 1,   size: 70 },
  dragon: { icon: '🐉', value: 15,   speed: 0.8, size: 80 }
};

// Fish component
const Fish = ({ fish, onShoot, shooting }) => {
  const [hit, setHit] = useState(false);

  const handleClick = () => {
    setHit(true);
    setTimeout(() => setHit(false), 200);
    onShoot(fish);
  };

  return (
    <div
      onClick={handleClick}
      style={{
        position: 'absolute',
        left: `${fish.x}%`,
        top: `${fish.y}%`,
        fontSize: `${fish.size}px`,
        cursor: 'pointer',
        transform: `translate(-50%, -50%) ${hit ? 'scale(1.3)' : 'scale(1)'} ${fish.direction < 0 ? 'scaleX(-1)' : ''}`,
        transition: 'transform 0.15s',
        filter: hit ? `drop-shadow(0 0 20px #ffd700) brightness(1.5)` : 'none',
        opacity: fish.hp !== undefined && fish.hp <= 0 ? 0 : 1,
        animation: `swim ${3 / fish.speed}s ease-in-out infinite alternate`,
        userSelect: 'none'
      }}
    >
      {fish.icon}
      {fish.hp !== undefined && fish.hp > 0 && (
        <div style={{
          position: 'absolute',
          bottom: '-8px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '40px',
          height: '4px',
          background: 'rgba(0, 0, 0, 0.5)',
          borderRadius: '2px',
          overflow: 'hidden'
        }}>
          <div style={{
            width: `${(fish.hp / fish.maxHp) * 100}%`,
            height: '100%',
            background: fish.hp > fish.maxHp * 0.5 ? '#2ecc71' : '#e74c3c',
            transition: 'width 0.2s'
          }} />
        </div>
      )}
    </div>
  );
};

// Bullet component
const Bullet = ({ x, y, targetX, targetY }) => (
  <div style={{
    position: 'absolute',
    left: x,
    top: y,
    width: '8px',
    height: '8px',
    background: 'radial-gradient(circle, #ffd700, #ff8c00)',
    borderRadius: '50%',
    boxShadow: '0 0 10px #ffd700',
    transform: 'translate(-50%, -50%)',
    animation: 'bulletPulse 0.2s ease infinite'
  }} />
);

// Net explosion
const NetExplosion = ({ x, y }) => (
  <div style={{
    position: 'absolute',
    left: x,
    top: y,
    width: '60px',
    height: '60px',
    border: '3px solid rgba(255, 215, 0, 0.8)',
    borderRadius: '50%',
    transform: 'translate(-50%, -50%)',
    animation: 'netExpand 0.3s ease-out forwards',
    pointerEvents: 'none'
  }} />
);

export default function FishingGame() {
  const { slug } = useParams();
  const navigate = useNavigate();

  const [game, setGame] = useState(null);
  const [balance, setBalance] = useState(0);
  const [bet, setBet] = useState(1);
  const [fishes, setFishes] = useState([]);
  const [bullets, setBullets] = useState([]);
  const [nets, setNets] = useState([]);
  const [lastWin, setLastWin] = useState(0);
  const [message, setMessage] = useState('');
  const [autoMode, setAutoMode] = useState(false);
  const [totalWinnings, setTotalWinnings] = useState(0);

  const gameAreaRef = useRef(null);

  useEffect(() => {
    walletAPI.balance().then(({ data }) => setBalance(Number(data.balance) || 0)).catch(() => {});
    gameAPI.details(slug).then(({ data }) => setGame(data)).catch(() => navigate('/'));
  }, [slug, navigate]);

  // Spawn fish
  useEffect(() => {
    const spawnInterval = setInterval(() => {
      if (fishes.length < 20) {
        const types = Object.keys(FISH_TYPES);
        const weights = [40, 25, 15, 10, 7, 3];
        let random = Math.random() * 100;
        let typeIndex = 0;
        for (let i = 0; i < weights.length; i++) {
          random -= weights[i];
          if (random <= 0) {
            typeIndex = i;
            break;
          }
        }

        const type = types[typeIndex];
        const fishData = FISH_TYPES[type];
        const direction = Math.random() > 0.5 ? 1 : -1;

        const newFish = {
          id: Date.now() + Math.random(),
          type,
          icon: fishData.icon,
          value: fishData.value,
          speed: fishData.speed,
          size: fishData.size,
          x: direction > 0 ? -10 : 110,
          y: 10 + Math.random() * 80,
          direction,
          hp: type === 'boss' || type === 'dragon' ? 5 : undefined,
          maxHp: type === 'boss' || type === 'dragon' ? 5 : undefined
        };

        setFishes(prev => [...prev, newFish]);
      }
    }, 1500);

    return () => clearInterval(spawnInterval);
  }, [fishes.length]);

  // Move fish
  useEffect(() => {
    const moveInterval = setInterval(() => {
      setFishes(prev => prev
        .map(fish => ({
          ...fish,
          x: fish.x + (fish.direction * fish.speed * 0.5)
        }))
        .filter(fish => fish.x > -15 && fish.x < 115)
      );
    }, 50);

    return () => clearInterval(moveInterval);
  }, []);

  // Auto mode
  useEffect(() => {
    if (!autoMode) return;
    if (balance < bet) { setAutoMode(false); return; }
    const autoInterval = setInterval(() => {
      if (balance >= bet && fishes.length > 0) {
        const targetFish = fishes[Math.floor(Math.random() * Math.min(3, fishes.length))];
        if (targetFish) shoot(targetFish);
      } else if (balance < bet) {
        setAutoMode(false);
      }
    }, 800);
    return () => clearInterval(autoInterval);
  }, [autoMode, balance, bet, fishes]);

  const shoot = async (fish) => {
    if (balance < bet) {
      setMessage('💸 Insufficient balance!');
      return;
    }

    // Add net explosion animation
    const rect = gameAreaRef.current?.getBoundingClientRect();
    if (rect) {
      const netX = (fish.x * rect.width) / 100;
      const netY = (fish.y * rect.height) / 100;
      const netId = Date.now();
      setNets(prev => [...prev, { id: netId, x: netX, y: netY }]);
      setTimeout(() => setNets(prev => prev.filter(n => n.id !== netId)), 300);
    }

    try {
      const { data } = await gameAPI.fishingShoot(game.id, bet);
      setBalance(data.balance);
      if (data.hit && data.fish) {
        setLastWin(data.totalWin);
        setTotalWinnings(prev => prev + data.totalWin);
        setMessage(`🎉 Caught ${data.fish.emoji}! +₱${data.totalWin}`);
        setFishes(prev => prev.filter(f => f.id !== fish.id));
        setTimeout(() => setLastWin(0), 2000);
      } else {
        setMessage('Miss!');
        setTimeout(() => setMessage(''), 800);
      }
    } catch (err) {
      setMessage(err.response?.data?.error || 'Shot failed');
    }
  };

  if (!game) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #0a1a2a 0%, #052d4a 30%, #0a3d5a 60%, #0a1a2a 100%)',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Underwater Effects */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(circle at 30% 20%, rgba(0, 150, 200, 0.1), transparent 50%), radial-gradient(circle at 70% 80%, rgba(0, 100, 150, 0.1), transparent 50%)',
        pointerEvents: 'none'
      }} />

      {/* Bubbles */}
      {Array.from({ length: 20 }).map((_, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: `${Math.random() * 100}%`,
          bottom: '-20px',
          width: `${4 + Math.random() * 8}px`,
          height: `${4 + Math.random() * 8}px`,
          background: 'radial-gradient(circle, rgba(255, 255, 255, 0.3), rgba(255, 255, 255, 0.1))',
          borderRadius: '50%',
          animation: `bubble ${5 + Math.random() * 10}s linear infinite`,
          animationDelay: `${Math.random() * 5}s`,
          pointerEvents: 'none'
        }} />
      ))}

      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 16px',
        background: 'linear-gradient(180deg, rgba(0, 20, 40, 0.9), rgba(0, 20, 40, 0.7))',
        borderBottom: '2px solid rgba(0, 150, 200, 0.5)',
        zIndex: 10
      }}>
        <Link to="/" style={{
          display: 'inline-flex', alignItems: 'center',
          background: 'linear-gradient(135deg, #00b4d8, #0096c7)',
          borderRadius: '10px',
          padding: '10px 16px',
          color: 'white',
          fontWeight: '800',
          fontSize: '13px',
          textDecoration: 'none'
        }}>← Home</Link>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '10px', color: '#00b4d8', letterSpacing: '1px' }}>BALANCE</div>
          <div style={{
            fontSize: '22px',
            fontWeight: '900',
            background: 'linear-gradient(135deg, #00f5d4, #00b4d8)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>₱{balance.toLocaleString('en', { minimumFractionDigits: 2 })}</div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => navigate('/wallet')} style={{
            background: 'linear-gradient(135deg, #ffd700, #b8860b)',
            border: 'none',
            borderRadius: '10px',
            padding: '10px 16px',
            color: '#1a0a2e',
            fontWeight: '800',
            fontSize: '13px',
            cursor: 'pointer'
          }}>Deposit</button>
        </div>
      </div>

      {/* Game Info */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '16px',
        padding: '8px',
        background: 'rgba(0, 50, 80, 0.3)',
        zIndex: 10
      }}>
        <span style={{ color: '#00f5d4', fontSize: '12px' }}>{game.name}</span>
        <span style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px' }}>RTP {game.rtp}%</span>
      </div>

      {/* Game Area */}
      <div ref={gameAreaRef} style={{
        flex: 1,
        position: 'relative',
        cursor: 'crosshair',
        overflow: 'hidden'
      }}>
        {/* Fish */}
        {fishes.map(fish => (
          <Fish key={fish.id} fish={fish} onShoot={shoot} />
        ))}

        {/* Net Explosions */}
        {nets.map(net => (
          <NetExplosion key={net.id} x={net.x} y={net.y} />
        ))}
      </div>

      {/* Win Display */}
      {lastWin > 0 && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          padding: '16px 32px',
          background: 'rgba(0, 245, 212, 0.9)',
          borderRadius: '20px',
          textAlign: 'center',
          animation: 'winPop 0.5s ease-out',
          zIndex: 100,
          pointerEvents: 'none'
        }}>
          <div style={{
            fontSize: '28px',
            fontWeight: '900',
            color: '#0a0a15'
          }}>+₱{lastWin}</div>
        </div>
      )}

      {/* Message */}
      {message && (
        <div style={{
          position: 'absolute',
          top: '120px',
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '8px 16px',
          background: 'rgba(0, 0, 0, 0.7)',
          borderRadius: '12px',
          color: message.includes('Caught') ? '#00f5d4' : 'white',
          fontSize: '14px',
          fontWeight: '700',
          zIndex: 100,
          pointerEvents: 'none'
        }}>{message}</div>
      )}

      {/* Bottom Controls */}
      <div style={{
        padding: '16px',
        background: 'linear-gradient(180deg, rgba(0, 20, 40, 0.7), rgba(0, 20, 40, 0.95))',
        borderTop: '2px solid rgba(0, 150, 200, 0.5)',
        zIndex: 10
      }}>
        {/* Bet Selection */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '12px'
        }}>
          <button onClick={() => setBet(Math.max(1, bet - 1))} disabled={bet <= 1} style={{
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #00b4d8, #0096c7)',
            border: 'none',
            color: 'white',
            fontSize: '22px',
            fontWeight: '900',
            cursor: bet <= 1 ? 'not-allowed' : 'pointer',
            opacity: bet <= 1 ? 0.4 : 1
          }}>−</button>

          <div style={{
            padding: '12px 24px',
            background: 'rgba(0, 150, 200, 0.2)',
            borderRadius: '16px',
            border: '2px solid rgba(0, 245, 212, 0.5)'
          }}>
            <div style={{ fontSize: '10px', color: 'rgba(0, 245, 212, 0.8)', textAlign: 'center' }}>BET</div>
            <div style={{
              fontSize: '28px',
              fontWeight: '900',
              color: '#00f5d4',
              textAlign: 'center'
            }}>₱{bet}</div>
          </div>

          <button onClick={() => setBet(Math.min(100, bet + 1))} disabled={bet >= 100} style={{
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #00b4d8, #0096c7)',
            border: 'none',
            color: 'white',
            fontSize: '22px',
            fontWeight: '900',
            cursor: bet >= 100 ? 'not-allowed' : 'pointer',
            opacity: bet >= 100 ? 0.4 : 1
          }}>+</button>
        </div>

        {/* Quick Bet */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '8px',
          marginBottom: '12px'
        }}>
          {[1, 5, 10, 50, 100].map(v => (
            <button key={v} onClick={() => setBet(v)} style={{
              padding: '8px 16px',
              borderRadius: '12px',
              background: bet === v ? 'linear-gradient(135deg, #00f5d4, #00b4d8)' : 'rgba(0, 150, 200, 0.2)',
              border: bet === v ? 'none' : '1px solid rgba(0, 150, 200, 0.5)',
              color: bet === v ? '#0a0a15' : '#00f5d4',
              fontWeight: '700',
              fontSize: '12px',
              cursor: 'pointer'
            }}>₱{v}</button>
          ))}
        </div>

        {/* Auto Mode */}
        <button onClick={() => setAutoMode(!autoMode)} style={{
          width: '100%',
          padding: '14px',
          background: autoMode ? 'linear-gradient(135deg, #ff2d75, #e74c3c)' : 'linear-gradient(135deg, #00f5d4, #00b4d8)',
          border: 'none',
          borderRadius: '16px',
          color: autoMode ? 'white' : '#0a0a15',
          fontWeight: '800',
          fontSize: '16px',
          cursor: 'pointer',
          boxShadow: '0 0 30px rgba(0, 245, 212, 0.5)'
        }}>
          {autoMode ? '⏹ AUTO OFF' : '🎯 AUTO FIRE'}
        </button>

        {/* Stats */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-around',
          marginTop: '12px',
          padding: '12px',
          background: 'rgba(0, 50, 80, 0.3)',
          borderRadius: '12px'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.5)' }}>TOTAL WIN</div>
            <div style={{ fontSize: '16px', fontWeight: '900', color: '#00f5d4' }}>₱{totalWinnings.toLocaleString()}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.5)' }}>FISH COUNT</div>
            <div style={{ fontSize: '16px', fontWeight: '900', color: '#ffd700' }}>{fishes.length}</div>
          </div>
        </div>
      </div>

      {/* Styles */}
      <style>{`
        @keyframes swim {
          0% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
          100% { transform: translateY(0); }
        }
        @keyframes bubble {
          0% { transform: translateY(0) scale(1); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(-100vh) scale(0.5); opacity: 0; }
        }
        @keyframes netExpand {
          0% { transform: translate(-50%, -50%) scale(0.3); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(1.5); opacity: 0; }
        }
        @keyframes bulletPulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          50% { transform: translate(-50%, -50%) scale(1.2); }
        }
        @keyframes winPop {
          0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
          50% { transform: translate(-50%, -50%) scale(1.1); }
          100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
