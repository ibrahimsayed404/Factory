import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Input, Btn, ErrorMsg, Spinner } from '../components/ui';
import { LanguageSwitcher } from '../components/ui/LanguageSwitcher';
import { useLanguage } from '../context/LanguageContext';
import FabriCoreLogo from '../components/brand/FabriCoreLogo';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();
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
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <LanguageSwitcher compact />
        </div>
        {/* Logo */}
        <div style={{ marginBottom: 28 }}>
          <FabriCoreLogo style={{ width: '100%', height: 'auto' }} />
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 6 }}>{t('signIn', 'Sign in')}</h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24 }}>{t('welcomeBack', 'Welcome back. Enter your credentials to continue.')}</p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input label="Email" type="email" placeholder="you@factory.com"
            value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
          <Input label="Password" type="password" placeholder="••••••••"
            value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
          {error && <ErrorMsg msg={error} />}
          <Btn type="submit" variant="primary" disabled={loading} aria-busy={loading} style={{ marginTop: 4, justifyContent: 'center', padding: '10px 0', width: '100%' }}>
            {loading ? <Spinner /> : t('signIn', 'Sign in')}
          </Btn>
        </form>
      </div>
    </div>
  );
}
