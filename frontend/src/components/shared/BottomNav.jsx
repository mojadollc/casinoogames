import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const GamesIcon = ({ active }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <rect x="2" y="6" width="20" height="14" rx="3" stroke={active ? '#FFD700' : '#8a8a9a'} strokeWidth="1.8" fill="none"/>
    <circle cx="8" cy="13" r="1.5" fill={active ? '#FFD700' : '#8a8a9a'}/>
    <circle cx="16" cy="13" r="1.5" fill={active ? '#FFD700' : '#8a8a9a'}/>
    <path d="M12 10v6M9 13h6" stroke={active ? '#FFD700' : '#8a8a9a'} strokeWidth="1.8" strokeLinecap="round"/>
    <path d="M8 6V4M16 6V4" stroke={active ? '#FFD700' : '#8a8a9a'} strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
);

const WalletIcon = ({ active }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <rect x="2" y="7" width="20" height="14" rx="3" stroke={active ? '#FFD700' : '#8a8a9a'} strokeWidth="1.8" fill="none"/>
    <path d="M2 11h20" stroke={active ? '#FFD700' : '#8a8a9a'} strokeWidth="1.8"/>
    <path d="M6 4h12" stroke={active ? '#FFD700' : '#8a8a9a'} strokeWidth="1.8" strokeLinecap="round"/>
    <circle cx="16.5" cy="16" r="1.5" fill={active ? '#FFD700' : '#8a8a9a'}/>
  </svg>
);

const PromosIcon = ({ active }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M20 12V22H4V12" stroke={active ? '#FFD700' : '#8a8a9a'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M22 7H2v5h20V7z" stroke={active ? '#FFD700' : '#8a8a9a'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12 22V7" stroke={active ? '#FFD700' : '#8a8a9a'} strokeWidth="1.8" strokeLinecap="round"/>
    <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" stroke={active ? '#FFD700' : '#8a8a9a'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" stroke={active ? '#FFD700' : '#8a8a9a'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ProfileIcon = ({ active }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="8" r="4" stroke={active ? '#FFD700' : '#8a8a9a'} strokeWidth="1.8" fill="none"/>
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={active ? '#FFD700' : '#8a8a9a'} strokeWidth="1.8" strokeLinecap="round" fill="none"/>
  </svg>
);

const ICONS = { '/': GamesIcon, '/wallet': WalletIcon, '/promotions': PromosIcon, '/profile': ProfileIcon };

const navItems = [
  { path: '/', label: 'Games' },
  { path: '/wallet', label: 'Wallet' },
  { path: '/promotions', label: 'Promos' },
  { path: '/profile', label: 'Profile' },
];

export default function BottomNav() {
  const { pathname } = useLocation();

  return (
    <nav className="bottom-nav" style={{
      background: 'linear-gradient(180deg, rgba(26, 10, 46, 0.99) 0%, rgba(13, 2, 33, 0.995) 100%)',
      borderTop: '1px solid rgba(255, 215, 0, 0.15)',
      boxShadow: '0 -4px 30px rgba(0, 0, 0, 0.5)'
    }}>
      {navItems.map(({ path, label, icon, activeIcon }) => {
        const isActive = pathname === path;
        
        const Icon = ICONS[path];
        return (
          <Link 
            key={path} 
            to={path} 
            className={isActive ? 'active' : ''}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              padding: '10px 16px',
              fontSize: '10px',
              color: isActive ? 'var(--gold)' : 'var(--text-muted)',
              transition: 'all 0.3s ease',
              borderRadius: '12px',
              position: 'relative',
              minWidth: '60px'
            }}
          >
            {isActive && (
              <>
                <div style={{
                  position: 'absolute',
                  top: '-1px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '32px',
                  height: '3px',
                  background: 'linear-gradient(90deg, var(--gold), #ffed4a, var(--gold))',
                  borderRadius: '0 0 4px 4px',
                  boxShadow: '0 0 15px rgba(255, 215, 0, 0.6)'
                }} />
                <div style={{
                  position: 'absolute',
                  inset: '0',
                  background: 'radial-gradient(circle at center, rgba(255, 215, 0, 0.15), transparent 70%)',
                  borderRadius: '12px',
                  pointerEvents: 'none'
                }} />
              </>
            )}
            
            {/* Icon */}
            <span style={{ 
              transition: 'all 0.3s ease',
              transform: isActive ? 'scale(1.15)' : 'scale(1)',
              filter: isActive ? 'drop-shadow(0 0 8px rgba(255, 215, 0, 0.6))' : 'none',
              display: 'flex'
            }}>
              <Icon active={isActive} />
            </span>
            
            {/* Label */}
            <span style={{ 
              fontWeight: isActive ? '700' : '500',
              textShadow: isActive ? '0 0 10px rgba(255, 215, 0, 0.5)' : 'none',
              letterSpacing: isActive ? '0.5px' : '0'
            }}>
              {label}
            </span>
            
            {/* Active dot indicator */}
            {isActive && (
              <div style={{
                width: '4px',
                height: '4px',
                background: 'var(--gold)',
                borderRadius: '50%',
                boxShadow: '0 0 8px var(--gold)'
              }} />
            )}
          </Link>
        );
      })}
      
      {/* Decorative side glow effects */}
      <div style={{
        position: 'absolute',
        left: '0',
        bottom: '0',
        width: '100px',
        height: '60px',
        background: 'radial-gradient(circle at bottom left, rgba(255, 45, 117, 0.1), transparent 70%)',
        pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute',
        right: '0',
        bottom: '0',
        width: '100px',
        height: '60px',
        background: 'radial-gradient(circle at bottom right, rgba(138, 43, 226, 0.1), transparent 70%)',
        pointerEvents: 'none'
      }} />
    </nav>
  );
}
