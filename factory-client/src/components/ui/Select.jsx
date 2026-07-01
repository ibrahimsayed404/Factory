import React, { useId } from 'react';

export const Select = ({ label, id, children, ...props }) => {
  const autoId = useId();
  const selectId = id || autoId;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && (
        <label htmlFor={selectId} style={{
          fontSize: 12, color: 'var(--text-secondary)',
          fontWeight: 600, letterSpacing: '.02em',
        }}>
          {label}
        </label>
      )}
      <select
        id={selectId}
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
          cursor: 'pointer',
          ...props.style,
        }}
      >
        {children}
      </select>
    </div>
  );
};
