import React from 'react';

export const ErrorMsg = ({ msg, error, children, style, onDismiss }) => {
  const raw = msg ?? error ?? children;
  if (!raw) return null;

  let displayMessage = raw;
  if (typeof raw === 'object' && raw !== null) {
    displayMessage = raw.message || raw.error || JSON.stringify(raw);
  }
  displayMessage = String(displayMessage || '').trim();
  if (!displayMessage) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        padding: '12px 16px',
        background: 'var(--danger-dim, rgba(239, 68, 68, 0.15))',
        color: 'var(--danger, #ef4444)',
        borderRadius: 'var(--radius-sm, 8px)',
        fontSize: 13,
        fontWeight: 500,
        border: '1px solid rgba(239, 68, 68, 0.25)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        animation: 'fadeInUp .3s var(--ease-out, ease-out) both',
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 15, flexShrink: 0 }}>⚠</span>
        <span>{displayMessage}</span>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'inherit',
            cursor: 'pointer',
            fontSize: 16,
            padding: 0,
            lineHeight: 1,
            opacity: 0.7,
          }}
          title="إغلاق"
        >
          ✕
        </button>
      )}
    </div>
  );
};
