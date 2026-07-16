import React, { useState, useMemo } from 'react';

export const Table = ({ columns, data, onRowClick, emptyMsg = 'No records found' }) => {
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedData = useMemo(() => {
    if (!sortConfig.key || !data) return data;
    return [...data].sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];
      
      aVal = aVal ?? '';
      bVal = bVal ?? '';

      // Special case for numeric fields
      if (!isNaN(aVal) && !isNaN(bVal) && aVal !== '' && bVal !== '') {
        return sortConfig.direction === 'asc' ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal);
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortConfig.direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortConfig]);

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 2px', fontSize: 13 }}>
        <thead>
          <tr>
            {columns.map(c => (
              <th key={c.key} 
                onClick={() => c.sortable !== false && handleSort(c.key)}
                style={{
                textAlign: 'left', padding: '10px 14px',
                fontSize: 11, fontWeight: 600,
                color: 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: '.06em',
                borderBottom: '1px solid var(--border)',
                position: 'sticky', top: 0,
                background: 'var(--bg-surface)',
                zIndex: 1,
                cursor: c.sortable !== false ? 'pointer' : 'default',
                userSelect: 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {c.label}
                  {c.sortable !== false && sortConfig.key === c.key && (
                    <span style={{ fontSize: 10, color: 'var(--accent)' }}>
                      {sortConfig.direction === 'asc' ? '▲' : '▼'}
                    </span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {!sortedData?.length ? (
            <tr>
              <td colSpan={columns.length} style={{
                padding: '32px 14px', textAlign: 'center',
                color: 'var(--text-muted)', fontSize: 13,
              }}>
                {emptyMsg}
              </td>
            </tr>
          ) : sortedData.map((row, i) => (
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
};
