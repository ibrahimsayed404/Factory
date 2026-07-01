import React, { useState } from 'react';
import { productApi } from '../api';
import { useFetch } from '../hooks/useFetch';
import { PageHeader, Card, Table, Btn, Modal, Input, Spinner, ErrorMsg } from '../components/ui';
import { useLanguage } from '../context/LanguageContext';

const emptyForm = { name: '', sku: '', description: '', default_price: '' };

export default function Products() {
  const { t } = useLanguage();
  const { data: items, loading, error, refetch } = useFetch(productApi.list);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const openCreate = () => { setForm(emptyForm); setEditing(null); setShowModal(true); };
  const openEdit = (item) => { setForm(item); setEditing(item.id); setShowModal(true); };

  const validateForm = () => {
    if (!form.name.trim()) return t('nameRequired', 'Name is required.');
    if (form.default_price && (Number.isNaN(Number(form.default_price)) || Number(form.default_price) < 0)) return t('nonNegativePrice', 'Price must be a non-negative number.');
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
      if (editing) await productApi.update(editing, form);
      else await productApi.create(form);
      setShowModal(false);
      setSuccessMsg(editing ? t('productUpdated', 'Product updated!') : t('productAdded', 'Product added!'));
      await refetch();
    } catch (e) {
      setFormError(e.message || t('failedSaveProduct', 'Failed to save product.'));
    } finally {
      setSaving(false);
    }
  };

  const [deletingId, setDeletingId] = useState(null);
  const handleDelete = async (id) => {
    if (!globalThis.window.confirm(t('deleteProduct', 'Delete this product?'))) return;
    setDeletingId(id);
    try {
      await productApi.delete(id);
      refetch();
    } finally {
      setDeletingId(null);
    }
  };

  const f = v => e => setForm({ ...form, [v]: e.target.value });

  const columns = [
    { key: 'name', label: t('product', 'Product') },
    { key: 'sku', label: t('sku', 'SKU'), render: v => v || '—' },
    { key: 'description', label: t('description', 'Description'), render: v => v || '—' },
    { key: 'default_price', label: t('defaultPrice', 'Default Price'), render: v => v ? `$${v}` : '—' },
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
        title={t('products', 'Products')}
        subtitle={t('manageProductCatalog', 'Manage product catalog and SKUs')}
        action={
          <Btn variant="primary" onClick={openCreate}>{t('addProduct', '+ Add product')}</Btn>
        }
      />

      {loading && <Spinner />}
      {error && <ErrorMsg msg={error} />}

      {!loading && (
        <Card padding="0">
          <Table columns={columns} data={items || []} />
        </Card>
      )}

      {successMsg && <div style={{color:'var(--accent)',margin:'12px 0',fontWeight:600}}>{successMsg}</div>}
      {showModal && (
        <Modal title={editing ? t('editProduct', 'Edit product') : t('addProduct', 'Add product')} onClose={() => setShowModal(false)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
            <Input label={t('product', 'Name')} value={form.name} onChange={f('name')} />
            <Input label={t('sku', 'SKU')} value={form.sku} onChange={f('sku')} />
            <Input label={t('description', 'Description')} value={form.description} onChange={f('description')} />
            <Input label={t('defaultPrice', 'Default Price ($)')} type="number" value={form.default_price} onChange={f('default_price')} />
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
