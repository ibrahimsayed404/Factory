import React from 'react';

const variantColor = (variant, fallback = 'var(--text-secondary)') => {
  const key = String(variant || '').replace('outline-', '');
  const map = {
    primary: 'var(--info)',
    secondary: 'var(--text-secondary)',
    success: 'var(--accent)',
    danger: 'var(--danger)',
    warning: 'var(--warn)',
    info: 'var(--info)',
    link: 'var(--info)',
  };
  return map[key] || fallback;
};

export const Button = ({ children, variant = 'secondary', size, className = '', style, ...props }) => (
  <button
    {...props}
    className={className}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderRadius: 'var(--radius-sm)',
      border: variant?.startsWith?.('outline') || variant === 'link' ? '1px solid var(--border)' : 'none',
      background: variant === 'link' ? 'transparent' : variant?.startsWith?.('outline') ? 'transparent' : variantColor(variant),
      color: variant === 'link' || variant?.startsWith?.('outline') ? variantColor(variant) : '#0a1a14',
      padding: size === 'sm' ? '6px 10px' : '9px 14px',
      fontSize: size === 'sm' ? 12 : 13,
      fontWeight: 600,
      cursor: props.disabled ? 'not-allowed' : 'pointer',
      opacity: props.disabled ? 0.55 : 1,
      ...style,
    }}
  >
    {children}
  </button>
);

export const Badge = ({ children, bg = 'secondary', text, className = '', style, ...props }) => (
  <span
    {...props}
    className={className}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      borderRadius: 99,
      padding: '3px 9px',
      fontSize: 11,
      fontWeight: 700,
      background: `${variantColor(bg)}22`,
      color: text === 'dark' ? '#111827' : variantColor(bg),
      border: `1px solid ${variantColor(bg)}55`,
      ...style,
    }}
  >
    {children}
  </span>
);

export const Table = ({ children, className = '', style, ...props }) => (
  <div style={{ overflowX: 'auto' }}>
    <table
      {...props}
      className={className}
      style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: 13,
        ...style,
      }}
    >
      {children}
    </table>
  </div>
);

export const Row = ({ children, className = '', style, ...props }) => (
  <div
    {...props}
    className={className}
    style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      gap: 12,
      ...style,
    }}
  >
    {children}
  </div>
);

export const Col = ({ children, className = '', style, ...props }) => (
  <div {...props} className={className} style={style}>{children}</div>
);

export const Card = ({ children, className = '', style, ...props }) => (
  <div
    {...props}
    className={className}
    style={{
      background: 'var(--gradient-surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-sm)',
      overflow: 'hidden',
      ...style,
    }}
  >
    {children}
  </div>
);

Card.Header = ({ children, className = '', style, ...props }) => (
  <div {...props} className={className} style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', ...style }}>{children}</div>
);

Card.Body = ({ children, className = '', style, ...props }) => (
  <div {...props} className={className} style={{ padding: 16, ...style }}>{children}</div>
);

export const Modal = ({ show = true, onHide, children, className = '', style }) => {
  if (!show) return null;
  return (
    <div
      className={className}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,.55)',
        padding: 24,
      }}
      onClick={onHide}
    >
      <div
        style={{
          width: 'min(620px, 100%)',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          ...style,
        }}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
};

Modal.Header = ({ children, closeButton, className = '', style, ...props }) => (
  <div {...props} className={className} style={{ display: 'flex', justifyContent: 'space-between', padding: 16, borderBottom: '1px solid var(--border)', ...style }}>
    {children}
    {closeButton && <span aria-hidden="true">x</span>}
  </div>
);
Modal.Title = ({ children, className = '', style, ...props }) => <h3 {...props} className={className} style={{ fontSize: 16, ...style }}>{children}</h3>;
Modal.Body = ({ children, className = '', style, ...props }) => <div {...props} className={className} style={{ padding: 16, ...style }}>{children}</div>;
Modal.Footer = ({ children, className = '', style, ...props }) => (
  <div {...props} className={className} style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: 16, borderTop: '1px solid var(--border)', ...style }}>{children}</div>
);

export const Form = ({ children, className = '', style, ...props }) => (
  <form {...props} className={className} style={{ display: 'grid', gap: 12, ...style }}>{children}</form>
);

Form.Group = ({ children, className = '', style, ...props }) => <div {...props} className={className} style={{ display: 'grid', gap: 6, ...style }}>{children}</div>;
Form.Label = ({ children, className = '', style, ...props }) => <label {...props} className={className} style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, ...style }}>{children}</label>;
Form.Control = ({ as, className = '', style, ...props }) => {
  const Component = as === 'textarea' ? 'textarea' : 'input';
  return (
    <Component
      {...props}
      className={className}
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        color: 'var(--text-primary)',
        padding: '10px 12px',
        width: '100%',
        ...style,
      }}
    />
  );
};
Form.Select = ({ children, className = '', style, ...props }) => (
  <select
    {...props}
    className={className}
    style={{
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)',
      color: 'var(--text-primary)',
      padding: '10px 12px',
      width: '100%',
      ...style,
    }}
  >
    {children}
  </select>
);
