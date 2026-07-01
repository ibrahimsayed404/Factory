import React, { useState } from 'react';
import { manufacturingApi, productApi } from '../api';
import { useFetch } from '../hooks/useFetch';
import { PageHeader, Card, Table, Btn, Modal, Input, Spinner, ErrorMsg, Select } from '../components/ui';
import { useLanguage } from '../context/LanguageContext';

const emptyForm = { product_id: '', name: '', steps: [] };

export default function Routings() {
  const { t } = useLanguage();
  const { data: routings, loading, error, refetch } = useFetch(manufacturingApi.routings);
  const { data: products } = useFetch(productApi.list);
  const { data: stages } = useFetch(manufacturingApi.stages);

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const openCreate = () => { setForm(emptyForm); setShowModal(true); };

  const addStep = () => {
    setForm({ 
      ...form, 
      steps: [...form.steps, { stage_id: '', sequence_order: form.steps.length + 1, standard_time_minutes: 60 }] 
    });
  };

  const removeStep = (idx) => {
    const newSteps = [...form.steps];
    newSteps.splice(idx, 1);
    // Re-adjust sequence_order
    newSteps.forEach((s, i) => s.sequence_order = i + 1);
    setForm({ ...form, steps: newSteps });
  };

  const updateStep = (idx, field, val) => {
    const newSteps = [...form.steps];
    newSteps[idx][field] = val;
    setForm({ ...form, steps: newSteps });
  };

  const validateForm = () => {
    if (!form.product_id) return t('productRequired', 'Product is required.');
    if (!form.name.trim()) return t('nameRequired', 'Routing name is required.');
    if (!form.steps.length) return t('stepsRequired', 'At least one step is required.');
    for (const s of form.steps) {
      if (!s.stage_id) return t('stageSelectionRequired', 'All stages must be selected.');
      if (s.standard_time_minutes <= 0) return t('timePositive', 'Time must be > 0.');
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
      await manufacturingApi.createRouting(form);
      setShowModal(false);
      setSuccessMsg(t('routingAdded', 'Routing created successfully!'));
      await refetch();
    } catch (e) {
      setFormError(e.message || t('failedSaveRouting', 'Failed to create Routing.'));
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: 'name', label: t('routingName', 'Routing Name') },
    { key: 'product_name', label: t('product', 'Product') },
    { key: 'created_at', label: t('created', 'Created Date'), render: v => new Date(v).toLocaleDateString() },
  ];

  return (
    <div style={{ padding: '28px 28px 40px' }}>
      <PageHeader
        title={t('routings', 'Production Routings')}
        subtitle={t('manageRoutings', 'Manage production steps for your products')}
        action={
          <Btn variant="primary" onClick={openCreate}>{t('createRouting', '+ Create Routing')}</Btn>
        }
      />

      {loading && <Spinner />}
      {error && <ErrorMsg msg={error} />}

      {!loading && (
        <Card padding="0">
          <Table columns={columns} data={routings || []} />
        </Card>
      )}

      {successMsg && <div style={{color:'var(--accent)',margin:'12px 0',fontWeight:600}}>{successMsg}</div>}
      
      {showModal && (
        <Modal title={t('createRouting', 'Create Routing')} onClose={() => setShowModal(false)} size="lg">
          <div style={{ display: 'grid', gap: 16 }}>
            {formError && <ErrorMsg msg={formError} />}
            <Select label={t('product', 'Product')} value={form.product_id} onChange={e => setForm({...form, product_id: e.target.value})}>
              <option value="">{t('selectProduct', 'Select Product...')}</option>
              {(products || []).map(p => <option key={p.id} value={p.id}>{p.name} {p.sku ? `(${p.sku})` : ''}</option>)}
            </Select>
            <Input label={t('routingName', 'Routing Name')} value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder={t('routingNameExample', 'e.g. Standard Shirt Routing')} />
            
            <div style={{ marginTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <strong>{t('steps', 'Routing Steps')}</strong>
                <Btn size="sm" onClick={addStep}>{t('addStep', '+ Add Step')}</Btn>
              </div>
              
              {form.steps.map((s, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-end' }}>
                  <div style={{ flex: 1 }}>
                    <Input type="number" label={t('sequence', 'Seq')} value={s.sequence_order} readOnly disabled />
                  </div>
                  <div style={{ flex: 3 }}>
                    <Select value={s.stage_id} onChange={e => updateStep(idx, 'stage_id', e.target.value)}>
                      <option value="">{t('selectStage', 'Select Stage...')}</option>
                      {(stages || []).map(st => (
                        <option key={st.id} value={st.id}>{st.name}</option>
                      ))}
                    </Select>
                  </div>
                  <div style={{ flex: 2 }}>
                    <Input type="number" placeholder="Mins" label={t('timeMins', 'Time (Mins)')} value={s.standard_time_minutes} onChange={e => updateStep(idx, 'standard_time_minutes', e.target.value)} />
                  </div>
                  <Btn variant="danger" onClick={() => removeStep(idx)}>X</Btn>
                </div>
              ))}
              {form.steps.length === 0 && <p style={{ fontSize: '13px', color: '#666' }}>{t('noStepsAdded', 'No steps added yet.')}</p>}
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
