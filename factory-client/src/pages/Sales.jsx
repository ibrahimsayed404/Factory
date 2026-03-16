import React, { useState } from 'react';
import { salesApi } from '../api';
import { useFetch } from '../hooks/useFetch';
import { PageHeader, Card, Table, Badge, Btn, Modal, Input, Select, Spinner, ErrorMsg, statusVariant } from '../components/ui';

export default function Sales() {
  const { data: orders, loading, error, refetch } = useFetch(salesApi.orders);
  const { data: customers } = useFetch(salesApi.customers);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ customer_id: '', delivery_date: '', notes: '' });
  const [items, setItems] = useState([{ product_name: '', quantity: '', unit_price: '' }]);
  const [saving, setSaving] = useState(false);

  const addItem = () => setItems([...items, { product_name: '', quantity: '', unit_price: '' }]);
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
    { key: 'customer_name', label: 'Customer', render: v => v || '—' },
    {
      key: 'customer_balance',
      label: 'Customer balance',
      render: (_, row) => {
        const bal = customerBalanceMap[Number(row.customer_id)] || { remaining: 0, credit: 0 };
        if (bal.remaining > 0) return <Badge variant="danger">Due ${bal.remaining.toLocaleString()}</Badge>;
        if (bal.credit > 0) return <Badge variant="success">Credit ${bal.credit.toLocaleString()}</Badge>;
        return <Badge variant="success">Clear</Badge>;
      },
    },
    { key: 'total_amount', label: 'Total', render: v => `$${Number(v || 0).toLocaleString()}` },
    { key: 'payment_status', label: 'Payment', render: v => <Badge variant={statusVariant(v)}>{v}</Badge> },
    { key: 'status', label: 'Status', render: v => <Badge variant={statusVariant(v)}>{v}</Badge> },
    { key: 'order_date', label: 'Date', render: v => new Date(v).toLocaleDateString() },
    { key: 'actions', label: '', render: (_, row) => (
      <Select value={row.status} onChange={e => updateStatus(row.id, e.target.value)} style={{ fontSize: 12, padding: '4px 8px', width: 130 }}>
        <option value="new">New</option>
        <option value="confirmed">Confirmed</option>
        <option value="shipped">Shipped</option>
        <option value="delivered">Delivered</option>
        <option value="cancelled">Cancelled</option>
      </Select>
    )},
  ];

  return (
    <div style={{ padding: '28px 28px 40px' }}>
      <PageHeader title="Sales" subtitle="Manage customer orders and invoices"
        action={<Btn variant="primary" onClick={() => { setForm({ customer_id: '', delivery_date: '', notes: '' }); setItems([{ product_name: '', quantity: '', unit_price: '' }]); setShowModal(true); }}>+ New order</Btn>}
      />
      {loading && <Spinner />}
      {error && <ErrorMsg msg={error} />}
      {!loading && <Card padding="0"><Table columns={columns} data={orders || []} /></Card>}

      {showModal && (
        <Modal title="New sales order" onClose={() => setShowModal(false)} width={560}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <Select label="Customer" value={form.customer_id} onChange={e => setForm({ ...form, customer_id: e.target.value })}>
              <option value="">Select customer</option>
              {customers?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <Input label="Delivery date" type="date" value={form.delivery_date} onChange={e => setForm({ ...form, delivery_date: e.target.value })} />
            <div style={{ gridColumn: '1/-1' }}>
              <Input label="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>

          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>ORDER ITEMS</div>
          {items.map((item, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8, marginBottom: 8, alignItems: 'flex-end' }}>
              <Input placeholder="Product name" value={item.product_name} onChange={e => updateItem(i, 'product_name', e.target.value)} />
              <Input placeholder="Qty" type="number" value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} />
              <Input placeholder="Unit price" type="number" value={item.unit_price} onChange={e => updateItem(i, 'unit_price', e.target.value)} />
              <Btn size="sm" variant="danger" onClick={() => removeItem(i)}>✕</Btn>
            </div>
          ))}
          <Btn size="sm" onClick={addItem} style={{ marginBottom: 16 }}>+ Add item</Btn>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <Btn onClick={() => setShowModal(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={handleCreate} disabled={saving}>{saving ? 'Creating…' : 'Create order'}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
