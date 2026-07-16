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
import { FEATURE_FLAGS } from '../../config/featureFlags';

/* ── Nav Section Label ──────────────────────────────────── */
const NavSection = ({ children }) => (
  <div style={{
    fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
    textTransform: 'uppercase', letterSpacing: '.1em',
    padding: '14px 6px 8px',
  }}>
    {children}
  </div>
);

/* ── Nav Item ───────────────────────────────────────────── */
const NavItem = ({ to, label, icon }) => (
  <NavLink to={to} end={to === '/'} style={({ isActive }) => ({
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '9px 14px', borderRadius: 'var(--radius-sm)',
    fontSize: 13, fontWeight: isActive ? 600 : 500,
    color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
    background: isActive ? 'var(--accent-dim)' : 'transparent',
    textDecoration: 'none', marginBottom: 2,
    transition: 'all .2s var(--ease-out)',
    position: 'relative',
    borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
  })}
    onMouseEnter={e => {
      const isActive = e.currentTarget.style.color.includes('var(--accent)');
      if (!isActive) {
        e.currentTarget.style.color = 'var(--text-primary)';
        e.currentTarget.style.background = 'var(--bg-hover)';
      }
    }}
    onMouseLeave={e => {
      e.currentTarget.style.color = '';
      e.currentTarget.style.background = '';
    }}
  >
    <span style={{ fontSize: 15, width: 20, textAlign: 'center' }}>{icon}</span>
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
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-base)', position: 'relative' }}>

      {/* Drifting ambient background glow blobs */}
      <div style={{
        position: 'absolute', top: '15%', left: '15%',
        width: '35vw', height: '35vw',
        background: 'radial-gradient(circle, rgba(34,211,160,0.03) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
        animation: 'drift 28s ease-in-out infinite alternate',
      }} />
      <div style={{
        position: 'absolute', bottom: '15%', right: '15%',
        width: '45vw', height: '45vw',
        background: 'radial-gradient(circle, rgba(96,165,250,0.035) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
        animation: 'drift 38s ease-in-out infinite alternate-reverse',
      }} />

      {/* ═══ Sidebar ═══ */}
      <aside style={{
        width: 'var(--sidebar-w)', flexShrink: 0,
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(var(--glass-blur))',
        WebkitBackdropFilter: 'blur(var(--glass-blur))',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
        zIndex: 10,
      }}>

        {/* Background glow */}
        <div style={{
          position: 'absolute', top: -60, left: -60,
          width: 180, height: 180,
          background: 'radial-gradient(circle, rgba(34,211,160,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Logo */}
        <div style={{
          padding: '22px 20px 18px',
          borderBottom: '1px solid var(--border)',
          position: 'relative',
        }}>
          <FabriCoreLogo compact style={{ maxWidth: '100%', height: 'auto' }} />
        </div>

        {/* Controls */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 10, padding: '10px 14px 4px',
        }}>
          <button onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            style={{
              background: 'var(--bg-hover)', color: 'var(--text-muted)',
              fontSize: 14, cursor: 'pointer',
              padding: '5px 8px', borderRadius: 'var(--radius-sm)',
              transition: 'all .2s var(--ease-out)',
              border: '1px solid var(--border)',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <LanguageSwitcher compact />
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '10px 10px', overflowY: 'auto' }}>
          <NavSection>{t('main', 'Main')}</NavSection>
          <NavItem to="/" label={t('dashboard', 'Dashboard')} icon="▦" />

          <NavSection>{t('operations', 'Operations')}</NavSection>
          <NavItem to="/production" label={t('production', 'Production')} icon="⚙" />
          {FEATURE_FLAGS.manufacturingBoms && <NavItem to="/manufacturing/boms" label={t('boms', 'BOMs')} icon="📄" />}
          {FEATURE_FLAGS.manufacturingRoutings && <NavItem to="/manufacturing/routings" label={t('routings', 'Routings')} icon="🔄" />}
          {FEATURE_FLAGS.productionPipeline && <NavItem to="/production-pipeline" label={t('productionPipeline', 'Pipeline Kanban')} icon="🗂" />}
          <NavItem to="/production-orders/create" label={t('createOrder', 'Create Order')} icon="🧵" />
          <NavItem to="/production-orders/sorting" label={t('sorting', 'Sorting (فرز)')} icon="🗂" />
          <NavItem to="/production-orders/outsourcing" label={t('outsourcing', 'Outsourcing')} icon="🚚" />
          <NavItem to="/production-orders/final" label={t('finalPhase', 'Final Phase')} icon="✅" />
          <NavItem to="/production-orders/report" label={t('prodReport', 'Prod Report')} icon="📉" />
          <NavItem to="/production-orders/manage" label={t('manageOrders', 'Manage Orders')} icon="🗑" />
          <NavItem to="/products"   label={t('products', 'Products')}    icon="🏷️" />
          <NavItem to="/inventory"  label={t('inventory', 'Inventory')}  icon="📦" />
          {FEATURE_FLAGS.purchasing && <NavItem to="/purchasing" label={t('purchasing', 'Purchasing')} icon="🛒" />}
          {FEATURE_FLAGS.qcInspections && <NavItem to="/qc/inspections" label={t('qcInspections', 'QC Inspections')} icon="🔍" />}
          {FEATURE_FLAGS.qcReports && <NavItem to="/qc/reports" label={t('qcReports', 'QC Reports')} icon="📋" />}

          <NavSection>{t('people', 'People')}</NavSection>
          <NavItem to="/employees"  label={t('employees', 'Employees')}  icon="👥" />
          <NavItem to="/attendance" label={t('attendance', 'Attendance')}  icon="📅" />
          <NavItem to="/payroll"    label={t('payroll', 'Payroll')}    icon="💳" />
          <NavItem to="/loans"      label={t('loans', 'Loans')}        icon="🏦" />

          <NavSection>{t('business', 'Business')}</NavSection>
          <NavItem to="/sales"      label={t('sales', 'Sales')}      icon="📈" />
          <NavItem to="/customers"  label={t('customers', 'Customers')}  icon="🏢" />
          {FEATURE_FLAGS.accounting && <NavItem to="/accounting" label={t('accounting', 'Accounting')} icon="🧾" />}
          <NavItem to="/reports"    label={t('reports', 'Reports')}    icon="📊" />
        </nav>

        {/* ── User footer ── */}
        <div style={{
          padding: '14px 16px', borderTop: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'rgba(0,0,0,0.1)',
        }}>
          <div style={{
            width: 34, height: 34, borderRadius: 'var(--radius-sm)',
            background: 'var(--gradient-accent)',
            color: '#0a1a14',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, flexShrink: 0,
            boxShadow: '0 2px 8px rgba(34,211,160,0.2)',
          }}>
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }} className="truncate">{user?.name}</div>
            <div style={{
              fontSize: 10, color: 'var(--text-muted)',
              fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.05em',
            }}>
              {user?.role}
            </div>
          </div>
          <button onClick={handleLogout} title="Logout" style={{
            background: 'var(--bg-hover)', color: 'var(--text-muted)',
            fontSize: 13, cursor: 'pointer',
            padding: '5px 8px', borderRadius: 'var(--radius-sm)',
            transition: 'all .2s var(--ease-out)',
            border: '1px solid var(--border)',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--danger-dim)'; e.currentTarget.style.color = 'var(--danger)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            ⏻
          </button>
        </div>
      </aside>

      {/* ═══ Main content ═══ */}
      <main style={{
        flex: 1, overflowY: 'auto',
        display: 'flex', flexDirection: 'column',
        position: 'relative',
      }}>
        {/* Top gradient glow */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 200,
          background: 'var(--gradient-glow)',
          pointerEvents: 'none', zIndex: 0,
        }} />

        {/* Loading bar */}
        {networkState.pendingRequests > 0 && (
          <div style={{ position: 'sticky', top: 0, zIndex: 20 }}>
            <div
              style={{
                height: 3,
                width: '100%',
                background: 'linear-gradient(90deg, var(--accent), var(--info), var(--accent))',
                backgroundSize: '200% 100%',
                animation: 'reqPulse 1.2s linear infinite',
                boxShadow: '0 0 12px var(--accent-glow)',
              }}
            />
          </div>
        )}

        {/* Network error */}
        {networkState.lastError && (
          <div style={{ padding: '12px 20px', position: 'relative', zIndex: 1 }}>
            <ErrorMsg msg={networkState.lastError} />
          </div>
        )}

        {/* Page content */}
        <div style={{ position: 'relative', zIndex: 1, flex: 1 }}>
          {children}
        </div>
      </main>
    </div>
  );
};
