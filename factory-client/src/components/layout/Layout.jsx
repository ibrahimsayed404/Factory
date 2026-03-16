import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const navItems = [
  { to: '/',           label: 'Dashboard',  icon: '▦' },
  { to: '/production', label: 'Production', icon: '⚙', badge: null },
  { to: '/inventory',  label: 'Inventory',  icon: '📦' },
  { to: '/employees',  label: 'Employees',  icon: '👥' },
  { to: '/payroll',    label: 'Payroll',    icon: '💳' },
  { to: '/sales',      label: 'Sales',      icon: '📈' },
  { to: '/customers',  label: 'Customers',  icon: '🏢' },
];

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 28, height: 28, background: 'var(--accent)', borderRadius: 6,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, color: '#0a1a14', fontWeight: 700,
            }}>F</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>FabriCore</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Factory Management</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '14px 10px', overflowY: 'auto' }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.08em', padding: '0 4px 8px' }}>Main</div>
          <NavItem to="/" label="Dashboard" icon="▦" />
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.08em', padding: '12px 4px 8px' }}>Operations</div>
          <NavItem to="/production" label="Production" icon="⚙" />
          <NavItem to="/inventory"  label="Inventory"  icon="📦" />
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.08em', padding: '12px 4px 8px' }}>People</div>
          <NavItem to="/employees"  label="Employees"  icon="👥" />
          <NavItem to="/attendance" label="Attendance"  icon="📅" />
          <NavItem to="/payroll"    label="Payroll"    icon="💳" />
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.08em', padding: '12px 4px 8px' }}>Business</div>
          <NavItem to="/sales"      label="Sales"      icon="📈" />
          <NavItem to="/customers"  label="Customers"  icon="🏢" />
          <NavItem to="/reports"    label="Reports"    icon="📊" />
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
        {children}
      </main>
    </div>
  );
};
