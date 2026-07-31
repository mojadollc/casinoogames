import React, { useState, useEffect } from 'react';
import { adminAPI } from '../../services/api';

const PER_PAGE = 15;

const Card = ({ children, style }) => (
  <div style={{ background: '#13131f', border: '1px solid #1e1e2e', borderRadius: '12px', ...style }}>{children}</div>
);

const Btn = ({ children, variant = 'default', sm, style, ...props }) => {
  const base = { display: 'inline-flex', alignItems: 'center', gap: '5px', padding: sm ? '6px 12px' : '10px 18px', borderRadius: '7px', fontSize: sm ? '12px' : '13px', fontWeight: '600', cursor: 'pointer', border: 'none', transition: 'all 0.15s', whiteSpace: 'nowrap' };
  const v = { default: { background: '#1a1a2e', color: '#8888aa', border: '1px solid #1e1e2e' }, success: { background: 'rgba(0,245,160,0.1)', color: '#00f5a0', border: '1px solid rgba(0,245,160,0.2)' }, danger: { background: 'rgba(255,71,87,0.1)', color: '#ff4757', border: '1px solid rgba(255,71,87,0.2)' } };
  return <button {...props} style={{ ...base, ...v[variant], ...style }}>{children}</button>;
};

const StatusBadge = ({ status }) => {
  const map = { pending: ['#fee440', 'rgba(254,228,64,0.1)', 'rgba(254,228,64,0.2)'], approved: ['#60a5fa', 'rgba(96,165,250,0.1)', 'rgba(96,165,250,0.2)'], completed: ['#00f5a0', 'rgba(0,245,160,0.1)', 'rgba(0,245,160,0.2)'], rejected: ['#ff4757', 'rgba(255,71,87,0.1)', 'rgba(255,71,87,0.2)'] };
  const [color, bg, border] = map[status] || ['#8888aa', 'rgba(136,136,170,0.1)', 'rgba(136,136,170,0.2)'];
  return <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', background: bg, color, border: `1px solid ${border}` }}>{status}</span>;
};

const Pagination = ({ page, total, perPage, onChange }) => {
  const pages = Math.ceil(total / perPage);
  if (pages <= 1) return null;
  const visible = Array.from({ length: pages }, (_, i) => i + 1).filter(p => Math.abs(p - page) <= 2);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
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
  <button onClick={onClick} disabled={disabled} style={{ minWidth: '32px', height: '32px', padding: '0 8px', borderRadius: '6px', fontSize: '13px', fontWeight: '600', cursor: disabled ? 'not-allowed' : 'pointer', background: active ? 'rgba(255,215,0,0.15)' : '#1a1a2e', border: active ? '1px solid rgba(255,215,0,0.4)' : '1px solid #1e1e2e', color: active ? '#ffd700' : disabled ? '#333355' : '#8888aa' }}>{children}</button>
);

export default function AdminWithdrawals() {
  const [withdrawals, setWithdrawals] = useState([]);
  const [status, setStatus] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const load = (s) => {
    setLoading(true);
    adminAPI.withdrawals(s).then(({ data }) => { setWithdrawals(data); setPage(1); }).finally(() => setLoading(false));
  };

  useEffect(() => { load(status); }, [status]);

  const approve = async (id) => {
    if (!window.confirm('Approve this withdrawal?')) return;
    await adminAPI.approveWithdrawal(id);
    load(status);
  };

  const reject = async (id) => {
    if (!window.confirm('Reject this withdrawal? Amount will be refunded.')) return;
    await adminAPI.rejectWithdrawal(id);
    load(status);
  };

  const paged = withdrawals.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <div style={{ maxWidth: '1280px' }}>
      <div style={{ marginBottom: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#e0e0f0', marginBottom: '4px' }}>Withdrawals</h1>
          <p style={{ fontSize: '13px', color: '#555577' }}>Review and process withdrawal requests</p>
        </div>
        {status === 'pending' && withdrawals.length > 0 && (
          <div style={{ padding: '8px 16px', borderRadius: '8px', background: 'rgba(254,228,64,0.08)', border: '1px solid rgba(254,228,64,0.2)', fontSize: '12px', color: '#fee440', fontWeight: '700' }}>
            ⏳ {withdrawals.length} pending approval
          </div>
        )}
      </div>

      <Card>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid #1e1e2e', padding: '0 20px' }}>
          {[
            { key: 'pending',   label: 'Pending',   dot: '#fee440' },
            { key: 'approved',  label: 'Approved',  dot: '#60a5fa' },
            { key: 'completed', label: 'Completed', dot: '#00f5a0' },
            { key: 'rejected',  label: 'Rejected',  dot: '#ff4757' },
          ].map(({ key, label, dot }) => (
            <button key={key} onClick={() => setStatus(key)} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '14px 18px', background: 'none', border: 'none',
              borderBottom: status === key ? '2px solid #ffd700' : '2px solid transparent',
              color: status === key ? '#ffd700' : '#555577',
              fontSize: '13px', fontWeight: '600', cursor: 'pointer',
              textTransform: 'capitalize', transition: 'all 0.15s', marginBottom: '-1px',
            }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: status === key ? dot : '#333355', flexShrink: 0 }} />
              {label}
            </button>
          ))}
          <span style={{ marginLeft: 'auto', alignSelf: 'center', fontSize: '12px', color: '#555577' }}>{withdrawals.length} records</span>
        </div>

        {loading ? (
          <div className="loading"><div className="spinner" /></div>
        ) : withdrawals.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#555577' }}>No {status} withdrawals</div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #1e1e2e' }}>
                    {['Player', 'Amount', 'Bank / Account', 'Date', 'Status', ...(status === 'pending' ? ['Actions'] : [])].map(h => (
                      <th key={h} style={{ padding: '12px 20px', textAlign: 'left', color: '#555577', fontWeight: '600', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paged.map(wd => (
                    <tr key={wd.id} style={{ borderBottom: '1px solid #1a1a2a' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#0f0f1a'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ fontWeight: '600', color: '#e0e0f0' }}>{wd.username}</div>
                      </td>
                      <td style={{ padding: '14px 20px', fontWeight: '800', color: '#ff4757', fontSize: '14px' }}>
                        ₱{Number(wd.amount).toLocaleString()}
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ color: '#e0e0f0' }}>{wd.bank_code}</div>
                        <div style={{ fontSize: '11px', color: '#555577' }}>{wd.account_number} · {wd.account_name}</div>
                      </td>
                      <td style={{ padding: '14px 20px', fontSize: '12px', color: '#555577', whiteSpace: 'nowrap' }}>
                        {new Date(wd.created_at).toLocaleString()}
                      </td>
                      <td style={{ padding: '14px 20px' }}><StatusBadge status={wd.status || status} /></td>
                      {status === 'pending' && (
                        <td style={{ padding: '14px 20px' }}>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button onClick={() => approve(wd.id)} style={{
                              display: 'inline-flex', alignItems: 'center', gap: '5px',
                              padding: '7px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: '700',
                              cursor: 'pointer', border: '1px solid rgba(0,245,160,0.3)',
                              background: 'rgba(0,245,160,0.1)', color: '#00f5a0', transition: 'all 0.15s',
                            }}>✓ Approve</button>
                            <button onClick={() => reject(wd.id)} style={{
                              display: 'inline-flex', alignItems: 'center', gap: '5px',
                              padding: '7px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: '700',
                              cursor: 'pointer', border: '1px solid rgba(255,71,87,0.3)',
                              background: 'rgba(255,71,87,0.1)', color: '#ff4757', transition: 'all 0.15s',
                            }}>✗ Reject</button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '16px 20px', borderTop: '1px solid #1e1e2e' }}>
              <Pagination page={page} total={withdrawals.length} perPage={PER_PAGE} onChange={setPage} />
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
