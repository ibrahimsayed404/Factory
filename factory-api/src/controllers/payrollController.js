const payrollService = require('../services/payrollService');
const { runAutoPayrollForCurrentWeek } = require('../services/autoPayrollScheduler');

const getAll = async (req, res, next) => {
  try {
    const result = await payrollService.getPayroll({
      weekStartInput: req.query.week_start,
      month: req.query.month,
      year: req.query.year,
      status: req.query.status,
      dateFrom: req.query.date_from,
      dateTo: req.query.date_to,
      page: req.query.page,
      limit: req.query.limit,
    });
    res.json(result);
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const result = await payrollService.generatePayroll(req.body);
    res.status(201).json(result);
  } catch (err) { next(err); }
};

const markPaid = async (req, res, next) => {
  try {
    const result = await payrollService.markPaid(req.params.id);
    res.json(result);
  } catch (err) { next(err); }
};

const updateManual = async (req, res, next) => {
  try {
    const result = await payrollService.updateManualAdjustments(req.params.id, req.body);
    res.json(result);
  } catch (err) { next(err); }
};

const deleteWeek = async (req, res, next) => {
  try {
    const result = await payrollService.deletePayrollWeek(req.params.weekStart);
    res.json(result);
  } catch (err) { next(err); }
};

const autoRun = async (req, res, next) => {
  try {
    await runAutoPayrollForCurrentWeek();
    res.json({ success: true, message: 'Auto payroll check completed.' });
  } catch (err) { next(err); }
};

module.exports = { getAll, create, markPaid, updateManual, deleteWeek, autoRun };
