const express = require('express');
const router = express.Router();
const accounting = require('../controllers/accountingController');
const { authenticate, authorizeAdmin } = require('../middleware/auth');
const v = require('../middleware/validation');

router.get('/accounts', authenticate, accounting.listAccounts);
router.post('/accounts', authenticate, authorizeAdmin, v.accountCreate, accounting.createAccount);
router.put('/accounts/:id', authenticate, authorizeAdmin, v.idParam, v.accountUpdate, accounting.updateAccount);

router.get('/cash-accounts', authenticate, accounting.listCashAccounts);
router.post('/cash-accounts', authenticate, authorizeAdmin, accounting.createCashAccount);
router.get('/bank-accounts', authenticate, accounting.listBankAccounts);
router.post('/bank-accounts', authenticate, authorizeAdmin, accounting.createBankAccount);

router.get('/journal-entries', authenticate, accounting.listJournalEntries);
router.get('/journal-entries/:id', authenticate, v.idParam, accounting.getJournalEntry);
router.post('/journal-entries', authenticate, authorizeAdmin, v.journalEntryCreate, accounting.createJournalEntry);

router.get('/general-ledger', authenticate, accounting.getGeneralLedger);
router.get('/trial-balance', authenticate, accounting.getTrialBalance);
router.get('/profit-loss', authenticate, accounting.getProfitLoss);
router.get('/balance-sheet', authenticate, accounting.getBalanceSheet);

router.post('/expenses', authenticate, authorizeAdmin, v.accountingExpenseCreate, accounting.createExpense);

module.exports = router;
