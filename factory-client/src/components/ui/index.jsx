import React from 'react';

/* ── Badge ─────────────────────────────────────────────── */
const variants = {
  success: { bg: 'var(--accent-dim)',  color: 'var(--accent)' },
  warning: { bg: 'var(--warn-dim)',    color: 'var(--warn)' },
  danger:  { bg: 'var(--danger-dim)', color: 'var(--danger)' },
  info:    { bg: 'var(--info-dim)',    color: 'var(--info)' },
  default: { bg: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' },
};

export const Badge = ({ children, variant = 'default' }) => {
  const s = variants[variant] || variants.default;
  return (
    <span style={{
      background: s.bg, color: s.color,
      fontSize: 11, fontWeight: 500,
      padding: '2px 8px', borderRadius: 99,
      display: 'inline-flex', alignItems: 'center',
      whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  );
};

/* ── Status badge helper ────────────────────────────────── */
export const statusVariant = (status) => {
  const map = {
    active: 'success', done: 'success', shipped: 'success', paid: 'success', delivered: 'success',
    in_progress: 'info', invoiced: 'info', confirmed: 'info',
    pending: 'warning', new: 'warning',
    inactive: 'default', cancelled: 'danger', low: 'danger',
  };
  return map[status] || 'default';
};

/* ── Button ─────────────────────────────────────────────── */
export const Btn = ({ children, variant = 'ghost', size = 'md', onClick, disabled, type = 'button', style }) => {
  const base = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    borderRadius: 'var(--radius-sm)', fontWeight: 500,
    fontSize: size === 'sm' ? 12 : 13,
    padding: size === 'sm' ? '5px 10px' : '8px 14px',
    transition: 'all .15s', cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  };
  const styles = {
    primary: { background: 'var(--accent)', color: '#0a1a14', border: 'none' },
    ghost:   { background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)' },
    danger:  { background: 'var(--danger-dim)', color: 'var(--danger)', border: '1px solid rgba(240,82,82,.2)' },
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      style={{ ...base, ...styles[variant], ...style }}
      onMouseEnter={e => {
        if (variant === 'primary') e.currentTarget.style.background = 'var(--accent-hover)';
        if (variant === 'ghost') e.currentTarget.style.borderColor = 'var(--border-hover)';
      }}
      onMouseLeave={e => {
        if (variant === 'primary') e.currentTarget.style.background = 'var(--accent)';
        if (variant === 'ghost') e.currentTarget.style.borderColor = 'var(--border)';
      }}
    >
      {children}
    </button>
  );
};

/* ── Card ───────────────────────────────────────────────── */
export const Card = ({ children, style, padding = '20px' }) => (
  <div style={{
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding,
    ...style,
  }}>
    {children}
  </div>
);

/* ── Input ──────────────────────────────────────────────── */
import { useId } from 'react';
export const Input = ({ label, id, ...props }) => {
  const autoId = useId();
  const inputId = id || autoId;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {label && <label htmlFor={inputId} style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</label>}
      <input
        id={inputId}
        {...props}
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--text-primary)',
          padding: '8px 11px',
          fontSize: 13,
          width: '100%',
          transition: 'border .15s',
          ...props.style,
        }}
        onFocus={e => e.target.style.borderColor = 'var(--accent)'}
        onBlur={e => e.target.style.borderColor = 'var(--border)'}
      />
    </div>
  );
};

/* ── Select ─────────────────────────────────────────────── */
export const Select = ({ label, id, children, ...props }) => {
  const autoId = useId();
  const selectId = id || autoId;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {label && <label htmlFor={selectId} style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</label>}
      <select
        id={selectId}
        {...props}
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--text-primary)',
          padding: '8px 11px',
          fontSize: 13,
          width: '100%',
          ...props.style,
        }}
      >
        {children}
      </select>
    </div>
  );
};

/* ── Table ──────────────────────────────────────────────── */
export const Table = ({ columns, data, onRowClick, emptyMsg = 'No records found' }) => (
  <div style={{ overflowX: 'auto' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
      <thead>
        <tr>
          {columns.map(c => (
            <th key={c.key} style={{
              textAlign: 'left', padding: '8px 12px',
              fontSize: 11, fontWeight: 500,
              color: 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: '.06em',
              borderBottom: '1px solid var(--border)',
            }}>
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {!data?.length ? (
          <tr>
            <td colSpan={columns.length} style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-muted)' }}>
              {emptyMsg}
            </td>
          </tr>
        ) : data.map((row, i) => (
          <tr key={row.id || i}
            onClick={() => onRowClick?.(row)}
            style={{
              borderBottom: '1px solid var(--border)',
              cursor: onRowClick ? 'pointer' : 'default',
              transition: 'background .12s',
            }}
            onMouseEnter={e => onRowClick && (e.currentTarget.style.background = 'var(--bg-hover)')}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            {columns.map(c => (
              <td key={c.key} style={{ padding: '11px 12px', color: 'var(--text-primary)' }}>
                {c.render ? c.render(row[c.key], row) : row[c.key] ?? '—'}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

/* ── MetricCard ─────────────────────────────────────────── */
export const MetricCard = ({ label, value, sub, color }) => (
  <Card padding="16px 18px">
    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>{label}</div>
    <div style={{ fontSize: 26, fontWeight: 600, color: color || 'var(--text-primary)', lineHeight: 1 }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 5 }}>{sub}</div>}
  </Card>
);

/* ── PageHeader ─────────────────────────────────────────── */
export const PageHeader = ({ title, subtitle, action }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</h1>
      {subtitle && <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 3 }}>{subtitle}</p>}
    </div>
    {action && <div>{action}</div>}
  </div>
);

/* ── Modal ──────────────────────────────────────────────── */
import { useRef, useEffect } from 'react';

export const Modal = ({ title, onClose, children, width = 480 }) => {
  const modalRef = useRef(null);
  useEffect(() => {
    // Focus the first focusable element in the modal
    if (modalRef.current) {
      const focusable = modalRef.current.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable) focusable.focus();
    }
  }, []);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        ref={modalRef}
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          width: '100%', maxWidth: width,
          maxHeight: '90vh', overflowY: 'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid var(--border)',
        }}>
          <h2 id="modal-title" style={{ fontSize: 15, fontWeight: 600 }}>{title}</h2>
            <button onClick={onClose} aria-label="Close modal" style={{ background: 'none', color: 'var(--text-secondary)', fontSize: 18, cursor: 'pointer' }}>&times;</button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  );
};

/* ── Spinner ────────────────────────────────────────────── */
export const Spinner = () => (
  <div
    role="status"
    aria-live="polite"
    aria-label="Loading"
    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}
  >
    <div style={{
      width: 28, height: 28, borderRadius: '50%',
      border: '2px solid var(--border)',
      borderTopColor: 'var(--accent)',
      animation: 'spin .7s linear infinite',
    }} />
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>
);

/* ── ErrorMsg ───────────────────────────────────────────── */
export const ErrorMsg = ({ msg }) => (
  <div
    role="alert"
    aria-live="assertive"
    style={{ padding: '12px 16px', background: 'var(--danger-dim)', color: 'var(--danger)', borderRadius: 'var(--radius-sm)', fontSize: 13 }}
  >
    {msg}
  </div>
);
