import React, { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { authAPI } from '../../services/api';

const KYC_STEPS = [
  { type: 'selfie',   label: 'Take a Selfie',          bonus: 50, icon: '🤳', desc: 'Take or upload a selfie photo' },
  { type: 'phone',    label: 'Add Phone Number',        bonus: 30, icon: '📱', desc: 'Verify your mobile number' },
  { type: 'location', label: 'Enable Current Location', bonus: 20, icon: '📍', desc: 'Allow location access' },
];

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const refCode = searchParams.get('ref');

  const [form, setForm] = useState({ username: '', email: '', password: '', phone: '', ref: refCode || '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // KYC step state
  const [kycMode, setKycMode] = useState(false);
  const [claimed, setClaimed] = useState({});
  const [kycPhone, setKycPhone] = useState('');
  const [selfiePreview, setSelfiePreview] = useState(null);
  const [selfieReady, setSelfieReady] = useState(false);
  const [kycLoading, setKycLoading] = useState('');
  const [kycMsg, setKycMsg] = useState('');

  const totalEarned = KYC_STEPS.filter(s => claimed[s.type]).reduce((a, s) => a + s.bonus, 0);
  const allDone = KYC_STEPS.every(s => claimed[s.type]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form);
      setKycMode(true);
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Registration failed');
    }
    setLoading(false);
  };

  const handleSelfieFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setSelfiePreview(ev.target.result);
      setSelfieReady(true);
    };
    reader.readAsDataURL(file);
  };

  const claimBonus = async (type) => {
    if (claimed[type] || kycLoading) return;
    setKycLoading(type);
    setKycMsg('');
    try {
      let value = null;
      if (type === 'selfie') {
        if (!selfieReady) { setKycMsg('Please take a selfie first.'); setKycLoading(''); return; }
        value = 'verified'; // backend just needs a truthy value, not the image
      } else if (type === 'phone') {
        if (!kycPhone.trim()) { setKycMsg('Please enter your phone number.'); setKycLoading(''); return; }
        value = kycPhone.trim();
      } else if (type === 'location') {
        value = await new Promise((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve(`${pos.coords.latitude},${pos.coords.longitude}`),
            () => reject(new Error('Location denied'))
          )
        ).catch(() => null);
        if (!value) { setKycMsg('Location access was denied.'); setKycLoading(''); return; }
      }
      const { data } = await authAPI.kycBonus(type, value);
      setClaimed(data.claimed);
      setKycMsg(`✅ ₱${data.amount} bonus credited!`);
    } catch (err) {
      setKycMsg(err.response?.data?.error || 'Failed to claim bonus');
    }
    setKycLoading('');
  };

  if (kycMode) {
    return (
      <div className="app" style={{ justifyContent: 'center', padding: '24px' }}>
        <div style={{ maxWidth: '420px', margin: '0 auto', width: '100%' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{ fontSize: '48px', marginBottom: '8px' }}>🎉</div>
            <h2 style={{ marginBottom: '6px' }}>Account Created!</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
              Complete KYC steps to earn up to <strong style={{ color: '#ffd700' }}>₱100 bonus</strong>
            </p>
          </div>

          {/* KYC Note */}
          <div className="card" style={{ background: 'rgba(96,165,250,0.08)', borderColor: 'rgba(96,165,250,0.3)', marginBottom: '20px', padding: '12px 16px' }}>
            <p style={{ fontSize: '12px', color: '#60a5fa', margin: 0 }}>
              🪪 <strong>KYC Note:</strong> These steps verify your identity and help keep the platform safe. Your information is securely stored and used for account verification only.
            </p>
          </div>

          {/* Progress bar */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Bonus Earned</span>
              <span style={{ fontSize: '14px', fontWeight: '700', color: '#ffd700' }}>₱{totalEarned} / ₱100</span>
            </div>
            <div style={{ height: '8px', background: '#1e1e2e', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${totalEarned}%`, background: 'linear-gradient(90deg, #ffd700, #00f5a0)', borderRadius: '4px', transition: 'width 0.4s' }} />
            </div>
          </div>

          {/* KYC Steps */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>

            {/* Selfie Step */}
            <div className="card" style={{ opacity: claimed.selfie ? 0.7 : 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: claimed.selfie ? 0 : '12px' }}>
                <span style={{ fontSize: '28px' }}>🤳</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '700', fontSize: '14px' }}>Take a Selfie</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Earn ₱50 bonus</div>
                </div>
                {claimed.selfie
                  ? <span style={{ color: '#00f5a0', fontWeight: '700', fontSize: '13px' }}>✅ +₱50</span>
                  : <span style={{ color: '#ffd700', fontWeight: '700', fontSize: '13px' }}>₱50</span>
                }
              </div>
              {!claimed.selfie && (
                <>
                  {selfiePreview && (
                    <img src={selfiePreview} alt="selfie" style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', display: 'block', margin: '0 auto 10px' }} />
                  )}
                  {/* Single visible input — capture="user" forces front camera on mobile */}
                  <label style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    padding: '10px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600',
                    background: selfieReady ? 'rgba(0,245,160,0.08)' : '#1e1e2e',
                    border: selfieReady ? '1px solid rgba(0,245,160,0.3)' : '1px solid #333',
                    color: selfieReady ? '#00f5a0' : '#e0e0f0',
                    marginBottom: selfieReady ? '8px' : 0,
                  }}>
                    📷 {selfieReady ? 'Retake Selfie' : 'Open Front Camera'}
                    <input
                      type="file"
                      accept="image/*"
                      capture="user"
                      style={{ display: 'none' }}
                      onChange={handleSelfieFile}
                    />
                  </label>
                  {selfieReady && (
                    <button className="btn btn-primary" style={{ width: '100%', padding: '8px', fontSize: '13px' }}
                      onClick={() => claimBonus('selfie')} disabled={kycLoading === 'selfie'}>
                      {kycLoading === 'selfie' ? 'Claiming...' : 'Claim ₱50'}
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Phone Step */}
            <div className="card" style={{ opacity: claimed.phone ? 0.7 : 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: claimed.phone ? 0 : '12px' }}>
                <span style={{ fontSize: '28px' }}>📱</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '700', fontSize: '14px' }}>Add Phone Number</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Earn ₱30 bonus</div>
                </div>
                {claimed.phone
                  ? <span style={{ color: '#00f5a0', fontWeight: '700', fontSize: '13px' }}>✅ +₱30</span>
                  : <span style={{ color: '#ffd700', fontWeight: '700', fontSize: '13px' }}>₱30</span>
                }
              </div>
              {!claimed.phone && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="tel"
                    value={kycPhone}
                    onChange={e => setKycPhone(e.target.value)}
                    placeholder="+63 9XX XXX XXXX"
                    style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', background: '#0f0f1a', border: '1px solid #333', color: '#e0e0f0', fontSize: '13px' }}
                  />
                  <button className="btn btn-primary" style={{ padding: '8px 14px', fontSize: '13px' }} onClick={() => claimBonus('phone')} disabled={kycLoading === 'phone'}>
                    {kycLoading === 'phone' ? '...' : 'Claim ₱30'}
                  </button>
                </div>
              )}
            </div>

            {/* Location Step */}
            <div className="card" style={{ opacity: claimed.location ? 0.7 : 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: claimed.location ? 0 : '12px' }}>
                <span style={{ fontSize: '28px' }}>📍</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '700', fontSize: '14px' }}>Enable Current Location</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Earn ₱20 bonus</div>
                </div>
                {claimed.location
                  ? <span style={{ color: '#00f5a0', fontWeight: '700', fontSize: '13px' }}>✅ +₱20</span>
                  : <span style={{ color: '#ffd700', fontWeight: '700', fontSize: '13px' }}>₱20</span>
                }
              </div>
              {!claimed.location && (
                <button className="btn btn-primary" style={{ width: '100%', padding: '8px', fontSize: '13px' }} onClick={() => claimBonus('location')} disabled={kycLoading === 'location'}>
                  {kycLoading === 'location' ? 'Getting location...' : '📍 Allow Location & Claim ₱20'}
                </button>
              )}
            </div>
          </div>

          {kycMsg && (
            <div className="card" style={{ background: kycMsg.startsWith('✅') ? 'rgba(0,245,160,0.08)' : 'rgba(225,112,85,0.1)', borderColor: kycMsg.startsWith('✅') ? 'var(--success)' : 'var(--danger)', marginBottom: '16px', padding: '10px 14px' }}>
              <p style={{ fontSize: '13px', color: kycMsg.startsWith('✅') ? 'var(--success)' : 'var(--danger)', margin: 0 }}>{kycMsg}</p>
            </div>
          )}

          <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => navigate('/')}>
            {allDone ? '🎰 Start Playing!' : '🎰 Go to Home (Complete KYC later to withdraw)'}
          </button>
          {!allDone && (
            <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--danger)', marginTop: '10px' }}>
              ⚠️ KYC is required to withdraw funds. You can complete it anytime in your Wallet.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="app" style={{ justifyContent: 'center', padding: '24px' }}>
      <div style={{ maxWidth: '400px', margin: '0 auto', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <Link to="/" style={{ textDecoration: 'none', display: 'inline-block' }}>
            <h1 style={{ fontSize: '48px', marginBottom: '8px' }}>🎰</h1>
          </Link>
          <h2>Create Account</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>Join and start winning today</p>
        </div>

        {/* KYC Bonus teaser */}
        <div className="card" style={{ background: 'rgba(255,215,0,0.06)', borderColor: 'rgba(255,215,0,0.3)', marginBottom: '20px', padding: '12px 16px' }}>
          <p style={{ fontSize: '13px', color: '#ffd700', margin: 0, fontWeight: '600' }}>
            🎁 Earn up to <strong>₱100 welcome bonus</strong> after registering!
          </p>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Complete KYC steps: Selfie ₱50 · Phone ₱30 · Location ₱20
          </p>
        </div>

        {error && <div className="card" style={{ background: 'rgba(225,112,85,0.1)', borderColor: 'var(--danger)', marginBottom: '16px' }}><p style={{ color: 'var(--danger)', fontSize: '14px' }}>{error}</p></div>}
        {refCode && <div className="card" style={{ background: 'rgba(46,204,113,0.1)', borderColor: 'var(--success)', marginBottom: '16px' }}><p style={{ color: 'var(--success)', fontSize: '14px' }}>🎁 You were referred! Sign up to get bonus rewards.</p></div>}

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Username</label>
            <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required placeholder="Choose a username" />
          </div>
          <div className="input-group">
            <label>Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required placeholder="your@email.com" />
          </div>
          <div className="input-group">
            <label>Phone</label>
            <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+63 9XX XXX XXXX" required />
          </div>
          <div className="input-group">
            <label>Password</label>
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required placeholder="Min 8 characters" minLength={8} />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Creating...' : 'Create Account'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '20px', color: 'var(--text-muted)' }}>
          Already have an account? <Link to="/login" style={{ color: 'var(--primary)' }}>Sign In</Link>
        </p>
      </div>
    </div>
  );
}
