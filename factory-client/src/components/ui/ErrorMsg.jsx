import React from 'react';

export const ErrorMsg = ({ msg }) => (
  <div
    role="alert"
    aria-live="assertive"
    style={{
      padding: '12px 16px',
      background: 'var(--danger-dim)',
      color: 'var(--danger)',
      borderRadius: 'var(--radius-sm)',
      fontSize: 13, fontWeight: 500,
      border: '1px solid rgba(239,68,68,0.2)',
      display: 'flex', alignItems: 'center', gap: 8,
      animation: 'fadeInUp .3s var(--ease-out) both',
    }}
  >
    <span style={{ fontSize: 15, flexShrink: 0 }}>⚠</span>
    {msg}
  </div>
);
