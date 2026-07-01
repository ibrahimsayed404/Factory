import React from 'react';

export const PageHeader = ({ title, subtitle, action }) => (
  <div style={{
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    marginBottom: 28,
    animation: 'fadeInUp .4s var(--ease-out) both',
  }}>
    <div>
      <h1 style={{
        fontSize: 22, fontWeight: 700,
        color: 'var(--text-primary)',
        letterSpacing: '-0.02em',
      }}>
        {title}
      </h1>
      {subtitle && (
        <p style={{
          fontSize: 13, color: 'var(--text-secondary)',
          marginTop: 4, fontWeight: 400,
        }}>
          {subtitle}
        </p>
      )}
    </div>
    {action && <div style={{ animation: 'fadeIn .5s var(--ease-out) 0.1s both' }}>{action}</div>}
  </div>
);
