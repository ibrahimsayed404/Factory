import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Input, Btn, ErrorMsg } from '../components/ui';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await login(form.email, form.password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-base)', padding: 20,
    }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
          <div style={{
            width: 36, height: 36, background: 'var(--accent)', borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, color: '#0a1a14', fontWeight: 700,
          }}>F</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>FabriCore</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Factory Management</div>
          </div>
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 6 }}>Sign in</h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24 }}>Welcome back. Enter your credentials to continue.</p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input label="Email" type="email" placeholder="you@factory.com"
            value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
          <Input label="Password" type="password" placeholder="••••••••"
            value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
          {error && <ErrorMsg msg={error} />}
          <Btn type="submit" variant="primary" disabled={loading} style={{ marginTop: 4, justifyContent: 'center', padding: '10px 0', width: '100%' }}>
            {loading ? 'Signing in…' : 'Sign in'}
          </Btn>
        </form>
      </div>
    </div>
  );
}
