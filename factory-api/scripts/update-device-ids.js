/**
 * Update device_user_id for all employees based on the new device (64) assignment.
 * 
 * CAREFUL RE-READ of the handwritten list. For names that cannot be clearly
 * read from the image, they are assigned IDs starting from 1000.
 * 
 * Run: node scripts/update-device-ids.js
 */
require('dotenv').config();
const pool = require('../src/db/pool');

// =====================================================================
// New device_user_id mapping from the handwritten list (device 64)
// 
// RIGHT COLUMN (1-32) and LEFT COLUMN (33-63)
// =====================================================================

const newMappings = [
  // ===== RIGHT COLUMN (1-32) =====
  { new_id: '1',  db_name: 'جرجس' },            // #1 جرجس — clear
  { new_id: '2',  db_name: 'كيرلس' },           // #2 حسينك → كيرلس (Coptic name next to جرجس)
  { new_id: '3',  db_name: null, list_name: 'فريدة' },  // #3 فريدة — NOT IN DB
  { new_id: '4',  db_name: 'سما' },             // #4 سما — clear
  { new_id: '5',  db_name: 'ام حمزه' },          // #5 ام حمزة — clear
  { new_id: '6',  db_name: 'سلمي' },            // #6 سلمي — clear
  { new_id: '7',  db_name: 'نور (فرز)' },        // #7 فرز — clear
  { new_id: '8',  db_name: 'ام عمار' },          // #8 ام عمار — clear
  { new_id: '9',  db_name: 'رويدا' },           // #9 رويدا — clear
  { new_id: '10', db_name: 'ام رودينا' },        // #10 ام رنا → ام رودينا (closest match)
  { new_id: '11', db_name: 'عبدالعزيز' },        // #11 عبد → عبدالعزيز (abbreviation)
  { new_id: '12', db_name: 'ابتسام' },           // #12 ابتسام — reading as ابتسام
  { new_id: '13', db_name: 'اسماء سيد' },        // #13 اسماء → اسماء سيد
  { new_id: '14', db_name: 'فاطمة' },            // #14 فاطمة — clear
  { new_id: '15', db_name: 'ام رحمة (تشطيب)' },   // #15 ام رحمة تشطيب — clear
  { new_id: '16', db_name: 'عمر' },              // #16 عمر ناصر → عمر
  { new_id: '17', db_name: 'ام منة' },           // #17 ام منة — clear
  { new_id: '18', db_name: 'ام اية' },           // #18 ام اية — clear
  { new_id: '19', db_name: 'ام دعاء' },          // #19 ام دعاء — clear
  { new_id: '20', db_name: 'زينة' },             // #20 زينة — clear
  { new_id: '21', db_name: 'بسمة' },             // #21 ام بسمة → بسمة
  { new_id: '22', db_name: 'منة صبحي' },         // #22 منة كليبي → منة صبحي (only منة with last name)
  { new_id: '23', db_name: 'رحمة' },             // #23 رحمة — clear
  { new_id: '24', db_name: 'مصطفي' },            // #24 مصطفي — clear
  { new_id: '25', db_name: 'محمد عبده' },         // #25 محمد + [name] → محمد عبده (only remaining محمد)
  { new_id: '26', db_name: 'راغب' },             // #26 داهب/راهب → راغب
  { new_id: '27', db_name: 'دنيا حسين' },        // #27 دنيا حسين — clear
  { new_id: '28', db_name: 'ام محمد' },          // #28 ام محمد — clear
  { new_id: '29', db_name: 'ام احمد' },          // #29 ام احمد — clear
  { new_id: '30', db_name: 'الاء' },             // #30 الاء — clear
  { new_id: '31', db_name: null, list_name: 'نادية' },   // #31 نادية — NOT IN DB
  { new_id: '32', db_name: 'ام مكة' },           // #32 ام ملكة → ام مكة

  // ===== LEFT COLUMN (33-63) =====
  { new_id: '33', db_name: 'ام شهد' },           // #33 ام رشد → ام شهد
  { new_id: '34', db_name: 'صباح' },             // #34 صباح — clear
  { new_id: '35', db_name: 'ام مروان' },         // #35 ام مروان — clear
  { new_id: '36', db_name: 'ام نورة' },          // #36 ام نورة — clear
  { new_id: '37', db_name: null, list_name: 'الصعايده' },    // #37 UNCLEAR — cannot read clearly
  { new_id: '38', db_name: null, list_name: 'ام رقيه' },     // #38 ام رقيه — NOT IN DB
  { new_id: '39', db_name: null, list_name: 'السلام' },      // #39 UNCLEAR — cannot read clearly
  { new_id: '40', db_name: null, list_name: 'ام بياسف' },    // #40 UNCLEAR — cannot read clearly
  { new_id: '41', db_name: 'ياسمين' },           // #41 ياسمين — clear
  { new_id: '42', db_name: 'دعاء' },             // #42 دعاء — clear
  { new_id: '43', db_name: 'ام ادم' },           // #43 ام ادم — clear
  { new_id: '44', db_name: 'ام عماد' },          // #44 ام عمار وكنز → ام عماد (similar name)
  { new_id: '45', db_name: 'منة' },              // #45 منة — clear
  { new_id: '46', db_name: 'منة رمضان' },        // #46 منة رمضان
  { new_id: '47', db_name: 'احمد ممدوح' },       // #47 احمد ممدوح — clear
  { new_id: '48', db_name: null, list_name: 'محمد عبدالعزيز' },  // #48 NOT IN DB
  { new_id: '49', db_name: 'ام يونس' },          // #49 ام يونس — clear
  { new_id: '50', db_name: 'محمد شعبان' },       // #50 محمد شعبان — clear
  { new_id: '51', db_name: 'زياد' },             // #51 زياد مفرح → زياد
  { new_id: '52', db_name: 'محمد صبحي' },        // #52 محمد صبحي — clear
  { new_id: '53', db_name: 'أميرة' },            // #53 اميرة احمد → أميرة
  { new_id: '54', db_name: 'ام رحمة' },          // #54 ام رحمة (different from #15 تشطيب)
  { new_id: '55', db_name: 'ملك' },              // #55 ملك حسن → ملك
  { new_id: '56', db_name: 'امل' },              // #56 امل — clear
  { new_id: '57', db_name: 'عبدالرحمن' },        // #57 عبدالرحمن حسن → عبدالرحمن
  { new_id: '58', db_name: 'مؤمن ايمن' },        // #58 مؤمن ايمن — clear
  { new_id: '59', db_name: 'عزت' },              // #59 عزت — clear
  { new_id: '60', db_name: null, list_name: 'هجمة رجب' },   // #60 UNCLEAR — cannot read clearly
  { new_id: '61', db_name: null, list_name: 'محمد علي' },    // #61 محمد علي — NOT IN DB
  { new_id: '62', db_name: null, list_name: 'احمد عمر' },    // #62 احمد عمر — NOT IN DB
  { new_id: '63', db_name: 'محمود' },            // #63 محمود — clear
];

async function main() {
  const client = await pool.connect();
  try {
    // Get all current employees
    const { rows: employees } = await client.query(
      'SELECT id, name, device_user_id FROM employees ORDER BY id'
    );
    console.log(`Found ${employees.length} employees in database.\n`);

    // Build a name -> employee map (exact match)
    const nameMap = new Map();
    for (const emp of employees) {
      nameMap.set(emp.name, emp);
    }

    await client.query('BEGIN');

    // Step 1: Clear ALL device_user_ids to avoid unique constraint violations
    console.log('Clearing all existing device_user_ids...\n');
    await client.query('UPDATE employees SET device_user_id = NULL');

    // Step 2: Apply mappings from the list
    const matched = [];
    const notFound = [];

    for (const mapping of newMappings) {
      if (mapping.db_name) {
        const emp = nameMap.get(mapping.db_name);
        if (emp) {
          matched.push({ employee_id: emp.id, name: emp.name, new_device_id: mapping.new_id });
        } else {
          console.log(`❌ DB NAME NOT FOUND: "${mapping.db_name}" for list #${mapping.new_id} — THIS IS A BUG!`);
        }
      } else {
        notFound.push(mapping);
        console.log(`⚠ NOT IN DB: "${mapping.list_name}" (list #${mapping.new_id})`);
      }
    }

    console.log('');

    // Apply matched updates
    for (const u of matched) {
      await client.query(
        'UPDATE employees SET device_user_id = $1 WHERE id = $2',
        [u.new_device_id, u.employee_id]
      );
      console.log(`✓ ${u.new_device_id.padStart(3)} → ${u.name} (id=${u.employee_id})`);
    }

    // Step 3: Assign 1000+ to employees NOT in the list
    const assignedEmployeeIds = new Set(matched.map(u => u.employee_id));
    const unassigned = employees.filter(e => !assignedEmployeeIds.has(e.id));
    let unknownCounter = 1000;

    if (unassigned.length > 0) {
      console.log(`\n--- ${unassigned.length} employees NOT in the new list → assigning 1000+ ---`);
      for (const emp of unassigned) {
        await client.query(
          'UPDATE employees SET device_user_id = $1 WHERE id = $2',
          [String(unknownCounter), emp.id]
        );
        console.log(`→ ${unknownCounter} → ${emp.name} (id=${emp.id})`);
        unknownCounter++;
      }
    }

    await client.query('COMMIT');

    console.log('\n' + '='.repeat(60));
    console.log('✅ All device_user_ids updated successfully!');
    console.log(`   Mapped from list: ${matched.length}`);
    console.log(`   Not in DB (from list): ${notFound.length}`);
    console.log(`   Not in list (got 1000+): ${unassigned.length}`);
    console.log('='.repeat(60));

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error updating device IDs:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
