import React from 'react';

export const Table = ({ columns, data, onRowClick, emptyMsg = 'No records found' }) => (
  <div style={{ overflowX: 'auto' }}>
    <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 2px', fontSize: 13 }}>
      <thead>
        <tr>
          {columns.map(c => (
            <th key={c.key} style={{
              textAlign: 'left', padding: '10px 14px',
              fontSize: 11, fontWeight: 600,
              color: 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: '.06em',
              borderBottom: '1px solid var(--border)',
              position: 'sticky', top: 0,
              background: 'var(--bg-surface)',
              zIndex: 1,
            }}>
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {!data?.length ? (
          <tr>
            <td colSpan={columns.length} style={{
              padding: '32px 14px', textAlign: 'center',
              color: 'var(--text-muted)', fontSize: 13,
            }}>
              {emptyMsg}
            </td>
          </tr>
        ) : data.map((row, i) => (
          <tr key={row.id || i}
            onClick={() => onRowClick?.(row)}
            className="interactive-row"
            style={{
              cursor: onRowClick ? 'pointer' : 'default',
              animation: `fadeInUp .35s var(--ease-out) ${i * 0.03}s both`,
            }}
          >
            {columns.map(c => (
              <td key={c.key} style={{
                padding: '12px 14px',
                color: 'var(--text-primary)',
                borderBottom: '1px solid var(--border)',
              }}>
                {c.render ? c.render(row[c.key], row) : row[c.key] ?? '—'}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
