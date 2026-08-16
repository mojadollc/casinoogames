import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { authAPI, affiliationAPI } from '../../services/api';
import { useNavigate } from 'react-router-dom';

export default function Profile() {
  const { user, logout, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('profile');
  const [limits, setLimits] = useState({ daily_limit: '', weekly_limit: '', monthly_limit: '' });
  const [message, setMessage] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [referralData, setReferralData] = useState({ code: '', link: '' });
  const [affiliates, setAffiliates] = useState([]);
  const [affStats, setAffStats] = useState(null);
  const [copied, setCopied] = useState(false);
  const [affLoading, setAffLoading] = useState(false);

  // Change password state
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [pwLoading, setPwLoading] = useState(false);

  // Change email state
  const [emailForm, setEmailForm] = useState({ email: '', password: '' });
  const [emailLoading, setEmailLoading] = useState(false);

  // Change username state
  const [unForm, setUnForm] = useState({ username: '', password: '' });
  const [unLoading, setUnLoading] = useState(false);

  useEffect(() => {
    if (user?.responsible_gaming) {
      setLimits({
        daily_limit: user.responsible_gaming.daily_limit || '',
        weekly_limit: user.responsible_gaming.weekly_limit || '',
        monthly_limit: user.responsible_gaming.monthly_limit || '',
      });
    }
  }, [user]);

  useEffect(() => {
    if (tab === 'affiliation') {
      setAffLoading(true);
      Promise.all([
        affiliationAPI.getMyCode().then(({ data }) => setReferralData(data)).catch(() => {}),
        affiliationAPI.getStats().then(({ data }) => setAffStats(data)).catch(() => {}),
        affiliationAPI.getMyAffiliates().then(({ data }) => setAffiliates(data)).catch(() => {}),
      ]).finally(() => setAffLoading(false));
    }
  }, [tab]);

  const changePassword = async () => {
    setMessage('');
    if (pwForm.new_password !== pwForm.confirm_password) {
      setMessage('❌ New passwords do not match'); return;
    }
    if (pwForm.new_password.length < 8) {
      setMessage('❌ New password must be at least 8 characters'); return;
    }
    setPwLoading(true);
    try {
      await authAPI.changePassword(pwForm.current_password, pwForm.new_password);
      setMessage('✅ Password changed successfully');
      setPwForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err) {
      setMessage('❌ ' + (err.response?.data?.error || 'Failed to change password'));
    }
    setPwLoading(false);
  };

  const changeEmail = async () => {
    setMessage('');
    setEmailLoading(true);
    try {
      await authAPI.changeEmail(emailForm.email, emailForm.password);
      setMessage('✅ Email changed successfully');
      setEmailForm({ email: '', password: '' });
      refreshProfile();
    } catch (err) {
      setMessage('❌ ' + (err.response?.data?.error || 'Failed to change email'));
    }
    setEmailLoading(false);
  };

  const changeUsername = async () => {
    setMessage('');
    if (unForm.username.length < 3) {
      setMessage('❌ Username must be at least 3 characters'); return;
    }
    setUnLoading(true);
    try {
      await authAPI.changeUsername(unForm.username, unForm.password);
      setMessage('✅ Username changed successfully');
      setUnForm({ username: '', password: '' });
      refreshProfile();
    } catch (err) {
      setMessage('❌ ' + (err.response?.data?.error || 'Failed to change username'));
    }
    setUnLoading(false);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const saveLimits = async () => {
    try {
      await authAPI.updateProfile({
        responsible_gaming: {
          daily_limit: limits.daily_limit ? parseFloat(limits.daily_limit) : null,
          weekly_limit: limits.weekly_limit ? parseFloat(limits.weekly_limit) : null,
          monthly_limit: limits.monthly_limit ? parseFloat(limits.monthly_limit) : null,
        }
      });
      setMessage('Settings saved');
      refreshProfile();
    } catch { setMessage('Failed to save'); }
  };

  const enable2FA = async () => {
    try {
      const { data } = await authAPI.enable2FA();
      setQrCode(data.qrCode);
    } catch { setMessage('Failed to enable 2FA'); }
  };

  const copyLink = async () => {
    const text = referralData.link;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for mobile browsers that block clipboard API
      const el = document.createElement('textarea');
      el.value = text;
      el.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
      document.body.appendChild(el);
      el.focus();
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!user) return null;

  return (
    <div>
      <div className="tabs">
        <button className={tab === 'profile' ? 'active' : ''} onClick={() => setTab('profile')}>Profile</button>
        <button className={tab === 'security' ? 'active' : ''} onClick={() => setTab('security')}>Security</button>
        <button className={tab === 'limits' ? 'active' : ''} onClick={() => setTab('limits')}>Limits</button>
        <button className={tab === 'affiliation' ? 'active' : ''} onClick={() => setTab('affiliation')}>Affiliation</button>
      </div>

      {message && <div className="card" style={{ textAlign: 'center' }}><p style={{ color: 'var(--secondary)', fontSize: '14px' }}>{message}</p></div>}

      {tab === 'profile' && (
        <div>
          <div className="card" style={{ textAlign: 'center' }}>
            <div className="avatar">{user.username?.[0]?.toUpperCase()}</div>
            <h3>{user.username}</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>{user.email}</p>
            <div className="profile-stats">
              <div className="stat-item">
                <div className="stat-value">⭐ {user.vip_level}</div>
                <div className="stat-label">VIP Level</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{user.kyc_status === 'verified' ? '✅' : '⏳'}</div>
                <div className="stat-label">KYC</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">₱{Number(user.balance || 0).toLocaleString()}</div>
                <div className="stat-label">Balance</div>
              </div>
            </div>
          </div>
          <button className="btn btn-danger" onClick={handleLogout} style={{ marginTop: '12px' }}>Logout</button>
          {user.role_id >= 2 && (
            <button className="btn btn-secondary" onClick={() => navigate('/admin')} style={{ marginTop: '12px' }}>🔧 Admin Dashboard</button>
          )}
        </div>
      )}

      {tab === 'security' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Change Username */}
          <div className="card">
            <h3 style={{ marginBottom: '16px' }}>👤 Change Username</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>Current: <strong style={{ color: 'white' }}>{user.username}</strong></p>
            <div className="input-group">
              <label>New Username</label>
              <input type="text" value={unForm.username} onChange={e => setUnForm({ ...unForm, username: e.target.value })} placeholder="Min 3 characters" />
            </div>
            <div className="input-group">
              <label>Confirm with Password</label>
              <input type="password" value={unForm.password} onChange={e => setUnForm({ ...unForm, password: e.target.value })} placeholder="Enter your password" />
            </div>
            <button className="btn btn-primary" onClick={changeUsername} disabled={unLoading || !unForm.username || !unForm.password}>
              {unLoading ? 'Saving...' : 'Update Username'}
            </button>
          </div>

          {/* Change Password */}
          <div className="card">
            <h3 style={{ marginBottom: '16px' }}>🔑 Change Password</h3>
            <div className="input-group">
              <label>Current Password</label>
              <input type="password" value={pwForm.current_password} onChange={e => setPwForm({ ...pwForm, current_password: e.target.value })} placeholder="Enter current password" />
            </div>
            <div className="input-group">
              <label>New Password</label>
              <input type="password" value={pwForm.new_password} onChange={e => setPwForm({ ...pwForm, new_password: e.target.value })} placeholder="Min 8 characters" />
            </div>
            <div className="input-group">
              <label>Confirm New Password</label>
              <input type="password" value={pwForm.confirm_password} onChange={e => setPwForm({ ...pwForm, confirm_password: e.target.value })} placeholder="Repeat new password" />
            </div>
            <button className="btn btn-primary" onClick={changePassword} disabled={pwLoading || !pwForm.current_password || !pwForm.new_password}>
              {pwLoading ? 'Saving...' : 'Update Password'}
            </button>
          </div>

          {/* Change Email */}
          <div className="card">
            <h3 style={{ marginBottom: '16px' }}>✉️ Change Email</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>Current: <strong style={{ color: 'white' }}>{user.email}</strong></p>
            <div className="input-group">
              <label>New Email</label>
              <input type="email" value={emailForm.email} onChange={e => setEmailForm({ ...emailForm, email: e.target.value })} placeholder="Enter new email" />
            </div>
            <div className="input-group">
              <label>Confirm with Password</label>
              <input type="password" value={emailForm.password} onChange={e => setEmailForm({ ...emailForm, password: e.target.value })} placeholder="Enter your password" />
            </div>
            <button className="btn btn-primary" onClick={changeEmail} disabled={emailLoading || !emailForm.email || !emailForm.password}>
              {emailLoading ? 'Saving...' : 'Update Email'}
            </button>
          </div>

          {/* 2FA */}
          <div className="card">
            <h3 style={{ marginBottom: '16px' }}>🔐 Two-Factor Authentication</h3>
            {user.two_factor_enabled ? (
              <p style={{ color: 'var(--success)' }}>✅ 2FA is enabled</p>
            ) : (
              <>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '12px' }}>Add an extra layer of security</p>
                <button className="btn btn-primary" onClick={enable2FA}>Enable 2FA</button>
                {qrCode && (
                  <div style={{ marginTop: '16px', textAlign: 'center' }}>
                    <img src={qrCode} alt="2FA QR" style={{ maxWidth: '200px', borderRadius: '8px' }} />
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>Scan with Google Authenticator</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {tab === 'limits' && (
        <div className="card">
          <h3 style={{ marginBottom: '16px' }}>Responsible Gaming</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '16px' }}>Set betting limits to stay in control</p>
          <div className="input-group">
            <label>Daily Limit (₱)</label>
            <input type="number" value={limits.daily_limit} onChange={(e) => setLimits({ ...limits, daily_limit: e.target.value })} placeholder="No limit" />
          </div>
          <div className="input-group">
            <label>Weekly Limit (₱)</label>
            <input type="number" value={limits.weekly_limit} onChange={(e) => setLimits({ ...limits, weekly_limit: e.target.value })} placeholder="No limit" />
          </div>
          <div className="input-group">
            <label>Monthly Limit (₱)</label>
            <input type="number" value={limits.monthly_limit} onChange={(e) => setLimits({ ...limits, monthly_limit: e.target.value })} placeholder="No limit" />
          </div>
          <button className="btn btn-primary" onClick={saveLimits}>Save Limits</button>
        </div>
      )}

      {tab === 'affiliation' && (
        <div>
          <div className="card">
            <h3 style={{ marginBottom: '16px' }}>🔗 Your Referral Link</h3>
            {affLoading ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Loading...</p>
            ) : referralData.link ? (
              <>
                {/* Tap-to-copy link box */}
                <div
                  onClick={copyLink}
                  style={{
                    padding: '14px',
                    borderRadius: '10px',
                    border: '1px solid rgba(255,215,0,0.4)',
                    background: 'rgba(255,215,0,0.07)',
                    marginBottom: '10px',
                    cursor: 'pointer',
                    wordBreak: 'break-all',
                    fontSize: '13px',
                    color: 'var(--gold)',
                    lineHeight: '1.5',
                    userSelect: 'all',
                  }}
                >
                  {referralData.link}
                </div>
                <button
                  className="btn btn-primary"
                  onClick={copyLink}
                  style={{ width: '100%', marginBottom: '10px', fontSize: '15px' }}
                >
                  {copied ? '✅ Copied!' : '📋 Copy Referral Link'}
                </button>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Your code: <strong style={{ color: 'var(--gold)', letterSpacing: '2px' }}>{referralData.code}</strong>
                </p>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Share this link. When someone signs up and deposits, you'll earn 5% commission!</p>
              </>
            ) : (
              <p style={{ color: 'var(--danger)', fontSize: '13px' }}>Failed to load referral link. Please try again.</p>
            )}
          </div>

          {affStats && (
            <div className="card">
              <h3 style={{ marginBottom: '12px' }}>📊 Stats</h3>
              <div className="profile-stats">
                <div className="stat-item">
                  <div className="stat-value">{affStats.total_referrals || 0}</div>
                  <div className="stat-label">Total Referrals</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value" style={{ color: '#2ecc71' }}>{affStats.deposited_count || 0}</div>
                  <div className="stat-label">Deposited</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value" style={{ color: '#95a5a6' }}>{affStats.not_deposited_count || 0}</div>
                  <div className="stat-label">Not Deposited</div>
                </div>
              </div>
            </div>
          )}

          <div className="card">
            <h3 style={{ marginBottom: '12px' }}>👥 Your Referrals</h3>
            {affiliates.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>No referrals yet. Share your link!</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {affiliates.map((aff) => (
                  <div key={aff.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                    <div>
                      <div style={{ fontWeight: '600' }}>{aff.username}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{new Date(aff.created_at).toLocaleDateString()}</div>
                    </div>
                    <span style={{
                      fontSize: '12px', fontWeight: '700',
                      padding: '3px 10px', borderRadius: '20px',
                      background: aff.has_deposited ? 'rgba(46,204,113,0.12)' : 'rgba(149,165,166,0.12)',
                      color: aff.has_deposited ? '#2ecc71' : '#95a5a6',
                      border: `1px solid ${aff.has_deposited ? 'rgba(46,204,113,0.3)' : 'rgba(149,165,166,0.2)'}`,
                    }}>
                      {aff.has_deposited ? '✅ Deposited' : '⏳ No Deposit'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
