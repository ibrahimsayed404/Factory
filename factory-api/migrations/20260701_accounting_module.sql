-- ============================================================
-- ACCOUNTING MODULE MIGRATION
-- Adds chart of accounts, cash/bank accounts, expenses, and
-- shared double-entry journal metadata.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id SERIAL PRIMARY KEY,
  code VARCHAR(30) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL,
  account_type VARCHAR(30) NOT NULL,
  parent_id INT REFERENCES chart_of_accounts(id) ON DELETE SET NULL,
  is_cash BOOLEAN DEFAULT false,
  is_bank BOOLEAN DEFAULT false,
  is_system BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  opening_balance NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cash_accounts (
  id SERIAL PRIMARY KEY,
  account_id INT NOT NULL UNIQUE REFERENCES chart_of_accounts(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD',
  custodian VARCHAR(150),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bank_accounts (
  id SERIAL PRIMARY KEY,
  account_id INT NOT NULL UNIQUE REFERENCES chart_of_accounts(id) ON DELETE CASCADE,
  bank_name VARCHAR(150) NOT NULL,
  account_number VARCHAR(100),
  iban VARCHAR(100),
  currency VARCHAR(10) DEFAULT 'USD',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS accounting_expenses (
  id SERIAL PRIMARY KEY,
  expense_number VARCHAR(30) UNIQUE NOT NULL,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  account_id INT NOT NULL REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
  paid_from_account_id INT REFERENCES chart_of_accounts(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL,
  vendor VARCHAR(150),
  reference_number VARCHAR(100),
  notes TEXT,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS accounting_journal_entries (
  id SERIAL PRIMARY KEY,
  entry_number VARCHAR(30) UNIQUE NOT NULL,
  entry_date DATE DEFAULT CURRENT_DATE,
  source_type VARCHAR(80) NOT NULL,
  source_id INT NOT NULL,
  memo TEXT,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS accounting_journal_lines (
  id SERIAL PRIMARY KEY,
  journal_entry_id INT NOT NULL REFERENCES accounting_journal_entries(id) ON DELETE CASCADE,
  account_code VARCHAR(30) NOT NULL,
  account_name VARCHAR(150) NOT NULL,
  debit NUMERIC(12,2) DEFAULT 0,
  credit NUMERIC(12,2) DEFAULT 0,
  customer_id INT REFERENCES customers(id) ON DELETE SET NULL
);

ALTER TABLE accounting_journal_entries ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE accounting_journal_entries ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'posted';
ALTER TABLE accounting_journal_entries ADD COLUMN IF NOT EXISTS posted_at TIMESTAMP DEFAULT NOW();

ALTER TABLE accounting_journal_lines ADD COLUMN IF NOT EXISTS account_id INT REFERENCES chart_of_accounts(id) ON DELETE RESTRICT;
ALTER TABLE accounting_journal_lines ADD COLUMN IF NOT EXISTS line_memo TEXT;

INSERT INTO chart_of_accounts (code, name, account_type, is_cash, is_bank, is_system) VALUES
  ('1000', 'Cash on Hand', 'asset', true, false, true),
  ('1010', 'Main Bank Account', 'asset', false, true, true),
  ('1100', 'Accounts Receivable', 'asset', false, false, true),
  ('1200', 'Inventory', 'asset', false, false, true),
  ('1300', 'Work in Process', 'asset', false, false, true),
  ('2000', 'Accounts Payable', 'liability', false, false, true),
  ('2100', 'Sales Tax Payable', 'liability', false, false, true),
  ('2200', 'Payroll Payable', 'liability', false, false, true),
  ('3000', 'Owner Equity', 'equity', false, false, true),
  ('4000', 'Sales Revenue', 'revenue', false, false, true),
  ('4100', 'Sales Returns and Allowances', 'revenue', false, false, true),
  ('5000', 'Cost of Goods Sold', 'expense', false, false, true),
  ('5100', 'Materials Expense', 'expense', false, false, true),
  ('5200', 'Payroll Expense', 'expense', false, false, true),
  ('5300', 'Production Labor and Overhead', 'expense', false, false, true),
  ('5400', 'Inventory Adjustments', 'expense', false, false, true),
  ('6000', 'Operating Expenses', 'expense', false, false, true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO cash_accounts (account_id, name, currency)
SELECT id, 'Main Cash Box', 'USD' FROM chart_of_accounts WHERE code = '1000'
ON CONFLICT (account_id) DO NOTHING;

INSERT INTO bank_accounts (account_id, bank_name, currency)
SELECT id, 'Main Bank', 'USD' FROM chart_of_accounts WHERE code = '1010'
ON CONFLICT (account_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_type ON chart_of_accounts(account_type);
CREATE INDEX IF NOT EXISTS idx_cash_accounts_account_id ON cash_accounts(account_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_account_id ON bank_accounts(account_id);
CREATE INDEX IF NOT EXISTS idx_accounting_expenses_account_id ON accounting_expenses(account_id);
CREATE INDEX IF NOT EXISTS idx_accounting_expenses_date ON accounting_expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_accounting_journal_entries_source ON accounting_journal_entries(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_accounting_journal_entries_date ON accounting_journal_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_accounting_journal_lines_entry ON accounting_journal_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_accounting_journal_lines_account_id ON accounting_journal_lines(account_id);

COMMIT;
