import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', otp: '' });
  const [needs2FA, setNeeds2FA] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await login(form);
      if (result?.requires2FA) {
        setNeeds2FA(true);
      } else {
        navigate('/');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    }
    setLoading(false);
  };

  return (
    <div className="app" style={{ justifyContent: 'center', padding: '24px' }}>
      <div style={{ maxWidth: '400px', margin: '0 auto', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <Link to="/" style={{ textDecoration: 'none', display: 'inline-block' }}>
            <h1 style={{ fontSize: '48px', marginBottom: '8px' }}>🎰</h1>
          </Link>
          <h2>Welcome Back</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>Sign in to continue playing</p>
        </div>

        {error && <div className="card" style={{ background: 'rgba(225,112,85,0.1)', borderColor: 'var(--danger)', marginBottom: '16px' }}><p style={{ color: 'var(--danger)', fontSize: '14px' }}>{error}</p></div>}

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required placeholder="your@email.com" />
          </div>
          <div className="input-group">
            <label>Password</label>
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required placeholder="••••••••" />
          </div>
          {needs2FA && (
            <div className="input-group">
              <label>2FA Code</label>
              <input type="text" value={form.otp} onChange={(e) => setForm({ ...form, otp: e.target.value })} placeholder="Enter 6-digit code" maxLength={6} />
            </div>
          )}
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '20px', color: 'var(--text-muted)' }}>
          Don't have an account? <Link to="/register" style={{ color: 'var(--primary)' }}>Register</Link>
        </p>
      </div>
    </div>
  );
}
