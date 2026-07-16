import React, { useState, useId } from 'react';

export const SearchInput = ({ placeholder = 'Search...', value = '', onChange, onClear, ...props }) => {
  const autoId = useId();
  const inputId = props.id || autoId;
  const [isFocused, setIsFocused] = useState(false);
  const hasValue = Boolean(value?.trim());

  const handleClear = () => {
    if (onClear) {
      onClear();
    } else if (onChange) {
      onChange({ target: { value: '' } });
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div style={{
        position: 'absolute',
        left: 14,
        top: '50%',
        transform: 'translateY(-50%)',
        color: isFocused ? 'var(--accent)' : 'var(--text-muted)',
        pointerEvents: 'none',
        transition: 'color 0.2s ease',
        zIndex: 1,
      }}>
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx={11} cy={11} r={8} />
          <path d="m21 21-4.3-4.3" />
        </svg>
      </div>
      
      <input
        id={inputId}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        {...props}
        style={{
          width: '100%',
          padding: '12px 14px 12px 42px',
          fontSize: 14,
          fontWeight: 400,
          color: 'var(--text-primary)',
          background: 'var(--bg-elevated)',
          border: `1px solid ${isFocused ? 'var(--accent)' : 'var(--border)'}`,
          borderRadius: 'var(--radius-md)',
          outline: 'none',
          transition: 'all 0.2s ease',
          boxShadow: isFocused 
            ? '0 0 0 3px var(--accent-dim), 0 1px 3px rgba(0,0,0,0.1)' 
            : '0 1px 2px rgba(0,0,0,0.05)',
          ...props.style,
        }}
      />

      {hasValue && (
        <button
          type="button"
          onClick={handleClear}
          style={{
            position: 'absolute',
            right: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'var(--bg-hover)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            width: 24,
            height: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            transition: 'all 0.2s ease',
            padding: 0,
          }}
          onMouseEnter={(e) => {
            e.target.style.background = 'var(--bg-elevated)';
            e.target.style.borderColor = 'var(--accent)';
            e.target.style.color = 'var(--accent)';
          }}
          onMouseLeave={(e) => {
            e.target.style.background = 'var(--bg-hover)';
            e.target.style.borderColor = 'var(--border)';
            e.target.style.color = 'var(--text-muted)';
          }}
        >
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      )}
    </div>
  );
};
