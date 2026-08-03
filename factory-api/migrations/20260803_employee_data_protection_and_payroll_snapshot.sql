-- ============================================================
-- MIGRATION: Employee Data Protection & Payroll Name Snapshot
-- Date: 2026-08-03
-- Description: 
--   1. Add employee_name column to payroll table for historical snapshotting.
--   2. Backfill existing payroll records with current employee names.
--   3. Replace ON DELETE CASCADE with ON DELETE RESTRICT across all HR tables.
-- ============================================================

-- 1. Add employee_name column to payroll table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'payroll' AND column_name = 'employee_name'
    ) THEN
        ALTER TABLE payroll ADD COLUMN employee_name VARCHAR(150);
    END IF;
END $$;

-- 2. Backfill existing payroll records with names from employees table
UPDATE payroll p
SET employee_name = e.name
FROM employees e
WHERE p.employee_id = e.id
  AND (p.employee_name IS NULL OR p.employee_name = '');

-- 3. Replace ON DELETE CASCADE with ON DELETE RESTRICT on HR tables

-- Payroll
ALTER TABLE payroll DROP CONSTRAINT IF EXISTS payroll_employee_id_fkey;
ALTER TABLE payroll ADD CONSTRAINT payroll_employee_id_fkey 
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT;

-- Attendance
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_employee_id_fkey;
ALTER TABLE attendance ADD CONSTRAINT attendance_employee_id_fkey 
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT;

-- HR Transactions (Bonuses, Penalties, Overtime)
ALTER TABLE hr_transactions DROP CONSTRAINT IF EXISTS hr_transactions_employee_id_fkey;
ALTER TABLE hr_transactions ADD CONSTRAINT hr_transactions_employee_id_fkey 
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT;

-- HR Loans
ALTER TABLE hr_loans DROP CONSTRAINT IF EXISTS hr_loans_employee_id_fkey;
ALTER TABLE hr_loans ADD CONSTRAINT hr_loans_employee_id_fkey 
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT;

-- HR Leave Requests
ALTER TABLE hr_leave_requests DROP CONSTRAINT IF EXISTS hr_leave_requests_employee_id_fkey;
ALTER TABLE hr_leave_requests ADD CONSTRAINT hr_leave_requests_employee_id_fkey 
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT;

-- HR Employee Documents
ALTER TABLE hr_employee_documents DROP CONSTRAINT IF EXISTS hr_employee_documents_employee_id_fkey;
ALTER TABLE hr_employee_documents ADD CONSTRAINT hr_employee_documents_employee_id_fkey 
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT;

-- HR Performance Reviews
ALTER TABLE hr_performance_reviews DROP CONSTRAINT IF EXISTS hr_performance_reviews_employee_id_fkey;
ALTER TABLE hr_performance_reviews ADD CONSTRAINT hr_performance_reviews_employee_id_fkey 
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT;

-- HR Salary History
ALTER TABLE hr_salary_history DROP CONSTRAINT IF EXISTS hr_salary_history_employee_id_fkey;
ALTER TABLE hr_salary_history ADD CONSTRAINT hr_salary_history_employee_id_fkey 
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT;
