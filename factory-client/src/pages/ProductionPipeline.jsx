import React, { useState } from 'react';
import { productionApi } from '../api';
import { useFetch } from '../hooks/useFetch';
import { PageHeader, Spinner, ErrorMsg, Badge, statusVariant } from '../components/ui';
import { useLanguage } from '../context/LanguageContext';
import { getOrderDisplayNumber } from '../utils/productionOrderDisplay';

export default function ProductionPipeline() {
  const { t } = useLanguage();
  const { data: orders, loading, error, refetch } = useFetch(productionApi.list);
  const [draggedOrderId, setDraggedOrderId] = useState(null);

  const statuses = [
    { id: 'pending', label: t('pending', 'Pending') },
    { id: 'in_progress', label: t('in_progress', 'In Progress') },
    { id: 'done', label: t('done', 'Done') },
    { id: 'shipped', label: t('shipped', 'Shipped') }
  ];

  const handleDragStart = (e, id) => {
    setDraggedOrderId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, newStatus) => {
    e.preventDefault();
    if (!draggedOrderId) return;

    const order = orders.find(o => o.id === draggedOrderId);
    if (order && order.status !== newStatus) {
      try {
        await productionApi.updateStatus(draggedOrderId, { status: newStatus });
        refetch();
      } catch (err) {
        window.alert(err.message || 'Failed to update status');
      }
    }
    setDraggedOrderId(null);
  };

  return (
    <div style={{ padding: '28px 28px 40px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <PageHeader 
        title={t('productionPipeline', 'Product Pipeline')} 
        subtitle={t('productionPipelineSubtitle', 'Drag and drop production orders across stages')}
      />

      {loading && <Spinner />}
      {error && <ErrorMsg msg={error} />}

      {!loading && !error && (
        <div style={{ 
          display: 'flex', 
          gap: '16px', 
          flex: 1, 
          overflowX: 'auto',
          alignItems: 'flex-start'
        }}>
          {statuses.map(status => {
            const columnOrders = (orders || []).filter(o => o.status === status.id);

            return (
              <div 
                key={status.id}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, status.id)}
                style={{
                  flex: 1,
                  minWidth: '280px',
                  backgroundColor: 'var(--bg-secondary)',
                  borderRadius: '8px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  height: '100%',
                  minHeight: '60vh'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {status.label}
                  </h3>
                  <Badge variant="default">{columnOrders.length}</Badge>
                </div>

                {columnOrders.map(order => {
                  const total = Number(order.quantity || 0);
                  const produced = Number(order.produced_qty || 0);
                  const pct = total > 0 ? Math.min((produced / total) * 100, 100) : 0;
                  const color = pct >= 100 ? 'var(--accent)' : pct > 0 ? 'var(--info)' : 'var(--text-muted)';

                  return (
                    <div
                      key={order.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, order.id)}
                      style={{
                        backgroundColor: 'var(--bg-panel)',
                        padding: '12px',
                        borderRadius: '6px',
                        boxShadow: 'var(--shadow-sm)',
                        cursor: 'grab',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)' }}>
                          {getOrderDisplayNumber(order)}
                        </span>
                        <Badge variant={statusVariant(order.status)}>{status.label}</Badge>
                      </div>
                      
                      <div style={{ fontWeight: 500, fontSize: '13px' }}>
                        {order.product_name}
                      </div>

                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 11, color: 'var(--text-secondary)' }}>
                          <span>{produced} / {total}</span>
                          <span style={{ color }}>{Math.round(pct)}%</span>
                        </div>
                        <div style={{ height: 4, background: 'var(--bg-hover)', borderRadius: 999, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 999 }} />
                        </div>
                      </div>
                      
                      {order.due_date && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                          Due: {new Date(order.due_date).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  );
                })}
                
                {columnOrders.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '20px', fontSize: '13px', color: 'var(--text-muted)' }}>
                    {t('noOrders', 'No orders in this stage')}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
