import React from 'react';

const variants = {
  success: { bg: 'var(--accent-dim)',  color: 'var(--accent)',  border: 'rgba(34,211,160,0.2)' },
  warning: { bg: 'var(--warn-dim)',    color: 'var(--warn)',    border: 'rgba(245,166,35,0.2)' },
  danger:  { bg: 'var(--danger-dim)',  color: 'var(--danger)',  border: 'rgba(239,68,68,0.2)' },
  info:    { bg: 'var(--info-dim)',    color: 'var(--info)',    border: 'rgba(96,165,250,0.2)' },
  default: { bg: 'rgba(255,255,255,0.04)', color: 'var(--text-secondary)', border: 'var(--border)' },
};

export const Badge = ({ children, variant = 'default', showPulse = false }) => {
  const s = variants[variant] || variants.default;
  const isPulseActive = showPulse || variant === 'success' || variant === 'info';
  return (
    <span style={{
      background: s.bg, color: s.color,
      fontSize: 11, fontWeight: 600, letterSpacing: '.02em',
      padding: '3px 10px', borderRadius: 99,
      border: `1px solid ${s.border}`,
      display: 'inline-flex', alignItems: 'center', gap: 6,
      whiteSpace: 'nowrap',
      transition: 'all .2s var(--ease-out)',
    }}>
      {isPulseActive && <span className="pulse-dot" style={{ backgroundColor: s.color }} />}
      {children}
    </span>
  );
};

export const statusVariant = (status) => {
  const map = {
    active: 'success', done: 'success', shipped: 'success', paid: 'success', delivered: 'success',
    in_progress: 'info', invoiced: 'info', confirmed: 'info',
    pending: 'warning', new: 'warning',
    inactive: 'default', cancelled: 'danger', low: 'danger',
  };
  return map[status] || 'default';
};
