const pool = require('../db/pool');
const employeeRepository = require('../repositories/employeeRepository');
const ApiError = require('../utils/ApiError');
const {
  calculateHoursWorked,
  calculateShiftMetrics,
  calculateWorkedMinutes,
  isWeekendDate,
} = require('../utils/attendanceMetrics');
const { getAttendancePayrollPolicy } = require('../utils/policySettings');

const WEEKEND_PRESENT_NOTE = 'present vacation';

const listEmployees = async ({ status, department_id, page, limit }) => {
  const pageNum  = Math.max(1, parseInt(page, 10) || 1);
  const pageSize = Math.min(1000, Math.max(1, parseInt(limit, 10) || 50));
  const offset   = (pageNum - 1) * pageSize;

  const { data, total } = await employeeRepository.getEmployees({
    status,
    departmentId: department_id,
    limit: pageSize,
    offset
  });

  return {
    data,
    total,
    page: pageNum,
    limit: pageSize
  };
};

const getEmployee = async (id) => {
  const employee = await employeeRepository.getEmployeeById(id);
  if (!employee) throw new ApiError(404, 'Employee not found');
  return employee;
};

const addEmployee = async (data) => {
  return await employeeRepository.createEmployee(data);
};

const updateEmployee = async (id, data) => {
  const employee = await employeeRepository.updateEmployee(id, data);
  if (!employee) throw new ApiError(404, 'Employee not found');
  return employee;
};

const removeEmployee = async (id) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const deleted = await employeeRepository.deleteEmployee(id, client);
    if (!deleted) throw new ApiError(404, 'Employee not found');
    await client.query('COMMIT');
    return deleted;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const logAttendance = async (id, data) => {
  const { date, check_in, check_out, hours_worked, status, notes, late_minutes, early_leave_minutes, overtime_minutes } = data;
  
  const employeeRecord = await employeeRepository.getEmployeeShiftDetails(id);
  if (!employeeRecord) throw new ApiError(404, 'Employee not found');

  const isAbsent = status === 'absent';
  const resolvedCheckIn = isAbsent ? null : (check_in || null);
  const resolvedCheckOut = isAbsent ? null : (check_out || null);

  const policy = await getAttendancePayrollPolicy();
  const isWeekendAttendance = !isAbsent && isWeekendDate(employeeRecord, date) && Boolean(resolvedCheckIn || resolvedCheckOut);
  const workedMinutes = isAbsent ? 0 : calculateWorkedMinutes(resolvedCheckIn, resolvedCheckOut);
  
  const metrics = isAbsent
    ? { late_minutes: 0, early_leave_minutes: 0, overtime_minutes: 0 }
    : (isWeekendAttendance
        ? {
          late_minutes: 0,
          early_leave_minutes: 0,
          overtime_minutes: workedMinutes || 0,
        }
        : calculateShiftMetrics(employeeRecord, resolvedCheckIn, resolvedCheckOut, { lateGraceMinutes: policy.attendanceLateGraceMinutes }));
    
  const resolvedHoursWorked = isAbsent ? null : calculateHoursWorked(resolvedCheckIn, resolvedCheckOut, hours_worked);
  
  const resolvedLateMinutes = isAbsent ? 0 : (isWeekendAttendance
    ? 0
    : (Number.isFinite(Number(late_minutes)) ? Number(late_minutes) : metrics.late_minutes));
    
  const resolvedEarlyLeaveMinutes = isAbsent ? 0 : (isWeekendAttendance
    ? 0
    : (Number.isFinite(Number(early_leave_minutes)) ? Number(early_leave_minutes) : metrics.early_leave_minutes));
    
  const resolvedOvertimeMinutes = isAbsent ? 0 : (isWeekendAttendance
    ? (workedMinutes || 0)
    : (Number.isFinite(Number(overtime_minutes)) ? Number(overtime_minutes) : metrics.overtime_minutes));
    
  const resolvedStatus = isAbsent
    ? 'absent'
    : (isWeekendAttendance
        ? 'present'
        : ((status === 'present' || status === 'late')
          ? (resolvedLateMinutes > 0 ? 'late' : 'present')
          : status));
      
  const resolvedNotes = isWeekendAttendance ? WEEKEND_PRESENT_NOTE : notes;

  const attendanceData = {
    check_in: resolvedCheckIn,
    check_out: resolvedCheckOut,
    hours_worked: resolvedHoursWorked,
    status: resolvedStatus,
    notes: resolvedNotes,
    late_minutes: resolvedLateMinutes,
    early_leave_minutes: resolvedEarlyLeaveMinutes,
    overtime_minutes: resolvedOvertimeMinutes
  };

  const existing = await employeeRepository.getAttendanceRecord(id, date);
  if (existing) {
    return { record: await employeeRepository.updateAttendanceRecord(id, date, attendanceData), isUpdate: true };
  }

  return { record: await employeeRepository.createAttendanceRecord(id, date, attendanceData), isUpdate: false };
};

const getAttendance = async (id, month, year) => {
  return await employeeRepository.getAttendanceHistory(id, month, year);
};

const listDepartments = async () => {
  return await employeeRepository.getAllDepartments();
};

module.exports = {
  listEmployees,
  getEmployee,
  addEmployee,
  updateEmployee,
  removeEmployee,
  logAttendance,
  getAttendance,
  listDepartments,
};
