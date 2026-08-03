import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { adminAPI } from '../../services/api';
import { useLogo } from '../../hooks/useLogo';

/* ── Shared primitives ─────────────────────────────────── */
const Card = ({ children, style }) => (
  <div style={{
    background: '#13131f', border: '1px solid #1e1e2e',
    borderRadius: '12px', ...style,
  }}>{children}</div>
);

const StatCard = ({ icon, label, value, sub, accent = '#ffd700', alert }) => (
  <Card style={{ padding: '20px', position: 'relative', overflow: 'hidden' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
      <div style={{
        width: '40px', height: '40px', borderRadius: '10px',
        background: `${accent}18`, display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: '18px',
      }}>{icon}</div>
      {alert && <span style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '20px', background: 'rgba(255,71,87,0.12)', color: '#ff4757', border: '1px solid rgba(255,71,87,0.2)', fontWeight: '700' }}>HIGH</span>}
    </div>
    <div style={{ fontSize: '26px', fontWeight: '800', color: alert ? '#ff4757' : accent, letterSpacing: '-0.5px' }}>{value}</div>
    <div style={{ fontSize: '12px', color: '#555577', marginTop: '4px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
    {sub && <div style={{ fontSize: '11px', color: '#666688', marginTop: '6px' }}>{sub}</div>}
  </Card>
);

const Pagination = ({ page, total, perPage, onChange }) => {
  const pages = Math.ceil(total / perPage);
  if (pages <= 1) return null;
  const visible = Array.from({ length: pages }, (_, i) => i + 1).filter(p => Math.abs(p - page) <= 2);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center', marginTop: '20px' }}>
      <PBtn disabled={page === 1} onClick={() => onChange(page - 1)}>‹</PBtn>
      {visible[0] > 1 && <><PBtn onClick={() => onChange(1)}>1</PBtn>{visible[0] > 2 && <span style={{ color: '#555577' }}>…</span>}</>}
      {visible.map(p => <PBtn key={p} active={p === page} onClick={() => onChange(p)}>{p}</PBtn>)}
      {visible[visible.length - 1] < pages && <><span style={{ color: '#555577' }}>…</span><PBtn onClick={() => onChange(pages)}>{pages}</PBtn></>}
      <PBtn disabled={page === pages} onClick={() => onChange(page + 1)}>›</PBtn>
      <span style={{ fontSize: '11px', color: '#555577', marginLeft: '8px' }}>
        {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} of {total}
      </span>
    </div>
  );
};

const PBtn = ({ children, active, disabled, onClick }) => (
  <button onClick={onClick} disabled={disabled} style={{
    minWidth: '32px', height: '32px', padding: '0 8px',
    borderRadius: '6px', fontSize: '13px', fontWeight: '600',
    cursor: disabled ? 'not-allowed' : 'pointer',
    background: active ? 'rgba(255,215,0,0.15)' : '#1a1a2e',
    border: active ? '1px solid rgba(255,215,0,0.4)' : '1px solid #1e1e2e',
    color: active ? '#ffd700' : disabled ? '#333355' : '#8888aa',
    transition: 'all 0.15s',
  }}>{children}</button>
);

/* ── Dashboard ─────────────────────────────────────────── */
export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const logoUrl = useLogo();
  const [logoPreview, setLogoPreview] = useState(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoMsg, setLogoMsg] = useState('');
  const logoInputRef = useRef();

  const [affiliations, setAffiliations] = useState([]);
  const [affSearch, setAffSearch] = useState('');
  const [affTab, setAffTab] = useState('all');
  const [affLoading, setAffLoading] = useState(false);
  const [affPage, setAffPage] = useState(1);
  const [affTotal, setAffTotal] = useState(0);
  const [affStats, setAffStats] = useState({ total: 0, deposited: 0, not_deposited: 0, total_deposited: 0, total_commission: 0 });
  const [affError, setAffError] = useState('');
  const AFF_PER_PAGE = 20;

  useEffect(() => {
    adminAPI.dashboard()
      .then(({ data }) => setStats(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (tab === 'affiliations') loadAffiliations(1);
  }, [tab]);

  useEffect(() => {
    if (tab !== 'affiliations') return;
    loadAffiliations(1);
  }, [affTab]);

  // Debounced search
  useEffect(() => {
    if (tab !== 'affiliations') return;
    const t = setTimeout(() => loadAffiliations(1), 400);
    return () => clearTimeout(t);
  }, [affSearch]);

  const loadAffiliations = async (page = affPage) => {
    setAffLoading(true);
    setAffError('');
    try {
      const params = {
        page,
        limit: AFF_PER_PAGE,
        ...(affSearch ? { search: affSearch } : {}),
        ...(affTab === 'deposited' ? { deposited: '1' } : {}),
      };
      const affResult = await adminAPI.affiliations(params);
      const rows = affResult.data.data || [];
      const total = parseInt(affResult.data.total) || 0;
      setAffiliations(rows);
      setAffTotal(total);
      setAffPage(page);
      setAffStats({
        total,
        deposited:        rows.filter(a => a.has_deposited).length,
        not_deposited:    rows.filter(a => !a.has_deposited).length,
        total_deposited:  rows.reduce((s, a) => s + Number(a.total_deposited || 0), 0),
        total_commission: rows.reduce((s, a) => s + Number(a.commission_earned || 0), 0),
      });
    } catch (err) {
      setAffError(err.response?.data?.error || 'Failed to load affiliations');
    }
    setAffLoading(false);
  };

  if (loading) return <div className="loading"><div className="spinner" /></div>;
  if (!stats) return <p style={{ color: '#ff4757', padding: '20px' }}>Failed to load dashboard. Check backend logs.</p>;


  return (
    <div style={{ maxWidth: '1280px' }}>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#e0e0f0', marginBottom: '4px' }}>Dashboard</h1>
        <p style={{ fontSize: '13px', color: '#555577' }}>Platform overview and analytics</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '28px', borderBottom: '1px solid #1e1e2e', paddingBottom: '0' }}>
        {[['overview', 'Overview'], ['affiliations', 'Affiliations'], ['branding', 'Branding']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: '10px 18px', fontSize: '13px', fontWeight: '600',
            background: 'none', border: 'none',
            borderBottom: tab === key ? '2px solid #ffd700' : '2px solid transparent',
            color: tab === key ? '#ffd700' : '#555577',
            cursor: 'pointer', marginBottom: '-1px', transition: 'all 0.15s',
          }}>{label}</button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {tab === 'overview' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '28px' }}>
            <StatCard icon="🟢" label="Online Players"    value={stats.onlinePlayers}                                                        accent="#00f5a0" />
            <StatCard icon="💰" label="Daily Revenue"     value={`₱${stats.dailyRevenue.toLocaleString()}`}                                   accent="#ffd700" />
            <StatCard icon="📥" label="Today Deposits"    value={`₱${stats.deposits.total.toLocaleString()}`}                                sub={`${stats.deposits.count} transactions`} />
            <StatCard icon="💳" label="Total Deposited"   value={`₱${stats.totalDeposited.total.toLocaleString()}`}                          sub={`${stats.totalDeposited.count} completed deposits`} accent="#00f5a0" />
            <StatCard icon="📤" label="Withdrawals"       value={`₱${stats.withdrawals.total.toLocaleString()}`}                             sub={`${stats.withdrawals.count} transactions`} accent="#a78bfa" />
            <StatCard icon="🎲" label="Total Bets"        value={`₱${stats.bets.total.toLocaleString()}`}                                    sub={`${stats.bets.count} spins`} accent="#60a5fa" />
            <StatCard icon="🏆" label="Total Wins"        value={`₱${stats.wins.toLocaleString()}`}                                          accent="#00f5a0" />
            <StatCard icon="📈" label="RTP"               value={`${stats.rtp}%`}                                                            accent={stats.rtp > 97 ? '#ff4757' : '#00f5a0'} alert={stats.rtp > 97} />
            <StatCard icon="🎮" label="Active Games"      value={stats.activeGames} />
          </div>

          {/* Quick Actions */}
          <Card style={{ padding: '24px' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#555577', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Quick Actions</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
              {[
                { to: '/admin/players',     icon: '👥', label: 'Player Management',    desc: 'Manage accounts & KYC',    accent: '#60a5fa' },
                { to: '/admin/withdrawals', icon: '💸', label: 'Withdrawal Approvals', desc: 'Review pending requests',   accent: '#a78bfa' },
                { to: '/admin/games',       icon: '🎮', label: 'Game Configuration',   desc: 'RTP, limits & controls',   accent: '#ffd700' },
              ].map(({ to, icon, label, desc, accent }) => (
                <Link key={to} to={to} style={{
                  display: 'flex', alignItems: 'center', gap: '14px',
                  padding: '16px 18px', borderRadius: '10px',
                  background: '#0f0f1a', border: '1px solid #1e1e2e',
                  color: '#c0c0d8', textDecoration: 'none', transition: 'all 0.15s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = accent + '55'; e.currentTarget.style.background = accent + '0a'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#1e1e2e'; e.currentTarget.style.background = '#0f0f1a'; }}
                >
                  <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: accent + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>{icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#e0e0f0', marginBottom: '2px' }}>{label}</div>
                    <div style={{ fontSize: '11px', color: '#555577' }}>{desc}</div>
                  </div>
                  <span style={{ color: '#333355', fontSize: '18px' }}>›</span>
                </Link>
              ))}
              <button onClick={() => setTab('affiliations')} style={{
                display: 'flex', alignItems: 'center', gap: '14px',
                padding: '16px 18px', borderRadius: '10px',
                background: '#0f0f1a', border: '1px solid #1e1e2e',
                color: '#c0c0d8', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#00f5a055'; e.currentTarget.style.background = '#00f5a00a'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#1e1e2e'; e.currentTarget.style.background = '#0f0f1a'; }}
              >
                <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#00f5a018', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>🔗</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#e0e0f0', marginBottom: '2px' }}>Affiliation Management</div>
                  <div style={{ fontSize: '11px', color: '#555577' }}>Referrals & commissions</div>
                </div>
                <span style={{ color: '#333355', fontSize: '18px' }}>›</span>
              </button>
            </div>
          </Card>
        </>
      )}

      {/* ── BRANDING ── */}
      {tab === 'branding' && (
        <Card style={{ padding: '28px', maxWidth: '520px' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#555577', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '20px' }}>Platform Logo</div>

          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '12px', color: '#555577', marginBottom: '10px' }}>Current Logo</div>
            <div style={{
              width: '180px', height: '80px', borderRadius: '10px',
              background: '#0f0f1a', border: '1px solid #1e1e2e',
              display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
            }}>
              {logoPreview
                ? <img src={logoPreview} alt="preview" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                : logoUrl
                  ? <img src={logoUrl} alt="logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  : <span style={{ fontSize: '28px' }}>🐉</span>
              }
            </div>
          </div>

          <div style={{
            padding: '12px 14px', borderRadius: '8px', marginBottom: '20px',
            background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.2)',
          }}>
            <div style={{ fontSize: '12px', color: '#60a5fa', fontWeight: '600', marginBottom: '6px' }}>📌 Recommended Specs</div>
            <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px', color: '#8888aa', lineHeight: '1.9' }}>
              <li>Format: <strong style={{ color: '#c0c0d8' }}>PNG or SVG</strong> (transparent background)</li>
              <li>Size: <strong style={{ color: '#c0c0d8' }}>400 × 160 px</strong> minimum</li>
              <li>Aspect ratio: <strong style={{ color: '#c0c0d8' }}>2.5 : 1</strong> (wide logo)</li>
              <li>Max file size: <strong style={{ color: '#c0c0d8' }}>2 MB</strong></li>
            </ul>
          </div>

          <input
            ref={logoInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files[0];
              if (!file) return;
              if (file.size > 2 * 1024 * 1024) {
                setLogoMsg('❌ File too large. Maximum size is 2MB.');
                e.target.value = '';
                return;
              }
              setLogoPreview(URL.createObjectURL(file));
              setLogoMsg('');
            }}
          />

          <button
            onClick={() => logoInputRef.current.click()}
            style={{
              width: '100%', padding: '12px', borderRadius: '8px', marginBottom: '12px',
              background: '#0f0f1a', border: '2px dashed #1e1e2e',
              color: '#8888aa', fontSize: '13px', cursor: 'pointer',
            }}
          >
            {logoPreview ? '🖼️ Change Image' : '📤 Select Logo Image'}
          </button>

          {logoPreview && (
            <button
              disabled={logoUploading}
              onClick={async () => {
                const file = logoInputRef.current.files[0];
                if (!file) return;
                setLogoUploading(true);
                setLogoMsg('');
                try {
                  await adminAPI.uploadLogo(file);
                  localStorage.removeItem('platform_logo_url');
                  setLogoMsg('✅ Logo uploaded! Refreshing...');
                  setTimeout(() => window.location.reload(), 1200);
                } catch (err) {
                  setLogoMsg('❌ ' + (err.response?.data?.error || 'Upload failed'));
                }
                setLogoUploading(false);
              }}
              className="btn btn-primary"
              style={{ width: '100%' }}
            >
              {logoUploading ? 'Uploading...' : '✅ Save Logo'}
            </button>
          )}

          {logoMsg && (
            <p style={{ marginTop: '12px', fontSize: '13px', color: logoMsg.startsWith('✅') ? '#00f5a0' : '#ff4757' }}>
              {logoMsg}
            </p>
          )}
        </Card>
      )}

      {/* ── AFFILIATIONS ── */}
      {tab === 'affiliations' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <StatCard icon="👥" label="Total Referrals"   value={affStats.total} />
            <StatCard icon="✅" label="Deposited"         value={affStats.deposited}      accent="#00f5a0" sub="on this page" />
            <StatCard icon="⏳" label="Not Deposited"     value={affStats.not_deposited}  accent="#8888aa" sub="on this page" />
            <StatCard icon="💰" label="Page Deposited"    value={`₱${Number(affStats.total_deposited).toLocaleString()}`} />
            <StatCard icon="🏷️" label="Page Commission"   value={`₱${Number(affStats.total_commission).toLocaleString()}`} accent="#a78bfa" />
          </div>

          <Card>
            <div style={{ display: 'flex', gap: '8px', padding: '16px 20px', borderBottom: '1px solid #1e1e2e', flexWrap: 'wrap', alignItems: 'center' }}>
              {[['all', 'All'], ['deposited', 'Deposited Only']].map(([key, label]) => (
                <button key={key} onClick={() => setAffTab(key)} style={{
                  padding: '7px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: '600',
                  background: affTab === key ? 'rgba(255,215,0,0.1)' : 'transparent',
                  border: affTab === key ? '1px solid rgba(255,215,0,0.3)' : '1px solid #1e1e2e',
                  color: affTab === key ? '#ffd700' : '#555577', cursor: 'pointer',
                }}>{label}</button>
              ))}
              <button onClick={() => loadAffiliations(1)} style={{
                padding: '7px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: '600',
                background: 'transparent', border: '1px solid #1e1e2e',
                color: '#8888aa', cursor: 'pointer',
              }}>↻ Refresh</button>
              <input
                type="text" placeholder="Search username or email…"
                value={affSearch} onChange={e => setAffSearch(e.target.value)}
                style={{
                  marginLeft: 'auto', padding: '8px 14px', borderRadius: '6px',
                  background: '#0f0f1a', border: '1px solid #1e1e2e',
                  color: '#e0e0f0', fontSize: '13px', minWidth: '220px', outline: 'none',
                }}
              />
            </div>

            {affError && (
              <div style={{ padding: '16px 20px', color: '#ff4757', fontSize: '13px' }}>⚠ {affError}</div>
            )}

            {affLoading ? (
              <div style={{ padding: '48px', textAlign: 'center', color: '#555577' }}>Loading...</div>
            ) : (
              <>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #1e1e2e' }}>
                        {['Referrer', 'Referred User', 'Status', 'Deposited', 'Commission', 'Joined'].map(h => (
                          <th key={h} style={{ padding: '12px 20px', textAlign: 'left', color: '#555577', fontWeight: '600', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {affiliations.length === 0 ? (
                        <tr><td colSpan="6" style={{ padding: '48px', textAlign: 'center', color: '#555577' }}>
                          {affSearch ? `No results for "${affSearch}"` : 'No affiliations found'}
                        </td></tr>
                      ) : affiliations.map(aff => (
                        <tr key={aff.id} style={{ borderBottom: '1px solid #1a1a2a' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#0f0f1a'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <td style={{ padding: '14px 20px' }}>
                            <div style={{ fontWeight: '600', color: '#e0e0f0' }}>{aff.referrer_username}</div>
                            <div style={{ fontSize: '11px', color: '#555577' }}>{aff.referrer_email}</div>
                            <div style={{ fontSize: '10px', color: '#ffd700', marginTop: '2px' }}>Code: {aff.referral_code}</div>
                          </td>
                          <td style={{ padding: '14px 20px' }}>
                            <div style={{ fontWeight: '600', color: '#e0e0f0' }}>{aff.referee_username}</div>
                            <div style={{ fontSize: '11px', color: '#555577' }}>{aff.referee_email}</div>
                          </td>
                          <td style={{ padding: '14px 20px' }}>
                            <StatusBadge ok={aff.has_deposited} yes="Deposited" no="Registered" />
                          </td>
                          <td style={{ padding: '14px 20px', fontWeight: '700', color: aff.has_deposited ? '#ffd700' : '#555577' }}>
                            ₱{Number(aff.total_deposited || 0).toLocaleString()}
                          </td>
                          <td style={{ padding: '14px 20px', fontWeight: '700', color: '#a78bfa' }}>
                            ₱{Number(aff.commission_earned || 0).toLocaleString()}
                          </td>
                          <td style={{ padding: '14px 20px', fontSize: '12px', color: '#555577' }}>
                            {new Date(aff.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ padding: '16px 20px', borderTop: '1px solid #1e1e2e' }}>
                  <Pagination
                    page={affPage}
                    total={affTotal}
                    perPage={AFF_PER_PAGE}
                    onChange={(p) => loadAffiliations(p)}
                  />
                </div>
              </>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function StatusBadge({ ok, yes, no }) {
  return (
    <span style={{
      padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700',
      background: ok ? 'rgba(0,245,160,0.1)' : 'rgba(136,136,170,0.1)',
      color: ok ? '#00f5a0' : '#8888aa',
      border: `1px solid ${ok ? 'rgba(0,245,160,0.25)' : 'rgba(136,136,170,0.2)'}`,
    }}>{ok ? yes : no}</span>
  );
}
