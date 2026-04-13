import React, { useState } from 'react';
import { employeeApi } from '../api';
import { useFetch } from '../hooks/useFetch';
import { PageHeader, Card, Table, Badge, Btn, Modal, Input, Select, Spinner, ErrorMsg } from '../components/ui';

const SHIFT_DEFAULTS = {
  morning: { start: '09:00', end: '17:00' },
  evening: { start: '14:00', end: '22:00' },
  night: { start: '22:00', end: '06:00' },
};

const WEEK_DAYS = [
  { index: 0, label: 'Sun' },
  { index: 1, label: 'Mon' },
  { index: 2, label: 'Tue' },
  { index: 3, label: 'Wed' },
  { index: 4, label: 'Thu' },
  { index: 5, label: 'Fri' },
  { index: 6, label: 'Sat' },
];

const WEEK_DAY_LABELS = WEEK_DAYS.reduce((acc, day) => {
  acc[day.index] = day.label;
  return acc;
}, {});

const parseWeekendDays = (value) =>
  String(value || '0,6')
    .split(',')
    .map((v) => Number(String(v).trim()))
    .filter((v) => Number.isInteger(v) && v >= 0 && v <= 6);

const serializeWeekendDays = (days) =>
  [...new Set(days)]
    .sort((a, b) => a - b)
    .join(',');

const WeekendChips = ({ value }) => {
  const days = parseWeekendDays(value);
  if (!days.length) {
    return <span style={{ color: 'var(--text-muted)' }}>None</span>;
  }

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {days.map((d) => (
        <span
          key={d}
          style={{
            border: '1px solid var(--danger)',
            background: 'var(--danger-dim)',
            color: 'var(--danger)',
            borderRadius: 999,
            padding: '2px 8px',
            fontSize: 11,
            fontWeight: 600,
            lineHeight: 1.5,
          }}
        >
          {WEEK_DAY_LABELS[d]}
        </span>
      ))}
    </div>
  );
};

const emptyForm = {
  name: '', email: '', phone: '', department_id: '', role: '', shift: 'morning',
  shift_start: '09:00', shift_end: '17:00', device_user_id: '', weekend_days: '0,6', salary: '', hire_date: '', status: 'active',
};

export default function Employees() {
  const { data: employees, loading, error, refetch } = useFetch(employeeApi.list);
  const { data: departments } = useFetch(employeeApi.departments);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const openCreate = () => { setForm(emptyForm); setEditing(null); setShowModal(true); };
  const openEdit = (emp) => {
    setForm({
      ...emp,
      hire_date: emp.hire_date?.split('T')[0] || '',
      shift_start: emp.shift_start ? String(emp.shift_start).slice(0, 5) : (SHIFT_DEFAULTS[emp.shift]?.start || ''),
      shift_end: emp.shift_end ? String(emp.shift_end).slice(0, 5) : (SHIFT_DEFAULTS[emp.shift]?.end || ''),
      weekend_days: emp.weekend_days || '0,6',
    });
    setEditing(emp.id);
    setShowModal(true);
  };

  const validateForm = () => {
    if (!form.name.trim()) return 'Name is required.';
    if (!form.department_id) return 'Department is required.';
    if (!form.shift) return 'Shift is required.';
    if (!form.shift_start) return 'Shift start is required.';
    if (!form.shift_end) return 'Shift end is required.';
    if (form.salary !== '' && (isNaN(Number(form.salary)) || Number(form.salary) < 0)) return 'Salary must be a non-negative number.';
    return '';
  };

  const handleSave = async () => {
    setFormError('');
    const err = validateForm();
    if (err) {
      setFormError(err);
      return;
    }
    setSaving(true);
    // Convert empty numeric fields to null
    const cleanForm = {
      ...form,
      salary: form.salary === '' ? null : Number(form.salary),
      device_user_id: form.device_user_id === '' ? null : Number(form.device_user_id),
    };
    try {
      if (editing) await employeeApi.update(editing, cleanForm);
      else await employeeApi.create(cleanForm);
      setShowModal(false);
      setForm(emptyForm);
      await refetch();
    } catch (err) {
      let msg = err?.message || 'Failed to save employee.';
      if (err?.response?.data?.error) msg = err.response.data.error;
      setFormError(msg);
    } finally {
      setSaving(false);
    }
  };

  const [deletingId, setDeletingId] = useState(null);
  const handleDelete = async (id) => {
    if (!window.confirm('Remove this employee?')) return;
    setDeletingId(id);
    try {
      await employeeApi.delete(id);
      refetch();
    } finally {
      setDeletingId(null);
    }
  };

  const f = v => e => setForm({ ...form, [v]: e.target.value });

  const selectedWeekendDays = parseWeekendDays(form.weekend_days);
  const toggleWeekendDay = (dayIndex) => {
    const next = selectedWeekendDays.includes(dayIndex)
      ? selectedWeekendDays.filter((d) => d !== dayIndex)
      : [...selectedWeekendDays, dayIndex];
    setForm({ ...form, weekend_days: serializeWeekendDays(next) });
  };

  const columns = [
    { key: 'name', label: 'Name', render: (v) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: 'var(--accent-dim)', color: 'var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 600, flexShrink: 0,
        }}>{v?.[0]?.toUpperCase()}</div>
        <span>{v}</span>
      </div>
    )},
    { key: 'department_name', label: 'Department', render: v => v || '—' },
    { key: 'device_user_id', label: 'Device ID', render: v => v || '—' },
    { key: 'role', label: 'Role', render: v => v || '—' },
    { key: 'shift', label: 'Shift', render: (v, row) => {
      const label = v ? v.charAt(0).toUpperCase() + v.slice(1) : '—';
      const start = row.shift_start ? String(row.shift_start).slice(0, 5) : '—';
      const end = row.shift_end ? String(row.shift_end).slice(0, 5) : '—';
      return `${label} (${start}-${end})`;
    } },
    { key: 'weekend_days', label: 'Weekend', render: v => <WeekendChips value={v} /> },
    { key: 'salary', label: 'Salary', render: v => v ? `$${Number(v).toLocaleString()}` : '—' },
    { key: 'status', label: 'Status', render: v => <Badge variant={v === 'active' ? 'success' : 'default'}>{v}</Badge> },
    { key: 'actions', label: '', render: (_, row) => (
      <div style={{ display: 'flex', gap: 6 }}>
        <Btn size="sm" onClick={e => { e.stopPropagation(); openEdit(row); }} disabled={deletingId === row.id}>Edit</Btn>
        <Btn size="sm" variant="danger" onClick={e => { e.stopPropagation(); handleDelete(row.id); }} disabled={deletingId === row.id} aria-busy={deletingId === row.id}>
          {deletingId === row.id ? <Spinner /> : 'Del'}
        </Btn>
      </div>
    )},
  ];

  return (
    <div style={{ padding: '28px 28px 40px' }}>
      <PageHeader title="Employees" subtitle="Manage your factory workforce"
        action={<Btn variant="primary" onClick={openCreate}>+ Add employee</Btn>}
      />
      {loading && <Spinner />}
      {error && <ErrorMsg msg={error} />}
      {!loading && <Card padding="0"><Table columns={columns} data={employees || []} /></Card>}

      {showModal && (
        <Modal title={editing ? 'Edit employee' : 'Add employee'} onClose={() => setShowModal(false)} width={520}>
          {formError && (
            <div style={{ color: 'var(--danger)', marginBottom: 12, fontWeight: 600, gridColumn: '1/-1' }}>
              {formError}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: '1/-1' }}><Input label="Full name" value={form.name} onChange={f('name')} /></div>
            <Input label="Email" type="email" value={form.email} onChange={f('email')} />
            <Input label="Phone" value={form.phone} onChange={f('phone')} />
            <Select label="Department" value={form.department_id} onChange={f('department_id')}>
              <option value="">Select department</option>
              {departments?.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
            <Input label="Role / Position" value={form.role} onChange={f('role')} />
            <Input label="Device user ID" value={form.device_user_id || ''} onChange={f('device_user_id')} />
            <Select label="Shift" value={form.shift} onChange={e => {
              const nextShift = e.target.value;
              const defaults = SHIFT_DEFAULTS[nextShift] || { start: '', end: '' };
              setForm({
                ...form,
                shift: nextShift,
                shift_start: form.shift_start || defaults.start,
                shift_end: form.shift_end || defaults.end,
              });
            }}>
              <option value="morning">Morning</option>
              <option value="evening">Evening</option>
              <option value="night">Night</option>
            </Select>
            <Input label="Shift start" type="time" value={form.shift_start} onChange={f('shift_start')} />
            <Input label="Shift end" type="time" value={form.shift_end} onChange={f('shift_end')} />
            <div style={{ gridColumn: '1/-1' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
                Weekend days
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 8 }}>
                {WEEK_DAYS.map((day) => {
                  const active = selectedWeekendDays.includes(day.index);
                  return (
                    <label
                      key={day.index}
                      style={{
                        border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                        background: active ? 'var(--accent-dim)' : 'var(--bg-soft)',
                        color: active ? 'var(--accent)' : 'var(--text-secondary)',
                        borderRadius: 8,
                        minHeight: 34,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        cursor: 'pointer',
                        userSelect: 'none',
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => toggleWeekendDay(day.index)}
                        style={{ margin: 0 }}
                      />
                      {day.label}
                    </label>
                  );
                })}
              </div>
            </div>
            <Select label="Status" value={form.status} onChange={f('status')}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
            <Input label="Salary ($)" type="number" value={form.salary} onChange={f('salary')} />
            <Input label="Hire date" type="date" value={form.hire_date} onChange={f('hire_date')} />
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
