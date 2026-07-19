-- 20260718_fix_payroll_weekly_unique_constraint.sql
-- Purpose: Drop monthly-only unique constraint (employee_id, month, year) from payroll table
-- to allow multiple weekly payroll records in the same month/year.

ALTER TABLE payroll DROP CONSTRAINT IF EXISTS payroll_employee_id_month_year_key;

-- Ensure weekly payroll unique constraint exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payroll_employee_id_week_start_key'
  ) THEN
    ALTER TABLE payroll
      ADD CONSTRAINT payroll_employee_id_week_start_key UNIQUE (employee_id, week_start);
  END IF;
END $$;

-- Create partial unique index for legacy monthly payrolls (where week_start is NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_payroll_employee_month_year_monthly
  ON payroll (employee_id, month, year)
  WHERE week_start IS NULL;
