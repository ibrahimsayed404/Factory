-- Migration: 20260928_machines_stage.sql
-- Description: Add the mandatory in-house "machines" (المكن) stage to the operations
--              cycle: Cutting -> Sorting -> Printing (or skip) -> Machines -> Delivery.
-- Additive only: new nullable columns, no data is changed. Orders delivered before
-- this stage existed keep machine columns NULL.

ALTER TABLE production_order_colors
  ADD COLUMN IF NOT EXISTS machine_quantity INT,
  ADD COLUMN IF NOT EXISTS machine_note TEXT;

ALTER TABLE production_orders
  ADD COLUMN IF NOT EXISTS total_machine_quantity INT,
  ADD COLUMN IF NOT EXISTS machine_notes TEXT,
  ADD COLUMN IF NOT EXISTS machines_completed_at TIMESTAMP;

-- When the order entered its current stage (for "days in stage" on the board).
-- Backfilled from the latest stage timestamp each order already has; new
-- orders get NOW() by default. Safe to re-run.
ALTER TABLE production_orders
  ADD COLUMN IF NOT EXISTS stage_entered_at TIMESTAMP;

UPDATE production_orders
SET stage_entered_at = COALESCE(delivered_at, machines_completed_at, print_received_at, print_sent_at, sorted_at, created_at)
WHERE stage_entered_at IS NULL;

ALTER TABLE production_orders
  ALTER COLUMN stage_entered_at SET DEFAULT NOW();
