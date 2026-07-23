import React, { useState, useEffect, useMemo } from 'react';
import { employeeApi } from '../api';
import { useLanguage } from '../context/LanguageContext';
import { useFetch } from '../hooks/useFetch';
import {
  PageHeader, Card, Table, Badge, Btn,
  Modal, Input, Select, Spinner, MetricCard, SearchInput
} from '../components/ui';

const STATUS_OPTS = ['present', 'absent', 'late', 'half-day'];

const statusVariant = s => ({
  present: 'success', late: 'warning', absent: 'danger', 'half-day': 'info'
}[s] || 'default');

const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

/**
 * Returns { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' } for the current
 * Sat→Thu work-week that contains "today".
 * Week starts Saturday (day 6) and ends Thursday (day 4).
 */
const getCurrentWeekRange = () => {
  const now = new Date();
  const day = now.getDay(); // 0=Sun … 6=Sat

  // How many days since the most recent Saturday?
  // Sat=0, Sun=1, Mon=2, Tue=3, Wed=4, Thu=5, Fri=6
  const daysSinceSat = (day + 1) % 7; // shift so Sat=0

  const saturday = new Date(now);
  saturday.setDate(now.getDate() - daysSinceSat);

  const thursday = new Date(saturday);
  thursday.setDate(saturday.getDate() + 5); // Sat + 5 = Thu

  const fmt = d =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  return { start: fmt(saturday), end: fmt(thursday) };
};
const monthName = m => ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m - 1];
const weekDayName = i => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][i];
const SHIFT_SCHEDULES = {
  morning: { start: '09:00', end: '17:00' },
  evening: { start: '14:00', end: '22:00' },
  night: { start: '22:00', end: '06:00' },
};

const parseDateParts = (value) => {
  const match = String(value || '').slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
};

const dayOfWeekFromDate = (value) => {
  const parts = parseDateParts(value);
  if (!parts) return null;
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
};

const formatAttendanceDate = (value) => {
  const parts = parseDateParts(value);
  if (!parts) return value || '—';
  return `${weekDayName(dayOfWeekFromDate(value))}, ${monthName(parts.month)} ${parts.day}`;
};

const formatTime = (value) => {
  if (!value || value === '—') return '—';
  const match = String(value).trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return String(value);
  let h = parseInt(match[1], 10);
  const m = match[2];
  if (Number.isNaN(h)) return String(value);
  const period = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${period}`;
};

const toMinutes = (value) => {
  if (!value) return null;
  const match = String(value).trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (Number.isNaN(h) || Number.isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return (h * 60) + m;
};

const WEEKEND_PRESENT_NOTE = 'present vacation';

const calculateWorkedMinutes = (checkIn, checkOut) => {
  const inMin = toMinutes(checkIn);
  const outMin = toMinutes(checkOut);
  if (inMin === null || outMin === null) return null;

  let end = outMin;
  if (end < inMin) end += 24 * 60;
  return Math.max(0, end - inMin);
};

const computeWorkedHours = (checkIn, checkOut) => {
  if (!checkIn || !checkOut) return '';
  const [inH, inM] = checkIn.split(':').map(Number);
  const [outH, outM] = checkOut.split(':').map(Number);
  if ([inH, inM, outH, outM].some(Number.isNaN)) return '';

  const start = (inH * 60) + inM;
  let end = (outH * 60) + outM;
  if (end < start) end += 24 * 60;

  const hours = (end - start) / 60;
  return Math.max(0, Number(hours.toFixed(2))).toString();
};

const computeShiftMetrics = (employee, checkIn, checkOut) => {
  const schedule = SHIFT_SCHEDULES[employee?.shift] || SHIFT_SCHEDULES.morning;
  const shiftStart = toMinutes(employee?.shift_start || schedule.start);
  const shiftEnd = toMinutes(employee?.shift_end || schedule.end);
  const inMin = toMinutes(checkIn);
  const outMin = toMinutes(checkOut);

  if (shiftStart === null || shiftEnd === null || inMin === null || outMin === null) {
    return { late_minutes: 0, early_leave_minutes: 0, overtime_minutes: 0 };
  }

  const overnightShift = shiftEnd <= shiftStart;
  let normalizedShiftEnd = shiftEnd;
  let normalizedIn = inMin;
  let normalizedOut = outMin;

  if (overnightShift) {
    normalizedShiftEnd += 24 * 60;
    if (normalizedIn < shiftStart) normalizedIn += 24 * 60;
    if (normalizedOut < shiftStart) normalizedOut += 24 * 60;
  } else {
    if (normalizedOut < normalizedIn) normalizedOut += 24 * 60;
  }

  if (normalizedOut < normalizedIn) normalizedOut += 24 * 60;

  return {
    late_minutes: Math.max(0, normalizedIn - shiftStart),
    early_leave_minutes: Math.max(0, normalizedShiftEnd - normalizedOut),
    overtime_minutes: Math.max(0, normalizedOut - normalizedShiftEnd),
  };
};

const toDateKey = (value) => String(value || '').split('T')[0];

const weekendSetFrom = (weekendDays) => {
  const raw = String(weekendDays || '5');
  return new Set(
    raw
      .split(',')
      .map((x) => Number(String(x).trim()))
      .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
  );
};

const isWeekendDate = (employee, dateValue) => {
  if (!employee || !dateValue) return false;
  const dayOfWeek = dayOfWeekFromDate(dateValue);
  if (dayOfWeek === null) return false;
  return weekendSetFrom(employee.weekend_days).has(dayOfWeek);
};

const augmentWithInferredAbsences = (records, weekendDays) => {
  if (!records?.length) return [];

  const normalized = [...records]
    .map((r) => {
      const date = toDateKey(r.date);
      const weekend = weekendSetFrom(weekendDays).has(dayOfWeekFromDate(date));
      return {
        ...r,
        date,
        notes: !weekend && String(r.notes || '').trim().toLowerCase() === WEEKEND_PRESENT_NOTE
          ? ''
          : r.notes,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  const weekendSet = weekendSetFrom(weekendDays);
  const startParts = parseDateParts(normalized[0].date);
  const endParts = parseDateParts(normalized[normalized.length - 1].date);
  const start = new Date(Date.UTC(startParts.year, startParts.month - 1, startParts.day));
  const end = new Date(Date.UTC(endParts.year, endParts.month - 1, endParts.day));

  const byDate = new Map(normalized.map((r) => [r.date, r]));
  const merged = [];

  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    const existing = byDate.get(key);
    if (existing) {
      merged.push(existing);
      continue;
    }

    if (weekendSet.has(d.getUTCDay())) continue;

    merged.push({
      id: `inferred-${key}`,
      date: key,
      status: 'absent',
      check_in: null,
      check_out: null,
      hours_worked: 0,
      late_minutes: 0,
      early_leave_minutes: 0,
      overtime_minutes: 0,
      notes: 'Inferred absence (missing attendance log)',
      inferred_absence: true,
    });
  }

  return merged;
};

/* ── Small calendar heatmap ─────────────────────────────── */
const HeatMap = ({ records, year, month }) => {
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay    = new Date(year, month - 1, 1).getDay(); // 0=Sun

  const byDay = {};
  records.forEach(r => {
    const parts = parseDateParts(r.date);
    if (parts) byDay[parts.day] = r.status;
  });

  const color = s => ({
    present:   '#22d3a0',
    late:      '#f5a623',
    absent:    '#f05252',
    'half-day':'#60a5fa',
  }[s] || 'var(--bg-hover)');

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(<div key={`e${i}`} />);
  for (let d = 1; d <= daysInMonth; d++) {
    const s = byDay[d];
    cells.push(
      <div key={d} title={s ? `${d}: ${s}` : `${d}: no record`}
        style={{
          width: 26, height: 26, borderRadius: 5,
          background: color(s),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, color: s ? '#0a1a14' : 'var(--text-muted)',
          fontWeight: 500, cursor: 'default',
          border: '1px solid rgba(255,255,255,0.04)',
        }}>
        {d}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,26px)', gap: 4, marginBottom: 8 }}>
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
          <div key={d} style={{ fontSize: 9, color: 'var(--text-muted)', textAlign: 'center', fontWeight: 600 }}>{d}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,26px)', gap: 4 }}>
        {cells}
      </div>
      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
        {[['present','#22d3a0'],['late','#f5a623'],['absent','#f05252'],['half-day','#60a5fa']].map(([label, c]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-secondary)' }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: c }} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
};

/* ── Main page ─────────────────────────────────────────── */
export default function Attendance() {
  const { t } = useLanguage();
  const now = new Date();
  const [month, setMonth]  = useState(now.getMonth() + 1);
  const [year,  setYear]   = useState(now.getFullYear());
  const [startDate, setStartDate] = useState(`${year}-${String(now.getMonth() + 1).padStart(2, '0')}-01`);
  const [endDate, setEndDate] = useState(`${year}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(new Date(year, now.getMonth() + 1, 0).getDate()).padStart(2, '0')}`);
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [empRecords, setEmpRecords]   = useState([]);
  const [empLoading, setEmpLoading]   = useState(false);

  // Week / Month toggle for employee detail view (default: week)
  const [viewMode, setViewMode] = useState('week'); // 'week' | 'month'

  // Filter employee records based on viewMode
  const filteredEmpRecords = useMemo(() => {
    if (viewMode === 'month') return empRecords;
    const { start, end } = getCurrentWeekRange();
    return empRecords.filter(r => {
      const d = toDateKey(r.date);
      return d >= start && d <= end;
    });
  }, [empRecords, viewMode]);

  // Log modal
  const [showLog, setShowLog] = useState(false);
  const [logForm, setLogForm] = useState({
    employee_id: '', date: today(),
    check_in: '08:00', check_out: '17:00',
    hours_worked: '8',
    late_minutes: 0,
    early_leave_minutes: 0,
    overtime_minutes: 0,
    status: 'present', notes: '',
  });
  const [saving, setSaving]   = useState(false);
  const [saveError, setSaveError] = useState('');

  const { data: employees, loading: empListLoading } = useFetch(employeeApi.list);

  useEffect(() => {
    const isAbsent = logForm.status === 'absent';
    const calculated = isAbsent ? '' : computeWorkedHours(logForm.check_in, logForm.check_out);
    const employee = employees?.find((e) => String(e.id) === String(logForm.employee_id));
    const weekendAttendance = !isAbsent && isWeekendDate(employee, logForm.date) && Boolean(logForm.check_in || logForm.check_out);
    const workedMinutes = isAbsent ? 0 : calculateWorkedMinutes(logForm.check_in, logForm.check_out);
    const metrics = isAbsent
      ? { late_minutes: 0, early_leave_minutes: 0, overtime_minutes: 0 }
      : (weekendAttendance
          ? { late_minutes: 0, early_leave_minutes: 0, overtime_minutes: workedMinutes || 0 }
          : computeShiftMetrics(employee, logForm.check_in, logForm.check_out));
    setLogForm((prev) => {
      const autoStatus = weekendAttendance
        ? 'present'
        : (prev.status === 'present' || prev.status === 'late'
          ? (metrics.late_minutes > 0 ? 'late' : 'present')
          : prev.status);
      
      const next = {
        ...prev,
        check_in: isAbsent ? '' : prev.check_in,
        check_out: isAbsent ? '' : prev.check_out,
        hours_worked: calculated,
        late_minutes: metrics.late_minutes,
        early_leave_minutes: metrics.early_leave_minutes,
        overtime_minutes: metrics.overtime_minutes,
        status: autoStatus,
        notes: weekendAttendance
          ? WEEKEND_PRESENT_NOTE
          : (prev.notes === WEEKEND_PRESENT_NOTE ? '' : prev.notes),
      };
      if (
        prev.check_in === next.check_in
        && prev.check_out === next.check_out
        && prev.hours_worked === next.hours_worked
        && prev.late_minutes === next.late_minutes
        && prev.early_leave_minutes === next.early_leave_minutes
        && prev.overtime_minutes === next.overtime_minutes
        && prev.status === next.status
        && prev.notes === next.notes
      ) {
        return prev;
      }
      return next;
    });
  }, [logForm.check_in, logForm.check_out, logForm.employee_id, logForm.date, logForm.status, employees]);

  // Summary: load attendance for ALL employees for the month
  const [summary, setSummary] = useState([]);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const loadSummary = async () => {
    if (!employees?.length) return;
    setSummaryLoading(true);
    try {
      const results = await Promise.all(
        employees.map(e =>
          employeeApi.attendance(e.id, `?month=${month}&year=${year}`)
            .then(records => ({ emp: e, records: augmentWithInferredAbsences(records, e.weekend_days) }))
            .catch(() => ({ emp: e, records: [] }))
        )
      );
      setSummary(results);
    } finally { setSummaryLoading(false); }
  };

  useEffect(() => { if (employees) loadSummary(); }, [employees, month, year]);

  // Load single employee detail
  const selectEmployee = async (emp) => {
    setSelectedEmp(emp);
    setViewMode('week'); // default to week view
    setEmpLoading(true);
    try {
      const records = await employeeApi.attendance(emp.id, `?month=${month}&year=${year}`);
      setEmpRecords(augmentWithInferredAbsences(records, emp.weekend_days));
    } finally { setEmpLoading(false); }
  };

  const handleLog = async () => {
    setSaving(true); setSaveError('');
    try {
      await employeeApi.logAttendance(logForm.employee_id, logForm);
      setShowLog(false);
      loadSummary();
      if (selectedEmp && selectedEmp.id === parseInt(logForm.employee_id)) {
        selectEmployee(selectedEmp);
      }
    } catch (e) {
      setSaveError(e.message);
    } finally { setSaving(false); }
  };

  // Aggregate metrics from summary
  const totalPresent  = summary.reduce((a, s) => a + s.records.filter(r => r.status === 'present').length, 0);
  const totalAbsent   = summary.reduce((a, s) => a + s.records.filter(r => r.status === 'absent').length, 0);
  const totalLate     = summary.reduce((a, s) => a + s.records.filter(r => r.status === 'late').length, 0);
  const totalHours    = summary.reduce((a, s) => a + s.records.reduce((b, r) => b + parseFloat(r.hours_worked || 0), 0), 0);

  // Search functionality
  const [searchTerm, setSearchTerm] = useState('');

  // Summary table columns
  const summaryTableData = useMemo(() => {
    const data = summary.map(s => {
      // Filter records by date range if applicable
      let filteredRecords = s.records;
      if (startDate && endDate) {
        filteredRecords = s.records.filter(r => {
          return r.date >= startDate && r.date <= endDate;
        });
      }

      const presentCount = filteredRecords.filter(r => r.status === 'present').length;
      const lateCount = filteredRecords.filter(r => r.status === 'late').length;
      const absentCount = filteredRecords.filter(r => r.status === 'absent').length;
      const totalHrs = parseFloat(filteredRecords.reduce((a, r) => a + parseFloat(r.hours_worked || 0), 0).toFixed(1));
      const total = filteredRecords.length;
      const rate = total > 0 ? Math.round(((presentCount + lateCount) / total) * 100) : 0;
      return {
        id: s.emp.id,
        emp: s.emp,
        records: filteredRecords,
        device_user_id: s.emp.device_user_id || '',
        empName: s.emp.name || '',
        presentCount,
        lateCount,
        absentCount,
        totalHrs,
        rate,
      };
    });

    const term = searchTerm.toLowerCase().trim();
    if (!term) return data;
    return data.filter(row => 
      (row.empName?.toLowerCase() || '').includes(term) ||
      (row.device_user_id?.toString() || '').includes(term)
    );
  }, [summary, searchTerm, startDate, endDate]);

  const summaryColumns = [
    { key: 'device_user_id', label: t('deviceNo', 'Device No'), render: v => (
      <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v || '—'}</span>
    )},
    { key: 'empName', label: t('employee', 'Employee'), render: (_, row) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: 'var(--accent-dim)', color: 'var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 600, flexShrink: 0,
        }}>{row.emp.name?.[0]?.toUpperCase()}</div>
        <span>{row.emp.name}</span>
      </div>
    )},
    { key: 'presentCount', label: t('present', 'Present'), render: v => (
      <span style={{ color: 'var(--accent)', fontWeight: 500 }}>{v}</span>
    )},
    { key: 'lateCount', label: t('late', 'Late'), render: v => (
      <span style={{ color: 'var(--warn)' }}>{v}</span>
    )},
    { key: 'absentCount', label: t('absent', 'Absent'), render: v => (
      <span style={{ color: 'var(--danger)' }}>{v}</span>
    )},
    { key: 'totalHrs', label: t('totalHours', 'Total hours'), render: v => `${v}h` },
    { key: 'rate', label: t('attendanceRate', 'Attendance rate'), render: (_, row) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, height: 5, background: 'var(--bg-hover)', borderRadius: 99, maxWidth: 80 }}>
          <div style={{ width: `${row.rate}%`, height: '100%', background: row.rate > 80 ? 'var(--accent)' : row.rate > 50 ? 'var(--warn)' : 'var(--danger)', borderRadius: 99 }} />
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{row.rate}%</span>
      </div>
    )},
    { key: 'actions', label: '', sortable: false, render: (_, row) => (
      <Btn size="sm" onClick={() => selectEmployee(row.emp)}>View</Btn>
    )},
  ];

  // Detail table columns
  const detailColumns = [
    { key: 'date', label: 'Date', render: v => formatAttendanceDate(v) },
    { key: 'status', label: 'Status', render: v => <Badge variant={statusVariant(v)}>{v}</Badge> },
    { key: 'check_in',  label: 'Check in',  render: v => formatTime(v) },
    { key: 'check_out', label: 'Check out', render: v => formatTime(v) },
    { key: 'hours_worked', label: 'Hours', render: v => v ? `${v}h` : '—' },
    { key: 'late_minutes', label: 'Late', render: v => `${v || 0}m` },
    { key: 'early_leave_minutes', label: 'Early leave', render: v => `${v || 0}m` },
    { key: 'overtime_minutes', label: 'Overtime', render: v => `${v || 0}m` },
    { key: 'notes', label: 'Notes', render: v => v || '—' },
  ];

  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  return (
    <div style={{ padding: '28px 28px 40px' }}>
      <PageHeader
        title="Attendance"
        subtitle={`${monthName(month)} ${year} — track daily employee attendance`}
        action={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Select value={month} onChange={e => setMonth(Number(e.target.value))} style={{ width: 90 }}>
              {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </Select>
            <Input type="number" value={year} onChange={e => setYear(Number(e.target.value))} style={{ width: 80 }} />
            <Btn variant="primary" onClick={() => { setShowLog(true); setSaveError(''); }}>+ Log attendance</Btn>
          </div>
        }
      />

      {/* Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 14, marginBottom: 24 }}>
        <MetricCard label="Days present"  value={totalPresent}          color="var(--accent)" />
        <MetricCard label="Days late"     value={totalLate}             color="var(--warn)" />
        <MetricCard label="Days absent"   value={totalAbsent}           color="var(--danger)" />
        <MetricCard label="Total hours"   value={`${totalHours.toFixed(0)}h`} />
      </div>

      {/* Date range filter */}
      {!selectedEmp && (
        <Card padding="12px 16px" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>Filter by date range:</span>
            <input 
              type="date" 
              value={startDate} 
              onChange={e => setStartDate(e.target.value)}
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', padding: '8px 10px', fontSize: 13 }}
            />
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>to</span>
            <input 
              type="date" 
              value={endDate} 
              onChange={e => setEndDate(e.target.value)}
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', padding: '8px 10px', fontSize: 13 }}
            />
            <Btn 
              size="sm" 
              onClick={() => {
                setStartDate(`${year}-${String(month).padStart(2, '0')}-01`);
                setEndDate(`${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`);
              }}
            >
              Reset to month
            </Btn>
          </div>
        </Card>
      )}

      {/* Search bar for summary view */}
      {!selectedEmp && (
        <Card padding="12px 16px" style={{ marginBottom: 16 }}>
          <SearchInput 
            placeholder="Search by employee name or device ID..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </Card>
      )}

      {/* Employee detail view */}
      {selectedEmp ? (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <Btn onClick={() => setSelectedEmp(null)}>← Back</Btn>
            <h2 style={{ fontSize: 16, fontWeight: 600, flex: 1 }}>{selectedEmp.name} — {monthName(month)} {year}</h2>
            {/* Week / Month toggle */}
            <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
              <button
                onClick={() => setViewMode('week')}
                style={{
                  padding: '7px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  border: 'none', outline: 'none', transition: 'all 0.2s',
                  background: viewMode === 'week' ? 'var(--accent)' : 'var(--bg-elevated)',
                  color: viewMode === 'week' ? '#fff' : 'var(--text-secondary)',
                }}
              >
                {(() => { const { start, end } = getCurrentWeekRange(); const s = parseDateParts(start); const e = parseDateParts(end); return `Week (${s.day}/${s.month} – ${e.day}/${e.month})`; })()}
              </button>
              <button
                onClick={() => setViewMode('month')}
                style={{
                  padding: '7px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  border: 'none', borderLeft: '1px solid var(--border)', outline: 'none', transition: 'all 0.2s',
                  background: viewMode === 'month' ? 'var(--accent)' : 'var(--bg-elevated)',
                  color: viewMode === 'month' ? '#fff' : 'var(--text-secondary)',
                }}
              >
                Month Attendance
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, marginBottom: 20 }}>
            <Card>
              {empLoading ? <Spinner /> : (
                filteredEmpRecords.length ? (
                  <Table columns={detailColumns} data={filteredEmpRecords} />
                ) : (
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                    {viewMode === 'week' ? 'No attendance records for this week.' : 'No attendance records for this month.'}
                  </div>
                )
              )}
            </Card>
            <Card style={{ minWidth: 230 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 14 }}>MONTHLY CALENDAR</div>
              {empLoading ? <Spinner /> : <HeatMap records={empRecords} year={year} month={month} />}
            </Card>
          </div>
        </div>
      ) : (
        /* Summary table */
        <>
          {(empListLoading || summaryLoading) && <Spinner />}
          {!empListLoading && !summaryLoading && (
            <Card padding="0">
              <Table
                columns={summaryColumns}
                data={summaryTableData}
                emptyMsg="No employees found."
              />
            </Card>
          )}
        </>
      )}

      {/* Log attendance modal */}
      {showLog && (
        <Modal title="Log attendance" onClose={() => setShowLog(false)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: '1/-1' }}>
              <Select label="Employee" value={logForm.employee_id}
                onChange={e => setLogForm({ ...logForm, employee_id: e.target.value })}>
                <option value="">Select employee</option>
                {employees?.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </Select>
            </div>
            <Input label="Date" type="date" value={logForm.date}
              onChange={e => setLogForm({ ...logForm, date: e.target.value })} />
            <Select label="Status" value={logForm.status}
              onChange={e => setLogForm({ ...logForm, status: e.target.value })}>
              {STATUS_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
            <Input label="Check in" type="time" value={logForm.check_in}
              onChange={e => setLogForm({ ...logForm, check_in: e.target.value })} />
            <Input label="Check out" type="time" value={logForm.check_out}
              onChange={e => setLogForm({ ...logForm, check_out: e.target.value })} />
            <div style={{ gridColumn: '1/-1' }}>
              <Input label="Hours worked" type="number" value={logForm.hours_worked}
                readOnly />
            </div>
            <Input label="Late (minutes)" type="number" value={logForm.late_minutes} readOnly />
            <Input label="Early leave (minutes)" type="number" value={logForm.early_leave_minutes} readOnly />
            <Input label="Overtime (minutes)" type="number" value={logForm.overtime_minutes} readOnly />
            <div style={{ gridColumn: '1/-1' }}>
              <Input label="Notes" value={logForm.notes}
                onChange={e => setLogForm({ ...logForm, notes: e.target.value })} />
            </div>
          </div>
          {saveError && (
            <div style={{ marginTop: 10, padding: '8px 12px', background: 'var(--danger-dim)', color: 'var(--danger)', borderRadius: 6, fontSize: 12 }}>
              {saveError}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
            <Btn onClick={() => setShowLog(false)} disabled={saving}>Cancel</Btn>
            <Btn variant="primary" onClick={handleLog} disabled={saving} aria-busy={saving}>
              {saving ? <Spinner /> : 'Save record'}
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
