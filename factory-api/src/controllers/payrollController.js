const payrollService = require('../services/payrollService');

const getAll = async (req, res, next) => {
  try {
    const result = await payrollService.getPayroll({
      weekStartInput: req.query.week_start,
      month: req.query.month,
      year: req.query.year,
      status: req.query.status,
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

const generateMonthly = async (req, res, next) => {
  try {
    const result = await payrollService.generateMonthlyPayroll(req.body);
    res.status(201).json(result);
  } catch (err) { next(err); }
};

module.exports = { getAll, create, markPaid, generateMonthly };
