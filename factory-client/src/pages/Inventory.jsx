import React, { useState } from 'react';
import { inventoryApi } from '../api';
import { useFetch } from '../hooks/useFetch';
import { PageHeader, Card, Table, Badge, Btn, Modal, Input, Spinner, ErrorMsg } from '../components/ui';
import { useLanguage } from '../context/LanguageContext';

const emptyForm = { name: '', category: '', unit: '', quantity: '', min_quantity: '', cost_per_unit: '', supplier: '' };

export default function Inventory() {
  const { t } = useLanguage();
  const { data: items, loading, error, refetch } = useFetch(inventoryApi.list);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filterLow, setFilterLow] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const openCreate = () => { setForm(emptyForm); setEditing(null); setShowModal(true); };
  const openEdit = (item) => { setForm(item); setEditing(item.id); setShowModal(true); };

  const validateForm = () => {
    if (!form.name.trim()) return t('nameRequired', 'Name is required.');
    if (!form.unit.trim()) return t('unitRequired', 'Unit is required.');
    if (form.quantity === '' || Number.isNaN(Number(form.quantity)) || Number(form.quantity) < 0) return t('nonNegativeQuantity', 'Quantity must be a non-negative number.');
    if (form.min_quantity === '' || Number.isNaN(Number(form.min_quantity)) || Number(form.min_quantity) < 0) return t('nonNegativeMinQuantity', 'Min quantity must be a non-negative number.');
    return '';
  };

  const handleSave = async () => {
    setFormError('');
    setSuccessMsg('');
    const err = validateForm();
    if (err) {
      setFormError(err);
      return;
    }
    setSaving(true);
    try {
      if (editing) await inventoryApi.update(editing, form);
      else await inventoryApi.create(form);
      setShowModal(false);
      setSuccessMsg(editing ? t('materialUpdated', 'Material updated!') : t('materialAdded', 'Material added!'));
      await refetch();
    } catch (e) {
      setFormError(e.message || t('failedSaveMaterial', 'Failed to save material.'));
    } finally {
      setSaving(false);
    }
  };

  const [deletingId, setDeletingId] = useState(null);
  const handleDelete = async (id) => {
    if (!globalThis.window.confirm(t('deleteMaterial', 'Delete this material?'))) return;
    setDeletingId(id);
    try {
      await inventoryApi.delete(id);
      refetch();
    } finally {
      setDeletingId(null);
    }
  };

  const f = v => e => setForm({ ...form, [v]: e.target.value });
  const quantityValue = (value) => Number.parseFloat(value);

  const displayed = filterLow
    ? (items || []).filter(i => quantityValue(i.quantity) <= quantityValue(i.min_quantity))
    : items || [];

  const lowCount = (items || []).filter(i => quantityValue(i.quantity) <= quantityValue(i.min_quantity)).length;

  const columns = [
    { key: 'name', label: t('material', 'Material') },
    { key: 'category', label: t('category', 'Category'), render: v => v || '—' },
    { key: 'quantity', label: t('qty', 'Qty'), render: (v, row) => (
      <span style={{ color: quantityValue(v) <= quantityValue(row.min_quantity) ? 'var(--danger)' : 'var(--text-primary)' }}>
        {v} {row.unit}
      </span>
    )},
    { key: 'min_quantity', label: t('minQty', 'Min qty'), render: (v, row) => `${v} ${row.unit}` },
    { key: 'cost_per_unit', label: t('unitCost', 'Unit cost'), render: v => v ? `$${v}` : '—' },
    { key: 'supplier', label: t('supplier', 'Supplier'), render: v => v || '—' },
    { key: 'status', label: t('status', 'Status'), render: (_, row) => (
      quantityValue(row.quantity) <= quantityValue(row.min_quantity)
        ? <Badge variant="danger">{t('lowStock', 'Low stock')}</Badge>
        : <Badge variant="success">{t('ok', 'OK')}</Badge>
    )},
    { key: 'actions', label: '', render: (_, row) => (
      <div style={{ display: 'flex', gap: 6 }}>
        <Btn size="sm" onClick={e => { e.stopPropagation(); openEdit(row); }} disabled={deletingId === row.id}>{t('edit', 'Edit')}</Btn>
        <Btn size="sm" variant="danger" onClick={e => { e.stopPropagation(); handleDelete(row.id); }} disabled={deletingId === row.id} aria-busy={deletingId === row.id}>
          {deletingId === row.id ? <Spinner /> : t('del', 'Del')}
        </Btn>
      </div>
    )},
  ];

  return (
    <div style={{ padding: '28px 28px 40px' }}>
      <PageHeader
        title={t('inventory', 'Inventory')}
        subtitle={t('manageRawMaterials', 'Manage raw materials and stock levels')}
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn onClick={() => setFilterLow(!filterLow)} variant={filterLow ? 'danger' : 'ghost'}>
              {lowCount > 0 && <span style={{ background: 'var(--danger)', color: '#fff', borderRadius: 99, padding: '0 5px', fontSize: 10 }}>{lowCount}</span>}
              {t('lowStock', 'Low stock')}
            </Btn>
            <Btn variant="primary" onClick={openCreate}>{t('addMaterial', '+ Add material')}</Btn>
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

      {successMsg && <div style={{color:'var(--accent)',margin:'12px 0',fontWeight:600}}>{successMsg}</div>}
      {showModal && (
        <Modal title={editing ? t('editMaterial', 'Edit material') : t('addMaterial', 'Add material')} onClose={() => setShowModal(false)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: '1/-1' }}><Input label={t('material', 'Name')} value={form.name} onChange={f('name')} /></div>
            <Input label={t('category', 'Category')} placeholder="fabric, thread…" value={form.category} onChange={f('category')} />
            <Input label={t('unit', 'Unit')} placeholder="meters, kg, pcs" value={form.unit} onChange={f('unit')} />
            <Input label={t('qty', 'Quantity')} type="number" value={form.quantity} onChange={f('quantity')} />
            <Input label={t('minQty', 'Min quantity')} type="number" value={form.min_quantity} onChange={f('min_quantity')} />
            <Input label={t('unitCost', 'Cost per unit ($)')} type="number" value={form.cost_per_unit} onChange={f('cost_per_unit')} />
            <Input label={t('supplier', 'Supplier')} value={form.supplier} onChange={f('supplier')} />
          </div>
          {formError && <div style={{color:'var(--danger)',marginTop:10}}>{formError}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
            <Btn onClick={() => setShowModal(false)} disabled={saving}>{t('cancel', 'Cancel')}</Btn>
            <Btn variant="primary" onClick={handleSave} disabled={saving || !!validateForm()} aria-busy={saving}>
              {saving ? t('saving', 'Saving…') : t('save', 'Save')}
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
