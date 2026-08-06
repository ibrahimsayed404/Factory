const pool = require('../db/pool');

let hasWeekendDaysColumnCache = null;
const hasWeekendDaysColumn = async () => {
  if (hasWeekendDaysColumnCache !== null) return hasWeekendDaysColumnCache;
  const result = await pool.query(
    `SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'employees'
        AND column_name = 'weekend_days'
    ) AS exists`
  );
  hasWeekendDaysColumnCache = Boolean(result.rows[0]?.exists);
  return hasWeekendDaysColumnCache;
};

const getEmployees = async ({ status, departmentId, limit, offset }) => {
  let baseWhere = 'WHERE 1=1';
  const params = [];
  
  if (status) {
    params.push(status);
    baseWhere += ` AND e.status = $${params.length}`;
  }
  if (departmentId) {
    params.push(departmentId);
    baseWhere += ` AND e.department_id = $${params.length}`;
  }

  const countResult = await pool.query(`SELECT COUNT(*) FROM employees e ${baseWhere}`, params);
  const total = parseInt(countResult.rows[0].count, 10);

  const dataParams = [...params, limit, offset];
  const dataResult = await pool.query(
    `SELECT e.*, d.name AS department_name
     FROM employees e
     LEFT JOIN departments d ON e.department_id = d.id
     ${baseWhere}
     ORDER BY e.name
     LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
    dataParams
  );

  return { data: dataResult.rows, total };
};

const getEmployeeById = async (id, client = null) => {
  const executor = client || pool;
  const result = await executor.query(
    `SELECT e.*, d.name AS department_name FROM employees e
     LEFT JOIN departments d ON e.department_id = d.id WHERE e.id = $1`,
    [id]
  );
  return result.rows[0] || null;
};

const createEmployee = async (data) => {
  const { name, email, phone, department_id, role, shift, shift_start, shift_end, weekend_days, salary, hire_date, status = 'active', termination_date, device_user_id } = data;
  const supportsWeekendDays = await hasWeekendDaysColumn();
  
  const resolvedTerminationDate = (status === 'inactive')
    ? (termination_date || new Date().toISOString().slice(0, 10))
    : null;

  const result = supportsWeekendDays
    ? await pool.query(
      `INSERT INTO employees (name, email, phone, department_id, role, shift, shift_start, shift_end, weekend_days, salary, hire_date, status, termination_date, device_user_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [name, email, phone, department_id, role, shift, shift_start || null, shift_end || null, weekend_days || null, salary, hire_date, status, resolvedTerminationDate, device_user_id || null]
    )
    : await pool.query(
      `INSERT INTO employees (name, email, phone, department_id, role, shift, shift_start, shift_end, salary, hire_date, status, termination_date, device_user_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [name, email, phone, department_id, role, shift, shift_start || null, shift_end || null, salary, hire_date, status, resolvedTerminationDate, device_user_id || null]
    );
    
  return result.rows[0];
};

const updateEmployee = async (id, data, client = null) => {
  const existing = await getEmployeeById(id, client);
  if (!existing) return null;

  const resolvedName = data.name !== undefined ? data.name : existing.name;
  const resolvedEmail = data.email !== undefined ? data.email : existing.email;
  const resolvedPhone = data.phone !== undefined ? data.phone : existing.phone;
  const resolvedDept = data.department_id !== undefined ? data.department_id : existing.department_id;
  const resolvedRole = data.role !== undefined ? data.role : existing.role;
  const resolvedShift = data.shift !== undefined ? data.shift : existing.shift;
  const resolvedShiftStart = data.shift_start !== undefined ? data.shift_start : existing.shift_start;
  const resolvedShiftEnd = data.shift_end !== undefined ? data.shift_end : existing.shift_end;
  const resolvedWeekendDays = data.weekend_days !== undefined ? data.weekend_days : existing.weekend_days;
  const resolvedSalary = data.salary !== undefined ? data.salary : existing.salary;
  const resolvedHireDate = data.hire_date !== undefined ? data.hire_date : existing.hire_date;
  const resolvedDeviceUserId = data.device_user_id !== undefined ? data.device_user_id : existing.device_user_id;

  const resolvedStatus = data.status !== undefined ? data.status : existing.status;
  let resolvedTerminationDate = existing.termination_date;

  if (data.status !== undefined) {
    if (data.status === 'inactive') {
      resolvedTerminationDate = data.termination_date || existing.termination_date || new Date().toISOString().slice(0, 10);
    } else if (data.status === 'active') {
      resolvedTerminationDate = null;
    }
  } else if (data.termination_date !== undefined) {
    resolvedTerminationDate = data.termination_date;
  }

  const supportsWeekendDays = await hasWeekendDaysColumn();
  
  const dbClient = client || pool;

  if (data.salary !== undefined && Number(data.salary) !== Number(existing.salary)) {
    await dbClient.query(
      `INSERT INTO hr_salary_history (employee_id, previous_salary, new_salary, effective_date, reason)
       VALUES ($1, $2, $3, CURRENT_DATE, $4)`,
      [id, existing.salary || 0, data.salary, data.reason || 'Salary updated via employee profile']
    );
  }

  const result = supportsWeekendDays
    ? await dbClient.query(
      `UPDATE employees SET name=$1, email=$2, phone=$3, department_id=$4, role=$5,
       shift=$6, shift_start=$7, shift_end=$8, weekend_days=$9, salary=$10, hire_date=$11, status=$12, termination_date=$13, device_user_id=$14 WHERE id=$15 RETURNING *`,
      [resolvedName, resolvedEmail, resolvedPhone, resolvedDept, resolvedRole, resolvedShift, resolvedShiftStart || null, resolvedShiftEnd || null, resolvedWeekendDays || null, resolvedSalary, resolvedHireDate, resolvedStatus, resolvedTerminationDate, resolvedDeviceUserId || null, id]
    )
    : await dbClient.query(
      `UPDATE employees SET name=$1, email=$2, phone=$3, department_id=$4, role=$5,
       shift=$6, shift_start=$7, shift_end=$8, salary=$9, hire_date=$10, status=$11, termination_date=$12, device_user_id=$13 WHERE id=$14 RETURNING *`,
      [resolvedName, resolvedEmail, resolvedPhone, resolvedDept, resolvedRole, resolvedShift, resolvedShiftStart || null, resolvedShiftEnd || null, resolvedSalary, resolvedHireDate, resolvedStatus, resolvedTerminationDate, resolvedDeviceUserId || null, id]
    );
    
  return result.rows[0] || null;
};

const deleteEmployee = async (id, client = pool) => {
  const result = await client.query(
    `UPDATE employees 
     SET status = 'terminated', termination_date = COALESCE(termination_date, CURRENT_DATE), device_user_id = NULL 
     WHERE id = $1 
     RETURNING id, name, status, termination_date, device_user_id`,
    [id]
  );
  return result.rows[0] || null;
};

const hardDeleteEmployee = async (id, client = pool) => {
  const result = await client.query(
    `DELETE FROM employees WHERE id = $1 RETURNING id, name`,
    [id]
  );
  return result.rows[0] || null;
};


const getEmployeeShiftDetails = async (id) => {
  const supportsWeekendDays = await hasWeekendDaysColumn();
  const result = supportsWeekendDays
    ? await pool.query('SELECT shift, shift_start, shift_end, weekend_days FROM employees WHERE id = $1', [id])
    : await pool.query('SELECT shift, shift_start, shift_end FROM employees WHERE id = $1', [id]);
  return result.rows[0] || null;
};

const getAttendanceRecord = async (employeeId, date) => {
  const result = await pool.query(
    'SELECT id FROM attendance WHERE employee_id = $1 AND date = $2',
    [employeeId, date]
  );
  return result.rows[0] || null;
};

const updateAttendanceRecord = async (employeeId, date, data) => {
  const { check_in, check_out, hours_worked, status, notes, late_minutes, early_leave_minutes, overtime_minutes } = data;
  const result = await pool.query(
    `UPDATE attendance
     SET check_in=$1, check_out=$2, hours_worked=$3, status=$4, notes=$5,
         late_minutes=$6, early_leave_minutes=$7, overtime_minutes=$8
     WHERE employee_id=$9 AND date=$10
     RETURNING id, employee_id, date::text AS date,
               TO_CHAR(check_in, 'HH24:MI') AS check_in,
               TO_CHAR(check_out, 'HH24:MI') AS check_out,
               hours_worked, late_minutes, early_leave_minutes, overtime_minutes, status, notes`,
    [check_in, check_out, hours_worked, status, notes, late_minutes, early_leave_minutes, overtime_minutes, employeeId, date]
  );
  return result.rows[0];
};

const createAttendanceRecord = async (employeeId, date, data) => {
  const { check_in, check_out, hours_worked, status, notes, late_minutes, early_leave_minutes, overtime_minutes } = data;
  const result = await pool.query(
    `INSERT INTO attendance (
      employee_id, date, check_in, check_out, hours_worked, status, notes,
      late_minutes, early_leave_minutes, overtime_minutes
    )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING id, employee_id, date::text AS date,
               TO_CHAR(check_in, 'HH24:MI') AS check_in,
               TO_CHAR(check_out, 'HH24:MI') AS check_out,
               hours_worked, late_minutes, early_leave_minutes, overtime_minutes, status, notes`,
    [employeeId, date, check_in, check_out, hours_worked, status, notes, late_minutes, early_leave_minutes, overtime_minutes]
  );
  return result.rows[0];
};

const getAttendanceHistory = async (employeeId, month, year) => {
  let query = `
    SELECT
      a.id,
      a.employee_id,
      a.date::text AS date,
      TO_CHAR(a.check_in, 'HH24:MI') AS check_in,
      TO_CHAR(a.check_out, 'HH24:MI') AS check_out,
      a.hours_worked,
      a.late_minutes,
      a.early_leave_minutes,
      a.overtime_minutes,
      a.status,
      a.notes
    FROM attendance a
    LEFT JOIN employees e ON a.employee_id = e.id
    WHERE a.employee_id = $1
      AND (e.hire_date IS NULL OR a.date >= e.hire_date)
      AND (e.termination_date IS NULL OR a.date <= e.termination_date)
  `;
  const params = [employeeId];
  if (month && year) {
    query += ` AND EXTRACT(MONTH FROM a.date) = $2 AND EXTRACT(YEAR FROM a.date) = $3`;
    params.push(month, year);
  }
  query += ' ORDER BY a.date DESC';
  
  const result = await pool.query(query, params);
  return result.rows;
};

const getAllDepartments = async () => {
  const result = await pool.query('SELECT * FROM departments ORDER BY name');
  return result.rows;
};

module.exports = {
  getEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  hardDeleteEmployee,
  getEmployeeShiftDetails,
  getAttendanceRecord,
  updateAttendanceRecord,
  createAttendanceRecord,
  getAttendanceHistory,
  getAllDepartments,
};
