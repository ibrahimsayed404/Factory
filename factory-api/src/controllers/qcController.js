const qcService = require('../services/qcService');

exports.getDefectCategories = async (req, res, next) => {
  try {
    const categories = await qcService.getDefectCategories();
    res.json(categories);
  } catch (err) {
    next(err);
  }
};

exports.getAll = async (req, res, next) => {
  try {
    const filters = {
      status: req.query.status,
      inspection_type: req.query.inspection_type,
      reference_type: req.query.reference_type,
      reference_id: req.query.reference_id,
    };
    const inspections = await qcService.getAll(filters);
    res.json(inspections);
  } catch (err) {
    next(err);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const inspection = await qcService.getById(req.params.id);
    res.json(inspection);
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const pool = require('../db/pool');
    const userRes = await pool.query('SELECT email FROM users WHERE id = $1', [req.user.id]);
    let inspectorId = null;
    if (userRes.rows[0]) {
      const empRes = await pool.query('SELECT id FROM employees WHERE email = $1', [userRes.rows[0].email]);
      if (empRes.rows[0]) inspectorId = empRes.rows[0].id;
    }

    const inspection = await qcService.create(req.body, inspectorId);
    res.status(201).json(inspection);
  } catch (err) {
    next(err);
  }
};

exports.updateResults = async (req, res, next) => {
  try {
    const inspection = await qcService.updateResults(req.params.id, req.body);
    res.json(inspection);
  } catch (err) {
    next(err);
  }
};

exports.addPhoto = async (req, res, next) => {
  try {
    if (!req.file) throw new Error('No photo provided');
    const photo = await qcService.addPhoto(req.params.id, req.file);
    res.status(201).json(photo);
  } catch (err) {
    next(err);
  }
};

exports.getReports = async (req, res, next) => {
  try {
    const reports = await qcService.getReports();
    res.json(reports);
  } catch (err) {
    next(err);
  }
};
