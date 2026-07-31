import React, { useState, useEffect, useCallback } from 'react';
import { adminAPI } from '../../services/api';

const LIMIT = 20;

const Pagination = ({ page, total, limit, onChange }) => {
  const totalPages = Math.ceil(total / limit);
  if (totalPages <= 1) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
      <button
        onClick={() => onChange(page - 1)} disabled={page === 1}
        style={{ padding: '8px 18px', borderRadius: '10px', border: '1px solid rgba(255,215,0,0.3)', background: page === 1 ? 'rgba(255,255,255,0.04)' : 'rgba(255,215,0,0.1)', color: page === 1 ? 'var(--text-muted)' : 'var(--gold)', cursor: page === 1 ? 'not-allowed' : 'pointer', fontWeight: '600', fontSize: '13px' }}
      >← Prev</button>
      <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Page {page} of {totalPages} <span style={{ color: 'var(--gold)' }}>({total} total)</span></span>
      <button
        onClick={() => onChange(page + 1)} disabled={page >= totalPages}
        style={{ padding: '8px 18px', borderRadius: '10px', border: '1px solid rgba(255,215,0,0.3)', background: page >= totalPages ? 'rgba(255,255,255,0.04)' : 'rgba(255,215,0,0.1)', color: page >= totalPages ? 'var(--text-muted)' : 'var(--gold)', cursor: page >= totalPages ? 'not-allowed' : 'pointer', fontWeight: '600', fontSize: '13px' }}
      >Next →</button>
    </div>
  );
};

export default function AdminAffiliations() {
  const [affiliations, setAffiliations] = useState([]);
  const [total, setTotal] = useState(0);
  const [topReferrers, setTopReferrers] = useState([]);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('all');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [affResult, topResult] = await Promise.all([
        adminAPI.affiliations({ search, limit: LIMIT, page }),
        adminAPI.topReferrers()
      ]);
      setAffiliations(affResult.data.data || []);
      setTotal(affResult.data.total || 0);
      setTopReferrers(topResult.data || []);
    } catch (err) {}
    setLoading(false);
  }, [search, page]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePageChange = (newPage) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div>
      <h2 style={{ fontSize: '20px', marginBottom: '16px' }}>🔗 Affiliation Management</h2>

      <div className="tabs" style={{ marginBottom: '16px' }}>
        <button className={tab === 'all' ? 'active' : ''} onClick={() => setTab('all')}>All Referrals</button>
        <button className={tab === 'top' ? 'active' : ''} onClick={() => setTab('top')}>Top Referrers</button>
      </div>

      <div className="input-group" style={{ marginBottom: '16px' }}>
        <input type="text" placeholder="Search by username or email..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loading ? <div className="loading"><div className="spinner" /></div> : (
        tab === 'all' ? (
          <div className="card">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <th style={{ padding: '12px 8px', textAlign: 'left' }}>Referrer</th>
                    <th style={{ padding: '12px 8px', textAlign: 'left' }}>Referee</th>
                    <th style={{ padding: '12px 8px', textAlign: 'center' }}>Deposited</th>
                    <th style={{ padding: '12px 8px', textAlign: 'right' }}>Total Deposited</th>
                    <th style={{ padding: '12px 8px', textAlign: 'center' }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {affiliations.length === 0 ? (
                    <tr><td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>No affiliations found</td></tr>
                  ) : affiliations.map((aff) => (
                    <tr key={aff.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '10px 8px' }}>
                        <div style={{ fontWeight: '600' }}>{aff.referrer_username}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{aff.referrer_email}</div>
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        <div style={{ fontWeight: '600' }}>{aff.referee_username}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{aff.referee_email}</div>
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: aff.has_deposited ? '#2ecc71' : '#95a5a6', boxShadow: aff.has_deposited ? '0 0 10px #2ecc71' : 'none' }} />
                          <span style={{ fontSize: '11px', color: aff.has_deposited ? '#2ecc71' : '#95a5a6' }}>{aff.has_deposited ? 'Yes' : 'No'}</span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: '600', color: 'var(--gold)' }}>₱{Number(aff.total_deposited || 0).toLocaleString()}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>{new Date(aff.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} total={total} limit={LIMIT} onChange={handlePageChange} />
          </div>
        ) : (
          <div className="card">
            <h3 style={{ marginBottom: '12px' }}>🏆 Top Referrers</h3>
            {topReferrers.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>No referrers yet</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {topReferrers.map((user, idx) => (
                  <div key={user.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: idx < 3 ? 'linear-gradient(135deg, #ffd700, #b8860b)' : 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', color: '#1a0a2e' }}>
                      {idx + 1}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '600' }}>{user.username}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Code: {user.referral_code}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontWeight: '700', color: 'var(--gold)' }}>{user.total_referrals || 0}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Referrals</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontWeight: '700', color: '#2ecc71' }}>{user.deposited_count || 0}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Deposited</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: '700', color: 'var(--gold)' }}>₱{Number(user.total_deposited || 0).toLocaleString()}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Total</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
}
