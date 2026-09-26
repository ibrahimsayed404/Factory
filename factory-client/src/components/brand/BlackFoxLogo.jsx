/* eslint-disable react/prop-types */
import React from 'react';

export const BlackFoxLogo = ({ compact = false, className = '', style = {} }) => {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: compact ? 'row' : 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: compact ? 12 : 14,
        padding: compact ? '8px 12px' : '18px',
        userSelect: 'none',
        direction: 'ltr',
        ...style,
      }}
    >
      {/* Geometric Modern Fox Emblem */}
      <svg
        width={compact ? 36 : 56}
        height={compact ? 36 : 56}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0, filter: 'drop-shadow(0 4px 10px rgba(37, 99, 235, 0.25))' }}
      >
        <defs>
          <linearGradient id="foxGradPrimary" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
          <linearGradient id="foxGradAccent" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#2563eb" />
          </linearGradient>
          <linearGradient id="foxGradDark" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>
        </defs>

        {/* Outer Left Ear */}
        <polygon points="50,48 20,8 14,38" fill="url(#foxGradDark)" />
        {/* Inner Left Ear */}
        <polygon points="50,48 20,8 30,38" fill="url(#foxGradPrimary)" />

        {/* Outer Right Ear */}
        <polygon points="50,48 80,8 86,38" fill="url(#foxGradDark)" />
        {/* Inner Right Ear */}
        <polygon points="50,48 80,8 70,38" fill="url(#foxGradPrimary)" />

        {/* Brow Center Diamond */}
        <polygon points="50,22 62,38 50,54 38,38" fill="url(#foxGradAccent)" />

        {/* Left Cheek */}
        <polygon points="50,54 38,38 12,52 32,74" fill="url(#foxGradPrimary)" />
        {/* Right Cheek */}
        <polygon points="50,54 62,38 88,52 68,74" fill="url(#foxGradPrimary)" />

        {/* Left Outer Facet */}
        <polygon points="12,52 32,74 22,78" fill="url(#foxGradDark)" />
        {/* Right Outer Facet */}
        <polygon points="88,52 68,74 78,78" fill="url(#foxGradDark)" />

        {/* Center Snout Facets */}
        <polygon points="50,54 32,74 50,92" fill="#ffffff" fillOpacity="0.95" />
        <polygon points="50,54 68,74 50,92" fill="#e2e8f0" />

        {/* Nose Tip */}
        <polygon points="50,86 44,92 56,92" fill="#0f172a" />

        {/* Eyes (Fierce & Modern Amber Glow) */}
        <polygon points="36,54 44,57 40,61" fill="#f59e0b" />
        <polygon points="64,54 56,57 60,61" fill="#f59e0b" />
      </svg>

      {/* Brand Typography */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: compact ? 'flex-start' : 'center', textAlign: compact ? 'left' : 'center' }}>
        <div style={{
          fontSize: compact ? 16 : 22,
          fontWeight: 900,
          letterSpacing: '0.12em',
          color: 'var(--text-primary)',
          lineHeight: 1.1,
          fontFamily: 'var(--font-sans)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <span>BLACK</span>
          <span style={{ color: 'var(--accent)' }}>FOX</span>
        </div>
        <div style={{
          fontSize: compact ? 9 : 10,
          fontWeight: 700,
          letterSpacing: '0.22em',
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          marginTop: 3,
        }}>
          Clothing Factory
        </div>
      </div>
    </div>
  );
};

export default BlackFoxLogo;
