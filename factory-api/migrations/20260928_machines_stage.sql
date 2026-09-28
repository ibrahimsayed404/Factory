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
