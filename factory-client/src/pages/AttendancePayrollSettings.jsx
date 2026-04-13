import React, { useEffect, useState } from 'react';
import { settingsApi } from '../api';
import { Btn, Card, ErrorMsg, Input, PageHeader, Spinner } from '../components/ui';
import { useLanguage } from '../context/LanguageContext';

const emptyForm = {
  attendance_late_grace_minutes: '10',
  payroll_overtime_multiplier: '1.5',
  payroll_vacation_overtime_multiplier: '1',
  payroll_weeks_per_month: '4',
};

export default function AttendancePayrollSettings() {
  const { t } = useLanguage();
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    settingsApi.getAttendancePayrollPolicy()
      .then((data) => {
        setForm({
          attendance_late_grace_minutes: String(data.attendanceLateGraceMinutes ?? 10),
          payroll_overtime_multiplier: String(data.payrollOvertimeMultiplier ?? 1.5),
          payroll_vacation_overtime_multiplier: String(data.payrollVacationOvertimeMultiplier ?? 1),
          payroll_weeks_per_month: String(data.payrollWeeksPerMonth ?? 4),
        });
      })
      .catch((e) => setError(e.message || t('failedLoadSettings', 'Failed to load settings')))
      .finally(() => setLoading(false));
  }, []);

  const setField = (key) => (e) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
    if (error) setError('');
    if (success) setSuccess('');
  };

  const validate = () => {
    const grace = Number(form.attendance_late_grace_minutes);
    const overtime = Number(form.payroll_overtime_multiplier);
    const vacation = Number(form.payroll_vacation_overtime_multiplier);
    const weeks = Number(form.payroll_weeks_per_month);

    if (!Number.isFinite(grace) || grace < 0 || grace > 180) return t('lateGraceRange', 'Late grace minutes must be between 0 and 180.');
    if (!Number.isFinite(overtime) || overtime < 1 || overtime > 5) return t('overtimeRange', 'Overtime multiplier must be between 1 and 5.');
    if (!Number.isFinite(vacation) || vacation < 0 || vacation > 5) return t('vacationRange', 'Vacation multiplier must be between 0 and 5.');
    if (!Number.isFinite(weeks) || weeks < 1 || weeks > 6) return t('weeksRange', 'Weeks per month must be between 1 and 6.');

    return '';
  };

  const handleSave = async () => {
    setError('');
    setSuccess('');
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    try {
      await settingsApi.updateAttendancePayrollPolicy({
        attendance_late_grace_minutes: Number(form.attendance_late_grace_minutes),
        payroll_overtime_multiplier: Number(form.payroll_overtime_multiplier),
        payroll_vacation_overtime_multiplier: Number(form.payroll_vacation_overtime_multiplier),
        payroll_weeks_per_month: Number(form.payroll_weeks_per_month),
      });
      setSuccess(t('settingsSaved', 'Settings saved successfully. New values apply immediately.'));
    } catch (e) {
      setError(e.message || t('failedSaveSettings', 'Failed to save settings'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: '28px 28px 40px' }}>
      <PageHeader
        title={t('attendancePayrollPolicy', 'Attendance & Payroll Policy')}
        subtitle={t('configurePolicy', 'Configure grace period, multipliers, and weekly payment estimate')}
      />

      {loading && <Spinner />}

      {!loading && (
        <Card style={{ maxWidth: 640 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input
              label={t('lateGraceMinutes', 'Late Grace Minutes')}
              type="number"
              min="0"
              max="180"
              value={form.attendance_late_grace_minutes}
              onChange={setField('attendance_late_grace_minutes')}
            />
            <Input
              label={t('regularOvertimeMultiplier', 'Regular Overtime Multiplier')}
              type="number"
              min="1"
              max="5"
              step="0.1"
              value={form.payroll_overtime_multiplier}
              onChange={setField('payroll_overtime_multiplier')}
            />
            <Input
              label={t('vacationWeekendMultiplier', 'Vacation/Weekend Multiplier')}
              type="number"
              min="0"
              max="5"
              step="0.1"
              value={form.payroll_vacation_overtime_multiplier}
              onChange={setField('payroll_vacation_overtime_multiplier')}
            />
            <Input
              label={t('weeksPerMonth', 'Weeks Per Month')}
              type="number"
              min="1"
              max="6"
              step="0.1"
              value={form.payroll_weeks_per_month}
              onChange={setField('payroll_weeks_per_month')}
            />
          </div>

          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
            <Btn variant="primary" onClick={handleSave} disabled={saving}>
              {saving ? t('saving', 'Saving…') : t('savePolicy', 'Save Policy')}
            </Btn>
          </div>

          {error && <div style={{ marginTop: 12 }}><ErrorMsg msg={error} /></div>}
          {success && <div style={{ marginTop: 12, color: 'var(--accent)', fontSize: 13 }}>{success}</div>}
        </Card>
      )}
    </div>
  );
}
