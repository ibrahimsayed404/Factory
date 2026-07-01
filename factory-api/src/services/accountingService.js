const { randomBytes } = require('node:crypto');
const pool = require('../db/pool');
const accountingRepository = require('../repositories/accountingRepository');
const ApiError = require('../utils/ApiError');

const ACCOUNTS = {
  cash: '1000',
  bank: '1010',
  accountsReceivable: '1100',
  inventory: '1200',
  workInProcess: '1300',
  accountsPayable: '2000',
  salesTaxPayable: '2100',
  payrollPayable: '2200',
  salesRevenue: '4000',
  salesReturns: '4100',
  costOfGoodsSold: '5000',
  payrollExpense: '5200',
  productionOverhead: '5300',
  inventoryAdjustments: '5400',
  operatingExpenses: '6000',
};

const round2 = (value) => Number(Number(value || 0).toFixed(2));

const buildNumber = (prefix) => {
  const ts = Date.now().toString().slice(-8);
  const rand = randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}-${ts}-${rand}`;
};

const withClient = async (externalClient, fn) => {
  if (externalClient) return fn(externalClient);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const resolveAccount = async (line, client) => {
  let account = null;
  if (line.account_id) account = await accountingRepository.getAccountById(line.account_id, client);
  if (!account && line.account_code) account = await accountingRepository.getAccountByCode(line.account_code, client);
  if (!account) throw new ApiError(400, `Invalid account: ${line.account_code || line.account_id}`);
  if (!account.is_active) throw new ApiError(400, `Inactive account: ${account.code}`);
  return account;
};

const normalizeLines = async (lines, client) => {
  if (!Array.isArray(lines) || lines.length < 2) {
    throw new ApiError(400, 'A journal entry requires at least two lines');
  }

  const normalized = [];
  for (const line of lines) {
    const debit = round2(line.debit);
    const credit = round2(line.credit);
    if (debit < 0 || credit < 0) throw new ApiError(400, 'Debit and credit values must be positive');
    if (debit > 0 && credit > 0) throw new ApiError(400, 'A line cannot contain both debit and credit');
    if (debit === 0 && credit === 0) continue;

    const account = await resolveAccount(line, client);
    normalized.push({
      ...line,
      account_id: account.id,
      account_code: account.code,
      account_name: account.name,
      debit,
      credit,
    });
  }

  const totalDebit = round2(normalized.reduce((sum, line) => sum + line.debit, 0));
  const totalCredit = round2(normalized.reduce((sum, line) => sum + line.credit, 0));
  if (normalized.length < 2 || totalDebit !== totalCredit) {
    throw new ApiError(400, `Journal entry is not balanced. Debit ${totalDebit}, credit ${totalCredit}`);
  }

  return { lines: normalized, totalDebit, totalCredit };
};

const postJournalEntry = async (data, externalClient = null) => withClient(externalClient, async (client) => {
  const idempotent = data.idempotent !== false;
  if (idempotent && data.source_type && data.source_id !== undefined && data.source_id !== null) {
    const existing = await accountingRepository.getExistingJournalEntry(data.source_type, data.source_id, client);
    if (existing) return { ...existing, skipped_duplicate: true };
  }

  const { lines } = await normalizeLines(data.lines, client);
  let entry = null;
  for (let i = 0; i < 5; i += 1) {
    try {
      entry = await accountingRepository.insertJournalEntry(client, {
        entry_number: data.entry_number || buildNumber('JE'),
        entry_date: data.entry_date,
        description: data.description,
        source_type: data.source_type || 'manual',
        source_id: data.source_id ?? 0,
        memo: data.memo,
        status: data.status || 'posted',
        created_by: data.created_by,
      });
      break;
    } catch (err) {
      if (err.code !== '23505') throw err;
    }
  }
  if (!entry) throw new ApiError(500, 'Could not generate unique journal entry number');

  const savedLines = [];
  for (const line of lines) {
    savedLines.push(await accountingRepository.insertJournalLine(client, {
      ...line,
      journal_entry_id: entry.id,
    }));
  }

  return { ...entry, lines: savedLines };
});

const listAccounts = (filters) => accountingRepository.listAccounts(filters);

const createAccount = async (data) => {
  if (!['asset', 'liability', 'equity', 'revenue', 'expense'].includes(data.account_type)) {
    throw new ApiError(400, 'Invalid account type');
  }
  return accountingRepository.createAccount(data);
};

const updateAccount = async (id, data) => {
  const account = await accountingRepository.updateAccount(id, data);
  if (!account) throw new ApiError(404, 'Account not found');
  return account;
};

const listCashAccounts = () => accountingRepository.listCashAccounts();
const listBankAccounts = () => accountingRepository.listBankAccounts();

const createCashAccount = async (data) => withClient(null, async (client) => {
  let accountId = data.account_id;
  if (!accountId) {
    const account = await accountingRepository.createAccount({
      code: data.code,
      name: data.name,
      account_type: 'asset',
      is_cash: true,
      opening_balance: data.opening_balance || 0,
    }, client);
    accountId = account.id;
  }
  return accountingRepository.createCashAccount({ ...data, account_id: accountId }, client);
});

const createBankAccount = async (data) => withClient(null, async (client) => {
  let accountId = data.account_id;
  if (!accountId) {
    const account = await accountingRepository.createAccount({
      code: data.code,
      name: data.account_name || data.bank_name,
      account_type: 'asset',
      is_bank: true,
      opening_balance: data.opening_balance || 0,
    }, client);
    accountId = account.id;
  }
  return accountingRepository.createBankAccount({ ...data, account_id: accountId }, client);
});

const listJournalEntries = (filters) => accountingRepository.listJournalEntries(filters);
const getJournalEntry = async (id) => {
  const entry = await accountingRepository.getJournalEntryById(id);
  if (!entry) throw new ApiError(404, 'Journal entry not found');
  return entry;
};

const getGeneralLedger = async (filters) => {
  const rows = await accountingRepository.getLedgerRows(filters);
  let running = 0;
  return rows.map((row) => {
    running = round2(running + Number(row.debit || 0) - Number(row.credit || 0));
    return { ...row, running_balance: running };
  });
};

const getTrialBalance = async (filters) => {
  const rows = await accountingRepository.getTrialBalanceRows(filters);
  let totalDebit = 0;
  let totalCredit = 0;
  const accounts = rows.map((row) => {
    const signed = round2(Number(row.opening_balance || 0) + Number(row.debit || 0) - Number(row.credit || 0));
    const debit_balance = signed > 0 ? signed : 0;
    const credit_balance = signed < 0 ? Math.abs(signed) : 0;
    totalDebit += debit_balance;
    totalCredit += credit_balance;
    return { ...row, debit_balance, credit_balance };
  });
  return {
    accounts,
    total_debit: round2(totalDebit),
    total_credit: round2(totalCredit),
    balanced: round2(totalDebit) === round2(totalCredit),
  };
};

const getProfitLoss = async (filters) => {
  const rows = await accountingRepository.getProfitLossRows(filters);
  const revenue = [];
  const expenses = [];
  for (const row of rows) {
    if (row.account_type === 'revenue') {
      revenue.push({ ...row, amount: round2(Number(row.credit || 0) - Number(row.debit || 0)) });
    } else {
      expenses.push({ ...row, amount: round2(Number(row.debit || 0) - Number(row.credit || 0)) });
    }
  }
  const totalRevenue = round2(revenue.reduce((sum, row) => sum + row.amount, 0));
  const totalExpenses = round2(expenses.reduce((sum, row) => sum + row.amount, 0));
  return {
    revenue,
    expenses,
    total_revenue: totalRevenue,
    total_expenses: totalExpenses,
    net_income: round2(totalRevenue - totalExpenses),
  };
};

const getBalanceSheet = async (filters) => {
  const rows = await accountingRepository.getBalanceSheetRows(filters);
  const assets = [];
  const liabilities = [];
  const equity = [];
  let retainedEarnings = 0;

  for (const row of rows) {
    const debitCredit = Number(row.opening_balance || 0) + Number(row.debit || 0) - Number(row.credit || 0);
    if (row.account_type === 'asset') assets.push({ ...row, amount: round2(debitCredit) });
    if (row.account_type === 'liability') liabilities.push({ ...row, amount: round2(-debitCredit) });
    if (row.account_type === 'equity') equity.push({ ...row, amount: round2(-debitCredit) });
    if (row.account_type === 'revenue') retainedEarnings += -debitCredit;
    if (row.account_type === 'expense') retainedEarnings -= debitCredit;
  }

  const totalAssets = round2(assets.reduce((sum, row) => sum + row.amount, 0));
  const totalLiabilities = round2(liabilities.reduce((sum, row) => sum + row.amount, 0));
  const totalEquityBase = round2(equity.reduce((sum, row) => sum + row.amount, 0));
  const retained = round2(retainedEarnings);
  const totalEquity = round2(totalEquityBase + retained);

  return {
    assets,
    liabilities,
    equity: [...equity, { code: 'RE', name: 'Retained Earnings', account_type: 'equity', amount: retained }],
    total_assets: totalAssets,
    total_liabilities: totalLiabilities,
    total_equity: totalEquity,
    total_liabilities_and_equity: round2(totalLiabilities + totalEquity),
    balanced: totalAssets === round2(totalLiabilities + totalEquity),
  };
};

const createExpense = async (userId, data) => withClient(null, async (client) => {
  const expenseAccount = data.account_id
    ? await accountingRepository.getAccountById(data.account_id, client)
    : await accountingRepository.getAccountByCode(data.account_code || ACCOUNTS.operatingExpenses, client);
  const paidAccount = data.paid_from_account_id
    ? await accountingRepository.getAccountById(data.paid_from_account_id, client)
    : await accountingRepository.getAccountByCode(data.paid_from_account_code || ACCOUNTS.bank, client);

  if (!expenseAccount || expenseAccount.account_type !== 'expense') {
    throw new ApiError(400, 'Expense account must be an active expense account');
  }
  if (!paidAccount || paidAccount.account_type !== 'asset') {
    throw new ApiError(400, 'Paid-from account must be an asset account');
  }

  const expense = await accountingRepository.createExpenseRecord(client, {
    ...data,
    expense_number: data.expense_number || buildNumber('EXP'),
    account_id: expenseAccount.id,
    paid_from_account_id: paidAccount.id,
    created_by: userId,
  });

  await postJournalEntry({
    entry_date: expense.expense_date,
    source_type: 'expense',
    source_id: expense.id,
    description: `Expense ${expense.expense_number}`,
    created_by: userId,
    lines: [
      { account_id: expenseAccount.id, debit: expense.amount, line_memo: expense.notes },
      { account_id: paidAccount.id, credit: expense.amount, line_memo: expense.notes },
    ],
  }, client);

  return expense;
});

const postSalesInvoice = (invoice, client = null) => {
  const total = round2(invoice.total_amount);
  if (total <= 0) return null;
  const tax = round2(invoice.tax_amount);
  const revenue = round2(total - tax);
  const lines = [
    { account_code: ACCOUNTS.accountsReceivable, debit: total, customer_id: invoice.customer_id },
    { account_code: ACCOUNTS.salesRevenue, credit: revenue, customer_id: invoice.customer_id },
  ];
  if (tax > 0) lines.push({ account_code: ACCOUNTS.salesTaxPayable, credit: tax, customer_id: invoice.customer_id });
  return postJournalEntry({
    entry_date: invoice.invoice_date || invoice.order_date,
    source_type: invoice.invoice_number ? 'sales_invoice' : 'sales_order',
    source_id: invoice.id,
    description: invoice.invoice_number ? `Sales invoice ${invoice.invoice_number}` : `Sales order ${invoice.order_number}`,
    created_by: invoice.created_by,
    lines,
  }, client);
};

const postCustomerPayment = (payment, client = null) => {
  const amount = round2(payment.amount);
  if (amount <= 0) return null;
  const cashCode = payment.payment_method === 'cash' ? ACCOUNTS.cash : ACCOUNTS.bank;
  return postJournalEntry({
    entry_date: payment.payment_date,
    source_type: 'customer_payment',
    source_id: payment.id,
    description: `Customer payment ${payment.id}`,
    created_by: payment.created_by,
    lines: [
      { account_code: cashCode, debit: amount, customer_id: payment.customer_id },
      { account_code: ACCOUNTS.accountsReceivable, credit: amount, customer_id: payment.customer_id },
    ],
  }, client);
};

const postSalesCredit = (credit, client = null) => {
  const amount = round2(credit.total_amount || credit.amount);
  if (amount <= 0) return null;
  return postJournalEntry({
    entry_date: credit.credit_date || credit.return_date,
    source_type: credit.credit_note_number ? 'credit_note' : 'sales_return',
    source_id: credit.id,
    description: credit.credit_note_number ? `Credit note ${credit.credit_note_number}` : `Sales return ${credit.return_number}`,
    created_by: credit.created_by,
    lines: [
      { account_code: ACCOUNTS.salesReturns, debit: amount, customer_id: credit.customer_id },
      { account_code: ACCOUNTS.accountsReceivable, credit: amount, customer_id: credit.customer_id },
    ],
  }, client);
};

const postPurchaseReceipt = (purchaseOrder, client = null) => {
  const amount = round2(purchaseOrder.total_amount);
  if (amount <= 0) return null;
  return postJournalEntry({
    entry_date: purchaseOrder.actual_delivery_date || new Date().toISOString().slice(0, 10),
    source_type: 'purchase_receipt',
    source_id: purchaseOrder.id,
    description: `Purchase receipt ${purchaseOrder.order_number}`,
    created_by: purchaseOrder.created_by,
    lines: [
      { account_code: ACCOUNTS.inventory, debit: amount },
      { account_code: ACCOUNTS.accountsPayable, credit: amount },
    ],
  }, client);
};

const postSupplierPayment = (payment, client = null) => {
  const amount = round2(payment.amount);
  if (amount <= 0) return null;
  return postJournalEntry({
    entry_date: payment.payment_date,
    source_type: 'supplier_payment',
    source_id: payment.id,
    description: `Supplier payment ${payment.id}`,
    created_by: payment.created_by,
    lines: [
      { account_code: ACCOUNTS.accountsPayable, debit: amount },
      { account_code: ACCOUNTS.bank, credit: amount },
    ],
  }, client);
};

const postPayrollAccrual = (payroll, client = null) => {
  const amount = round2(payroll.net_salary);
  if (amount <= 0) return null;
  return postJournalEntry({
    entry_date: payroll.week_end || new Date().toISOString().slice(0, 10),
    source_type: 'payroll_accrual',
    source_id: payroll.id,
    description: `Payroll accrual ${payroll.id}`,
    lines: [
      { account_code: ACCOUNTS.payrollExpense, debit: amount },
      { account_code: ACCOUNTS.payrollPayable, credit: amount },
    ],
  }, client);
};

const postPayrollPayment = (payroll, client = null) => {
  const amount = round2(payroll.net_salary);
  if (amount <= 0) return null;
  return postJournalEntry({
    entry_date: new Date().toISOString().slice(0, 10),
    source_type: 'payroll_payment',
    source_id: payroll.id,
    description: `Payroll payment ${payroll.id}`,
    lines: [
      { account_code: ACCOUNTS.payrollPayable, debit: amount },
      { account_code: ACCOUNTS.bank, credit: amount },
    ],
  }, client);
};

const getInventoryUnitCost = async (tx, client) => {
  if (tx.item_type === 'material') {
    const result = await client.query('SELECT cost_per_unit FROM materials WHERE id = $1', [tx.item_id]);
    return Number(result.rows[0]?.cost_per_unit || 0);
  }
  const result = await client.query('SELECT default_price FROM products WHERE id = $1', [tx.item_id]);
  return Number(result.rows[0]?.default_price || 0);
};

const postInventoryTransaction = async (tx, client = null) => withClient(client, async (db) => {
  if (!tx || tx.transaction_type === 'reserve' || tx.transaction_type === 'transfer' || tx.reference_type === 'transfer') return null;
  if (tx.reference_type === 'purchase_order') return null;
  if (Number(tx.quantity) > 0 && tx.reference_type === 'production_order') return null;
  const unitCost = await getInventoryUnitCost(tx, db);
  const amount = round2(Math.abs(Number(tx.quantity || 0)) * unitCost);
  if (amount <= 0) return null;

  const isInbound = Number(tx.quantity) > 0;
  let debitAccount = ACCOUNTS.inventory;
  let creditAccount = ACCOUNTS.inventoryAdjustments;

  if (!isInbound && tx.reference_type === 'sales_order') {
    debitAccount = ACCOUNTS.costOfGoodsSold;
    creditAccount = ACCOUNTS.inventory;
  } else if (!isInbound && ['work_order', 'production_order'].includes(tx.reference_type)) {
    debitAccount = ACCOUNTS.workInProcess;
    creditAccount = ACCOUNTS.inventory;
  } else if (isInbound && tx.reference_type === 'production_order') {
    debitAccount = ACCOUNTS.inventory;
    creditAccount = ACCOUNTS.workInProcess;
  } else if (!isInbound) {
    debitAccount = ACCOUNTS.inventoryAdjustments;
    creditAccount = ACCOUNTS.inventory;
  }

  return postJournalEntry({
    entry_date: new Date().toISOString().slice(0, 10),
    source_type: 'inventory_transaction',
    source_id: tx.id,
    description: `Inventory ${tx.transaction_type} ${tx.item_type} ${tx.item_id}`,
    created_by: tx.user_id,
    lines: [
      { account_code: debitAccount, debit: amount },
      { account_code: creditAccount, credit: amount },
    ],
  }, db);
});

const postProductionCompletion = (productionOrder, amount, client = null) => {
  const total = round2(amount);
  if (total <= 0) return null;
  return postJournalEntry({
    entry_date: new Date().toISOString().slice(0, 10),
    source_type: 'production_completion',
    source_id: productionOrder.id,
    description: `Production completion ${productionOrder.order_number}`,
    lines: [
      { account_code: ACCOUNTS.inventory, debit: total },
      { account_code: ACCOUNTS.workInProcess, credit: total },
    ],
  }, client);
};

module.exports = {
  ACCOUNTS,
  postJournalEntry,
  listAccounts,
  createAccount,
  updateAccount,
  listCashAccounts,
  listBankAccounts,
  createCashAccount,
  createBankAccount,
  listJournalEntries,
  getJournalEntry,
  getGeneralLedger,
  getTrialBalance,
  getProfitLoss,
  getBalanceSheet,
  createExpense,
  postSalesInvoice,
  postCustomerPayment,
  postSalesCredit,
  postPurchaseReceipt,
  postSupplierPayment,
  postPayrollAccrual,
  postPayrollPayment,
  postInventoryTransaction,
  postProductionCompletion,
};
