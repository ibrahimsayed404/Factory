import React from 'react';
import { Badge, statusVariant } from './index';

/* eslint-disable react/prop-types */

/**
 * Reusable order details panel shown after selecting a production order.
 * Displays order number, product, quantity, color breakdown, and phase data.
 *
 * @param {object} props
 * @param {object} props.order          - The selected order object from the list
 * @param {object} props.orderReport    - The full report loaded via getReport()
 * @param {function} props.t            - Translation function
 * @param {object} props.productNameById - Product name lookup map
 * @param {string} [props.currentPhase] - 'sorting' | 'outsourcing' | 'final'
 */
export default function OrderDetailsSummary({ order, orderReport, t, productNameById = {}, currentPhase = '' }) {
  if (!order && !orderReport) return null;

  const displayNumber = orderReport?.display_order_number || orderReport?.order_number || order?.model_number || order?.order_number || '—';
  const productName = orderReport?.product_name || orderReport?.catalog_product_name
    || (order?.product_id && productNameById[String(order.product_id)])
    || order?.product_name || '—';
  const inputQty = orderReport?.input ?? order?.phases?.input ?? order?.planned_quantity ?? '—';
  const status = order?.status || orderReport?.status || '—';

  // Color breakdown from input phase
  const inputPhase = (orderReport?.phases || []).find((p) => p.phase === 'input');
  const inputColors = Array.isArray(inputPhase?.color_breakdown) ? inputPhase.color_breakdown : [];

  // Previous phase data
  const sortingQty = orderReport?.sorting ?? order?.phases?.sorting;
  const sortingPhase = (orderReport?.phases || []).find((p) => p.phase === 'sorting');
  const sortingColors = Array.isArray(sortingPhase?.color_breakdown) ? sortingPhase.color_breakdown : [];

  const outsourcingQty = orderReport?.outsourcing ?? order?.phases?.outsourcing;
  const outsourcingPhase = (orderReport?.phases || []).find((p) => p.phase === 'outsourcing');
  const outsourcingColors = Array.isArray(outsourcingPhase?.color_breakdown) ? outsourcingPhase.color_breakdown : [];

  const efficiency = orderReport?.efficiency;

  const showSorting = currentPhase === 'outsourcing' || currentPhase === 'final';
  const showOutsourcing = currentPhase === 'final';

  const renderColorBadges = (colors) => {
    if (!colors.length) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {colors.map((c, i) => (
          <span
            key={`${c.color}-${i}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '2px 8px',
              borderRadius: 12,
              fontSize: 11,
              fontWeight: 500,
              background: 'var(--bg-hover)',
              border: '1px solid var(--border)',
            }}
          >
            <span style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'var(--accent)',
              flexShrink: 0,
            }} />
            {c.color}: {c.quantity}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div style={{
      marginTop: 16,
      padding: 16,
      backgroundColor: 'var(--bg-elevated, var(--background-secondary))',
      borderRadius: 10,
      border: '1px solid var(--border)',
    }}>
      {/* Header row: Order #, Product, Status */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {t('orderNumber', 'Order Number')}
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{displayNumber}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {t('productName', 'Product')}
          </div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{productName}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {t('status', 'Status')}
          </div>
          <Badge variant={statusVariant(status)}>{status}</Badge>
        </div>
      </div>

      {/* Input phase */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginBottom: showSorting ? 12 : 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
            {t('input', 'Input')} — {t('quantity', 'Quantity')}: <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{inputQty}</span>
          </div>
        </div>
        {inputColors.length > 0 && (
          <div style={{ marginBottom: 4 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{t('colorBreakdown', 'Color Breakdown')}</div>
            {renderColorBadges(inputColors)}
          </div>
        )}
      </div>

      {/* Sorting phase (shown on outsourcing & final pages) */}
      {showSorting && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginBottom: showOutsourcing ? 12 : 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
              {t('sorting', 'Sorting')} — {t('quantity', 'Quantity')}: <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{typeof sortingQty === 'number' ? sortingQty : '—'}</span>
            </div>
          </div>
          {sortingColors.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{t('colorBreakdown', 'Color Breakdown')}</div>
              {renderColorBadges(sortingColors)}
            </div>
          )}
        </div>
      )}

      {/* Outsourcing phase (shown on final page) */}
      {showOutsourcing && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
              {t('outsourcing', 'Outsourcing')} — {t('quantity', 'Quantity')}: <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{typeof outsourcingQty === 'number' ? outsourcingQty : '—'}</span>
            </div>
          </div>
          {outsourcingColors.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{t('colorBreakdown', 'Color Breakdown')}</div>
              {renderColorBadges(outsourcingColors)}
            </div>
          )}
        </div>
      )}

      {/* Efficiency */}
      {typeof efficiency === 'number' && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 12, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
          {t('efficiency', 'Efficiency')}: <span style={{ color: efficiency >= 90 ? 'var(--accent)' : efficiency >= 70 ? 'var(--info)' : 'var(--danger)', fontWeight: 700 }}>{efficiency}%</span>
        </div>
      )}
    </div>
  );
}
