import React, { useState, useEffect } from 'react';
import { adminAPI } from '../../services/api';

const PER_PAGE = 15;

/* ── Primitives ─────────────────────────────────────────── */
const Card = ({ children, style }) => (
  <div style={{ background: '#13131f', border: '1px solid #1e1e2e', borderRadius: '12px', ...style }}>{children}</div>
);

const ActionBtn = ({ children, color, bg, border, onClick, disabled }) => (
  <button onClick={onClick} disabled={disabled} style={{
    display: 'inline-flex', alignItems: 'center', gap: '5px',
    padding: '6px 13px', borderRadius: '7px', fontSize: '12px', fontWeight: '600',
    cursor: disabled ? 'not-allowed' : 'pointer', border: `1px solid ${border}`,
    background: bg, color, transition: 'all 0.15s', whiteSpace: 'nowrap',
    opacity: disabled ? 0.45 : 1,
  }}>{children}</button>
);

const Badge = ({ status }) => {
  const map = {
    active:    ['#00f5a0', 'rgba(0,245,160,0.12)',    'rgba(0,245,160,0.25)'],
    suspended: ['#ff4757', 'rgba(255,71,87,0.12)',    'rgba(255,71,87,0.25)'],
    verified:  ['#00f5a0', 'rgba(0,245,160,0.12)',    'rgba(0,245,160,0.25)'],
    pending:   ['#fee440', 'rgba(254,228,64,0.12)',   'rgba(254,228,64,0.25)'],
    rejected:  ['#ff4757', 'rgba(255,71,87,0.12)',    'rgba(255,71,87,0.25)'],
  };
  const [color, bg, border] = map[status] || ['#8888aa', 'rgba(136,136,170,0.1)', 'rgba(136,136,170,0.2)'];
  return (
    <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', background: bg, color, border: `1px solid ${border}`, textTransform: 'capitalize' }}>
      {status}
    </span>
  );
};

const Pagination = ({ page, total, perPage, onChange }) => {
  const pages = Math.ceil(total / perPage);
  if (pages <= 1) return null;
  const visible = Array.from({ length: pages }, (_, i) => i + 1).filter(p => Math.abs(p - page) <= 2);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
      <PBtn disabled={page === 1} onClick={() => onChange(page - 1)}>‹ Prev</PBtn>
      {visible[0] > 1 && <><PBtn onClick={() => onChange(1)}>1</PBtn>{visible[0] > 2 && <Dots />}</>}
      {visible.map(p => <PBtn key={p} active={p === page} onClick={() => onChange(p)}>{p}</PBtn>)}
      {visible[visible.length - 1] < pages && <><Dots /><PBtn onClick={() => onChange(pages)}>{pages}</PBtn></>}
      <PBtn disabled={page === pages} onClick={() => onChange(page + 1)}>Next ›</PBtn>
      <span style={{ fontSize: '11px', color: '#555577', marginLeft: '8px' }}>
        {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} of {total}
      </span>
    </div>
  );
};

const Dots = () => <span style={{ color: '#333355', padding: '0 2px' }}>…</span>;

const PBtn = ({ children, active, disabled, onClick }) => (
  <button onClick={onClick} disabled={disabled} style={{
    minWidth: '36px', height: '34px', padding: '0 10px', borderRadius: '7px',
    fontSize: '12px', fontWeight: '600', cursor: disabled ? 'not-allowed' : 'pointer',
    background: active ? 'rgba(255,215,0,0.15)' : '#1a1a2e',
    border: active ? '1px solid rgba(255,215,0,0.4)' : '1px solid #1e1e2e',
    color: active ? '#ffd700' : disabled ? '#333355' : '#8888aa',
    transition: 'all 0.15s',
  }}>{children}</button>
);

/* ── Player Detail Panel ────────────────────────────────── */
const DetailPanel = ({ player, onClose, onAction }) => {
  if (!player) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', justifyContent: 'flex-end',
    }} onClick={onClose}>
      <div style={{
        width: '360px', height: '100%', background: '#13131f',
        borderLeft: '1px solid #1e1e2e', padding: '28px 24px',
        overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px',
      }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '16px', fontWeight: '800', color: '#e0e0f0' }}>{player.username}</div>
            <div style={{ fontSize: '12px', color: '#555577', marginTop: '3px' }}>{player.email}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#555577', fontSize: '22px', cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}>×</button>
        </div>

        {/* Avatar + status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px', background: '#0f0f1a', borderRadius: '10px', border: '1px solid #1e1e2e' }}>
          <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'linear-gradient(135deg, #ffd700, #b8860b)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0, overflow: 'hidden' }}>
            {player.profile_image
              ? <img src={player.profile_image} alt="selfie" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : player.username?.[0]?.toUpperCase() || '?'
            }
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '6px' }}>
              <Badge status={player.status} />
              <Badge status={player.kyc_status} />
            </div>
            <div style={{ fontSize: '11px', color: '#555577' }}>VIP Level {player.vip_level} · ID: {player.id?.slice(0, 8)}…</div>
          </div>
        </div>

        {/* Extra info */}
        {(player.phone || player.address) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '12px 14px', background: '#0f0f1a', borderRadius: '8px', border: '1px solid #1e1e2e', fontSize: '12px' }}>
            {player.phone && <div><span style={{ color: '#555577' }}>📱 Phone: </span><span style={{ color: '#e0e0f0' }}>{player.phone}</span></div>}
            {player.address && <div><span style={{ color: '#555577' }}>📍 Address: </span><span style={{ color: '#e0e0f0' }}>{player.address}</span></div>}
          </div>
        )}

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {[
            { label: 'Balance',    value: `₱${Number(player.balance || 0).toLocaleString()}`,       color: '#ffd700' },
            { label: 'VIP Level',  value: `Level ${player.vip_level}`,                              color: '#a78bfa' },
            { label: 'KYC Status', value: player.kyc_status,                                        color: player.kyc_status === 'verified' ? '#00f5a0' : '#fee440' },
            { label: 'Account',    value: player.status,                                            color: player.status === 'active' ? '#00f5a0' : '#ff4757' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ padding: '12px', background: '#0f0f1a', borderRadius: '8px', border: '1px solid #1e1e2e' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color, textTransform: 'capitalize' }}>{value}</div>
              <div style={{ fontSize: '10px', color: '#555577', marginTop: '3px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#555577', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>Actions</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {player.status === 'active' ? (
              <button onClick={() => onAction('suspend', player.id)} style={actionBtnStyle('#ff4757', 'rgba(255,71,87,0.1)', 'rgba(255,71,87,0.25)')}>
                🚫 Suspend Account
              </button>
            ) : (
              <button onClick={() => onAction('activate', player.id)} style={actionBtnStyle('#00f5a0', 'rgba(0,245,160,0.1)', 'rgba(0,245,160,0.25)')}>
                ✅ Activate Account
              </button>
            )}
            {player.kyc_status !== 'verified' && (
              <button onClick={() => onAction('kyc', player.id)} style={actionBtnStyle('#60a5fa', 'rgba(96,165,250,0.1)', 'rgba(96,165,250,0.25)')}>
                🪪 Verify KYC
              </button>
            )}
            {player.kyc_status === 'verified' && (
              <button onClick={() => onAction('kyc_reject', player.id)} style={actionBtnStyle('#fee440', 'rgba(254,228,64,0.08)', 'rgba(254,228,64,0.2)')}>
                ⚠️ Revoke KYC
              </button>
            )}
          </div>
        </div>

        <div style={{ fontSize: '11px', color: '#333355', marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid #1e1e2e' }}>
          Joined {player.created_at ? new Date(player.created_at).toLocaleDateString() : '—'}
        </div>
      </div>
    </div>
  );
};

function actionBtnStyle(color, bg, border) {
  return {
    display: 'flex', alignItems: 'center', gap: '8px',
    width: '100%', padding: '11px 16px', borderRadius: '8px',
    background: bg, border: `1px solid ${border}`, color,
    fontSize: '13px', fontWeight: '600', cursor: 'pointer', textAlign: 'left',
    transition: 'all 0.15s',
  };
}

/* ── Main ───────────────────────────────────────────────── */
export default function AdminPlayers() {
  const [players, setPlayers] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState('');

  const fetchPlayers = (s, p = 1) => {
    setLoading(true);
    adminAPI.players({ search: s, page: p, limit: PER_PAGE })
      .then(({ data }) => {
        // Handle both old array response and new { players, total } response
        if (Array.isArray(data)) {
          setPlayers(data);
          setTotal(data.length);
        } else {
          setPlayers(data.players || []);
          setTotal(data.total || 0);
        }
        setPage(p);
      })
      .catch(() => { setPlayers([]); setTotal(0); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchPlayers(''); }, []);

  const notify = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const handleAction = async (action, id) => {
    try {
      if (action === 'suspend')    await adminAPI.updatePlayerStatus(id, 'suspended');
      if (action === 'activate')   await adminAPI.updatePlayerStatus(id, 'active');
      if (action === 'kyc')        await adminAPI.updateKYC(id, 'verified');
      if (action === 'kyc_reject') await adminAPI.updateKYC(id, 'pending');
      notify('✓ Player updated successfully');
      fetchPlayers(search, page);
      setSelected(prev => prev ? { ...prev, ...getUpdated(action, prev) } : null);
    } catch {
      notify('✗ Action failed');
    }
  };

  const getUpdated = (action, p) => {
    if (action === 'suspend')    return { status: 'suspended' };
    if (action === 'activate')   return { status: 'active' };
    if (action === 'kyc')        return { kyc_status: 'verified' };
    if (action === 'kyc_reject') return { kyc_status: 'pending' };
    return {};
  };

  const handlePageChange = (p) => { fetchPlayers(search, p); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  return (
    <div style={{ maxWidth: '1280px' }}>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#e0e0f0', marginBottom: '4px' }}>Players</h1>
        <p style={{ fontSize: '13px', color: '#555577' }}>Manage player accounts, KYC, and status</p>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          padding: '12px 16px', marginBottom: '20px', borderRadius: '8px', fontSize: '13px', fontWeight: '600',
          background: toast.startsWith('✓') ? 'rgba(0,245,160,0.08)' : 'rgba(255,71,87,0.08)',
          border: `1px solid ${toast.startsWith('✓') ? 'rgba(0,245,160,0.2)' : 'rgba(255,71,87,0.2)'}`,
          color: toast.startsWith('✓') ? '#00f5a0' : '#ff4757',
        }}>{toast}</div>
      )}

      <Card>
        {/* Toolbar */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e1e2e', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#555577', fontSize: '14px' }}>🔍</span>
            <input
              placeholder="Search by username or email…"
              value={search}
              onChange={e => { setSearch(e.target.value); fetchPlayers(e.target.value, 1); }}
              style={{ padding: '9px 14px 9px 36px', borderRadius: '8px', background: '#0f0f1a', border: '1px solid #1e1e2e', color: '#e0e0f0', fontSize: '13px', outline: 'none', minWidth: '280px' }}
            />
          </div>
          <span style={{ fontSize: '12px', color: '#555577', marginLeft: 'auto' }}>
            {total} player{total !== 1 ? 's' : ''}
          </span>
        </div>

        {loading ? (
          <div className="loading"><div className="spinner" /></div>
        ) : players.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#555577' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>👥</div>
            No players found
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #1e1e2e' }}>
                    {['Player', 'Phone', 'Address', 'Balance', 'VIP', 'KYC', 'Status', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '12px 20px', textAlign: 'left', color: '#555577', fontWeight: '600', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {players.map(p => (
                    <tr key={p.id}
                      style={{ borderBottom: '1px solid #1a1a2a', cursor: 'pointer', transition: 'background 0.1s' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#0f0f1a'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      onClick={() => setSelected(p)}
                    >
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'linear-gradient(135deg, #1e1e3a, #2a2a4a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '700', color: '#ffd700', flexShrink: 0, overflow: 'hidden' }}>
                            {p.profile_image
                              ? <img src={p.profile_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              : p.username?.[0]?.toUpperCase()
                            }
                          </div>
                          <div>
                            <div style={{ fontWeight: '600', color: '#e0e0f0' }}>{p.username}</div>
                            <div style={{ fontSize: '11px', color: '#555577' }}>{p.email}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '14px 20px', color: '#e0e0f0', fontSize: '12px' }}>
                        {p.phone || <span style={{ color: '#333355' }}>—</span>}
                      </td>
                      <td style={{ padding: '14px 20px', color: '#8888aa', fontSize: '12px', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.address || <span style={{ color: '#333355' }}>—</span>}
                      </td>
                      <td style={{ padding: '14px 20px', fontWeight: '700', color: '#ffd700' }}>
                        ₱{Number(p.balance || 0).toLocaleString()}
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', background: 'rgba(167,139,250,0.1)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.2)' }}>
                          Lv {p.vip_level}
                        </span>
                      </td>
                      <td style={{ padding: '14px 20px' }}><Badge status={p.kyc_status} /></td>
                      <td style={{ padding: '14px 20px' }}><Badge status={p.status} /></td>
                      <td style={{ padding: '14px 20px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {p.status === 'active' ? (
                            <ActionBtn
                              color="#ff4757" bg="rgba(255,71,87,0.1)" border="rgba(255,71,87,0.25)"
                              onClick={() => handleAction('suspend', p.id)}
                            >🚫 Suspend</ActionBtn>
                          ) : (
                            <ActionBtn
                              color="#00f5a0" bg="rgba(0,245,160,0.1)" border="rgba(0,245,160,0.25)"
                              onClick={() => handleAction('activate', p.id)}
                            >✅ Activate</ActionBtn>
                          )}
                          {p.kyc_status !== 'verified' && (
                            <ActionBtn
                              color="#60a5fa" bg="rgba(96,165,250,0.1)" border="rgba(96,165,250,0.25)"
                              onClick={() => handleAction('kyc', p.id)}
                            >🪪 Verify KYC</ActionBtn>
                          )}
                          <ActionBtn
                            color="#8888aa" bg="rgba(136,136,170,0.08)" border="rgba(136,136,170,0.15)"
                            onClick={() => setSelected(p)}
                          >Details →</ActionBtn>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '16px 20px', borderTop: '1px solid #1e1e2e' }}>
              <Pagination page={page} total={total} perPage={PER_PAGE} onChange={handlePageChange} />
            </div>
          </>
        )}
      </Card>

      {/* Detail panel */}
      <DetailPanel
        player={selected}
        onClose={() => setSelected(null)}
        onAction={handleAction}
      />
    </div>
  );
}
