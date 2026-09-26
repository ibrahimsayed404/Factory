-- Migration: 20260926_new_operations_cycle.sql
-- Description: New 4-stage operations cycle: Cutting -> Sorting -> Printing -> Delivery

-- 1. Create print_shops table (or sync with partner_factories)
CREATE TABLE IF NOT EXISTS print_shops (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  contact_person VARCHAR(100),
  phone VARCHAR(50),
  address TEXT,
  notes TEXT,
  status VARCHAR(30) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Seed existing partner_factories into print_shops if any
INSERT INTO print_shops (name, phone, notes, status, created_at)
SELECT name, phone, notes, status, created_at 
FROM partner_factories
WHERE name IS NOT NULL
ON CONFLICT DO NOTHING;

-- 2. Enhance production_orders with new lifecycle fields
ALTER TABLE production_orders
  ADD COLUMN IF NOT EXISTS order_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS current_stage VARCHAR(50) DEFAULT 'cutting',
  ADD COLUMN IF NOT EXISTS customer_id INT REFERENCES customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS print_shop_id INT REFERENCES print_shops(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS unit_price NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_price NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_cut_quantity INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_sorted_quantity INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_print_sent_quantity INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_print_received_quantity INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_delivered_quantity INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sorting_notes TEXT,
  ADD COLUMN IF NOT EXISTS print_notes TEXT,
  ADD COLUMN IF NOT EXISTS delivery_notes TEXT,
  ADD COLUMN IF NOT EXISTS print_sent_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS print_received_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS sorted_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS created_by INT REFERENCES users(id) ON DELETE SET NULL;

-- 3. Create production_order_colors table
CREATE TABLE IF NOT EXISTS production_order_colors (
  id SERIAL PRIMARY KEY,
  order_id INT NOT NULL REFERENCES production_orders(id) ON DELETE CASCADE,
  color VARCHAR(100) NOT NULL,
  cut_quantity INT NOT NULL DEFAULT 0,
  sorted_quantity INT,
  sorting_note TEXT,
  print_sent_quantity INT,
  print_received_quantity INT,
  print_note TEXT,
  delivered_quantity INT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_production_order_colors_order_id ON production_order_colors(order_id);
CREATE INDEX IF NOT EXISTS idx_production_orders_current_stage ON production_orders(current_stage);
CREATE INDEX IF NOT EXISTS idx_production_orders_print_shop ON production_orders(print_shop_id);
CREATE INDEX IF NOT EXISTS idx_production_orders_customer ON production_orders(customer_id);
