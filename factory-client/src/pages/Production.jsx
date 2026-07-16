import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { productionApi, productionTrackingApi, productApi, manufacturingApi } from '../api';
import { useFetch } from '../hooks/useFetch';
import { PageHeader, Card, Table, Badge, Btn, Modal, Input, Select, Spinner, ErrorMsg, statusVariant, SearchInput } from '../components/ui';
import { FEATURE_FLAGS } from '../config/featureFlags';
import { useLanguage } from '../context/LanguageContext';
import { buildProductNameLookup, getOrderDisplayNumber, getOrderProductName } from '../utils/productionOrderDisplay';

const emptyForm = { product_id: '', quantity: '', bom_id: '', routing_id: '', start_date: '', due_date: '' };

const statusLabel = {
  pending: 'Pending',
  in_progress: 'In Progress',
  done: 'Done',
  shipped: 'Shipped',
  sorting: 'Sorting',
  outsourcing: 'Outsourcing',
  completed: 'Completed',
};

const TRACKING_STATUSES = new Set(['sorting', 'outsourcing', 'completed']);

const isTrackingOrder = (order) => (
  order?.order_number?.startsWith('PTO-')
  || Boolean(order?.model_number)
  || TRACKING_STATUSES.has(order?.status)
);

const trackingProgress = (order) => {
  const total = Number(order.planned_quantity || order.phases?.input || order.quantity || 0);
  const phases = ['input', 'sorting', 'outsourcing', 'final'];
  const completed = phases.filter((phase) => order.phases?.[phase] !== null && order.phases?.[phase] !== undefined).length;
  const produced = order.status === 'completed'
    ? Number(order.phases?.final ?? order.produced_qty ?? 0)
    : Number(order.phases?.final ?? order.phases?.outsourcing ?? order.phases?.sorting ?? 0);
  const pct = total > 0 ? Math.min((produced / total) * 100, 100) : Math.round((completed / phases.length) * 100);
  return { total, produced, pct, completed, phaseCount: phases.length };
};

export default function Production() {
  const { t } = useLanguage();
  const { data: orders, loading, error, refetch } = useFetch(productionTrackingApi.list);
  const { data: products } = useFetch(productApi.list);
  const productNameById = useMemo(() => buildProductNameLookup(products), [products]);
  const manufacturingEnabled = FEATURE_FLAGS.manufacturingBoms && FEATURE_FLAGS.manufacturingRoutings;
  const { data: boms } = useFetch(
    () => (manufacturingEnabled ? manufacturingApi.boms() : Promise.resolve([])),
    [manufacturingEnabled]
  );
  const { data: routings } = useFetch(
    () => (manufacturingEnabled ? manufacturingApi.routings() : Promise.resolve([])),
    [manufacturingEnabled]
  );
  const [showModal, setShowModal] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [progressForm, setProgressForm] = useState({ id: '', product_name: '', quantity: 0, produced_qty: 0, status: 'pending' });
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [createError, setCreateError] = useState('');
  const [progressError, setProgressError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

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
      const selectedProduct = (products || []).find((p) => String(p.id) === String(form.product_id));
      if (!selectedProduct) {
        setCreateError('Please select a product.');
        return;
      }
      const payload = manufacturingEnabled
        ? form
        : {
          product_name: selectedProduct.name,
          quantity: form.quantity,
          start_date: form.start_date || undefined,
          due_date: form.due_date || undefined,
        };
      await productionApi.create(payload);
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

  const displayed = useMemo(() => {
    let result = orders || [];
    if (statusFilter) {
      result = result.filter((o) => o.status === statusFilter);
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase().trim();
      result = result.filter(order => 
        (order.order_number?.toLowerCase() || '').includes(term) ||
        (order.product_name?.toLowerCase() || '').includes(term) ||
        (order.status?.toLowerCase() || '').includes(term) ||
        (order.model_number?.toLowerCase() || '').includes(term)
      );
    }
    return result;
  }, [orders, statusFilter, searchTerm]);

  const renderQuantity = (row) => {
    if (isTrackingOrder(row)) {
      const { total, produced, pct } = trackingProgress(row);
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
    }

    const total = Number(row.quantity || 0);
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
  };

  const columns = [
    { key: 'order_number', label: t('orderNumber', 'Order #'), render: (_, row) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>{getOrderDisplayNumber(row)}</span> },
    { key: 'sales_order_number', label: t('salesOrder', 'Sales order'), render: v => v ? <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--info)' }}>{v}</span> : t('manual', 'Manual') },
    { key: 'product_name', label: t('product', 'Product'), render: (_, row) => getOrderProductName(row, productNameById) },
    { key: 'quantity', label: t('qty', 'Qty'), render: (_, row) => renderQuantity(row) },
    { key: 'assigned_to_name', label: t('team', 'Team'), render: (v, row) => (row.sales_order_number && !v ? t('allEmployees', 'All employees') : (v || '—')) },
    { key: 'due_date', label: t('dueDate', 'Due'), render: v => v ? new Date(v).toLocaleDateString() : '—' },
    { key: 'status', label: t('status', 'Status'), render: v => <Badge variant={statusVariant(v)}>{statusLabel[v] || v}</Badge> },
    { key: 'actions', label: '', render: (_, row) => (
      isTrackingOrder(row) ? (
        <Link to="/production-orders/report" style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none' }}>
          {t('viewReport', 'View report')}
        </Link>
      ) : (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Btn size="sm" onClick={() => openProgress(row)}>{t('updateProgress', 'Update progress')}</Btn>
          <Select value={row.status} onChange={e => updateStatus(row.id, e.target.value)} style={{ fontSize: 12, padding: '4px 8px', width: 130 }}>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="done">Done</option>
            <option value="shipped">Shipped</option>
          </Select>
        </div>
      )
    )},
  ];

  return (
    <div style={{ padding: '28px 28px 40px' }}>
      <PageHeader title="Production" subtitle="Track manufacturing orders and progress"
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: 140 }}>
              <option value="">{t('allStatuses', 'All statuses')}</option>
              <option value="pending">{t('pending', 'Pending')}</option>
              <option value="in_progress">{t('inProgress', 'In Progress')}</option>
              <option value="sorting">{t('sorting', 'Sorting')}</option>
              <option value="outsourcing">{t('outsourcing', 'Outsourcing')}</option>
              <option value="completed">{t('completed', 'Completed')}</option>
              <option value="done">{t('done', 'Done')}</option>
              <option value="shipped">{t('shipped', 'Shipped')}</option>
            </Select>
            <Btn variant="primary" onClick={() => { setForm(emptyForm); setShowModal(true); }}>+ New order</Btn>
          </div>
        }
      />
      {loading && <Spinner />}
      {error && <ErrorMsg msg={error} />}
      {!loading && (
        <>
          <Card padding="12px 16px" style={{ marginBottom: 16 }}>
            <SearchInput 
              placeholder="Search by order number, product name, status, or model number..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </Card>
          <Card padding="0"><Table columns={columns} data={displayed} /></Card>
        </>
      )}

      {showModal && (
        <Modal title="New production order" onClose={() => setShowModal(false)} width={520}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: '1/-1' }}>
              <Select label="Product" value={form.product_id} onChange={f('product_id')}>
                <option value="">Select product...</option>
                {(products || []).map(p => <option key={p.id} value={p.id}>{p.name} {p.sku ? `(${p.sku})` : ''}</option>)}
              </Select>
            </div>
            
            <Input label="Quantity" type="number" value={form.quantity} onChange={f('quantity')} />
            
            {manufacturingEnabled && (
              <>
                <Select label="BOM" value={form.bom_id} onChange={f('bom_id')}>
                  <option value="">Select BOM...</option>
                  {(boms || []).filter(b => b.product_id === Number(form.product_id) || !form.product_id).map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </Select>

                <Select label="Routing" value={form.routing_id} onChange={f('routing_id')}>
                  <option value="">Select Routing...</option>
                  {(routings || []).filter(r => r.product_id === Number(form.product_id) || !form.product_id).map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </Select>
              </>
            )}

            <Input label="Start Date" type="date" value={form.start_date} onChange={f('start_date')} />
            <Input label="Due Date" type="date" value={form.due_date} onChange={f('due_date')} />
          </div>
          {createError && <div style={{marginTop:12}}><ErrorMsg msg={createError} /></div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 24 }}>
            <Btn onClick={() => setShowModal(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={handleCreate} disabled={saving}>{saving ? <Spinner /> : 'Create order'}</Btn>
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
