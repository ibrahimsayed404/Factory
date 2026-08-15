-- ============================================================
-- MIGRATION: Payroll Employee Snapshot Columns
-- Date: 2026-08-15
-- Description:
--   1. Add 7 snapshot columns to the payroll table to freeze employee
--      data at generation time, preventing salary/shift drift on read.
--   2. Backfill existing rows:
--      - snapshot_salary from base_salary (correct historical value)
--      - Other 6 fields from live employee data (best available source)
--
-- SAFETY: All operations are additive (ADD COLUMN IF NOT EXISTS).
--         The UPDATE is a backfill, not a destructive operation.
--         No columns are dropped, renamed, or altered.
-- ============================================================

-- 1. Add snapshot columns (all nullable, no default — won't affect existing queries)
ALTER TABLE payroll ADD COLUMN IF NOT EXISTS snapshot_salary NUMERIC(10,2);
ALTER TABLE payroll ADD COLUMN IF NOT EXISTS snapshot_shift VARCHAR(30);
ALTER TABLE payroll ADD COLUMN IF NOT EXISTS snapshot_shift_start TIME;
ALTER TABLE payroll ADD COLUMN IF NOT EXISTS snapshot_shift_end TIME;
ALTER TABLE payroll ADD COLUMN IF NOT EXISTS snapshot_weekend_days VARCHAR(20);
ALTER TABLE payroll ADD COLUMN IF NOT EXISTS snapshot_hire_date DATE;
ALTER TABLE payroll ADD COLUMN IF NOT EXISTS snapshot_termination_date DATE;

-- 2. Backfill existing rows
--    snapshot_salary comes from base_salary (already correct at generation time),
--    NOT from live e.salary (which may have drifted).
--    The other 6 fields come from live employee data (no prior snapshot existed).
UPDATE payroll p
SET
  snapshot_salary          = p.base_salary,
  snapshot_shift           = e.shift,
  snapshot_shift_start     = e.shift_start,
  snapshot_shift_end       = e.shift_end,
  snapshot_weekend_days    = COALESCE(e.weekend_days, '5'),
  snapshot_hire_date       = e.hire_date,
  snapshot_termination_date = e.termination_date
FROM employees e
WHERE p.employee_id = e.id
  AND p.snapshot_salary IS NULL;
