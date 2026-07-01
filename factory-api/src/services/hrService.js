const pool = require('../db/pool');
const ApiError = require('../utils/ApiError');

// Positions
exports.getPositions = async () => {
  const result = await pool.query(`
    SELECT p.*, d.name as department_name 
    FROM hr_positions p
    LEFT JOIN departments d ON p.department_id = d.id
    ORDER BY p.title
  `);
  return result.rows;
};

exports.createPosition = async (data) => {
  const { department_id, title, base_salary } = data;
  const result = await pool.query(
    'INSERT INTO hr_positions (department_id, title, base_salary) VALUES ($1, $2, $3) RETURNING *',
    [department_id || null, title, base_salary || 0]
  );
  return result.rows[0];
};

// Shifts
exports.getShifts = async () => {
  const result = await pool.query('SELECT * FROM hr_shifts ORDER BY name');
  return result.rows;
};

exports.createShift = async (data) => {
  const { name, start_time, end_time, weekend_days } = data;
  const result = await pool.query(
    'INSERT INTO hr_shifts (name, start_time, end_time, weekend_days) VALUES ($1, $2, $3, $4) RETURNING *',
    [name, start_time, end_time, weekend_days || '0,6']
  );
  return result.rows[0];
};

// Leaves
exports.getLeaves = async (employeeId) => {
  let query = `
    SELECT l.*, e.name as employee_name 
    FROM hr_leave_requests l
    JOIN employees e ON l.employee_id = e.id
  `;
  const params = [];
  if (employeeId) {
    query += ` WHERE l.employee_id = $1`;
    params.push(employeeId);
  }
  query += ` ORDER BY l.start_date DESC`;
  const result = await pool.query(query, params);
  return result.rows;
};

exports.createLeave = async (data) => {
  const { employee_id, leave_type, start_date, end_date, reason } = data;
  const result = await pool.query(
    'INSERT INTO hr_leave_requests (employee_id, leave_type, start_date, end_date, reason) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [employee_id, leave_type, start_date, end_date, reason]
  );
  return result.rows[0];
};

exports.updateLeaveStatus = async (id, status) => {
  const result = await pool.query(
    'UPDATE hr_leave_requests SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
    [status, id]
  );
  if (result.rows.length === 0) throw new ApiError(404, 'Leave request not found');
  return result.rows[0];
};

// Transactions (Bonuses, Penalties, Overtime)
exports.getTransactions = async (employeeId) => {
  let query = `
    SELECT t.*, e.name as employee_name 
    FROM hr_transactions t
    JOIN employees e ON t.employee_id = e.id
  `;
  const params = [];
  if (employeeId) {
    query += ` WHERE t.employee_id = $1`;
    params.push(employeeId);
  }
  query += ` ORDER BY t.transaction_date DESC`;
  const result = await pool.query(query, params);
  return result.rows;
};

exports.createTransaction = async (data) => {
  const { employee_id, transaction_type, amount, transaction_date, notes } = data;
  const result = await pool.query(
    'INSERT INTO hr_transactions (employee_id, transaction_type, amount, transaction_date, notes) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [employee_id, transaction_type, amount, transaction_date, notes]
  );
  return result.rows[0];
};

exports.deleteTransaction = async (id) => {
  const result = await pool.query('DELETE FROM hr_transactions WHERE id = $1 RETURNING *', [id]);
  if (result.rows.length === 0) throw new ApiError(404, 'Transaction not found');
  return result.rows[0];
};

// Loans
exports.getLoans = async (employeeId) => {
  let query = `
    SELECT l.*, e.name as employee_name 
    FROM hr_loans l
    JOIN employees e ON l.employee_id = e.id
  `;
  const params = [];
  if (employeeId) {
    query += ` WHERE l.employee_id = $1`;
    params.push(employeeId);
  }
  query += ` ORDER BY l.created_at DESC`;
  const result = await pool.query(query, params);
  return result.rows;
};

exports.createLoan = async (data) => {
  const { employee_id, principal_amount, monthly_installment } = data;
  const result = await pool.query(
    'INSERT INTO hr_loans (employee_id, principal_amount, remaining_amount, monthly_installment) VALUES ($1, $2, $3, $4) RETURNING *',
    [employee_id, principal_amount, principal_amount, monthly_installment]
  );
  return result.rows[0];
};

// Documents
exports.getDocuments = async (employeeId) => {
  const result = await pool.query('SELECT * FROM hr_employee_documents WHERE employee_id = $1 ORDER BY uploaded_at DESC', [employeeId]);
  return result.rows;
};

exports.uploadDocument = async (employeeId, documentType, filePath) => {
  const result = await pool.query(
    'INSERT INTO hr_employee_documents (employee_id, document_type, file_path) VALUES ($1, $2, $3) RETURNING *',
    [employeeId, documentType, filePath]
  );
  return result.rows[0];
};
