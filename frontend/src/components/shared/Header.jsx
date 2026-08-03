import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { walletAPI, notifAPI } from '../../services/api';
import { useLogo } from '../../hooks/useLogo';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3020';

export default function Header() {
  const { user } = useAuth();
  const [balance, setBalance] = useState(null);
  const [unread, setUnread] = useState(0);
  const [pulse, setPulse] = useState(false);
  const [dragonGlow, setDragonGlow] = useState(false);
  const logoUrl = useLogo();

  useEffect(() => {
    if (!user) return;

    walletAPI.balance().then(({ data }) => setBalance(data.balance)).catch(() => {});
    notifAPI.unreadCount().then(({ data }) => setUnread(data.count)).catch(() => {});

    // Dragon glow animation
    const glowInterval = setInterval(() => {
      setDragonGlow(true);
      setTimeout(() => setDragonGlow(false), 1000);
    }, 5000);

    // Real-time wallet updates via Socket.IO
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socket.on('connect', () => socket.emit('join', user.id));
    socket.on('wallet:update', ({ balance: newBalance }) => {
      setBalance(newBalance);
      setPulse(true);
      setTimeout(() => setPulse(false), 500);
    });
    // Only increment badge from actual notification events, not wallet updates
    socket.on('notification', () => setUnread(prev => prev + 1));

    return () => {
      socket.disconnect();
      clearInterval(glowInterval);
    };
  }, [user]);

  if (!user) return null;

  return (
    <div className="header" style={{
      background: 'linear-gradient(180deg, rgba(10, 0, 21, 0.99) 0%, rgba(26, 10, 46, 0.98) 100%)',
      borderBottom: '2px solid',
      borderImage: 'linear-gradient(90deg, transparent, rgba(255, 215, 0, 0.4), transparent) 1',
      boxShadow: '0 4px 30px rgba(255, 215, 0, 0.1)',
      position: 'relative'
    }}>
      {/* Decorative dragons */}
      <div style={{
        position: 'absolute',
        left: '0',
        top: '50%',
        transform: 'translateY(-50%)',
        fontSize: '20px',
        opacity: '0.15',
        filter: dragonGlow ? 'drop-shadow(0 0 10px #ffd700)' : 'none',
        transition: 'filter 0.5s ease'
      }}>🐉</div>
      
      {/* Logo */}
      <Link to="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
        {logoUrl
          ? <img src={logoUrl} alt="Logo" style={{ height: '48px', maxWidth: '160px', objectFit: 'contain', filter: 'drop-shadow(0 0 8px rgba(255,215,0,0.5))' }} />
          : (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '12px'
            }}>
              <span style={{ fontSize: '28px', filter: 'drop-shadow(0 0 5px #ffd700)' }}>🐉</span>
              <h1 style={{
                background: 'linear-gradient(135deg, #ffd700 0%, #ffed4a 30%, #fff 50%, #ffed4a 70%, #ffd700 100%)',
                backgroundSize: '200% auto',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                fontSize: '24px', fontWeight: '900', letterSpacing: '2px',
                animation: 'goldShine 3s linear infinite',
                filter: 'drop-shadow(0 0 15px rgba(255,215,0,0.6))'
              }}>REELX</h1>
            </div>
          )
        }
      </Link>

      {/* Right side: notifications & balance */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        {/* Notification badge */}
        {unread > 0 && (
          <div style={{
            background: 'linear-gradient(135deg, #ff2d75, #ff6b9d)',
            width: '30px',
            height: '30px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            fontWeight: '800',
            boxShadow: '0 0 20px rgba(255, 45, 117, 0.6)',
            animation: 'pulse 1.5s ease-in-out infinite',
            border: '2px solid rgba(255, 255, 255, 0.3)'
          }}>
            {unread > 9 ? '9+' : unread}
          </div>
        )}
        
        {/* Balance display */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 18px',
          background: pulse 
            ? 'linear-gradient(135deg, rgba(255, 215, 0, 0.25), rgba(0, 245, 160, 0.2))'
            : 'linear-gradient(135deg, rgba(255, 215, 0, 0.15), rgba(255, 215, 0, 0.08))',
          borderRadius: '28px',
          border: `2px solid ${pulse ? 'rgba(0, 245, 160, 0.5)' : 'rgba(255, 215, 0, 0.4)'}`,
          transition: 'all 0.3s ease',
          boxShadow: pulse 
            ? '0 0 30px rgba(0, 245, 160, 0.5), 0 0 15px rgba(255, 215, 0, 0.3)' 
            : '0 0 20px rgba(255, 215, 0, 0.2)'
        }}>
          <span style={{ 
            fontSize: '9px', 
            color: 'var(--gold)', 
            textTransform: 'uppercase',
            letterSpacing: '1px',
            opacity: 0.8
          }}>₱</span>
          <span style={{ 
            color: pulse ? 'var(--success)' : 'var(--gold)', 
            fontSize: '18px',
            fontWeight: '800',
            transition: 'all 0.3s ease',
            transform: pulse ? 'scale(1.05)' : 'scale(1)',
            textShadow: `0 0 15px ${pulse ? 'rgba(0, 245, 160, 0.8)' : 'rgba(255, 215, 0, 0.6)'}`
          }}>
            {balance !== null 
              ? Number(balance).toLocaleString('en', { minimumFractionDigits: 2 })
              : '...'
            }
          </span>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: pulse ? 'var(--success)' : 'var(--gold)',
            boxShadow: `0 0 10px ${pulse ? 'var(--success)' : 'var(--gold)'}`,
            animation: 'pulse 2s ease-in-out infinite'
          }} />
        </div>
      </div>

      {/* Decorative dragon right */}
      <div style={{
        position: 'absolute',
        right: '0',
        top: '50%',
        transform: 'translateY(-50%) scaleX(-1)',
        fontSize: '20px',
        opacity: '0.15',
        filter: dragonGlow ? 'drop-shadow(0 0 10px #ffd700)' : 'none',
        transition: 'filter 0.5s ease'
      }}>🐉</div>

      <style>{`
        @keyframes goldShine {
          0% { background-position: 200% center; }
          100% { background-position: -200% center; }
        }
      `}</style>
    </div>
  );
}
