import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLogo } from '../../hooks/useLogo';

const NAV = [
  { path: '/admin',             icon: '▣',  label: 'Dashboard'   },
  { path: '/admin/players',     icon: '👥', label: 'Players'     },
  { path: '/admin/withdrawals', icon: '💸', label: 'Withdrawals' },
  { path: '/admin/games',       icon: '🎮', label: 'Games'       },
];

const S = {
  sidebar: (open) => ({
    width: open ? '220px' : '60px',
    background: '#0f0f1a',
    borderRight: '1px solid #1e1e2e',
    display: 'flex', flexDirection: 'column',
    transition: 'width 0.22s ease',
    overflow: 'hidden', flexShrink: 0,
    position: 'sticky', top: 0, height: '100vh', zIndex: 200,
  }),
  logoBox: {
    padding: '0 12px', height: '60px',
    borderBottom: '1px solid #1e1e2e',
    display: 'flex', alignItems: 'center', gap: '10px',
  },
  logoIcon: {
    width: '36px', height: '36px', flexShrink: 0,
    background: 'linear-gradient(135deg, #ffd700, #b8860b)',
    borderRadius: '8px', display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: '18px',
  },
  navLink: (active) => ({
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '10px 12px', borderRadius: '8px', margin: '2px 0',
    background: active ? 'rgba(255,215,0,0.1)' : 'transparent',
    borderLeft: active ? '3px solid #ffd700' : '3px solid transparent',
    color: active ? '#ffd700' : '#8888aa',
    fontWeight: active ? '600' : '400',
    fontSize: '13px', whiteSpace: 'nowrap',
    textDecoration: 'none', transition: 'all 0.15s',
  }),
  header: {
    height: '60px', background: '#0f0f1a',
    borderBottom: '1px solid #1e1e2e',
    display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', padding: '0 24px',
    position: 'sticky', top: 0, zIndex: 100,
  },
};

export default function AdminLayout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);
  const logoUrl = useLogo();

  const currentPage = NAV.find(n => n.path === location.pathname)?.label || 'Admin';

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0a0a14', color: '#e0e0f0' }}>
      {/* Sidebar */}
      <aside style={S.sidebar(open)}>
        <div style={S.logoBox}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
            {logoUrl
              ? <img src={logoUrl} alt="Logo" style={{ height: open ? '40px' : '32px', maxWidth: open ? '140px' : '36px', objectFit: 'contain', transition: 'all 0.22s ease' }} />
              : (
                <>
                  <div style={S.logoIcon}>🐉</div>
                  {open && (
                    <div>
                      <div style={{ fontWeight: '800', fontSize: '14px', color: '#ffd700', letterSpacing: '1px' }}>REELX</div>
                      <div style={{ fontSize: '9px', color: '#555577', letterSpacing: '2px' }}>ADMIN PANEL</div>
                    </div>
                  )}
                </>
              )
            }
          </Link>
        </div>

        <nav style={{ flex: 1, padding: '12px 8px' }}>
          {open && <div style={{ fontSize: '10px', color: '#444466', letterSpacing: '1.5px', padding: '8px 12px 4px', textTransform: 'uppercase' }}>Navigation</div>}
          {NAV.map(({ path, icon, label }) => {
            const active = location.pathname === path;
            return (
              <Link key={path} to={path} style={S.navLink(active)}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ fontSize: '16px', flexShrink: 0, width: '20px', textAlign: 'center' }}>{icon}</span>
                {open && label}
              </Link>
            );
          })}
        </nav>

        <div style={{ padding: '12px 8px', borderTop: '1px solid #1e1e2e' }}>
          {open && (
            <div style={{ padding: '8px 12px', marginBottom: '8px', background: '#13131f', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#e0e0f0' }}>{user?.username}</div>
              <div style={{ fontSize: '10px', color: '#555577', marginTop: '2px' }}>Administrator</div>
            </div>
          )}
          <button onClick={() => { logout(); navigate('/login'); }} style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            width: '100%', padding: '10px 12px',
            background: 'rgba(255,71,87,0.08)', border: '1px solid rgba(255,71,87,0.15)',
            borderRadius: '8px', color: '#ff4757', fontSize: '13px',
            cursor: 'pointer', whiteSpace: 'nowrap',
          }}>
            <span style={{ fontSize: '14px', flexShrink: 0 }}>⏻</span>
            {open && 'Logout'}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header style={S.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button onClick={() => setOpen(o => !o)} style={{
              width: '34px', height: '34px', borderRadius: '6px',
              background: '#13131f', border: '1px solid #1e1e2e',
              color: '#8888aa', fontSize: '14px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>☰</button>
            <div>
              <div style={{ fontSize: '15px', fontWeight: '700', color: '#e0e0f0' }}>{currentPage}</div>
              <div style={{ fontSize: '11px', color: '#555577' }}>Admin Panel</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{
              padding: '5px 12px', borderRadius: '20px',
              background: 'rgba(0,245,160,0.08)', border: '1px solid rgba(0,245,160,0.2)',
              fontSize: '11px', color: '#00f5a0', fontWeight: '600',
            }}>● Live</span>
            <Link to="/" style={{
              padding: '6px 14px', borderRadius: '6px',
              background: '#13131f', border: '1px solid #1e1e2e',
              fontSize: '12px', color: '#8888aa',
            }}>← Player View</Link>
          </div>
        </header>

        <main style={{ flex: 1, padding: '28px', overflowY: 'auto' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
