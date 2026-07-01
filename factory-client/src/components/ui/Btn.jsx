import React from 'react';

export const Btn = ({ children, variant = 'ghost', size = 'md', onClick, disabled, type = 'button', style }) => {
  const base = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
    borderRadius: 'var(--radius-sm)', fontWeight: 600,
    fontSize: size === 'sm' ? 12 : 13,
    padding: size === 'sm' ? '6px 12px' : '9px 16px',
    transition: 'all .2s var(--ease-out)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    position: 'relative',
    letterSpacing: '.01em',
  };
  const styles = {
    primary: {
      background: 'var(--gradient-accent)',
      color: '#0a1a14',
      border: 'none',
      boxShadow: '0 2px 8px rgba(34,211,160,0.25)',
    },
    ghost: {
      background: 'transparent',
      color: 'var(--text-secondary)',
      border: '1px solid var(--border)',
    },
    danger: {
      background: 'var(--danger-dim)',
      color: 'var(--danger)',
      border: '1px solid rgba(239,68,68,0.2)',
    },
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      style={{ ...base, ...styles[variant], ...style }}
      onMouseEnter={e => {
        if (disabled) return;
        e.currentTarget.style.transform = 'translateY(-1px)';
        if (variant === 'primary') {
          e.currentTarget.style.boxShadow = '0 4px 16px rgba(34,211,160,0.4)';
        }
        if (variant === 'ghost') {
          e.currentTarget.style.borderColor = 'var(--border-hover)';
          e.currentTarget.style.background = 'var(--bg-hover)';
        }
        if (variant === 'danger') {
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(239,68,68,0.2)';
        }
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)';
        if (variant === 'primary') e.currentTarget.style.boxShadow = '0 2px 8px rgba(34,211,160,0.25)';
        if (variant === 'ghost') {
          e.currentTarget.style.borderColor = 'var(--border)';
          e.currentTarget.style.background = 'transparent';
        }
        if (variant === 'danger') e.currentTarget.style.boxShadow = 'none';
      }}
      onMouseDown={e => { if (!disabled) e.currentTarget.style.transform = 'translateY(0) scale(0.98)'; }}
      onMouseUp={e => { if (!disabled) e.currentTarget.style.transform = 'translateY(-1px)'; }}
    >
      {children}
    </button>
  );
};
