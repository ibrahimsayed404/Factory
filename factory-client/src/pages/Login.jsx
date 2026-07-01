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
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Background ambient glows */}
      <div style={{
        position: 'absolute', top: '-15%', left: '-10%',
        width: 500, height: 500,
        background: 'radial-gradient(circle, rgba(34,211,160,0.07) 0%, transparent 65%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '-20%', right: '-10%',
        width: 600, height: 600,
        background: 'radial-gradient(circle, rgba(14,165,233,0.05) 0%, transparent 65%)',
        pointerEvents: 'none',
      }} />

      <div style={{
        width: '100%', maxWidth: 440,
        position: 'relative', zIndex: 1,
        animation: 'fadeInUp .5s var(--ease-out) both',
      }}>
        {/* Language switcher */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <LanguageSwitcher compact />
        </div>

        {/* Login Card */}
        <div style={{
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(var(--glass-blur))',
          WebkitBackdropFilter: 'blur(var(--glass-blur))',
          border: '1px solid var(--glass-border)',
          borderRadius: 'var(--radius-xl)',
          padding: '36px 32px',
          boxShadow: 'var(--shadow-lg)',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Top accent bar */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 3,
            background: 'var(--gradient-accent)',
          }} />

          {/* Logo */}
          <div style={{ marginBottom: 30 }}>
            <FabriCoreLogo style={{ width: '100%', height: 'auto' }} />
          </div>

          <h1 style={{
            fontSize: 24, fontWeight: 700,
            marginBottom: 6, letterSpacing: '-0.02em',
          }}>
            {t('signIn', 'Sign in')}
          </h1>
          <p style={{
            fontSize: 14, color: 'var(--text-secondary)',
            marginBottom: 28, lineHeight: 1.6,
          }}>
            {t('welcomeBack', 'Welcome back. Enter your credentials to continue.')}
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <Input label="Email" type="email" placeholder="you@factory.com"
              value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
            <Input label="Password" type="password" placeholder="••••••••"
              value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
            {error && <ErrorMsg msg={error} />}
            <Btn type="submit" variant="primary" disabled={loading} aria-busy={loading}
              style={{
                marginTop: 6, justifyContent: 'center',
                padding: '12px 0', width: '100%',
                fontSize: 14, fontWeight: 700,
              }}
            >
              {loading ? <Spinner /> : t('signIn', 'Sign in')}
            </Btn>
          </form>
        </div>

        {/* Footer note */}
        <p style={{
          textAlign: 'center', marginTop: 20,
          fontSize: 12, color: 'var(--text-muted)',
        }}>
          FabriCore Factory Management System
        </p>
      </div>
    </div>
  );
}
