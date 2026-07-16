import React, { useState, useMemo } from 'react';
import { productApi } from '../api';
import { useFetch } from '../hooks/useFetch';
import { PageHeader, Card, Table, Btn, Modal, Input, Spinner, ErrorMsg, SearchInput } from '../components/ui';
import { useLanguage } from '../context/LanguageContext';

const emptyForm = { name: '', description: '', default_price: '' };

export default function Products() {
  const { t } = useLanguage();
  const { data: items, loading, error, refetch } = useFetch(productApi.list);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredProducts = useMemo(() => {
    if (!items) return [];
    const term = searchTerm.toLowerCase().trim();
    if (!term) return items;
    return items.filter(item => 
      (item.name?.toLowerCase() || '').includes(term) ||
      (item.description?.toLowerCase() || '').includes(term)
    );
  }, [items, searchTerm]);

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
      const payload = {
        name: form.name.trim(),
        description: form.description?.trim() || null,
        default_price: form.default_price || 0,
      };
      if (editing) await productApi.update(editing, payload);
      else await productApi.create(payload);
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
        subtitle={t('manageProductCatalog', 'Manage product names for production and sales')}
        action={
          <Btn variant="primary" onClick={openCreate}>{t('addProduct', '+ Add product')}</Btn>
        }
      />

      {loading && <Spinner />}
      {error && <ErrorMsg msg={error} />}

      {!loading && (
        <>
          <Card padding="12px 16px" style={{ marginBottom: 16 }}>
            <SearchInput 
              placeholder="Search by name or description..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </Card>
          <Card padding="0">
            <Table columns={columns} data={filteredProducts} />
          </Card>
        </>
      )}

      {successMsg && <div style={{color:'var(--accent)',margin:'12px 0',fontWeight:600}}>{successMsg}</div>}
      {showModal && (
        <Modal title={editing ? t('editProduct', 'Edit product') : t('addProduct', 'Add product')} onClose={() => setShowModal(false)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
            <Input label={t('product', 'Name')} value={form.name} onChange={f('name')} />
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
