-- 20260315_security_and_indexes.sql
-- Purpose: backfill constraints and indexes for existing environments.

-- Remove duplicate attendance rows before adding unique constraint.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY employee_id, date
      ORDER BY id DESC
    ) AS rn
  FROM attendance
)
DELETE FROM attendance a
USING ranked r
WHERE a.id = r.id
  AND r.rn > 1;

-- Ensure one attendance row per employee per date.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'attendance_employee_id_date_key'
  ) THEN
    ALTER TABLE attendance
      ADD CONSTRAINT attendance_employee_id_date_key UNIQUE (employee_id, date);
  END IF;
END $$;

-- Add shift-based attendance metric columns for existing databases.
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS late_minutes INT DEFAULT 0;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS early_leave_minutes INT DEFAULT 0;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS overtime_minutes INT DEFAULT 0;

-- Add employee-specific shift window columns.
ALTER TABLE employees ADD COLUMN IF NOT EXISTS shift_start TIME;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS shift_end TIME;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS weekend_days VARCHAR(20) DEFAULT '0,6';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS device_user_id VARCHAR(100);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'employees_device_user_id_key'
  ) THEN
    ALTER TABLE employees ADD CONSTRAINT employees_device_user_id_key UNIQUE (device_user_id);
  END IF;
END $$;

-- Backfill shift windows based on existing shift labels when missing.
UPDATE employees
SET shift_start = CASE shift
  WHEN 'morning' THEN '09:00'::time
  WHEN 'evening' THEN '14:00'::time
  WHEN 'night' THEN '22:00'::time
  ELSE NULL
END
WHERE shift_start IS NULL;

UPDATE employees
SET shift_end = CASE shift
  WHEN 'morning' THEN '17:00'::time
  WHEN 'evening' THEN '22:00'::time
  WHEN 'night' THEN '06:00'::time
  ELSE NULL
END
WHERE shift_end IS NULL;

CREATE TABLE IF NOT EXISTS attendance_punch_events (
  id SERIAL PRIMARY KEY,
  external_event_id VARCHAR(100) UNIQUE NOT NULL,
  device_id VARCHAR(100),
  device_user_id VARCHAR(100),
  employee_id INT REFERENCES employees(id) ON DELETE SET NULL,
  punched_at TIMESTAMP NOT NULL,
  direction VARCHAR(20),
  source VARCHAR(30) DEFAULT 'connector',
  payload JSONB,
  attendance_date DATE,
  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customer_payments (
  id SERIAL PRIMARY KEY,
  customer_id INT REFERENCES customers(id) ON DELETE CASCADE,
  payment_date DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  evidence_url TEXT,
  evidence_name VARCHAR(255),
  evidence_mime VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE customer_payments ADD COLUMN IF NOT EXISTS evidence_url TEXT;
ALTER TABLE customer_payments ADD COLUMN IF NOT EXISTS evidence_name VARCHAR(255);
ALTER TABLE customer_payments ADD COLUMN IF NOT EXISTS evidence_mime VARCHAR(100);

CREATE TABLE IF NOT EXISTS business_expenses (
  id SERIAL PRIMARY KEY,
  expense_date DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  category VARCHAR(100),
  notes TEXT,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Helpful indexes for common filters and joins.
CREATE INDEX IF NOT EXISTS idx_materials_category ON materials(category);
CREATE INDEX IF NOT EXISTS idx_materials_low_stock ON materials(quantity, min_quantity);
CREATE INDEX IF NOT EXISTS idx_employees_status_department ON employees(status, department_id);
CREATE INDEX IF NOT EXISTS idx_payroll_month_year_status ON payroll(month, year, status);
CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON sales_orders(status);
CREATE INDEX IF NOT EXISTS idx_sales_orders_payment_status ON sales_orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_sales_orders_customer ON sales_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_payments_customer_date ON customer_payments(customer_id, payment_date);
CREATE INDEX IF NOT EXISTS idx_business_expenses_date ON business_expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_production_orders_status_due ON production_orders(status, due_date);
CREATE INDEX IF NOT EXISTS idx_production_orders_assigned_to ON production_orders(assigned_to);
CREATE INDEX IF NOT EXISTS idx_attendance_employee_date ON attendance(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_production_materials_material_id ON production_materials(material_id);
CREATE INDEX IF NOT EXISTS idx_sales_order_items_sales_order_id ON sales_order_items(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_employees_device_user_id ON employees(device_user_id);
CREATE INDEX IF NOT EXISTS idx_punch_events_employee_date ON attendance_punch_events(employee_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_punch_events_punched_at ON attendance_punch_events(punched_at);

-- Date-range indexes to support the new date-range filters in reportsController.js.
-- These allow Postgres to use index scans instead of full-table sequential scans.
CREATE INDEX IF NOT EXISTS idx_sales_orders_order_date         ON sales_orders(order_date);
CREATE INDEX IF NOT EXISTS idx_customer_payments_payment_date  ON customer_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_business_expenses_date2         ON business_expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_payroll_paid_at                 ON payroll(paid_at);
CREATE INDEX IF NOT EXISTS idx_production_orders_created_at    ON production_orders(created_at);

-- DB-level CHECK constraints on financial and quantity columns.
-- Wrapped with IF NOT EXISTS checks so repeated migrations are safe.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_customer_payments_amount_positive'
  ) THEN
    ALTER TABLE customer_payments
      ADD CONSTRAINT chk_customer_payments_amount_positive CHECK (amount > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_business_expenses_amount_positive'
  ) THEN
    ALTER TABLE business_expenses
      ADD CONSTRAINT chk_business_expenses_amount_positive CHECK (amount > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_sales_order_items_quantity_positive'
  ) THEN
    ALTER TABLE sales_order_items
      ADD CONSTRAINT chk_sales_order_items_quantity_positive CHECK (quantity > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_sales_order_items_unit_price_positive'
  ) THEN
    ALTER TABLE sales_order_items
      ADD CONSTRAINT chk_sales_order_items_unit_price_positive CHECK (unit_price > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_production_orders_quantity_positive'
  ) THEN
    ALTER TABLE production_orders
      ADD CONSTRAINT chk_production_orders_quantity_positive CHECK (quantity > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_production_orders_produced_qty_nonneg'
  ) THEN
    ALTER TABLE production_orders
      ADD CONSTRAINT chk_production_orders_produced_qty_nonneg CHECK (produced_qty >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_materials_quantity_nonneg'
  ) THEN
    ALTER TABLE materials
      ADD CONSTRAINT chk_materials_quantity_nonneg CHECK (quantity >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_production_materials_qty_positive'
  ) THEN
    ALTER TABLE production_materials
      ADD CONSTRAINT chk_production_materials_qty_positive CHECK (quantity_used > 0);
  END IF;
END $$;
