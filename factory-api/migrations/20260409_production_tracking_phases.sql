-- 20260409_production_tracking_phases.sql
-- Purpose: add multi-phase production tracking support (input/sorting/final).

ALTER TABLE production_orders
  ADD COLUMN IF NOT EXISTS model_number VARCHAR(100),
  ADD COLUMN IF NOT EXISTS planned_quantity INT;

UPDATE production_orders
SET model_number = COALESCE(model_number, product_name)
WHERE model_number IS NULL;

UPDATE production_orders
SET planned_quantity = COALESCE(planned_quantity, quantity)
WHERE planned_quantity IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'production_phase_name'
  ) THEN
    CREATE TYPE production_phase_name AS ENUM ('input', 'sorting', 'final');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS production_phases (
  id SERIAL PRIMARY KEY,
  order_id INT NOT NULL REFERENCES production_orders(id) ON DELETE CASCADE,
  phase_name production_phase_name NOT NULL,
  quantity INT NOT NULL CHECK (quantity >= 0),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_production_phases_order_phase_created
  ON production_phases(order_id, phase_name, created_at DESC);
