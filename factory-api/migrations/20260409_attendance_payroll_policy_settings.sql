-- 20260409_attendance_payroll_policy_settings.sql
-- Purpose: store attendance/payroll policy values in DB for runtime admin updates.

CREATE TABLE IF NOT EXISTS app_settings (
  key VARCHAR(120) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO app_settings (key, value)
VALUES
  ('attendance_late_grace_minutes', '10'),
  ('payroll_overtime_multiplier', '1.5'),
  ('payroll_vacation_overtime_multiplier', '1'),
  ('payroll_weeks_per_month', '4')
ON CONFLICT (key) DO NOTHING;
