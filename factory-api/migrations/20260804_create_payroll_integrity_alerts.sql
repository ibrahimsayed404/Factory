-- Migration: 20260804_create_payroll_integrity_alerts.sql
-- Description: Create dedicated table payroll_integrity_alerts to record daily automated 
--              reconciliation mismatches between stored payroll and live recalculation.

CREATE TABLE IF NOT EXISTS payroll_integrity_alerts (
  id SERIAL PRIMARY KEY,
  week_start DATE NOT NULL,
  payroll_id INT REFERENCES payroll(id) ON DELETE CASCADE,
  employee_id INT REFERENCES employees(id) ON DELETE SET NULL,
  employee_name VARCHAR(150),
  stored_net NUMERIC(10,2) NOT NULL,
  recomputed_net NUMERIC(10,2) NOT NULL,
  difference NUMERIC(10,2) NOT NULL,
  status VARCHAR(30) DEFAULT 'unresolved', -- unresolved, acknowledged, resolved
  notes TEXT,
  detected_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payroll_integrity_alerts_status ON payroll_integrity_alerts(status);
CREATE INDEX IF NOT EXISTS idx_payroll_integrity_alerts_week ON payroll_integrity_alerts(week_start);
