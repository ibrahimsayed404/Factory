import React, { useState } from 'react';
import { salesApi } from '../api';
import { useFetch } from '../hooks/useFetch';
import { PageHeader, Card, Table, Badge, Btn, Modal, Input, Select, Spinner, ErrorMsg, statusVariant } from '../components/ui';
import { useLanguage } from '../context/LanguageContext';

const createEmptyItem = () => ({
  id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  product_name: '',
  quantity: '',
  unit_price: '',
});

export default function Sales() {
  const { t } = useLanguage();
  const { data: orders, loading, error, refetch } = useFetch(salesApi.orders);
  const { data: customers } = useFetch(salesApi.customers);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ customer_id: '', delivery_date: '', notes: '' });
  const [items, setItems] = useState([createEmptyItem()]);
  const [saving, setSaving] = useState(false);

  const addItem = () => setItems([...items, createEmptyItem()]);
  const updateItem = (i, field, val) => setItems(items.map((it, idx) => idx === i ? { ...it, [field]: val } : it));
  const removeItem = (i) => setItems(items.filter((_, idx) => idx !== i));

  const handleCreate = async () => {
    setSaving(true);
    try {
      await salesApi.createOrder({ ...form, items });
      setShowModal(false); refetch();
    } finally { setSaving(false); }
  };

  const updateStatus = async (id, status) => {
    await salesApi.updateStatus(id, { status });
    refetch();
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
    { key: 'actions', label: '', render: (_, row) => (
      <Select value={row.status} onChange={e => updateStatus(row.id, e.target.value)} style={{ fontSize: 12, padding: '4px 8px', width: 130 }}>
        <option value="new">{t('new', 'New')}</option>
        <option value="confirmed">{t('confirmed', 'Confirmed')}</option>
        <option value="shipped">{t('shipped', 'Shipped')}</option>
        <option value="delivered">{t('delivered', 'Delivered')}</option>
        <option value="cancelled">{t('cancelled', 'Cancelled')}</option>
      </Select>
    )},
  ];

  return (
    <div style={{ padding: '28px 28px 40px' }}>
      <PageHeader title={t('sales', 'Sales')} subtitle={t('manageCustomerOrders', 'Manage customer orders and invoices')}
        action={<Btn variant="primary" onClick={() => { setForm({ customer_id: '', delivery_date: '', notes: '' }); setItems([createEmptyItem()]); setShowModal(true); }}>{t('newOrder', '+ New order')}</Btn>}
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
          {items.map((item, i) => (
            <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8, marginBottom: 8, alignItems: 'flex-end' }}>
              <Input placeholder={t('productNamePlaceholder', 'Product name')} value={item.product_name} onChange={e => updateItem(i, 'product_name', e.target.value)} />
              <Input placeholder={t('qtyPlaceholder', 'Qty')} type="number" value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} />
              <Input placeholder={t('unitPricePlaceholder', 'Unit price')} type="number" value={item.unit_price} onChange={e => updateItem(i, 'unit_price', e.target.value)} />
              <Btn size="sm" variant="danger" onClick={() => removeItem(i)}>✕</Btn>
            </div>
          ))}
          <Btn size="sm" onClick={addItem} style={{ marginBottom: 16 }}>+ Add item</Btn>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <Btn onClick={() => setShowModal(false)}>{t('cancel', 'Cancel')}</Btn>
            <Btn variant="primary" onClick={handleCreate} disabled={saving}>{saving ? t('saving', 'Creating…') : t('createOrderButton', 'Create order')}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
