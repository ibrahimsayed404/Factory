import React, { useState } from 'react';
import { printShopApi } from './printShops.api';
import { useFetch } from '../../hooks/useFetch';
import { PageHeader, Card, Btn, Spinner, ErrorMsg, Modal, Input } from '../../components/ui';

export default function PrintShops() {
  const { data: shops, loading, refetch } = useFetch(printShopApi.list);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingShop, setEditingShop] = useState(null);
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');

  const openCreateModal = () => {
    setEditingShop(null);
    setName('');
    setContactPerson('');
    setPhone('');
    setAddress('');
    setNotes('');
    setError('');
    setModalOpen(true);
  };

  const openEditModal = (shop) => {
    setEditingShop(shop);
    setName(shop.name || '');
    setContactPerson(shop.contact_person || '');
    setPhone(shop.phone || '');
    setAddress(shop.address || '');
    setNotes(shop.notes || '');
    setError('');
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('اسم المطبعة مطلوب');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const payload = {
        name: name.trim(),
        contact_person: contactPerson.trim(),
        phone: phone.trim(),
        address: address.trim(),
        notes: notes.trim(),
      };

      if (editingShop) {
        await printShopApi.update(editingShop.id, payload);
      } else {
        await printShopApi.create(payload);
      }

      setModalOpen(false);
      await refetch();
    } catch (err) {
      setError(err.message || 'حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`هل أنت متأكد من حذف المطبعة "${name}"؟`)) return;
    setActionError('');
    try {
      await printShopApi.delete(id);
      await refetch();
    } catch (err) {
      setActionError(err.message || 'فشل حذف المطبعة');
    }
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1200, margin: '0 auto' }}>
      <PageHeader
        title="دليل المطابع والورش"
        subtitle="إدارة وتسجيل المطابع وورش الطباعة المتعاقد معها المصنع"
        action={
          <Btn variant="primary" onClick={openCreateModal} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>+</span> إضافة مطبعة جديدة
          </Btn>
        }
      />

      {actionError && <ErrorMsg error={actionError} onDismiss={() => setActionError('')} style={{ marginBottom: 16 }} />}

      <Card style={{ padding: 24 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spinner /></div>
        ) : (shops || []).length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
            لا توجد مطابع مسجلة حتى الآن. اضغط على &quot;إضافة مطبعة جديدة&quot; للبدء.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
              <thead>
                <tr style={{ background: 'var(--bg-hover)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '12px 16px' }}>اسم المطبعة / الورشة</th>
                  <th style={{ padding: '12px 16px' }}>المسؤول</th>
                  <th style={{ padding: '12px 16px' }}>رقم الهاتف</th>
                  <th style={{ padding: '12px 16px' }}>العنوان</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>أوردرات قيد الطباعة</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>إجمالي التشغيلات</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {(shops || []).map(shop => (
                  <tr key={shop.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '14px 16px', fontWeight: 700, fontSize: 15 }}>
                      {shop.name}
                    </td>
                    <td style={{ padding: '14px 16px', color: 'var(--text-muted)' }}>
                      {shop.contact_person || '—'}
                    </td>
                    <td style={{ padding: '14px 16px', direction: 'ltr', textAlign: 'right' }}>
                      {shop.phone ? (
                        <a href={`tel:${shop.phone}`} style={{ color: 'var(--accent, #38bdf8)', textDecoration: 'none' }}>
                          {shop.phone}
                        </a>
                      ) : '—'}
                    </td>
                    <td style={{ padding: '14px 16px', color: 'var(--text-muted)', fontSize: 13 }}>
                      {shop.address || '—'}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      {Number(shop.active_printing_orders) > 0 ? (
                        <span style={{
                          background: 'rgba(217, 119, 6, 0.15)',
                          color: '#f59e0b',
                          padding: '4px 10px',
                          borderRadius: 20,
                          fontWeight: 700,
                          fontSize: 12,
                        }}>
                          {shop.active_printing_orders} أوردر ({Number(shop.active_printing_pieces).toLocaleString()} ق)
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>0</span>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 600 }}>
                      {shop.total_orders_handled || 0}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                        <Btn variant="secondary" size="sm" onClick={() => openEditModal(shop)}>
                          ✏️ تعديل
                        </Btn>
                        <Btn variant="danger" size="sm" onClick={() => handleDelete(shop.id, shop.name)}>
                          🗑️
                        </Btn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal Create/Edit */}
      {modalOpen && (
        <Modal
          title={editingShop ? `تعديل بيانات ${editingShop.name}` : 'إضافة مطبعة / ورشة جديدة'}
          onClose={() => { setModalOpen(false); setError(''); }}
          zIndex={120}
        >
          <div style={{ padding: 8 }}>
            {error && <ErrorMsg error={error} onDismiss={() => setError('')} style={{ marginBottom: 16 }} />}

            <div style={{ display: 'grid', gap: 14 }}>
              <Input
                label="اسم المطبعة / الورشة *"
                placeholder="مثال: مطبعة النور سلك سكرين"
                value={name}
                onChange={e => setName(e.target.value)}
              />
              <Input
                label="اسم المسؤول / المندوب"
                placeholder="مثال: أستاذ حسام"
                value={contactPerson}
                onChange={e => setContactPerson(e.target.value)}
              />
              <Input
                label="رقم الهاتف"
                placeholder="مثال: 01012345678"
                value={phone}
                onChange={e => setPhone(e.target.value)}
              />
              <Input
                label="العنوان"
                placeholder="مثال: شبرا الخيمة - شارع 15"
                value={address}
                onChange={e => setAddress(e.target.value)}
              />
              <Input
                label="ملاحظات"
                placeholder="مثال: متخصصة في طباعة الديسك والتطريز"
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
              <Btn variant="secondary" onClick={() => { setModalOpen(false); setError(''); }}>
                إلغاء
              </Btn>
              <Btn variant="primary" onClick={handleSave} disabled={saving}>
                {saving ? <Spinner size="sm" /> : (editingShop ? 'حفظ التعديلات' : 'إضافة المطبعة')}
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
