-- 20260409_production_phase_analytics.sql
-- Purpose: add advanced production phase analytics metadata and machine tracking.

CREATE TABLE IF NOT EXISTS machines (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  code VARCHAR(60) UNIQUE,
  status VARCHAR(30) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE production_phases
  ADD COLUMN IF NOT EXISTS loss_reason TEXT,
  ADD COLUMN IF NOT EXISTS employee_id INT,
  ADD COLUMN IF NOT EXISTS machine_id INT,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'production_phases_employee_id_fkey'
  ) THEN
    ALTER TABLE production_phases
      ADD CONSTRAINT production_phases_employee_id_fkey
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'production_phases_machine_id_fkey'
  ) THEN
    ALTER TABLE production_phases
      ADD CONSTRAINT production_phases_machine_id_fkey
      FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_production_phases_order_phase_created
  ON production_phases(order_id, phase_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_production_phases_order_phase_time
  ON production_phases(order_id, phase_name, completed_at DESC);
