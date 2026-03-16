import React, { useState } from 'react';
import { productionApi, employeeApi } from '../api';
import { useFetch } from '../hooks/useFetch';
import { PageHeader, Card, Table, Badge, Btn, Modal, Input, Select, Spinner, ErrorMsg, statusVariant } from '../components/ui';

const emptyForm = { product_name: '', quantity: '', assigned_to: '', start_date: '', due_date: '', notes: '' };

const statusLabel = { pending: 'Pending', in_progress: 'In Progress', done: 'Done', shipped: 'Shipped' };

export default function Production() {
  const { data: orders, loading, error, refetch } = useFetch(productionApi.list);
  const { data: employees } = useFetch(employeeApi.list);
  const [showModal, setShowModal] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [progressForm, setProgressForm] = useState({ id: '', product_name: '', quantity: 0, produced_qty: 0, status: 'pending' });
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [createError, setCreateError] = useState('');
  const [progressError, setProgressError] = useState('');

  const progressProducedQty = Number(progressForm.produced_qty || 0);
  const progressTotalQty = Number(progressForm.quantity || 0);
  const progressValidationError = Number.isNaN(progressProducedQty)
    ? 'Finished quantity must be a number.'
    : progressProducedQty < 0
      ? 'Finished quantity must be a non-negative number.'
      : progressProducedQty > progressTotalQty
        ? `Finished quantity cannot exceed ordered quantity (${progressTotalQty}).`
        : '';

  const handleCreate = async () => {
    setSaving(true);
    setCreateError('');
    try {
      await productionApi.create(form);
      setShowModal(false);
      refetch();
    } catch (e) {
      setCreateError(e.message);
    }
    finally { setSaving(false); }
  };

  const updateStatus = async (id, status) => {
    try {
      await productionApi.updateStatus(id, { status });
      refetch();
    } catch (e) {
      window.alert(e.message);
    }
  };

  const openProgress = (order) => {
    setProgressError('');
    setProgressForm({
      id: order.id,
      product_name: order.product_name,
      quantity: Number(order.quantity || 0),
      produced_qty: Number(order.produced_qty || 0),
      status: order.status,
    });
    setShowProgressModal(true);
  };

  const handleProgressSave = async () => {
    const producedQty = Number(progressForm.produced_qty || 0);
    if (Number.isNaN(producedQty) || producedQty < 0) {
      setProgressError('Finished quantity must be a non-negative number.');
      return;
    }
    if (producedQty > Number(progressForm.quantity || 0)) {
      setProgressError(`Finished quantity cannot exceed ordered quantity (${progressForm.quantity}).`);
      return;
    }

    setSaving(true);
    setProgressError('');
    try {
      await productionApi.updateStatus(progressForm.id, {
        produced_qty: producedQty,
        status: progressForm.status,
      });
      setShowProgressModal(false);
      refetch();
    } catch (e) {
      setProgressError(e.message);
    } finally { setSaving(false); }
  };

  const f = v => e => setForm({ ...form, [v]: e.target.value });

  const displayed = statusFilter ? (orders || []).filter(o => o.status === statusFilter) : orders || [];

  const columns = [
    { key: 'order_number', label: 'Order #', render: v => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>{v}</span> },
    { key: 'sales_order_number', label: 'Sales order', render: v => v ? <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--info)' }}>{v}</span> : 'Manual' },
    { key: 'product_name', label: 'Product' },
    { key: 'quantity', label: 'Qty', render: (v, row) => {
      const total = Number(v || 0);
      const produced = Number(row.produced_qty || 0);
      const pct = total > 0 ? Math.min((produced / total) * 100, 100) : 0;
      const color = pct >= 100 ? 'var(--accent)' : pct > 0 ? 'var(--info)' : 'var(--text-muted)';
      return (
        <div style={{ minWidth: 150 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 12 }}>
            <span>{produced} / {total}</span>
            <span style={{ color }}>{Math.round(pct)}%</span>
          </div>
          <div style={{ height: 6, background: 'var(--bg-hover)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 999 }} />
          </div>
        </div>
      );
    } },
    { key: 'assigned_to_name', label: 'Team', render: (v, row) => (row.sales_order_number && !v ? 'All employees' : (v || '—')) },
    { key: 'due_date', label: 'Due', render: v => v ? new Date(v).toLocaleDateString() : '—' },
    { key: 'status', label: 'Status', render: v => <Badge variant={statusVariant(v)}>{statusLabel[v] || v}</Badge> },
    { key: 'actions', label: '', render: (_, row) => (
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Btn size="sm" onClick={() => openProgress(row)}>Update progress</Btn>
        <Select value={row.status} onChange={e => updateStatus(row.id, e.target.value)} style={{ fontSize: 12, padding: '4px 8px', width: 130 }}>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="done">Done</option>
          <option value="shipped">Shipped</option>
        </Select>
      </div>
    )},
  ];

  return (
    <div style={{ padding: '28px 28px 40px' }}>
      <PageHeader title="Production" subtitle="Track manufacturing orders and progress"
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: 140 }}>
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="done">Done</option>
              <option value="shipped">Shipped</option>
            </Select>
            <Btn variant="primary" onClick={() => { setForm(emptyForm); setShowModal(true); }}>+ New order</Btn>
          </div>
        }
      />
      {loading && <Spinner />}
      {error && <ErrorMsg msg={error} />}
      {!loading && <Card padding="0"><Table columns={columns} data={displayed} /></Card>}

      {showModal && (
        <Modal title="New production order" onClose={() => setShowModal(false)} width={520}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: '1/-1' }}><Input label="Product name" value={form.product_name} onChange={f('product_name')} /></div>
            <Input label="Quantity" type="number" value={form.quantity} onChange={f('quantity')} />
            <Select label="Assign to" value={form.assigned_to} onChange={f('assigned_to')}>
              <option value="">Select employee</option>
              {employees?.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </Select>
            <Input label="Start date" type="date" value={form.start_date} onChange={f('start_date')} />
            <Input label="Due date" type="date" value={form.due_date} onChange={f('due_date')} />
            <div style={{ gridColumn: '1/-1' }}>
              <Input label="Notes" value={form.notes} onChange={f('notes')} />
            </div>
          </div>
          {createError && <div style={{ marginTop: 12 }}><ErrorMsg msg={createError} /></div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
            <Btn onClick={() => setShowModal(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={handleCreate} disabled={saving}>{saving ? 'Creating…' : 'Create order'}</Btn>
          </div>
        </Modal>
      )}

      {showProgressModal && (
        <Modal title={`Update progress — ${progressForm.product_name}`} onClose={() => setShowProgressModal(false)} width={460}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input label="Ordered quantity" type="number" value={progressForm.quantity} readOnly />
            <Input
              label="Finished quantity"
              type="number"
              min="0"
              max={progressForm.quantity}
              value={progressForm.produced_qty}
              onChange={e => {
                setProgressForm({ ...progressForm, produced_qty: e.target.value });
                if (progressError) setProgressError('');
              }}
            />
            <div style={{ gridColumn: '1/-1' }}>
              <Select label="Status" value={progressForm.status} onChange={e => setProgressForm({ ...progressForm, status: e.target.value })}>
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
                <option value="shipped">Shipped</option>
              </Select>
            </div>
            <div style={{ gridColumn: '1/-1', fontSize: 12, color: 'var(--text-muted)' }}>
              Progress: {progressForm.produced_qty || 0} / {progressForm.quantity} finished.
            </div>
          </div>
          {(progressError || progressValidationError) && <div style={{ marginTop: 12 }}><ErrorMsg msg={progressError || progressValidationError} /></div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
            <Btn onClick={() => setShowProgressModal(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={handleProgressSave} disabled={saving || Boolean(progressValidationError)}>{saving ? 'Saving…' : 'Save progress'}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
