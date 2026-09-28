import { api } from '../../api/client';

export const accountingApi = {
  accounts: (params = '') => api.get(`/accounting/accounts${params}`),
  createAccount: (body) => api.post('/accounting/accounts', body),
  cashAccounts: () => api.get('/accounting/cash-accounts'),
  createCashAccount: (body) => api.post('/accounting/cash-accounts', body),
  bankAccounts: () => api.get('/accounting/bank-accounts'),
  createBankAccount: (body) => api.post('/accounting/bank-accounts', body),
  journalEntries: (params = '') => api.get(`/accounting/journal-entries${params}`),
  journalEntry: (id) => api.get(`/accounting/journal-entries/${id}`),
  createJournalEntry: (body) => api.post('/accounting/journal-entries', body),
  generalLedger: (params = '') => api.get(`/accounting/general-ledger${params}`),
  trialBalance: (params = '') => api.get(`/accounting/trial-balance${params}`),
  profitLoss: (params = '') => api.get(`/accounting/profit-loss${params}`),
  balanceSheet: (params = '') => api.get(`/accounting/balance-sheet${params}`),
  createExpense: (body) => api.post('/accounting/expenses', body),
};
