import React, { useState } from 'react';
import { inventoryApi } from '../api';
import { useFetch } from '../hooks/useFetch';
import { PageHeader, Card, Table, Badge, Btn, Modal, Input, Select, Spinner, ErrorMsg } from '../components/ui';

const emptyForm = { name: '', category: '', unit: '', quantity: '', min_quantity: '', cost_per_unit: '', supplier: '' };

export default function Inventory() {
  const { data: items, loading, error, refetch } = useFetch(inventoryApi.list);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filterLow, setFilterLow] = useState(false);

  const openCreate = () => { setForm(emptyForm); setEditing(null); setShowModal(true); };
  const openEdit = (item) => { setForm(item); setEditing(item.id); setShowModal(true); };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editing) await inventoryApi.update(editing, form);
      else await inventoryApi.create(form);
      setShowModal(false); refetch();
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this material?')) return;
    await inventoryApi.delete(id);
    refetch();
  };

  const f = v => e => setForm({ ...form, [v]: e.target.value });

  const displayed = filterLow
    ? (items || []).filter(i => parseFloat(i.quantity) <= parseFloat(i.min_quantity))
    : items || [];

  const lowCount = (items || []).filter(i => parseFloat(i.quantity) <= parseFloat(i.min_quantity)).length;

  const columns = [
    { key: 'name', label: 'Material' },
    { key: 'category', label: 'Category', render: v => v || '—' },
    { key: 'quantity', label: 'Qty', render: (v, row) => (
      <span style={{ color: parseFloat(v) <= parseFloat(row.min_quantity) ? 'var(--danger)' : 'var(--text-primary)' }}>
        {v} {row.unit}
      </span>
    )},
    { key: 'min_quantity', label: 'Min qty', render: (v, row) => `${v} ${row.unit}` },
    { key: 'cost_per_unit', label: 'Unit cost', render: v => v ? `$${v}` : '—' },
    { key: 'supplier', label: 'Supplier', render: v => v || '—' },
    { key: 'status', label: 'Status', render: (_, row) => (
      parseFloat(row.quantity) <= parseFloat(row.min_quantity)
        ? <Badge variant="danger">Low stock</Badge>
        : <Badge variant="success">OK</Badge>
    )},
    { key: 'actions', label: '', render: (_, row) => (
      <div style={{ display: 'flex', gap: 6 }}>
        <Btn size="sm" onClick={e => { e.stopPropagation(); openEdit(row); }}>Edit</Btn>
        <Btn size="sm" variant="danger" onClick={e => { e.stopPropagation(); handleDelete(row.id); }}>Del</Btn>
      </div>
    )},
  ];

  return (
    <div style={{ padding: '28px 28px 40px' }}>
      <PageHeader
        title="Inventory"
        subtitle="Manage raw materials and stock levels"
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn onClick={() => setFilterLow(!filterLow)} variant={filterLow ? 'danger' : 'ghost'}>
              {lowCount > 0 && <span style={{ background: 'var(--danger)', color: '#fff', borderRadius: 99, padding: '0 5px', fontSize: 10 }}>{lowCount}</span>}
              Low stock
            </Btn>
            <Btn variant="primary" onClick={openCreate}>+ Add material</Btn>
          </div>
        }
      />

      {loading && <Spinner />}
      {error && <ErrorMsg msg={error} />}

      {!loading && (
        <Card padding="0">
          <Table columns={columns} data={displayed} />
        </Card>
      )}

      {showModal && (
        <Modal title={editing ? 'Edit material' : 'Add material'} onClose={() => setShowModal(false)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: '1/-1' }}><Input label="Name" value={form.name} onChange={f('name')} /></div>
            <Input label="Category" placeholder="fabric, thread…" value={form.category} onChange={f('category')} />
            <Input label="Unit" placeholder="meters, kg, pcs" value={form.unit} onChange={f('unit')} />
            <Input label="Quantity" type="number" value={form.quantity} onChange={f('quantity')} />
            <Input label="Min quantity" type="number" value={form.min_quantity} onChange={f('min_quantity')} />
            <Input label="Cost per unit ($)" type="number" value={form.cost_per_unit} onChange={f('cost_per_unit')} />
            <Input label="Supplier" value={form.supplier} onChange={f('supplier')} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
            <Btn onClick={() => setShowModal(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
