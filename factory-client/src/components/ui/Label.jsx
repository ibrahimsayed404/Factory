import React from 'react';

export const Label = ({ children, style, ...props }) => (
  <label
    {...props}
    style={{
      fontSize: 12,
      color: 'var(--text-secondary)',
      fontWeight: 600,
      letterSpacing: '.02em',
      ...style,
    }}
  >
    {children}
  </label>
);
