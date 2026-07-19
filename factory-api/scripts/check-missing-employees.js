// check-missing-employees.js
// Compare employees in the attendance file with the full database to find missing ones

require('dotenv').config();
delete process.env.PGSSLMODE;

const pg = require('pg');
const fs = require('fs');
const path = require('path');

const cloudConfig = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
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

const parseAttendanceFile = (filePath) => {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const employeesInFile = new Set();
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    if (trimmed.startsWith('Employee:')) {
      const employeeName = trimmed.replace('Employee:', '').trim();
      employeesInFile.add(employeeName);
    }
  }
  
  return employeesInFile;
};

const main = async () => {
  console.log('Parsing attendance file...');
  const filePath = path.join('d:\\Desktop\\Attendance_AI_Ready.txt');
  const employeesInFile = parseAttendanceFile(filePath);
  
  console.log(`Found ${employeesInFile.size} unique employees in attendance file`);
  
  console.log('\nConnecting to cloud Supabase...');
  const cloudClient = new pg.Client(cloudConfig);
  await cloudClient.connect();
  
  try {
    const { rows: dbEmployees } = await cloudClient.query(
      'SELECT id, name FROM employees ORDER BY id'
    );
    
    console.log(`Found ${dbEmployees.length} employees in database`);
    
    // Create name to ID map from database
    const dbEmployeeMap = {};
    for (const emp of dbEmployees) {
      dbEmployeeMap[emp.name] = emp.id;
    }
    
    // Find employees in file but not in confirmed map
    const confirmedMap = {
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
    
    console.log('\n' + '='.repeat(70));
    console.log('EMPLOYEES IN FILE BUT NOT IN CONFIRMED MAP');
    console.log('='.repeat(70));
    
    const missingEmployees = [];
    for (const name of employeesInFile) {
      if (!confirmedMap[name]) {
        const dbId = dbEmployeeMap[name];
        if (dbId) {
          missingEmployees.push({ name, dbId, status: 'IN_DB' });
        } else {
          missingEmployees.push({ name, dbId: null, status: 'NOT_IN_DB' });
        }
      }
    }
    
    console.table(missingEmployees);
    
    console.log(`\nTotal missing from confirmed map: ${missingEmployees.length}`);
    console.log(`In database but not confirmed: ${missingEmployees.filter(e => e.status === 'IN_DB').length}`);
    console.log(`Not in database at all: ${missingEmployees.filter(e => e.status === 'NOT_IN_DB').length}`);
    
    // Generate updated employee map
    console.log('\n' + '='.repeat(70));
    console.log('UPDATED EMPLOYEE MAP (including all DB matches)')
    console.log('='.repeat(70));
    
    const updatedMap = { ...confirmedMap };
    for (const { name, dbId, status } of missingEmployees) {
      if (status === 'IN_DB') {
        updatedMap[name] = dbId;
      }
    }
    
    console.log(JSON.stringify(updatedMap, null, 2));
    
  } catch (err) {
    console.error('ERROR:', err.message);
    process.exit(1);
  } finally {
    await cloudClient.end();
  }
};

main();
