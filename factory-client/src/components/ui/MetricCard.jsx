import React from 'react';
import { Card } from './Card';

export const MetricCard = ({ label, value, sub, color, icon }) => (
  <Card padding="18px 20px">
    {/* Subtle gradient glow at top */}
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, height: 3,
      background: color
        ? `linear-gradient(90deg, ${color}, transparent)`
        : 'var(--gradient-accent)',
      opacity: 0.6,
      borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
    }} />
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
      <div>
        <div style={{
          fontSize: 11, color: 'var(--text-muted)',
          fontWeight: 600, textTransform: 'uppercase',
          letterSpacing: '.07em', marginBottom: 10,
        }}>
          {label}
        </div>
        <div style={{
          fontSize: 28, fontWeight: 700,
          color: color || 'var(--text-primary)',
          lineHeight: 1, letterSpacing: '-0.02em',
        }}>
          {value}
        </div>
        {sub && (
          <div style={{
            fontSize: 11, color: 'var(--text-secondary)',
            marginTop: 6, fontWeight: 400,
          }}>
            {sub}
          </div>
        )}
      </div>
      {icon && (
        <div style={{
          fontSize: 22, opacity: 0.3,
          marginLeft: 8, flexShrink: 0,
        }}>
          {icon}
        </div>
      )}
    </div>
  </Card>
);
