import React, { useState } from 'react';
import { salesApi, productApi, productionTrackingApi } from '../api';
import { useFetch } from '../hooks/useFetch';
import { PageHeader, Card, Table, Badge, Btn, Modal, Input, Select, Spinner, ErrorMsg, statusVariant } from '../components/ui';
import { useLanguage } from '../context/LanguageContext';
import { formatOrderOptionLabel } from '../utils/productionOrderDisplay';

const createEmptyOrderRow = () => ({
  id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  production_order_id: '',
  unit_price: '',
});

/* eslint-disable react/prop-types */
const OrderDetailsContent = ({ order, metrics, t, statusVariant }) => (
  <div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
      <div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>{t('orderNumber', 'Order Number')}</div>
        <div style={{ fontSize: 16, fontWeight: 600 }}>{order.order_number}</div>
      </div>
      <div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>{t('customers', 'Customer')}</div>
        <div style={{ fontSize: 16, fontWeight: 600 }}>{order.customer_name}</div>
      </div>
      <div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>{t('date', 'Order Date')}</div>
        <div style={{ fontSize: 14 }}>{new Date(order.order_date).toLocaleDateString()}</div>
      </div>
      <div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>{t('status', 'Status')}</div>
        <Badge variant={statusVariant(order.status)}>{order.status}</Badge>
      </div>
    </div>

    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 16, marginBottom: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>{t('orderItems', 'ORDER ITEMS')}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {order.items?.map((item) => (
          <div key={`${item.product_name}-${item.color}-${item.unit_price}`} style={{ padding: 12, backgroundColor: 'var(--background-secondary)', borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{item.product_name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>${Number(item.unit_price || 0).toFixed(2)} / {t('pcs', 'pcs')}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>${Number((item.quantity || 0) * (item.unit_price || 0)).toFixed(2)}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('total', 'Total')}</div>
              </div>
            </div>
            
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--border-color)' }}>
              <Badge variant="outline" style={{ display: 'flex', gap: 8, padding: '4px 8px', fontSize: 12, backgroundColor: 'var(--background-primary)' }}>
                <span style={{ fontWeight: 500 }}>{item.color || t('defaultColor', 'Default')}</span>
                <span style={{ color: 'var(--text-secondary)' }}>{item.quantity} {t('pcs', 'pcs')}</span>
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>{t('totalOrdered', 'Total Amount')}</div>
        <div style={{ fontSize: 18, fontWeight: 600 }}>${Number(order.total_amount || 0).toLocaleString()}</div>
      </div>
      <div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>{t('payment', 'Payment Status')}</div>
        <Badge variant={statusVariant(order.payment_status)}>{order.payment_status}</Badge>
      </div>
    </div>

    {order.notes && (
      <div style={{ marginTop: 16, padding: 12, backgroundColor: 'var(--background-secondary)', borderRadius: 8 }}>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{t('notes', 'Notes')}</div>
        <div>{order.notes}</div>
      </div>
    )}

    {metrics && (
      <div style={{ marginTop: 20, borderTop: '1px solid var(--border-color)', paddingTop: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>{t('productionMetrics', 'PRODUCTION METRICS')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{t('inputQty', 'Input Quantity')}</div>
            <div style={{ fontWeight: 600 }}>{metrics.input || 0}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{t('sortingQty', 'Sorting Quantity')}</div>
            <div style={{ fontWeight: 600 }}>{typeof metrics.sorting === 'number' ? metrics.sorting : '—'}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{t('outsourcingQty', 'Outsourcing Quantity')}</div>
            <div style={{ fontWeight: 600 }}>{typeof metrics.outsourcing === 'number' ? metrics.outsourcing : '—'}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{t('finalQty', 'Final Quantity')}</div>
            <div style={{ fontWeight: 600 }}>{typeof metrics.final === 'number' ? metrics.final : '—'}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{t('totalLoss', 'Total Loss')}</div>
            <div style={{ fontWeight: 600 }}>{metrics.total_loss ?? 0}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{t('efficiency', 'Efficiency')}</div>
            <div style={{ fontWeight: 600 }}>{typeof metrics.efficiency === 'number' ? `${metrics.efficiency}%` : '—'}</div>
          </div>
        </div>
      </div>
    )}
  </div>
);

export default function Sales() {
  const { t } = useLanguage();
  const { data: orders, loading, error, refetch } = useFetch(salesApi.orders);
  const { data: customers } = useFetch(salesApi.customers);
  const { data: products } = useFetch(productApi.list);
  const { data: productionOrders } = useFetch(productionTrackingApi.list);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ customer_id: '', delivery_date: '', notes: '' });
  const [orderRows, setOrderRows] = useState([createEmptyOrderRow()]);
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState('');
  const [detailOrderId, setDetailOrderId] = useState(null);
  const [detailOrder, setDetailOrder] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [productionMetrics, setProductionMetrics] = useState(null);

  const addOrderRow = () => setOrderRows([...orderRows, createEmptyOrderRow()]);
  const updateOrderRowDynamic = (i, updates) => setOrderRows(prev => prev.map((it, idx) => idx === i ? { ...it, ...updates } : it));
  const updateOrderRow = (i, field, val) => updateOrderRowDynamic(i, { [field]: val });
  const removeOrderRow = (i) => setOrderRows(orderRows.filter((_, idx) => idx !== i));

  const handleOrderSelect = async (i, orderId) => {
    let unitPrice = '';
    const pOrder = productionOrders?.find(po => po.id === Number(orderId));
    if (pOrder && pOrder.product_id) {
       const product = products?.find(p => p.id === pOrder.product_id);
       if (product && product.default_price) unitPrice = product.default_price;
    }
    
    updateOrderRowDynamic(i, { production_order_id: orderId, details: null, unit_price: unitPrice });
    
    if (!orderId) return;

    try {
      updateOrderRowDynamic(i, { loading: true });
      const report = await productionTrackingApi.getReport(orderId);
      const phases = report.phases || [];
      const finalPhase = phases.find(p => p.phase === 'final');
      const outPhase = phases.find(p => p.phase === 'outsourcing');
      const sortPhase = phases.find(p => p.phase === 'sorting');
      const inPhase = phases.find(p => p.phase === 'input');
      
      const bestPhase = finalPhase || outPhase || sortPhase || inPhase;
      const colors = Array.isArray(bestPhase?.color_breakdown) ? bestPhase.color_breakdown : [];
      const totalQty = bestPhase?.quantity || report.planned_quantity;

      updateOrderRowDynamic(i, { details: { colors, totalQty } });
    } catch (e) {
      console.error(e);
    } finally {
      updateOrderRowDynamic(i, { loading: false });
    }
  };

  const loadOrderDetails = async (orderId) => {
    setDetailLoading(true);
    setDetailOrder(null);
    setProductionMetrics(null);
    try {
      const order = await salesApi.order(orderId);
      setDetailOrder(order);
      
      // Try to load production metrics if production order exists
      if (order.production_order_id) {
        try {
          const metrics = await productionTrackingApi.getReport(order.production_order_id);
          setProductionMetrics(metrics);
        } catch {
          // No production metrics available for this order - continue without them
        }
      }
    } catch (e) {
      console.error('Failed to load order details:', e);
    } finally {
      setDetailLoading(false);
    }
  };

  const validateOrder = () => {
    if (!form.customer_id) return t('selectCustomer', 'Please select a customer.');
    const validRows = orderRows.filter(r => r.production_order_id && Number(r.unit_price) >= 0);
    if (!validRows.length) return t('orderItemsRequired', 'Add at least one valid production order with a unit price.');
    return '';
  };

  const handleCreate = async () => {
    const validationError = validateOrder();
    if (validationError) {
      setCreateError(validationError);
      return;
    }
    setSaving(true);
    setCreateError('');
    try {
      const validItems = [];
      for (const row of orderRows) {
        if (!row.production_order_id) continue;
        const pOrder = productionOrders?.find(po => po.id === Number(row.production_order_id));
        if (pOrder && row.details) {
          const colors = row.details.colors || [];
          if (colors.length > 0) {
            for (const c of colors) {
              if (Number(c.quantity) > 0) {
                validItems.push({
                  product_name: pOrder.product_name || pOrder.catalog_product_name,
                  product_id: pOrder.product_id,
                  color: c.color,
                  quantity: Number(c.quantity),
                  unit_price: Number(row.unit_price || 0),
                });
              }
            }
          } else {
            const totalQty = row.details.totalQty;
            if (Number(totalQty) > 0) {
              validItems.push({
                product_name: pOrder.product_name || pOrder.catalog_product_name,
                product_id: pOrder.product_id,
                color: null,
                quantity: Number(totalQty),
                unit_price: Number(row.unit_price || 0),
              });
            }
          }
        }
      }
      
      if (!validItems.length) {
        throw new Error(t('noValidItems', 'No valid items found in the selected orders.'));
      }

      await salesApi.createOrder({ ...form, items: validItems });
      setShowModal(false);
      refetch();
    } catch (e) {
      setCreateError(e.message || t('createOrderFailed', 'Failed to create order.'));
    } finally { setSaving(false); }
  };

  const updateStatus = async (id, status) => {
    try {
      await salesApi.updateStatus(id, { status });
      refetch();
    } catch (e) {
      globalThis.alert(e.message || t('updateStatusFailed', 'Failed to update status.'));
    }
  };

  const customerBalanceMap = Object.fromEntries(
    (customers || []).map((c) => [
      Number(c.id),
      {
        remaining: Number(c.remaining_balance || 0),
        credit: Number(c.credit_balance || 0),
      },
    ])
  );

  const columns = [
    { key: 'order_number', label: 'Order #', render: v => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>{v}</span> },
    { key: 'customer_name', label: t('customers', 'Customer'), render: v => v || '—' },
    {
      key: 'customer_balance',
      label: t('customerBalance', 'Customer balance'),
      render: (_, row) => {
        const bal = customerBalanceMap[Number(row.customer_id)] || { remaining: 0, credit: 0 };
        if (bal.remaining > 0) return <Badge variant="danger">{`Due ${bal.remaining.toLocaleString()}`}</Badge>;
        if (bal.credit > 0) return <Badge variant="success">{`Credit ${bal.credit.toLocaleString()}`}</Badge>;
        return <Badge variant="success">{t('clear', 'Clear')}</Badge>;
      },
    },
    { key: 'total_amount', label: t('totalOrdered', 'Total'), render: v => `$${Number(v || 0).toLocaleString()}` },
    { key: 'payment_status', label: t('payment', 'Payment'), render: v => <Badge variant={statusVariant(v)}>{v}</Badge> },
    { key: 'status', label: t('status', 'Status'), render: v => <Badge variant={statusVariant(v)}>{v}</Badge> },
    { key: 'order_date', label: t('date', 'Date'), render: v => new Date(v).toLocaleDateString() },
    {
      key: 'actions',
      label: '',
      render: (_, row) => (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <Btn size="sm" onClick={() => { setDetailOrderId(row.id); loadOrderDetails(row.id); }} style={{ fontSize: 11, padding: '4px 8px' }}>{t('details', 'Details')}</Btn>
          <Select value={row.status} onChange={e => updateStatus(row.id, e.target.value)} style={{ fontSize: 12, padding: '4px 8px', width: 100 }}>
            <option value="new">{t('new', 'New')}</option>
            <option value="confirmed">{t('confirmed', 'Confirmed')}</option>
            <option value="shipped">{t('shipped', 'Shipped')}</option>
            <option value="delivered">{t('delivered', 'Delivered')}</option>
            <option value="cancelled">{t('cancelled', 'Cancelled')}</option>
          </Select>
        </div>
      ),
    },
  ];

  return (
    <div style={{ padding: '28px 28px 40px' }}>
      <PageHeader title={t('sales', 'Sales')} subtitle={t('manageCustomerOrders', 'Manage customer orders and invoices')}
        action={<Btn variant="primary" onClick={() => { setForm({ customer_id: '', delivery_date: '', notes: '' }); setOrderRows([createEmptyOrderRow()]); setCreateError(''); setShowModal(true); }}>{t('newOrder', '+ New order')}</Btn>}
      />
      {loading && <Spinner />}
      {error && <ErrorMsg msg={error} />}
      {!loading && <Card padding="0"><Table columns={columns} data={orders || []} /></Card>}

      {showModal && (
        <Modal title={t('newSalesOrder', 'New sales order')} onClose={() => setShowModal(false)} width={560}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <Select label={t('customers', 'Customer')} value={form.customer_id} onChange={e => setForm({ ...form, customer_id: e.target.value })}>
              <option value="">{t('selectEmployee', 'Select customer')}</option>
              {customers?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <Input label={t('dueDate', 'Delivery date')} type="date" value={form.delivery_date} onChange={e => setForm({ ...form, delivery_date: e.target.value })} />
            <div style={{ gridColumn: '1/-1' }}>
              <Input label={t('notes', 'Notes')} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>

          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>{t('orderItems', 'ORDER ITEMS')}</div>
          {orderRows.map((row, i) => {
            const pOrder = productionOrders?.find(po => po.id === Number(row.production_order_id));
            return (
              <div key={row.id} style={{ marginBottom: 16, padding: 12, border: '1px solid var(--border-color)', borderRadius: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 8, alignItems: 'flex-end' }}>
                  <Select value={row.production_order_id} onChange={e => handleOrderSelect(i, e.target.value)}>
                    <option value="">{t('selectOrder', 'Select Order')}</option>
                    {productionOrders?.map(po => (
                      <option key={po.id} value={po.id}>{formatOrderOptionLabel(po)}</option>
                    ))}
                  </Select>
                  <Input placeholder={t('unitPrice', 'Unit Price')} type="number" step="0.01" value={row.unit_price} onChange={e => updateOrderRow(i, 'unit_price', e.target.value)} />
                  <Btn variant="danger" onClick={() => removeOrderRow(i)} disabled={orderRows.length === 1}>X</Btn>
                </div>
                
                {row.loading && <div style={{ marginTop: 12 }}><Spinner /></div>}
                
                {!row.loading && pOrder && row.details && (
                  <div style={{ marginTop: 12, padding: 12, backgroundColor: 'var(--background-secondary)', borderRadius: 6 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{pOrder.product_name || pOrder.catalog_product_name}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {row.details.colors.length > 0 ? (
                        row.details.colors.map((c, idx) => (
                          <Badge key={idx} variant="outline" style={{ display: 'flex', gap: 8, padding: '4px 8px', fontSize: 12, backgroundColor: 'var(--background-primary)' }}>
                            <span style={{ fontWeight: 500 }}>{c.color}</span>
                            <span style={{ color: 'var(--text-secondary)' }}>{c.quantity} {t('pcs', 'pcs')}</span>
                          </Badge>
                        ))
                      ) : (
                        <Badge variant="outline" style={{ display: 'flex', gap: 8, padding: '4px 8px', fontSize: 12, backgroundColor: 'var(--background-primary)' }}>
                          <span style={{ fontWeight: 500 }}>{t('totalQty', 'Total Quantity')}</span>
                          <span style={{ color: 'var(--text-secondary)' }}>{row.details.totalQty} {t('pcs', 'pcs')}</span>
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <Btn variant="outline" size="sm" onClick={addOrderRow} style={{ marginBottom: 16 }}>{t('addOrder', '+ Add order')}</Btn>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <Btn onClick={() => setShowModal(false)}>{t('cancel', 'Cancel')}</Btn>
            <Btn variant="primary" onClick={handleCreate} disabled={saving}>{saving ? t('saving', 'Creating…') : t('createOrderButton', 'Create order')}</Btn>
          </div>
        </Modal>
      )}

      {detailOrderId && (
        <Modal title={t('orderDetails', 'Order Details')} onClose={() => { setDetailOrderId(null); setDetailOrder(null); setProductionMetrics(null); }} width={700}>
          {detailLoading && <Spinner />}
          {!detailLoading && !detailOrder && <ErrorMsg msg={t('failedToLoadOrderDetails', 'Failed to load order details')} />}
          {!detailLoading && detailOrder && (
            <OrderDetailsContent order={detailOrder} metrics={productionMetrics} t={t} statusVariant={statusVariant} />
          )}
        </Modal>
      )}
    </div>
  );
}
