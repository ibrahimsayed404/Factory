-- 20260409_payroll_weekly_periods.sql
-- Purpose: support weekly payroll periods.

ALTER TABLE payroll
  ADD COLUMN IF NOT EXISTS week_start DATE,
  ADD COLUMN IF NOT EXISTS week_end DATE;

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

CREATE INDEX IF NOT EXISTS idx_payroll_week_start_status ON payroll(week_start, status);
