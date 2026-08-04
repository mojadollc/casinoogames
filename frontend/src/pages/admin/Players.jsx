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

/* ── Player Detail Panel (full KYC) ─────────────────────── */
const DetailPanel = ({ player, loading, onClose, onAction }) => {
  if (!player && !loading) return null;

  const claimed = player?.kyc_bonus_claimed || {};
  const hasSelfie = !!(player?.profile_image && String(player.profile_image).startsWith('data:image/'));

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', justifyContent: 'flex-end',
      background: 'rgba(0,0,0,0.45)',
    }} onClick={onClose}>
      <div style={{
        width: '420px', maxWidth: '100%', height: '100%', background: '#13131f',
        borderLeft: '1px solid #1e1e2e', padding: '28px 24px',
        overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px',
      }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#555577', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>Player KYC Profile</div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: '#e0e0f0' }}>{player?.username || '…'}</div>
            <div style={{ fontSize: '12px', color: '#555577', marginTop: '3px' }}>{player?.email || ''}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#555577', fontSize: '22px', cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}>×</button>
        </div>

        {loading || !player ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#555577' }}>Loading player details…</div>
        ) : (
          <>
            {/* Selfie */}
            <div style={{ padding: '16px', background: '#0f0f1a', borderRadius: '10px', border: '1px solid #1e1e2e', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#555577', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Selfie (KYC)</div>
              {hasSelfie ? (
                <img
                  src={player.profile_image}
                  alt="Player selfie"
                  style={{ width: '160px', height: '160px', borderRadius: '12px', objectFit: 'cover', border: '2px solid rgba(255,215,0,0.35)' }}
                />
              ) : (
                <div style={{
                  width: '160px', height: '160px', margin: '0 auto', borderRadius: '12px',
                  background: 'linear-gradient(135deg, #1e1e3a, #2a2a4a)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '48px', color: '#ffd700', border: '1px dashed #333355',
                }}>
                  {player.username?.[0]?.toUpperCase() || '?'}
                </div>
              )}
              <div style={{ marginTop: '10px', fontSize: '12px', color: hasSelfie || claimed.selfie ? '#00f5a0' : '#fee440' }}>
                {hasSelfie ? '✅ Selfie on file' : claimed.selfie ? '⚠️ Claimed (image not stored)' : '❌ No selfie submitted'}
              </div>
            </div>

            {/* Contact & address */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '14px', background: '#0f0f1a', borderRadius: '10px', border: '1px solid #1e1e2e' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#555577', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Submitted details</div>
              <InfoRow label="Username" value={player.username} />
              <InfoRow label="Email" value={player.email} />
              <InfoRow label="Phone" value={player.phone} empty="Not provided" />
              <InfoRow label="Address" value={player.address} empty="Not provided" multiline />
              <InfoRow label="User ID" value={player.id} mono />
            </div>

            {/* KYC checklist */}
            <div style={{ padding: '14px', background: '#0f0f1a', borderRadius: '10px', border: '1px solid #1e1e2e' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#555577', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>KYC steps</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <KycStep done={!!claimed.selfie || hasSelfie} label="Selfie" bonus="₱50" />
                <KycStep done={!!claimed.phone || !!player.phone} label="Phone number" bonus="₱30" />
                <KycStep done={!!claimed.location || !!player.address} label="Address / location" bonus="₱20" />
              </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {[
                { label: 'Balance', value: `₱${Number(player.balance || 0).toLocaleString()}`, color: '#ffd700' },
                { label: 'VIP Level', value: `Level ${player.vip_level ?? 0}`, color: '#a78bfa' },
                { label: 'KYC Status', value: player.kyc_status, color: player.kyc_status === 'verified' ? '#00f5a0' : '#fee440' },
                { label: 'Account', value: player.status, color: player.status === 'active' ? '#00f5a0' : '#ff4757' },
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
              Joined {player.created_at ? new Date(player.created_at).toLocaleString() : '—'}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const InfoRow = ({ label, value, empty = '—', multiline, mono }) => (
  <div style={{ display: 'flex', flexDirection: multiline ? 'column' : 'row', gap: multiline ? '4px' : '12px', fontSize: '13px' }}>
    <span style={{ color: '#555577', minWidth: '72px', flexShrink: 0 }}>{label}</span>
    <span style={{
      color: value ? '#e0e0f0' : '#333355',
      fontWeight: value ? 600 : 400,
      wordBreak: 'break-word',
      fontFamily: mono ? 'monospace' : 'inherit',
      fontSize: mono ? '11px' : '13px',
    }}>
      {value || empty}
    </span>
  </div>
);

const KycStep = ({ done, label, bonus }) => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '8px 12px', borderRadius: '8px',
    background: done ? 'rgba(0,245,160,0.06)' : 'rgba(254,228,64,0.05)',
    border: `1px solid ${done ? 'rgba(0,245,160,0.2)' : 'rgba(254,228,64,0.15)'}`,
  }}>
    <span style={{ fontSize: '13px', color: done ? '#00f5a0' : '#fee440', fontWeight: 600 }}>
      {done ? '✅' : '⏳'} {label}
    </span>
    <span style={{ fontSize: '12px', color: '#8888aa' }}>{bonus}</span>
  </div>
);

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
  const [kycFilter, setKycFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [toast, setToast] = useState('');

  const fetchPlayers = (s, p = 1, kyc = kycFilter, st = statusFilter) => {
    setLoading(true);
    const params = { search: s || undefined, page: p, limit: PER_PAGE };
    if (kyc) params.kyc_status = kyc;
    if (st) params.status = st;
    adminAPI.players(params)
      .then(({ data }) => {
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

  const openDetail = async (row) => {
    setSelected(row);
    setDetailLoading(true);
    try {
      const { data } = await adminAPI.player(row.id);
      setSelected(data);
    } catch {
      // keep list row data if detail fails
    } finally {
      setDetailLoading(false);
    }
  };

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
              placeholder="Search username, email, phone, address…"
              value={search}
              onChange={e => { setSearch(e.target.value); fetchPlayers(e.target.value, 1); }}
              style={{ padding: '9px 14px 9px 36px', borderRadius: '8px', background: '#0f0f1a', border: '1px solid #1e1e2e', color: '#e0e0f0', fontSize: '13px', outline: 'none', minWidth: '280px' }}
            />
          </div>
          <select
            value={kycFilter}
            onChange={e => { setKycFilter(e.target.value); fetchPlayers(search, 1, e.target.value, statusFilter); }}
            style={{ padding: '9px 12px', borderRadius: '8px', background: '#0f0f1a', border: '1px solid #1e1e2e', color: '#e0e0f0', fontSize: '13px', outline: 'none' }}
          >
            <option value="">All KYC</option>
            <option value="pending">KYC Pending</option>
            <option value="verified">KYC Verified</option>
            <option value="rejected">KYC Rejected</option>
          </select>
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); fetchPlayers(search, 1, kycFilter, e.target.value); }}
            style={{ padding: '9px 12px', borderRadius: '8px', background: '#0f0f1a', border: '1px solid #1e1e2e', color: '#e0e0f0', fontSize: '13px', outline: 'none' }}
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="banned">Banned</option>
            <option value="pending">Pending</option>
          </select>
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
                      onClick={() => openDetail(p)}
                    >
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'linear-gradient(135deg, #1e1e3a, #2a2a4a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '700', color: '#ffd700', flexShrink: 0, overflow: 'hidden' }}>
                            {p.profile_image && String(p.profile_image).startsWith('data:image/')
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
                      <td style={{ padding: '14px 20px', color: '#e0e0f0', fontSize: '12px', whiteSpace: 'nowrap' }}>
                        {p.phone || <span style={{ color: '#333355' }}>—</span>}
                      </td>
                      <td style={{ padding: '14px 20px', color: '#e0e0f0', fontSize: '12px', minWidth: '180px', maxWidth: '280px' }}>
                        {p.address ? (
                          <span title={p.address} style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            📍 {p.address}
                          </span>
                        ) : (
                          <span style={{ color: '#333355' }}>—</span>
                        )}
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
                            onClick={() => openDetail(p)}
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
        loading={detailLoading}
        onClose={() => setSelected(null)}
        onAction={handleAction}
      />
    </div>
  );
}
