import React from 'react';

export const Card = ({ children, style, padding = '22px', glow = false }) => (
  <div
    className="elevated-card"
    style={{
      background: 'var(--gradient-surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      padding,
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      boxShadow: glow ? 'var(--shadow-glow)' : 'var(--shadow-sm)',
      position: 'relative',
      overflow: 'hidden',
      ...style,
    }}
  >
    {children}
  </div>
);
