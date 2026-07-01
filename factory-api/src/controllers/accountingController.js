const accountingService = require('../services/accountingService');

const listAccounts = async (req, res, next) => {
  try {
    res.json(await accountingService.listAccounts(req.query));
  } catch (err) { next(err); }
};

const createAccount = async (req, res, next) => {
  try {
    res.status(201).json(await accountingService.createAccount(req.body));
  } catch (err) { next(err); }
};

const updateAccount = async (req, res, next) => {
  try {
    res.json(await accountingService.updateAccount(req.params.id, req.body));
  } catch (err) { next(err); }
};

const listCashAccounts = async (req, res, next) => {
  try {
    res.json(await accountingService.listCashAccounts());
  } catch (err) { next(err); }
};

const createCashAccount = async (req, res, next) => {
  try {
    res.status(201).json(await accountingService.createCashAccount(req.body));
  } catch (err) { next(err); }
};

const listBankAccounts = async (req, res, next) => {
  try {
    res.json(await accountingService.listBankAccounts());
  } catch (err) { next(err); }
};

const createBankAccount = async (req, res, next) => {
  try {
    res.status(201).json(await accountingService.createBankAccount(req.body));
  } catch (err) { next(err); }
};

const listJournalEntries = async (req, res, next) => {
  try {
    res.json(await accountingService.listJournalEntries(req.query));
  } catch (err) { next(err); }
};

const getJournalEntry = async (req, res, next) => {
  try {
    res.json(await accountingService.getJournalEntry(req.params.id));
  } catch (err) { next(err); }
};

const createJournalEntry = async (req, res, next) => {
  try {
    const entry = await accountingService.postJournalEntry({
      ...req.body,
      source_type: req.body.source_type || 'manual',
      source_id: req.body.source_id ?? 0,
      created_by: req.user.id,
      idempotent: false,
    });
    res.status(201).json(entry);
  } catch (err) { next(err); }
};

const getGeneralLedger = async (req, res, next) => {
  try {
    res.json(await accountingService.getGeneralLedger(req.query));
  } catch (err) { next(err); }
};

const getTrialBalance = async (req, res, next) => {
  try {
    res.json(await accountingService.getTrialBalance(req.query));
  } catch (err) { next(err); }
};

const getProfitLoss = async (req, res, next) => {
  try {
    res.json(await accountingService.getProfitLoss(req.query));
  } catch (err) { next(err); }
};

const getBalanceSheet = async (req, res, next) => {
  try {
    res.json(await accountingService.getBalanceSheet(req.query));
  } catch (err) { next(err); }
};

const createExpense = async (req, res, next) => {
  try {
    res.status(201).json(await accountingService.createExpense(req.user.id, req.body));
  } catch (err) { next(err); }
};

module.exports = {
  listAccounts,
  createAccount,
  updateAccount,
  listCashAccounts,
  createCashAccount,
  listBankAccounts,
  createBankAccount,
  listJournalEntries,
  getJournalEntry,
  createJournalEntry,
  getGeneralLedger,
  getTrialBalance,
  getProfitLoss,
  getBalanceSheet,
  createExpense,
};
