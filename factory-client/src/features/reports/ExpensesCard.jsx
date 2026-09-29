import React, { useState } from 'react';
import { reportsApi } from './reports.api';
import { useFetch } from '../../hooks/useFetch';
import { Card, Btn, Modal, Input, Spinner, ErrorMsg } from '../../components/ui';

const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};
const money = (v) => `${Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })} ج.م`;
const addedAt = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const emptyForm = () => ({ expense_date: today(), amount: '', category: '', notes: '' });

const inputStyle = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  color: 'var(--text-primary)',
  padding: '8px 10px',
  fontSize: 13,
};
const th = { padding: '8px 10px', textAlign: 'start', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 700, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' };
const td = { padding: '8px 10px', fontSize: 13, borderBottom: '1px solid var(--border)', verticalAlign: 'top' };

/**
 * Extra expenses for the report period: add one, and see every entry with what
 * it was, how much, and who added it and when. Admins can fix or delete a
 * wrong entry (the old values are kept in the audit log).
 */
export default function ExpensesCard({ startDate, endDate, onChanged }) {
  const { data: expenses, loading, error, refetch } = useFetch(
    () => reportsApi.listSalesExpenses({ start_date: startDate, end_date: endDate }),
    [startDate, endDate]
  );
  const [form, setForm] = useState(emptyForm);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [deleting, setDeleting] = useState(null);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const rows = Array.isArray(expenses) ? expenses : [];
  const total = rows.reduce((sum, e) => sum + Number(e.amount || 0), 0);

  const afterChange = async () => {
    await refetch();
    if (onChanged) await onChanged();
  };

  const addExpense = async () => {
    setAdding(true);
    setAddError('');
    try {
      await reportsApi.addSalesExpense({ ...form, amount: Number(form.amount) });
      setForm({ ...emptyForm(), expense_date: form.expense_date });
      await afterChange();
    } catch (e) {
      setAddError(e.message);
    } finally {
      setAdding(false);
    }
  };

  const openEdit = (row) => {
    setEditing(row);
    setEditForm({ expense_date: row.expense_date, amount: String(row.amount), category: row.category || '', notes: row.notes || '' });
    setEditError('');
  };

  const saveEdit = async () => {
    setEditSaving(true);
    setEditError('');
    try {
      await reportsApi.updateSalesExpense(editing.id, { ...editForm, amount: Number(editForm.amount) });
      setEditing(null);
      await afterChange();
    } catch (e) {
      setEditError(e.message);
    } finally {
      setEditSaving(false);
    }
  };

  const confirmDelete = async () => {
    setDeleteSaving(true);
    setDeleteError('');
    try {
      await reportsApi.deleteSalesExpense(deleting.id);
      setDeleting(null);
      await afterChange();
    } catch (e) {
      setDeleteError(e.message);
    } finally {
      setDeleteSaving(false);
    }
  };

  return (
    <Card padding="0">
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 12 }}>💸 المصروفات الإضافية</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, alignItems: 'end' }}>
          <input type="date" aria-label="التاريخ" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} style={inputStyle} />
          <input type="number" min="0.01" placeholder="المبلغ (ج.م)" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} style={inputStyle} />
          <input type="text" placeholder="البند (مثال: شريط، إبر، مرتب...)" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={inputStyle} />
          <input type="text" placeholder="ملاحظات" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} style={inputStyle} />
          <Btn size="sm" variant="primary" onClick={addExpense} disabled={adding || !form.amount}>
            {adding ? 'جاري الحفظ…' : '+ إضافة مصروف'}
          </Btn>
        </div>
        {addError && <div style={{ marginTop: 10 }}><ErrorMsg msg={addError} /></div>}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', fontSize: 13 }}>
        <span style={{ color: 'var(--text-secondary)' }}>المصروفات من {startDate} إلى {endDate}</span>
        <span style={{ fontWeight: 800 }}>
          {rows.length} مصروف — الإجمالي: <span style={{ color: 'var(--danger)' }}>{money(total)}</span>
        </span>
      </div>

      {loading ? (
        <div style={{ padding: 20, textAlign: 'center' }}><Spinner /></div>
      ) : error ? (
        <div style={{ padding: 16 }}><ErrorMsg msg={error} /></div>
      ) : rows.length === 0 ? (
        <div style={{ padding: '16px', color: 'var(--text-muted)', fontSize: 13 }}>لا توجد مصروفات في هذه الفترة.</div>
      ) : (
        <div style={{ overflowX: 'auto', maxHeight: 420, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card)' }}>
              <tr>
                <th style={th}>التاريخ</th>
                <th style={th}>البند</th>
                <th style={{ ...th, textAlign: 'end' }}>المبلغ</th>
                <th style={th}>ملاحظات</th>
                <th style={th}>أضافه</th>
                <th style={th}>وقت الإضافة</th>
                <th style={th} />
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id}>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>{e.expense_date}</td>
                  <td style={{ ...td, fontWeight: 700 }}>{e.category || '—'}</td>
                  <td style={{ ...td, textAlign: 'end', whiteSpace: 'nowrap', fontWeight: 700, color: 'var(--danger)' }}>{money(e.amount)}</td>
                  <td style={{ ...td, color: 'var(--text-secondary)' }}>{e.notes || '—'}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>👤 {e.created_by_name || '—'}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: 12 }}>{addedAt(e.created_at)}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <Btn size="sm" variant="secondary" onClick={() => openEdit(e)}>تعديل</Btn>
                      <Btn size="sm" variant="danger" onClick={() => { setDeleting(e); setDeleteError(''); }}>حذف</Btn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <Modal title="تعديل مصروف" onClose={() => setEditing(null)} width={480}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Input label="التاريخ" type="date" value={editForm.expense_date} onChange={(e) => setEditForm({ ...editForm, expense_date: e.target.value })} />
              <Input label="المبلغ (ج.م)" type="number" min="0.01" value={editForm.amount} onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })} />
            </div>
            <Input label="البند" value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} />
            <Input label="ملاحظات" value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              أضافه {editing.created_by_name || '—'} في {addedAt(editing.created_at)}. القيم القديمة بتتحفظ في سجل التعديلات.
            </div>
            {editError && <ErrorMsg msg={editError} />}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Btn onClick={() => setEditing(null)} disabled={editSaving}>إلغاء</Btn>
              <Btn variant="primary" onClick={saveEdit} disabled={editSaving || !editForm.amount}>
                {editSaving ? 'جاري الحفظ…' : 'حفظ التعديل'}
              </Btn>
            </div>
          </div>
        </Modal>
      )}

      {deleting && (
        <Modal title="حذف مصروف" onClose={() => setDeleting(null)} width={420}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 14 }}>
              هتحذف مصروف <strong>{deleting.category || '—'}</strong> بمبلغ <strong style={{ color: 'var(--danger)' }}>{money(deleting.amount)}</strong> بتاريخ {deleting.expense_date}؟
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>المصروف المحذوف بيتحفظ في سجل التعديلات.</div>
            {deleteError && <ErrorMsg msg={deleteError} />}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Btn onClick={() => setDeleting(null)} disabled={deleteSaving}>إلغاء</Btn>
              <Btn variant="danger" onClick={confirmDelete} disabled={deleteSaving}>
                {deleteSaving ? 'جاري الحذف…' : 'حذف'}
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </Card>
  );
}
