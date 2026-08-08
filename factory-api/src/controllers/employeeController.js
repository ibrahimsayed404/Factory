const employeeService = require('../services/employeeService');
const auditService = require('../services/auditService');
const {
  runAutoAbsence12PM,
  runAutoCheckoutShiftBased,
} = require('../services/autoAttendanceScheduler');

const getAll = async (req, res, next) => {
  try {
    const result = await employeeService.listEmployees(req.query);
    res.json(result);
  } catch (err) { next(err); }
};

const getOne = async (req, res, next) => {
  try {
    const result = await employeeService.getEmployee(req.params.id);
    res.json(result);
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const result = await employeeService.addEmployee(req.body);
    res.status(201).json(result);
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const result = await employeeService.updateEmployee(req.params.id, req.body);
    res.json(result);
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    const reqContext = auditService.extractReqContext(req);
    await employeeService.removeEmployee(req.params.id, req.user?.id, reqContext);
    res.json({ message: 'Employee terminated successfully' });
  } catch (err) { next(err); }
};

const hardRemove = async (req, res, next) => {
  try {
    const reqContext = auditService.extractReqContext(req);
    await employeeService.hardDeleteEmployee(req.params.id, req.user?.id, reqContext);
    res.json({ message: 'Employee hard-deleted successfully' });
  } catch (err) { next(err); }
};

const logAttendance = async (req, res, next) => {
  try {
    const { record, isUpdate } = await employeeService.logAttendance(req.params.id, req.body);
    if (isUpdate) {
      res.json(record);
    } else {
      res.status(201).json(record);
    }
  } catch (err) { next(err); }
};

const getAttendance = async (req, res, next) => {
  try {
    const { month, year } = req.query;
    const result = await employeeService.getAttendance(req.params.id, month, year);
    res.json(result);
  } catch (err) { next(err); }
};

const getDepartments = async (req, res, next) => {
  try {
    const result = await employeeService.listDepartments();
    res.json(result);
  } catch (err) { next(err); }
};

// Vercel Cron target — marks unpunched active employees absent for today.
// Uses skipGuard=true so minor clock drift on the cron infrastructure never
// causes the 12:00 PM guard to silently return 0.
const triggerAutoAbsence = async (req, res, next) => {
  try {
    const marked = await runAutoAbsence12PM(null, { skipGuard: true });
    res.json({ success: true, marked_absent: marked });
  } catch (err) { next(err); }
};

// Vercel Cron target — auto-closes open check-ins that are past their
// per-shift 1-hour grace window.
const triggerAutoCheckout = async (req, res, next) => {
  try {
    const closed = await runAutoCheckoutShiftBased();
    res.json({ success: true, checked_out: closed });
  } catch (err) { next(err); }
};

module.exports = { getAll, getOne, create, update, remove, hardRemove, logAttendance, getAttendance, getDepartments, triggerAutoAbsence, triggerAutoCheckout };
