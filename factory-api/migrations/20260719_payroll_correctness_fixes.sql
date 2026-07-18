-- 20260719_payroll_correctness_fixes.sql
-- Payroll correctness audit fixes.
--
-- 1. Loan-deduction ledger: records the exact amount deducted from each loan for
--    each payroll record, so (a) loan repayment is idempotent across payroll
--    regeneration, and (b) deleting a payroll week reverses exactly what was
--    deducted rather than a recomputed heuristic.

CREATE TABLE IF NOT EXISTS payroll_loan_deductions (
  id SERIAL PRIMARY KEY,
  payroll_id INT NOT NULL REFERENCES payroll(id) ON DELETE CASCADE,
  loan_id INT NOT NULL REFERENCES hr_loans(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (payroll_id, loan_id)
);

CREATE INDEX IF NOT EXISTS idx_payroll_loan_deductions_payroll ON payroll_loan_deductions(payroll_id);
CREATE INDEX IF NOT EXISTS idx_payroll_loan_deductions_loan ON payroll_loan_deductions(loan_id);

-- 2. Unify the employees.weekend_days default to Friday-only ('5') to match the
--    payroll engine and the new-employee form. Older rows created before the
--    weekend_days column existed were backfilled with '0,6' (Sat+Sun), which
--    disagrees with payroll-time weekend detection. Normalize the column default;
--    existing per-employee values are left as-is (they are real data).
ALTER TABLE employees ALTER COLUMN weekend_days SET DEFAULT '5';
