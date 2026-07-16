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

  const handleSearch = () => {
    // Optional: trigger search action when button is clicked
    if (props.onSearch) {
      props.onSearch(value);
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', display: 'flex', gap: 12, alignItems: 'center' }}>
      {/* Main pill-shaped input */}
      <div style={{ position: 'relative', flex: 1 }}>
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
            padding: '14px 20px',
            fontSize: 15,
            fontWeight: 400,
            color: '#374151',
            background: '#f8f9fa',
            border: 'none',
            borderRadius: '50px',
            outline: 'none',
            transition: 'all 0.3s ease',
            boxShadow: isFocused 
              ? '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.04)' 
              : '0 2px 8px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.03)',
            ...props.style,
          }}
          placeholderStyle={{ color: '#9ca3af' }}
        />
        
        {hasValue && (
          <button
            type="button"
            onClick={handleClear}
            style={{
              position: 'absolute',
              right: 16,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'transparent',
              border: 'none',
              borderRadius: '50%',
              width: 20,
              height: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#9ca3af',
              transition: 'all 0.2s ease',
              padding: 0,
            }}
            onMouseEnter={(e) => {
              e.target.style.background = '#e5e7eb';
              e.target.style.color = '#6b7280';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'transparent';
              e.target.style.color = '#9ca3af';
            }}
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Detached circular search button */}
      <button
        type="button"
        onClick={handleSearch}
        style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: '#f8f9fa',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: '#6b7280',
          transition: 'all 0.3s ease',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.03)',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          e.target.style.background = '#e5e7eb';
          e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.04)';
          e.target.style.transform = 'scale(1.05)';
        }}
        onMouseLeave={(e) => {
          e.target.style.background = '#f8f9fa';
          e.target.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.03)';
          e.target.style.transform = 'scale(1)';
        }}
      >
        <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx={11} cy={11} r={8} />
          <path d="m21 21-4.3-4.3" />
        </svg>
      </button>
    </div>
  );
};
