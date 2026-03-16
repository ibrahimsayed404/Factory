-- ============================================================
-- CLOTHES FACTORY MANAGEMENT SYSTEM — DATABASE SCHEMA
-- ============================================================

-- Users (system auth)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'staff',   -- admin, manager, staff
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- INVENTORY MODULE
-- ============================================================
CREATE TABLE IF NOT EXISTS materials (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  category VARCHAR(100),              -- fabric, thread, button, zipper, etc.
  unit VARCHAR(30) NOT NULL,          -- kg, meters, pieces
  quantity NUMERIC(10,2) DEFAULT 0,
  min_quantity NUMERIC(10,2) DEFAULT 0,  -- low stock threshold
  cost_per_unit NUMERIC(10,2),
  supplier VARCHAR(150),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- EMPLOYEES MODULE
-- ============================================================
CREATE TABLE IF NOT EXISTS departments (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS employees (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(150) UNIQUE,
  phone VARCHAR(30),
  department_id INT REFERENCES departments(id) ON DELETE SET NULL,
  role VARCHAR(100),
  shift VARCHAR(30),                   -- morning, evening, night
  shift_start TIME,
  shift_end TIME,
  weekend_days VARCHAR(20) DEFAULT '0,6', -- JS day indexes, e.g. 0,6 (Sun,Sat)
  device_user_id VARCHAR(100) UNIQUE,
  salary NUMERIC(10,2),
  hire_date DATE,
  status VARCHAR(30) DEFAULT 'active', -- active, inactive
  created_at TIMESTAMP DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS attendance (
  id SERIAL PRIMARY KEY,
  employee_id INT REFERENCES employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  check_in TIME,
  check_out TIME,
  hours_worked NUMERIC(5,2),
  late_minutes INT DEFAULT 0,
  early_leave_minutes INT DEFAULT 0,
  overtime_minutes INT DEFAULT 0,
  status VARCHAR(30) DEFAULT 'present', -- present, absent, late, half-day
  notes TEXT,
  UNIQUE(employee_id, date)
);

CREATE TABLE IF NOT EXISTS payroll (
  id SERIAL PRIMARY KEY,
  employee_id INT REFERENCES employees(id) ON DELETE CASCADE,
  month INT NOT NULL,
  year INT NOT NULL,
  base_salary NUMERIC(10,2),
  bonus NUMERIC(10,2) DEFAULT 0,
  deductions NUMERIC(10,2) DEFAULT 0,
  net_salary NUMERIC(10,2),
  paid_at TIMESTAMP,
  status VARCHAR(30) DEFAULT 'pending', -- pending, paid
  UNIQUE(employee_id, month, year)
);

-- ============================================================
-- CUSTOMERS & SALES MODULE
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(150),
  phone VARCHAR(30),
  address TEXT,
  city VARCHAR(100),
  country VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales_orders (
  id SERIAL PRIMARY KEY,
  order_number VARCHAR(30) UNIQUE NOT NULL,
  customer_id INT REFERENCES customers(id) ON DELETE SET NULL,
  order_date DATE DEFAULT CURRENT_DATE,
  delivery_date DATE,
  total_amount NUMERIC(12,2) DEFAULT 0,
  paid_amount NUMERIC(12,2) DEFAULT 0,
  payment_status VARCHAR(30) DEFAULT 'pending',  -- pending, invoiced, paid
  status VARCHAR(30) DEFAULT 'new',              -- new, confirmed, shipped, delivered, cancelled
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales_order_items (
  id SERIAL PRIMARY KEY,
  sales_order_id INT REFERENCES sales_orders(id) ON DELETE CASCADE,
  product_name VARCHAR(150) NOT NULL,
  quantity INT NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  total_price NUMERIC(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED
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

CREATE TABLE IF NOT EXISTS business_expenses (
  id SERIAL PRIMARY KEY,
  expense_date DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  category VARCHAR(100),
  notes TEXT,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- PRODUCTION MODULE
-- ============================================================
CREATE TABLE IF NOT EXISTS production_orders (
  id SERIAL PRIMARY KEY,
  order_number VARCHAR(30) UNIQUE NOT NULL,
  product_name VARCHAR(150) NOT NULL,
  quantity INT NOT NULL,
  produced_qty INT DEFAULT 0,
  sales_order_id INT REFERENCES sales_orders(id) ON DELETE SET NULL,
  assigned_to INT REFERENCES employees(id) ON DELETE SET NULL,
  start_date DATE,
  due_date DATE,
  status VARCHAR(30) DEFAULT 'pending',  -- pending, in_progress, done, shipped
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS production_materials (
  id SERIAL PRIMARY KEY,
  production_order_id INT REFERENCES production_orders(id) ON DELETE CASCADE,
  material_id INT REFERENCES materials(id) ON DELETE SET NULL,
  quantity_used NUMERIC(10,2) NOT NULL
);

-- ============================================================
-- SEED DATA — departments
-- ============================================================
INSERT INTO departments (name) VALUES
  ('Cutting'),
  ('Sewing'),
  ('Quality Control'),
  ('Warehouse'),
  ('Administration')
ON CONFLICT DO NOTHING;
