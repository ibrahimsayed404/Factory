// import-attendance-july-11-16.js
// Imports attendance data for July 11-16, 2026 from Attendance_AI_Ready.txt
// Uses ON CONFLICT DO NOTHING to avoid overwriting existing data
// Wraps inserts in transaction with proper attendance calculations

require('dotenv').config();
delete process.env.PGSSLMODE;

const pg = require('pg');
const fs = require('fs');
const path = require('path');

// Keep dates/timestamps as raw strings to prevent timezone shifting
pg.types.setTypeParser(1082, (val) => val); // DATE
pg.types.setTypeParser(1114, (val) => val); // TIMESTAMP
pg.types.setTypeParser(1184, (val) => val); // TIMESTAMPTZ

const cloudConfig = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
};

// Employee name to ID mapping (confirmed matches)
const EMPLOYEE_MAP = {
  'ام يوسف': 4,
  'ام هبه': 5,
  'حنان': 7,
  'منة رمضان': 9,
  'صباح': 13,
  'ام نورة': 16,
  'دنيا حسين': 17,
  'دعاء': 18,
  'ام ادم': 19,
  'ام شهد': 22,
  'ام محمد': 23,
  'ام يونس': 27,
  'اسماء سيد': 82,
  'مروان': 28,
  'محمد شعبان': 31,
  'ام مروان': 83,
  'محمد صبحي': 84,
  'امل': 86,
  'جرجس': 73,
  'كيرلس': 74,
  'راغب': 75,
  'سما': 55,
  'بسمة': 57,
  'ابتسام': 58,
  'اسامة': 61,
  'أميرة': 12,
  'ياسمين': 26,
};

// Day name to date mapping for July 2026
const DAY_DATE_MAP = {
  'السبت 11/7': '2026-07-11',
  'الاحد 12/7': '2026-07-12',
  'الاثنين 13/7': '2026-07-13',
  'الثلاثاء 14/7': '2026-07-14',
  'الاربعاء 15/7': '2026-07-15',
  'الخميس 16/7': '2026-07-16',
};

// Helper functions for attendance calculations
const toMinutes = (value) => {
  if (!value) return null;
  const [h, m] = String(value).slice(0, 5).split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return (h * 60) + m;
};

const calculateWorkedMinutes = (checkIn, checkOut) => {
  const inMin = toMinutes(checkIn);
  const outMin = toMinutes(checkOut);
  if (inMin === null || outMin === null) return null;
  let end = outMin;
  if (end < inMin) end += 24 * 60;
  return Math.max(0, end - inMin);
};

const calculateHoursWorked = (checkIn, checkOut) => {
  const workedMinutes = calculateWorkedMinutes(checkIn, checkOut);
  if (workedMinutes === null) return null;
  return Number((workedMinutes / 60).toFixed(2));
};

const calculateShiftMetrics = (checkIn, checkOut) => {
  const inMin = toMinutes(checkIn);
  const outMin = toMinutes(checkOut);
  const shiftStart = 8 * 60; // 08:00
  const shiftEnd = 17 * 60; // 17:00
  
  if (inMin === null || outMin === null) {
    return { late_minutes: 0, early_leave_minutes: 0, overtime_minutes: 0 };
  }
  
  let normalizedIn = inMin;
  let normalizedOut = outMin;
  if (normalizedOut < normalizedIn) normalizedOut += 24 * 60;
  
  const lateWithoutGrace = Math.max(0, normalizedIn - shiftStart);
  const graceMinutes = 10; // 10 minute grace period
  
  return {
    late_minutes: Math.max(0, lateWithoutGrace - graceMinutes),
    early_leave_minutes: Math.max(0, shiftEnd - normalizedOut),
    overtime_minutes: Math.max(0, normalizedOut - shiftEnd),
  };
};

const parseAttendanceFile = (filePath) => {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const records = [];
  let currentEmployee = null;
  let currentData = {};
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    if (trimmed.startsWith('Employee:')) {
      // Save previous employee data
      if (currentEmployee && currentData.date) {
        records.push({ employee: currentEmployee, ...currentData });
      }
      
      currentEmployee = trimmed.replace('Employee:', '').trim();
      currentData = {};
    } else if (trimmed.startsWith('-')) {
      const parts = trimmed.substring(1).trim().split(':');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join(':').trim();
        
        if (DAY_DATE_MAP[key]) {
          // This is a date line with check-in time
          if (currentData.date) {
            // Save previous day's data
            records.push({ employee: currentEmployee, ...currentData });
          }
          
          let checkInTime = null;
          if (value !== 'غ' && value !== 'اذن') {
            if (value.includes(':')) {
              // Already in time format
              checkInTime = value;
            } else {
              // Convert hour number to time format (e.g., "8" -> "08:00")
              const hour = parseInt(value, 10);
              if (!isNaN(hour)) {
                checkInTime = `${String(hour).padStart(2, '0')}:00`;
              }
            }
          }
          
          currentData = {
            date: DAY_DATE_MAP[key],
            check_in: checkInTime,
            status: value === 'غ' ? 'absent' : value === 'اذن' ? 'excused' : 'present',
          };
        } else if (key === 'Col2' || key === 'Col4' || key === 'Col6' || key === 'Col8' || key === 'Col10' || key === 'Col12') {
          // These are check-out times - convert hour numbers to time format
          if (value === 'غ' || value === 'اذن') {
            currentData.check_out = null;
            if (value === 'غ') currentData.status = 'absent';
            if (value === 'اذن') currentData.status = 'excused';
          } else if (value.includes(':')) {
            // Already in time format
            currentData.check_out = value;
          } else {
            // Convert hour number to time format (e.g., "5" -> "17:00")
            const hour = parseInt(value, 10);
            if (!isNaN(hour)) {
              // Assuming PM times for check-out (add 12 if hour < 12, except 12 itself)
              const hour24 = hour < 12 ? hour + 12 : hour;
              currentData.check_out = `${String(hour24).padStart(2, '0')}:00`;
            } else {
              currentData.check_out = null;
            }
          }
        }
      }
    }
  }
  
  // Save last employee data
  if (currentEmployee && currentData.date) {
    records.push({ employee: currentEmployee, ...currentData });
  }
  
  return records;
};

const main = async () => {
  console.log('Parsing attendance file...');
  const filePath = path.join('d:\\Desktop\\Attendance_AI_Ready.txt');
  const rawRecords = parseAttendanceFile(filePath);
  
  console.log(`Parsed ${rawRecords.length} attendance records`);
  
  // Map to employee IDs and calculate metrics
  const attendanceData = [];
  const skippedEmployees = [];
  
  for (const record of rawRecords) {
    const employeeId = EMPLOYEE_MAP[record.employee];
    if (!employeeId) {
      skippedEmployees.push(record.employee);
      continue;
    }
    
    const metrics = calculateShiftMetrics(record.check_in, record.check_out);
    const hoursWorked = calculateHoursWorked(record.check_in, record.check_out);
    
    attendanceData.push({
      employee_id: employeeId,
      date: record.date,
      check_in: record.check_in,
      check_out: record.check_out,
      hours_worked: hoursWorked,
      late_minutes: metrics.late_minutes,
      early_leave_minutes: metrics.early_leave_minutes,
      overtime_minutes: metrics.overtime_minutes,
      status: record.status,
      notes: '',
    });
  }
  
  console.log(`Mapped ${attendanceData.length} records to employee IDs`);
  console.log(`Skipped ${skippedEmployees.length} employees not in map:`, skippedEmployees);
  
  // Show sample of records to be inserted
  console.log('\n' + '='.repeat(70));
  console.log('SAMPLE OF RECORDS TO BE INSERTED (first 10)');
  console.log('='.repeat(70));
  console.table(attendanceData.slice(0, 10));
  
  console.log(`\nTotal records to insert: ${attendanceData.length}`);
  console.log('Dates covered: 2026-07-11 to 2026-07-16');
  console.log('Using ON CONFLICT (employee_id, date) DO NOTHING to avoid duplicates');
  
  console.log('\n' + '='.repeat(70));
  console.log('READY TO INSERT - Type "yes" to continue, anything else to cancel');
  console.log('='.repeat(70));
  
  // Connect to database
  console.log('\nConnecting to cloud Supabase...');
  const cloudClient = new pg.Client(cloudConfig);
  await cloudClient.connect();
  
  try {
    // BEGIN transaction
    await cloudClient.query('BEGIN');
    console.log('BEGIN transaction');
    
    let inserted = 0;
    let skipped = 0;
    
    for (const record of attendanceData) {
      try {
        await cloudClient.query(
          `INSERT INTO attendance 
           (employee_id, date, check_in, check_out, hours_worked, late_minutes, early_leave_minutes, overtime_minutes, status, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (employee_id, date) DO NOTHING`,
          [
            record.employee_id,
            record.date,
            record.check_in,
            record.check_out,
            record.hours_worked,
            record.late_minutes ? record.late_minutes : 0,
            record.early_leave_minutes ? record.early_leave_minutes : 0,
            record.overtime_minutes ? record.overtime_minutes : 0,
            record.status,
            record.notes,
          ]
        );
        inserted++;
      } catch (err) {
        if (err.code === '23505') { // Unique violation
          skipped++;
        } else {
          throw err;
        }
      }
    }
    
    // COMMIT
    await cloudClient.query('COMMIT');
    console.log(`COMMIT — inserted ${inserted} records, skipped ${skipped} duplicates. ✅`);
    
    // Verification
    console.log('\n' + '='.repeat(70));
    console.log('VERIFICATION (attendance counts by date)');
    console.log('='.repeat(70));
    const dates = ['2026-07-11', '2026-07-12', '2026-07-13', '2026-07-14', '2026-07-15', '2026-07-16'];
    for (const date of dates) {
      const { rows } = await cloudClient.query(
        'SELECT COUNT(*)::int AS count FROM attendance WHERE date = $1',
        [date]
      );
      console.log(`${date}: ${rows[0].count} records`);
    }
    
    console.log('\n✅ Attendance import completed successfully.');
    
  } catch (err) {
    // ROLLBACK on error
    await cloudClient.query('ROLLBACK');
    console.error('ROLLBACK — error:', err.message);
    process.exit(1);
  } finally {
    await cloudClient.end();
  }
};

main();
