-- ============================================================
-- PURCHASING MODULE MIGRATION
-- Adds suppliers, purchase requests, purchase orders, payments
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS suppliers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(150),
  phone VARCHAR(30),
  address TEXT,
  city VARCHAR(100),
  country VARCHAR(100),
  rating NUMERIC(3,2), -- Supplier performance rating 1-5
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_requests (
  id SERIAL PRIMARY KEY,
  request_number VARCHAR(30) UNIQUE NOT NULL,
  requested_by INT REFERENCES users(id) ON DELETE SET NULL,
  request_date DATE DEFAULT CURRENT_DATE,
  required_date DATE,
  status VARCHAR(30) DEFAULT 'draft', -- draft, pending_approval, approved, rejected, ordered
  total_estimated_amount NUMERIC(12,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_request_items (
  id SERIAL PRIMARY KEY,
  purchase_request_id INT NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
  material_id INT REFERENCES materials(id) ON DELETE SET NULL,
  material_name VARCHAR(150) NOT NULL,
  quantity NUMERIC(10,2) NOT NULL,
  estimated_unit_price NUMERIC(10,2) DEFAULT 0
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id SERIAL PRIMARY KEY,
  order_number VARCHAR(30) UNIQUE NOT NULL,
  purchase_request_id INT REFERENCES purchase_requests(id) ON DELETE SET NULL,
  supplier_id INT REFERENCES suppliers(id) ON DELETE SET NULL,
  order_date DATE DEFAULT CURRENT_DATE,
  expected_delivery_date DATE,
  actual_delivery_date DATE,
  total_amount NUMERIC(12,2) DEFAULT 0,
  paid_amount NUMERIC(12,2) DEFAULT 0,
  payment_status VARCHAR(30) DEFAULT 'pending', -- pending, partial, paid
  status VARCHAR(30) DEFAULT 'draft', -- draft, pending_approval, approved, ordered, partially_received, received, cancelled
  notes TEXT,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id SERIAL PRIMARY KEY,
  purchase_order_id INT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  material_id INT REFERENCES materials(id) ON DELETE SET NULL,
  material_name VARCHAR(150) NOT NULL,
  ordered_quantity NUMERIC(10,2) NOT NULL,
  received_quantity NUMERIC(10,2) DEFAULT 0,
  unit_price NUMERIC(10,2) NOT NULL,
  total_price NUMERIC(10,2) GENERATED ALWAYS AS (ordered_quantity * unit_price) STORED
);

CREATE TABLE IF NOT EXISTS supplier_payments (
  id SERIAL PRIMARY KEY,
  supplier_id INT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  purchase_order_id INT REFERENCES purchase_orders(id) ON DELETE SET NULL,
  payment_date DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  payment_method VARCHAR(50),
  reference_number VARCHAR(100),
  notes TEXT,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_returns (
  id SERIAL PRIMARY KEY,
  return_number VARCHAR(30) UNIQUE NOT NULL,
  purchase_order_id INT REFERENCES purchase_orders(id) ON DELETE SET NULL,
  supplier_id INT REFERENCES suppliers(id) ON DELETE SET NULL,
  return_date DATE DEFAULT CURRENT_DATE,
  total_amount NUMERIC(12,2) DEFAULT 0,
  status VARCHAR(30) DEFAULT 'draft', -- draft, pending_approval, approved, returned
  notes TEXT,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_return_items (
  id SERIAL PRIMARY KEY,
  purchase_return_id INT NOT NULL REFERENCES purchase_returns(id) ON DELETE CASCADE,
  material_id INT REFERENCES materials(id) ON DELETE SET NULL,
  material_name VARCHAR(150) NOT NULL,
  quantity NUMERIC(10,2) NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  total_price NUMERIC(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_purchase_requests_status ON purchase_requests(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier_id ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_supplier_id ON supplier_payments(supplier_id);

COMMIT;
