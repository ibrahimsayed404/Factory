import React from 'react';

export const Spinner = () => (
  <div
    role="status"
    aria-live="polite"
    aria-label="Loading"
    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}
  >
    <div style={{
      width: 30, height: 30, borderRadius: '50%',
      border: '2.5px solid var(--border)',
      borderTopColor: 'var(--accent)',
      animation: 'spin .7s linear infinite',
      boxShadow: '0 0 12px var(--accent-dim)',
    }} />
  </div>
);
