const pool = require('../../config/db');
const {
  calculateHoursWorked,
  calculateShiftMetrics,
  calculateWorkedMinutes,
  isWeekendDate,
} = require('../utils/attendanceMetrics');

const WEEKEND_PRESENT_NOTE = 'present vacation';

let hasWeekendDaysColumnCache = null;
const hasWeekendDaysColumn = async () => {
  if (hasWeekendDaysColumnCache === true) return true;
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

// GET /api/employees
const getAll = async (req, res, next) => {
  try {
    const { status, department_id, page, limit: limitParam } = req.query;
    const pageNum  = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(1000, Math.max(1, parseInt(limitParam, 10) || 50));
    const offset   = (pageNum - 1) * pageSize;

    let baseWhere = 'WHERE 1=1';
    const params = [];
    if (status)        { params.push(status);       baseWhere += ` AND e.status = $${params.length}`; }
    if (department_id) { params.push(department_id); baseWhere += ` AND e.department_id = $${params.length}`; }

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM employees e ${baseWhere}`, params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const dataParams = [...params, pageSize, offset];
    const dataResult = await pool.query(
      `SELECT e.*, d.name AS department_name
       FROM employees e
       LEFT JOIN departments d ON e.department_id = d.id
       ${baseWhere}
       ORDER BY e.name
       LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams
    );

    res.json({ data: dataResult.rows, total, page: pageNum, limit: pageSize });
  } catch (err) { next(err); }
};

// GET /api/employees/:id
const getOne = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT e.*, d.name AS department_name FROM employees e
       LEFT JOIN departments d ON e.department_id = d.id WHERE e.id = $1`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Employee not found' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
};

// POST /api/employees
const create = async (req, res, next) => {
  try {
    const { name, email, phone, department_id, role, shift, shift_start, shift_end, weekend_days, salary, hire_date, device_user_id } = req.body;
    const supportsWeekendDays = await hasWeekendDaysColumn();
    const result = supportsWeekendDays
      ? await pool.query(
        `INSERT INTO employees (name, email, phone, department_id, role, shift, shift_start, shift_end, weekend_days, salary, hire_date, device_user_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [name, email, phone, department_id, role, shift, shift_start || null, shift_end || null, weekend_days || null, salary, hire_date, device_user_id || null]
      )
      : await pool.query(
        `INSERT INTO employees (name, email, phone, department_id, role, shift, shift_start, shift_end, salary, hire_date, device_user_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [name, email, phone, department_id, role, shift, shift_start || null, shift_end || null, salary, hire_date, device_user_id || null]
      );
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
};

// PUT /api/employees/:id
const update = async (req, res, next) => {
  try {
    const { name, email, phone, department_id, role, shift, shift_start, shift_end, weekend_days, salary, hire_date, status, device_user_id } = req.body;
    const supportsWeekendDays = await hasWeekendDaysColumn();
    const result = supportsWeekendDays
      ? await pool.query(
        `UPDATE employees SET name=$1, email=$2, phone=$3, department_id=$4, role=$5,
         shift=$6, shift_start=$7, shift_end=$8, weekend_days=$9, salary=$10, hire_date=$11, status=$12, device_user_id=$13 WHERE id=$14 RETURNING *`,
        [name, email, phone, department_id, role, shift, shift_start || null, shift_end || null, weekend_days || null, salary, hire_date, status, device_user_id || null, req.params.id]
      )
      : await pool.query(
        `UPDATE employees SET name=$1, email=$2, phone=$3, department_id=$4, role=$5,
         shift=$6, shift_start=$7, shift_end=$8, salary=$9, hire_date=$10, status=$11, device_user_id=$12 WHERE id=$13 RETURNING *`,
        [name, email, phone, department_id, role, shift, shift_start || null, shift_end || null, salary, hire_date, status, device_user_id || null, req.params.id]
      );
    if (!result.rows.length) return res.status(404).json({ error: 'Employee not found' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
};

// DELETE /api/employees/:id
const remove = async (req, res, next) => {
  try {
    const result = await pool.query('DELETE FROM employees WHERE id=$1 RETURNING id', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Employee not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) { next(err); }
};

// POST /api/employees/:id/attendance
const logAttendance = async (req, res, next) => {
  try {
    const { date, check_in, check_out, hours_worked, status, notes, late_minutes, early_leave_minutes, overtime_minutes } = req.body;
    const supportsWeekendDays = await hasWeekendDaysColumn();
    const employee = supportsWeekendDays
      ? await pool.query('SELECT shift, shift_start, shift_end, weekend_days FROM employees WHERE id = $1', [req.params.id])
      : await pool.query('SELECT shift, shift_start, shift_end FROM employees WHERE id = $1', [req.params.id]);
    if (!employee.rows.length) return res.status(404).json({ error: 'Employee not found' });

    const employeeRecord = employee.rows[0];
    const isWeekendAttendance = isWeekendDate(employeeRecord, date) && Boolean(check_in || check_out);
    const workedMinutes = calculateWorkedMinutes(check_in, check_out);
    const metrics = isWeekendAttendance
      ? {
        late_minutes: 0,
        early_leave_minutes: 0,
        overtime_minutes: workedMinutes || 0,
      }
      : calculateShiftMetrics(employeeRecord, check_in, check_out);
    const resolvedHoursWorked = calculateHoursWorked(check_in, check_out, hours_worked);
    const resolvedLateMinutes = isWeekendAttendance
      ? 0
      : (Number.isFinite(Number(late_minutes)) ? Number(late_minutes) : metrics.late_minutes);
    const resolvedEarlyLeaveMinutes = isWeekendAttendance
      ? 0
      : (Number.isFinite(Number(early_leave_minutes)) ? Number(early_leave_minutes) : metrics.early_leave_minutes);
    const resolvedOvertimeMinutes = isWeekendAttendance
      ? (workedMinutes || 0)
      : (Number.isFinite(Number(overtime_minutes)) ? Number(overtime_minutes) : metrics.overtime_minutes);
    const resolvedStatus = isWeekendAttendance
      ? 'present'
      : ((status === 'present' || status === 'late')
        ? (resolvedLateMinutes > 0 ? 'late' : 'present')
        : status);
    const resolvedNotes = isWeekendAttendance ? WEEKEND_PRESENT_NOTE : notes;
    const existing = await pool.query(
      'SELECT id FROM attendance WHERE employee_id = $1 AND date = $2',
      [req.params.id, date]
    );

    if (existing.rows.length) {
      const updated = await pool.query(
        `UPDATE attendance
         SET check_in=$1, check_out=$2, hours_worked=$3, status=$4, notes=$5,
             late_minutes=$6, early_leave_minutes=$7, overtime_minutes=$8
         WHERE employee_id=$9 AND date=$10 RETURNING *`,
        [
          check_in,
          check_out,
          resolvedHoursWorked,
          resolvedStatus,
          resolvedNotes,
          resolvedLateMinutes,
          resolvedEarlyLeaveMinutes,
          resolvedOvertimeMinutes,
          req.params.id,
          date,
        ]
      );
      return res.json(updated.rows[0]);
    }

    const inserted = await pool.query(
      `INSERT INTO attendance (
        employee_id, date, check_in, check_out, hours_worked, status, notes,
        late_minutes, early_leave_minutes, overtime_minutes
      )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [
        req.params.id,
        date,
        check_in,
        check_out,
        resolvedHoursWorked,
        resolvedStatus,
        resolvedNotes,
        resolvedLateMinutes,
        resolvedEarlyLeaveMinutes,
        resolvedOvertimeMinutes,
      ]
    );
    res.status(201).json(inserted.rows[0]);
  } catch (err) { next(err); }
};

// GET /api/employees/:id/attendance
const getAttendance = async (req, res, next) => {
  try {
    const { month, year } = req.query;
    let query = `
      SELECT
        id,
        employee_id,
        date::text AS date,
        check_in,
        check_out,
        hours_worked,
        late_minutes,
        early_leave_minutes,
        overtime_minutes,
        status,
        notes
      FROM attendance
      WHERE employee_id = $1
    `;
    const params = [req.params.id];
    if (month && year) {
      query += ` AND EXTRACT(MONTH FROM date) = $2 AND EXTRACT(YEAR FROM date) = $3`;
      params.push(month, year);
    }
    query += ' ORDER BY date DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) { next(err); }
};

// GET /api/departments
const getDepartments = async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM departments ORDER BY name');
    res.json(result.rows);
  } catch (err) { next(err); }
};

module.exports = { getAll, getOne, create, update, remove, logAttendance, getAttendance, getDepartments };
