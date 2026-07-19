const hrService = require('../services/hrService');
const storageService = require('../services/storageService');

exports.getPositions = async (req, res, next) => {
  try {
    const data = await hrService.getPositions();
    res.json(data);
  } catch (err) { next(err); }
};

exports.createPosition = async (req, res, next) => {
  try {
    const data = await hrService.createPosition(req.body);
    res.status(201).json(data);
  } catch (err) { next(err); }
};

exports.getShifts = async (req, res, next) => {
  try {
    const data = await hrService.getShifts();
    res.json(data);
  } catch (err) { next(err); }
};

exports.createShift = async (req, res, next) => {
  try {
    const data = await hrService.createShift(req.body);
    res.status(201).json(data);
  } catch (err) { next(err); }
};

exports.getLeaves = async (req, res, next) => {
  try {
    const data = await hrService.getLeaves(req.query.employee_id);
    res.json(data);
  } catch (err) { next(err); }
};

exports.createLeave = async (req, res, next) => {
  try {
    const data = await hrService.createLeave(req.body);
    res.status(201).json(data);
  } catch (err) { next(err); }
};

exports.updateLeaveStatus = async (req, res, next) => {
  try {
    const data = await hrService.updateLeaveStatus(req.params.id, req.body.status);
    res.json(data);
  } catch (err) { next(err); }
};

exports.getTransactions = async (req, res, next) => {
  try {
    const data = await hrService.getTransactions(req.query.employee_id);
    res.json(data);
  } catch (err) { next(err); }
};

exports.createTransaction = async (req, res, next) => {
  try {
    const data = await hrService.createTransaction(req.body);
    res.status(201).json(data);
  } catch (err) { next(err); }
};

exports.deleteTransaction = async (req, res, next) => {
  try {
    const data = await hrService.deleteTransaction(req.params.id);
    res.json(data);
  } catch (err) { next(err); }
};

exports.getLoans = async (req, res, next) => {
  try {
    const data = await hrService.getLoans(req.query.employee_id);
    res.json(data);
  } catch (err) { next(err); }
};

exports.createLoan = async (req, res, next) => {
  try {
    const data = await hrService.createLoan(req.body);
    res.status(201).json(data);
  } catch (err) { next(err); }
};

exports.updateLoan = async (req, res, next) => {
  try {
    const data = await hrService.updateLoan(req.params.id, req.body);
    res.json(data);
  } catch (err) { next(err); }
};

exports.getDocuments = async (req, res, next) => {
  try {
    const data = await hrService.getDocuments(req.params.employeeId);
    res.json(data);
  } catch (err) { next(err); }
};

exports.uploadDocument = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    // Upload to Supabase cloud if configured
    await storageService.uploadToCloud(req.file, 'hr-documents');
    const documentType = req.body.document_type || 'Other';
    const data = await hrService.uploadDocument(req.params.employeeId, documentType, req.file.filename);
    res.status(201).json(data);
  } catch (err) { next(err); }
};
