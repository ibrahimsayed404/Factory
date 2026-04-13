/* eslint-disable react/prop-types */
import React, { useEffect, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiRequestState } from '../../api';
import { ErrorMsg } from '../ui';
import { LanguageSwitcher } from '../ui/LanguageSwitcher';
import { useLanguage } from '../../context/LanguageContext';
import FabriCoreLogo from '../brand/FabriCoreLogo';

const NavItem = ({ to, label, icon }) => (
  <NavLink to={to} end={to === '/'} style={({ isActive }) => ({
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '8px 14px', borderRadius: 'var(--radius-sm)',
    fontSize: 13, fontWeight: 500,
    color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
    background: isActive ? 'var(--accent-dim)' : 'transparent',
    textDecoration: 'none', marginBottom: 2,
    transition: 'all .15s',
  })}
    onMouseEnter={e => { if (!e.currentTarget.style.color.includes('accent')) e.currentTarget.style.color = 'var(--text-primary)'; }}
    onMouseLeave={e => { e.currentTarget.style.color = ''; }}
  >
    <span style={{ fontSize: 14 }}>{icon}</span>
    {label}
  </NavLink>
);

export const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { t } = useLanguage();
  const [networkState, setNetworkState] = useState({ pendingRequests: 0, lastError: '' });

  useEffect(() => {
    return apiRequestState.subscribe(setNetworkState);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <aside style={{
        width: 'var(--sidebar-w)', flexShrink: 0,
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Logo */}
              <div style={{ padding: '20px 18px 16px', borderBottom: '1px solid var(--border)' }}>
                <FabriCoreLogo compact style={{ maxWidth: '100%', height: 'auto' }} />
        </div>
        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 12px 4px' }}>
          <button onClick={toggleTheme} title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} style={{
            background: 'none', color: 'var(--text-muted)', fontSize: 16, cursor: 'pointer',
            padding: 4, borderRadius: 4,
          }}>
            {theme === 'dark' ? '🌞' : '🌙'}
          </button>
          <LanguageSwitcher compact />
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '14px 10px', overflowY: 'auto' }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.08em', padding: '0 4px 8px' }}>{t('main', 'Main')}</div>
          <NavItem to="/" label={t('dashboard', 'Dashboard')} icon="▦" />
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.08em', padding: '12px 4px 8px' }}>{t('operations', 'Operations')}</div>
          <NavItem to="/production" label={t('production', 'Production')} icon="⚙" />
          <NavItem to="/production-orders/create" label={t('createOrder', 'Create Order')} icon="🧵" />
          <NavItem to="/production-orders/sorting" label={t('sorting', 'Sorting (فرز)')} icon="🗂" />
          <NavItem to="/production-orders/final" label={t('finalPhase', 'Final Phase')} icon="✅" />
          <NavItem to="/production-orders/report" label={t('prodReport', 'Prod Report')} icon="📉" />
          <NavItem to="/inventory"  label={t('inventory', 'Inventory')}  icon="📦" />
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.08em', padding: '12px 4px 8px' }}>{t('people', 'People')}</div>
          <NavItem to="/employees"  label={t('employees', 'Employees')}  icon="👥" />
          <NavItem to="/attendance" label={t('attendance', 'Attendance')}  icon="📅" />
          <NavItem to="/payroll"    label={t('payroll', 'Payroll')}    icon="💳" />
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.08em', padding: '12px 4px 8px' }}>{t('business', 'Business')}</div>
          <NavItem to="/sales"      label={t('sales', 'Sales')}      icon="📈" />
          <NavItem to="/customers"  label={t('customers', 'Customers')}  icon="🏢" />
          <NavItem to="/reports"    label={t('reports', 'Reports')}    icon="📊" />
        </nav>

        {/* User footer */}
        <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%',
            background: 'var(--accent-dim)', color: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 600, flexShrink: 0,
          }}>
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }} className="truncate">{user?.name}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{user?.role}</div>
          </div>
          <button onClick={handleLogout} title="Logout" style={{
            background: 'none', color: 'var(--text-muted)', fontSize: 14, cursor: 'pointer',
            padding: 4, borderRadius: 4,
          }}>⏻</button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {networkState.pendingRequests > 0 && (
          <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--bg-base)', borderBottom: '1px solid var(--border)' }}>
            <div
              style={{
                height: 3,
                width: '100%',
                background: 'linear-gradient(90deg, var(--accent), var(--info), var(--accent))',
                backgroundSize: '200% 100%',
                animation: 'reqPulse 1.2s linear infinite',
              }}
            />
            <style>{'@keyframes reqPulse{0%{background-position:200% 0}100%{background-position:-200% 0}}'}</style>
          </div>
        )}
        {networkState.lastError && (
          <div style={{ padding: '10px 16px' }}>
            <ErrorMsg msg={networkState.lastError} />
          </div>
        )}
        {children}
      </main>
    </div>
  );
};
