require('dotenv').config();
const pool = require('../src/db/pool');

const sampleEmployees = [
  {
    name: 'Alice Production',
    email: 'alice.production@test.com',
    role: 'Production Operator',
    shift: 'morning',
    weekend_days: '5,6',
    salary: 1500,
    hire_date: '2025-04-01',
  },
  {
    name: 'Bob Assembly',
    email: 'bob.assembly@test.com',
    role: 'Assembly Technician',
    shift: 'evening',
    weekend_days: '0,6',
    salary: 1200,
    hire_date: '2025-05-10',
  },
  {
    name: 'Charlie QC',
    email: 'charlie.qc@test.com',
    role: 'Quality Inspector',
    shift: 'morning',
    weekend_days: '6',
    salary: 1400,
    hire_date: '2025-06-15',
  },
];

const sampleAttendance = [
  {
    employeeEmail: 'alice.production@test.com',
    rows: [
      { date: '2026-06-26', check_in: '08:30', check_out: '17:00', hours_worked: 8.5, late_minutes: 0, early_leave_minutes: 0, overtime_minutes: 30, status: 'present', notes: 'normal' },
      { date: '2026-06-27', check_in: '09:00', check_out: '17:00', hours_worked: 8, late_minutes: 30, early_leave_minutes: 0, overtime_minutes: 0, status: 'present', notes: 'late arrival' },
      { date: '2026-06-28', check_in: '09:00', check_out: '17:00', hours_worked: 8, late_minutes: 0, early_leave_minutes: 0, overtime_minutes: 60, status: 'present', notes: 'overtime' },
      { date: '2026-06-29', check_in: '09:00', check_out: '14:00', hours_worked: 5, late_minutes: 0, early_leave_minutes: 180, overtime_minutes: 0, status: 'half-day', notes: 'half-day' },
      { date: '2026-06-30', check_in: null, check_out: null, hours_worked: 0, late_minutes: 0, early_leave_minutes: 0, overtime_minutes: 0, status: 'absent', notes: 'absent' },
      { date: '2026-07-01', check_in: '09:00', check_out: '17:00', hours_worked: 8, late_minutes: 0, early_leave_minutes: 0, overtime_minutes: 0, status: 'present', notes: 'normal' },
      { date: '2026-07-02', check_in: '09:00', check_out: '17:00', hours_worked: 8, late_minutes: 0, early_leave_minutes: 0, overtime_minutes: 0, status: 'present', notes: 'normal' },
    ],
  },
  {
    employeeEmail: 'bob.assembly@test.com',
    rows: [
      { date: '2026-06-26', check_in: '09:00', check_out: '12:00', hours_worked: 3, late_minutes: 0, early_leave_minutes: 180, overtime_minutes: 0, status: 'half-day', notes: 'half-day' },
      { date: '2026-06-27', check_in: null, check_out: null, hours_worked: 0, late_minutes: 0, early_leave_minutes: 0, overtime_minutes: 0, status: 'absent', notes: 'absent' },
      { date: '2026-06-28', check_in: '09:00', check_out: '18:00', hours_worked: 9, late_minutes: 0, early_leave_minutes: 0, overtime_minutes: 60, status: 'present', notes: 'overtime' },
      { date: '2026-06-29', check_in: '09:00', check_out: '17:00', hours_worked: 8, late_minutes: 0, early_leave_minutes: 0, overtime_minutes: 0, status: 'present', notes: 'normal' },
      { date: '2026-06-30', check_in: '09:00', check_out: '16:00', hours_worked: 7, late_minutes: 0, early_leave_minutes: 60, overtime_minutes: 0, status: 'present', notes: 'early leave' },
      { date: '2026-07-01', check_in: '09:00', check_out: '19:00', hours_worked: 10, late_minutes: 0, early_leave_minutes: 0, overtime_minutes: 120, status: 'present', notes: 'weekend overtime' },
      { date: '2026-07-02', check_in: '09:00', check_out: '17:00', hours_worked: 8, late_minutes: 0, early_leave_minutes: 0, overtime_minutes: 0, status: 'present', notes: 'normal' },
    ],
  },
  {
    employeeEmail: 'charlie.qc@test.com',
    rows: [
      { date: '2026-06-26', check_in: '08:00', check_out: '17:00', hours_worked: 9, late_minutes: 0, early_leave_minutes: 0, overtime_minutes: 60, status: 'present', notes: 'overtime' },
      { date: '2026-06-27', check_in: '09:00', check_out: '17:00', hours_worked: 8, late_minutes: 0, early_leave_minutes: 0, overtime_minutes: 0, status: 'present', notes: 'normal' },
      { date: '2026-06-28', check_in: '09:00', check_out: '17:00', hours_worked: 8, late_minutes: 0, early_leave_minutes: 0, overtime_minutes: 0, status: 'present', notes: 'normal' },
      { date: '2026-06-29', check_in: '09:00', check_out: '17:00', hours_worked: 8, late_minutes: 0, early_leave_minutes: 0, overtime_minutes: 0, status: 'present', notes: 'normal' },
      { date: '2026-06-30', check_in: '09:00', check_out: '12:00', hours_worked: 3, late_minutes: 0, early_leave_minutes: 180, overtime_minutes: 0, status: 'half-day', notes: 'half-day' },
      { date: '2026-07-01', check_in: null, check_out: null, hours_worked: 0, late_minutes: 0, early_leave_minutes: 0, overtime_minutes: 0, status: 'absent', notes: 'weekend off' },
      { date: '2026-07-02', check_in: '09:00', check_out: '17:00', hours_worked: 8, late_minutes: 0, early_leave_minutes: 0, overtime_minutes: 0, status: 'present', notes: 'normal' },
    ],
  },
];

const insertEmployees = async () => {
  const employeeMap = new Map();

  for (const employee of sampleEmployees) {
    const result = await pool.query(
      `INSERT INTO employees (name, email, role, shift, weekend_days, salary, hire_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (email) DO UPDATE
       SET name = EXCLUDED.name,
           role = EXCLUDED.role,
           shift = EXCLUDED.shift,
           weekend_days = EXCLUDED.weekend_days,
           salary = EXCLUDED.salary,
           hire_date = EXCLUDED.hire_date
       RETURNING id, email`,
      [
        employee.name,
        employee.email,
        employee.role,
        employee.shift,
        employee.weekend_days,
        employee.salary,
        employee.hire_date,
      ]
    );

    const inserted = result.rows[0];
    employeeMap.set(inserted.email, inserted.id);
    console.log(`Upserted employee: ${inserted.email} (id=${inserted.id})`);
  }

  return employeeMap;
};

const insertAttendance = async (employeeMap) => {
  for (const attendanceBlock of sampleAttendance) {
    const employeeId = employeeMap.get(attendanceBlock.employeeEmail);
    if (!employeeId) continue;

    for (const row of attendanceBlock.rows) {
      await pool.query(
        `INSERT INTO attendance (employee_id, date, check_in, check_out, hours_worked, late_minutes, early_leave_minutes, overtime_minutes, status, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (employee_id, date) DO UPDATE
         SET check_in = EXCLUDED.check_in,
             check_out = EXCLUDED.check_out,
             hours_worked = EXCLUDED.hours_worked,
             late_minutes = EXCLUDED.late_minutes,
             early_leave_minutes = EXCLUDED.early_leave_minutes,
             overtime_minutes = EXCLUDED.overtime_minutes,
             status = EXCLUDED.status,
             notes = EXCLUDED.notes`,
        [
          employeeId,
          row.date,
          row.check_in,
          row.check_out,
          row.hours_worked,
          row.late_minutes,
          row.early_leave_minutes,
          row.overtime_minutes,
          row.status,
          row.notes,
        ]
      );
    }

    console.log(`Inserted attendance for ${attendanceBlock.employeeEmail}`);
  }
};

const main = async () => {
  try {
    const employeeMap = await insertEmployees();
    await insertAttendance(employeeMap);
    console.log('Sample employee and attendance data seeded successfully.');
  } catch (err) {
    console.error('Failed to seed sample data:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

main();
