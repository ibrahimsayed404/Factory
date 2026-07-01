import React, { useRef, useEffect } from 'react';

export const Modal = ({ title, onClose, children, width = 500 }) => {
  const modalRef = useRef(null);
  useEffect(() => {
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
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
        animation: 'fadeIn .2s var(--ease-out) both',
      }}
      onClick={onClose}
    >
      <div
        ref={modalRef}
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-xl)',
          width: '100%', maxWidth: width,
          maxHeight: '90vh', overflowY: 'auto',
          boxShadow: 'var(--shadow-lg)',
          animation: 'scaleIn .3s var(--ease-out) both',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 22px', borderBottom: '1px solid var(--border)',
        }}>
          <h2 id="modal-title" style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>{title}</h2>
          <button onClick={onClose} aria-label="Close modal" style={{
            background: 'var(--bg-hover)', color: 'var(--text-secondary)',
            fontSize: 16, cursor: 'pointer',
            width: 30, height: 30, borderRadius: 'var(--radius-sm)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all .15s var(--ease-out)',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--danger-dim)'; e.currentTarget.style.color = 'var(--danger)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
          >
            ×
          </button>
        </div>
        <div style={{ padding: 22 }}>{children}</div>
      </div>
    </div>
  );
};
