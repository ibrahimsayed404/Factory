import React, { useState } from 'react';
import { manufacturingApi, productApi, inventoryApi } from '../api';
import { useFetch } from '../hooks/useFetch';
import { PageHeader, Card, Table, Btn, Modal, Input, Spinner, ErrorMsg, Select } from '../components/ui';
import { useLanguage } from '../context/LanguageContext';

const createMaterialRow = () => ({
  client_id: (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`),
  material_id: '',
  quantity: 1,
  scrap_percentage: 0,
});

const emptyForm = { product_id: '', name: '', base_quantity: 1, materials: [] };

export default function Bom() {
  const { t } = useLanguage();
  const { data: boms, loading, error, refetch } = useFetch(manufacturingApi.boms);
  const { data: products } = useFetch(productApi.list);
  const { data: materials } = useFetch(inventoryApi.list);

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const openCreate = () => { setForm(emptyForm); setShowModal(true); };

  const addMaterial = () => {
    setForm({ ...form, materials: [...form.materials, createMaterialRow()] });
  };

  const removeMaterial = (idx) => {
    const newMats = [...form.materials];
    newMats.splice(idx, 1);
    setForm({ ...form, materials: newMats });
  };

  const updateMaterial = (idx, field, val) => {
    const newMats = [...form.materials];
    newMats[idx][field] = val;
    setForm({ ...form, materials: newMats });
  };

  const validateForm = () => {
    if (!form.product_id) return t('productRequired', 'Product is required.');
    if (!form.name.trim()) return t('nameRequired', 'BOM name is required.');
    if (!form.materials.length) return t('materialsRequired', 'At least one material is required.');
    for (const m of form.materials) {
      if (!m.material_id) return t('materialSelectionRequired', 'All materials must be selected.');
      if (m.quantity <= 0) return t('materialQuantityPositive', 'Material quantities must be > 0.');
    }
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
      await manufacturingApi.createBom(form);
      setShowModal(false);
      setSuccessMsg(t('bomAdded', 'BOM created successfully!'));
      await refetch();
    } catch (e) {
      setFormError(e.message || t('failedSaveBom', 'Failed to create BOM.'));
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: 'name', label: t('bomName', 'BOM Name') },
    { key: 'product_name', label: t('product', 'Product') },
    { key: 'base_quantity', label: t('baseQuantity', 'Base Quantity') },
    { key: 'created_at', label: t('created', 'Created Date'), render: v => new Date(v).toLocaleDateString() },
  ];

  return (
    <div style={{ padding: '28px 28px 40px' }}>
      <PageHeader
        title={t('boms', 'Bill of Materials')}
        subtitle={t('manageBoms', 'Manage Bills of Materials for your products')}
        action={
          <Btn variant="primary" onClick={openCreate}>{t('createBom', '+ Create BOM')}</Btn>
        }
      />

      {loading && <Spinner />}
      {error && <ErrorMsg msg={error} />}

      {!loading && (
        <Card padding="0">
          <Table columns={columns} data={boms || []} />
        </Card>
      )}

      {successMsg && <div style={{color:'var(--accent)',margin:'12px 0',fontWeight:600}}>{successMsg}</div>}
      
      {showModal && (
        <Modal title={t('createBom', 'Create BOM')} onClose={() => setShowModal(false)} size="lg">
          <div style={{ display: 'grid', gap: 16 }}>
            {formError && <ErrorMsg msg={formError} />}
            <Select label={t('product', 'Product')} value={form.product_id} onChange={e => setForm({...form, product_id: e.target.value})}>
              <option value="">{t('selectProduct', 'Select Product...')}</option>
              {(products || []).map(p => <option key={p.id} value={p.id}>{p.name} {p.sku ? `(${p.sku})` : ''}</option>)}
            </Select>
            <Input label={t('bomName', 'BOM Name')} value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder={t('bomNameExample', 'e.g. Standard Shirt BOM')} />
            <Input type="number" label={t('baseQuantity', 'Base Quantity')} value={form.base_quantity} onChange={e => setForm({...form, base_quantity: e.target.value})} />
            
            <div style={{ marginTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <strong>{t('materials', 'Materials')}</strong>
                <Btn size="sm" onClick={addMaterial}>{t('addMaterial', '+ Add Material')}</Btn>
              </div>
              
              {form.materials.map((m, idx) => (
                <div key={m.client_id} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-end' }}>
                  <div style={{ flex: 2 }}>
                    <Select value={m.material_id} onChange={e => updateMaterial(idx, 'material_id', e.target.value)}>
                      <option value="">{t('selectMaterial', 'Select Material...')}</option>
                      {(materials || []).filter(i => i.item_type === 'material').map(mat => (
                        <option key={mat.id} value={mat.item_id}>{mat.name}</option>
                      ))}
                    </Select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <Input type="number" placeholder="Qty" value={m.quantity} onChange={e => updateMaterial(idx, 'quantity', e.target.value)} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <Input type="number" placeholder="Scrap %" value={m.scrap_percentage} onChange={e => updateMaterial(idx, 'scrap_percentage', e.target.value)} />
                  </div>
                  <Btn variant="danger" onClick={() => removeMaterial(idx)}>X</Btn>
                </div>
              ))}
              {form.materials.length === 0 && <p style={{ fontSize: '13px', color: '#666' }}>{t('noMaterialsAdded', 'No materials added yet.')}</p>}
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <Btn onClick={() => setShowModal(false)}>{t('cancel', 'Cancel')}</Btn>
              <Btn variant="primary" onClick={handleSave} disabled={saving}>{saving ? <Spinner /> : t('save', 'Save')}</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
