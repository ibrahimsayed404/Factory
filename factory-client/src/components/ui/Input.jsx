import React, { useId } from 'react';

export const Input = ({ label, id, ...props }) => {
  const autoId = useId();
  const inputId = id || autoId;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && (
        <label htmlFor={inputId} style={{
          fontSize: 12, color: 'var(--text-secondary)',
          fontWeight: 600, letterSpacing: '.02em',
        }}>
          {label}
        </label>
      )}
      <input
        id={inputId}
        {...props}
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--text-primary)',
          padding: '10px 13px',
          fontSize: 13,
          width: '100%',
          transition: 'all .2s var(--ease-out)',
          boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.08)',
          ...props.style,
        }}
        onFocus={e => {
          e.target.style.borderColor = 'var(--accent)';
          e.target.style.boxShadow = '0 0 0 3px var(--accent-dim), inset 0 1px 2px rgba(0,0,0,0.08)';
        }}
        onBlur={e => {
          e.target.style.borderColor = 'var(--border)';
          e.target.style.boxShadow = 'inset 0 1px 2px rgba(0,0,0,0.08)';
        }}
      />
    </div>
  );
};
