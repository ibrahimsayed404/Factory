require('dotenv').config();
const path = require('path');
const pool = require('../src/db/pool');
const employeeService = require('../src/services/employeeService');

function normalizeName(name) {
  if (!name) return '';
  return name
    .trim()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, '')
    .replace(/عبد\s+/g, 'عبد');
}

const manualOverrides = {
  'ام محمود الفار': 'ام محمد الفار'
};

const deptMap = {
  'قسم المكن': 16,
  'قسم التشغيل': 17,
  'قسم التشغل': 17,
  'قسم التشطيب': 18,
  'قسم التكيس': 19,
  'قسم المكوه': 20,
  'قسم الفرز': 21
};

async function main() {
  const dataPath = path.join(__dirname, 'attendance-data.json');
  const employeesData = require(dataPath);
  
  console.log(`Loaded ${employeesData.length} employees from JSON.`);
  
  // 1. Fetch all DB employees for mapping
  const dbEmpsRes = await pool.query('SELECT id, name, department_id FROM employees');
  const dbEmployees = dbEmpsRes.rows;
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const emp of employeesData) {
    let targetName = manualOverrides[emp.name] || emp.name;
    const targetDeptId = deptMap[emp.dept];
    const normName = normalizeName(targetName);
    
    // Find DB employee
    const match = dbEmployees.find(e => 
      normalizeName(e.name) === normName && 
      e.department_id === targetDeptId
    );
    
    if (!match) {
      console.error(`❌ COULD NOT FIND MATCH FOR: ${emp.name} in department ${emp.dept}`);
      errorCount++;
      continue;
    }
    
    const empId = match.id;
    console.log(`Processing "${emp.name}" (ID: ${empId})`);
    
    for (const day of emp.days) {
      try {
        const payload = {
          date: day.date,
          check_in: day.in,
          check_out: day.out,
          status: day.status,
          notes: day.note || null
        };
        
        await employeeService.logAttendance(empId, payload);
        successCount++;
      } catch (err) {
        console.error(`  ❌ Error logging day ${day.date} for ${emp.name}:`, err.message);
        errorCount++;
      }
    }
  }
  
  console.log(`\n=== IMPORT COMPLETE ===`);
  console.log(`Successfully logged: ${successCount} records.`);
  console.log(`Errors encountered: ${errorCount}`);
  
  await pool.end();
}

main().catch(err => {
  console.error('Fatal Error:', err);
  pool.end();
});
