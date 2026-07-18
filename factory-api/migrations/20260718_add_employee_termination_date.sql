-- Migration: Add termination_date column to employees table & payroll breakdown columns
ALTER TABLE employees ADD COLUMN IF NOT EXISTS termination_date DATE;

-- Safety net: Ensure all payroll breakdown columns exist static in schema now that runtime DDL (ensureWeeklyPayrollColumns) is removed
ALTER TABLE payroll
  ADD COLUMN IF NOT EXISTS week_start DATE,
  ADD COLUMN IF NOT EXISTS week_end DATE,
  ADD COLUMN IF NOT EXISTS loan_deduction NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS manual_bonus NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS manual_deductions NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS auto_bonus NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS auto_deductions NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hr_bonus NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hr_penalty NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hr_overtime NUMERIC(10,2) DEFAULT 0;
