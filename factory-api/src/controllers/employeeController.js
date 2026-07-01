const employeeService = require('../services/employeeService');

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
    await employeeService.removeEmployee(req.params.id);
    res.json({ message: 'Deleted successfully' });
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

module.exports = { getAll, getOne, create, update, remove, logAttendance, getAttendance, getDepartments };
