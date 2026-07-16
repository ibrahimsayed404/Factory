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
  failed_login_attempts INT DEFAULT 0,
  locked_until TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  token VARCHAR(500) PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,
  entity_name VARCHAR(100) NOT NULL,
  entity_id VARCHAR(100),
  details JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_settings (
  key VARCHAR(120) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- ACCOUNTING MODULE
-- ============================================================
CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id SERIAL PRIMARY KEY,
  code VARCHAR(30) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL,
  account_type VARCHAR(30) NOT NULL,
  parent_id INT REFERENCES chart_of_accounts(id) ON DELETE SET NULL,
  is_cash BOOLEAN DEFAULT false,
  is_bank BOOLEAN DEFAULT false,
  is_system BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  opening_balance NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cash_accounts (
  id SERIAL PRIMARY KEY,
  account_id INT NOT NULL UNIQUE REFERENCES chart_of_accounts(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD',
  custodian VARCHAR(150),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bank_accounts (
  id SERIAL PRIMARY KEY,
  account_id INT NOT NULL UNIQUE REFERENCES chart_of_accounts(id) ON DELETE CASCADE,
  bank_name VARCHAR(150) NOT NULL,
  account_number VARCHAR(100),
  iban VARCHAR(100),
  currency VARCHAR(10) DEFAULT 'USD',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS accounting_expenses (
  id SERIAL PRIMARY KEY,
  expense_number VARCHAR(30) UNIQUE NOT NULL,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  account_id INT NOT NULL REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
  paid_from_account_id INT REFERENCES chart_of_accounts(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL,
  vendor VARCHAR(150),
  reference_number VARCHAR(100),
  notes TEXT,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- INVENTORY MODULE
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inventory_item_type') THEN
    CREATE TYPE inventory_item_type AS ENUM ('material', 'product');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inventory_transaction_type') THEN
    CREATE TYPE inventory_transaction_type AS ENUM (
      'in', 'out', 'transfer', 'adjustment', 'reserve', 'damage', 'audit'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS warehouses (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) UNIQUE NOT NULL,
  type VARCHAR(50) DEFAULT 'internal',
  location_address TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS warehouse_locations (
  id SERIAL PRIMARY KEY,
  warehouse_id INT NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  code VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (warehouse_id, code)
);

CREATE TABLE IF NOT EXISTS inventory_transactions (
  id SERIAL PRIMARY KEY,
  item_type inventory_item_type NOT NULL,
  item_id INT NOT NULL,
  warehouse_id INT REFERENCES warehouses(id) ON DELETE RESTRICT,
  location_id INT REFERENCES warehouse_locations(id) ON DELETE RESTRICT,
  quantity NUMERIC(10,2) NOT NULL,
  transaction_type inventory_transaction_type NOT NULL,
  batch_number VARCHAR(100),
  lot_number VARCHAR(100),
  barcode VARCHAR(255),
  qr_code VARCHAR(255),
  reference_type VARCHAR(100),
  reference_id INT,
  user_id INT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_balances (
  id SERIAL PRIMARY KEY,
  item_type inventory_item_type NOT NULL,
  item_id INT NOT NULL,
  warehouse_id INT NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  location_id INT REFERENCES warehouse_locations(id) ON DELETE RESTRICT,
  batch_number VARCHAR(100) DEFAULT '',
  lot_number VARCHAR(100) DEFAULT '',
  quantity_on_hand NUMERIC(10,2) DEFAULT 0,
  quantity_reserved NUMERIC(10,2) DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (item_type, item_id, warehouse_id, location_id, batch_number, lot_number)
);

CREATE TABLE IF NOT EXISTS materials (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  category VARCHAR(100),              -- fabric, thread, button, zipper, etc.
  unit VARCHAR(30) NOT NULL,          -- kg, meters, pieces
  color VARCHAR(80),
  colors VARCHAR(80),
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
  name VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS hr_positions (
  id SERIAL PRIMARY KEY,
  department_id INT REFERENCES departments(id) ON DELETE SET NULL,
  title VARCHAR(150) NOT NULL,
  base_salary NUMERIC(10,2),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hr_shifts (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  weekend_days VARCHAR(20) DEFAULT '0,6',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS employees (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(150) UNIQUE,
  phone VARCHAR(30),
  department_id INT REFERENCES departments(id) ON DELETE SET NULL,
  position_id INT REFERENCES hr_positions(id) ON DELETE SET NULL,
  role VARCHAR(100),
  shift_id INT REFERENCES hr_shifts(id) ON DELETE SET NULL,
  shift VARCHAR(30),                   -- morning, evening, night (legacy)
  shift_start TIME,                    -- legacy
  shift_end TIME,                      -- legacy
  weekend_days VARCHAR(20) DEFAULT '0,6', -- legacy
  device_user_id VARCHAR(100) UNIQUE,
  salary NUMERIC(10,2),
  hire_date DATE,
  status VARCHAR(30) DEFAULT 'active', -- active, inactive
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hr_leave_requests (
  id SERIAL PRIMARY KEY,
  employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type VARCHAR(50) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(30) DEFAULT 'pending',
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hr_transactions (
  id SERIAL PRIMARY KEY,
  employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  transaction_type VARCHAR(50) NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  transaction_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hr_loans (
  id SERIAL PRIMARY KEY,
  employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  principal_amount NUMERIC(10,2) NOT NULL,
  remaining_amount NUMERIC(10,2) NOT NULL,
  monthly_installment NUMERIC(10,2) NOT NULL,
  status VARCHAR(30) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hr_salary_history (
  id SERIAL PRIMARY KEY,
  employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  previous_salary NUMERIC(10,2),
  new_salary NUMERIC(10,2) NOT NULL,
  effective_date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hr_employee_documents (
  id SERIAL PRIMARY KEY,
  employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  document_type VARCHAR(100),
  file_path VARCHAR(255) NOT NULL,
  uploaded_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hr_performance_reviews (
  id SERIAL PRIMARY KEY,
  employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  reviewer_id INT REFERENCES employees(id) ON DELETE SET NULL,
  review_date DATE NOT NULL,
  rating INT CHECK (rating >= 1 AND rating <= 5),
  comments TEXT,
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
  week_start DATE,
  week_end DATE,
  base_salary NUMERIC(10,2),
  bonus NUMERIC(10,2) DEFAULT 0,
  deductions NUMERIC(10,2) DEFAULT 0,
  net_salary NUMERIC(10,2),
  paid_at TIMESTAMP,
  status VARCHAR(30) DEFAULT 'pending', -- pending, paid
  UNIQUE(employee_id, month, year),
  UNIQUE(employee_id, week_start)
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
  tax_number VARCHAR(100),
  payment_terms_days INT DEFAULT 30,
  credit_limit NUMERIC(12,2) DEFAULT 0,
  status VARCHAR(30) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) UNIQUE NOT NULL,
  sku VARCHAR(50) UNIQUE,
  description TEXT,
  colors TEXT,
  default_price NUMERIC(10,2),
  quantity NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quotations (
  id SERIAL PRIMARY KEY,
  quotation_number VARCHAR(30) UNIQUE NOT NULL,
  customer_id INT REFERENCES customers(id) ON DELETE SET NULL,
  quotation_date DATE DEFAULT CURRENT_DATE,
  valid_until DATE,
  subtotal NUMERIC(12,2) DEFAULT 0,
  discount_amount NUMERIC(12,2) DEFAULT 0,
  tax_amount NUMERIC(12,2) DEFAULT 0,
  total_amount NUMERIC(12,2) DEFAULT 0,
  status VARCHAR(30) DEFAULT 'draft',
  notes TEXT,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quotation_items (
  id SERIAL PRIMARY KEY,
  quotation_id INT NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  product_id INT REFERENCES products(id) ON DELETE SET NULL,
  product_name VARCHAR(150) NOT NULL,
  quantity NUMERIC(10,2) NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  discount_percent NUMERIC(5,2) DEFAULT 0,
  total_price NUMERIC(12,2) GENERATED ALWAYS AS (quantity * unit_price * (1 - discount_percent / 100)) STORED
);

CREATE TABLE IF NOT EXISTS sales_orders (
  id SERIAL PRIMARY KEY,
  order_number VARCHAR(30) UNIQUE NOT NULL,
  quotation_id INT REFERENCES quotations(id) ON DELETE SET NULL,
  customer_id INT REFERENCES customers(id) ON DELETE SET NULL,
  order_date DATE DEFAULT CURRENT_DATE,
  delivery_date DATE,
  subtotal NUMERIC(12,2) DEFAULT 0,
  discount_amount NUMERIC(12,2) DEFAULT 0,
  tax_amount NUMERIC(12,2) DEFAULT 0,
  total_amount NUMERIC(12,2) DEFAULT 0,
  paid_amount NUMERIC(12,2) DEFAULT 0,
  payment_status VARCHAR(30) DEFAULT 'pending',  -- pending, invoiced, paid
  status VARCHAR(30) DEFAULT 'new',              -- new, confirmed, shipped, delivered, cancelled
  notes TEXT,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  reserved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales_order_items (
  id SERIAL PRIMARY KEY,
  sales_order_id INT REFERENCES sales_orders(id) ON DELETE CASCADE,
  product_id INT REFERENCES products(id) ON DELETE SET NULL,
  product_name VARCHAR(150) NOT NULL,
  color VARCHAR(80),
  quantity INT NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  fulfilled_quantity NUMERIC(10,2) DEFAULT 0,
  returned_quantity NUMERIC(10,2) DEFAULT 0,
  total_price NUMERIC(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED
);

CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  invoice_number VARCHAR(30) UNIQUE NOT NULL,
  sales_order_id INT REFERENCES sales_orders(id) ON DELETE SET NULL,
  customer_id INT REFERENCES customers(id) ON DELETE SET NULL,
  invoice_date DATE DEFAULT CURRENT_DATE,
  due_date DATE,
  subtotal NUMERIC(12,2) DEFAULT 0,
  discount_amount NUMERIC(12,2) DEFAULT 0,
  tax_amount NUMERIC(12,2) DEFAULT 0,
  total_amount NUMERIC(12,2) DEFAULT 0,
  paid_amount NUMERIC(12,2) DEFAULT 0,
  credited_amount NUMERIC(12,2) DEFAULT 0,
  status VARCHAR(30) DEFAULT 'draft',
  notes TEXT,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id SERIAL PRIMARY KEY,
  invoice_id INT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  sales_order_item_id INT REFERENCES sales_order_items(id) ON DELETE SET NULL,
  product_id INT REFERENCES products(id) ON DELETE SET NULL,
  product_name VARCHAR(150) NOT NULL,
  quantity NUMERIC(10,2) NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  discount_percent NUMERIC(5,2) DEFAULT 0,
  tax_rate NUMERIC(5,2) DEFAULT 0,
  total_price NUMERIC(12,2) GENERATED ALWAYS AS (quantity * unit_price * (1 - discount_percent / 100)) STORED
);

CREATE TABLE IF NOT EXISTS delivery_notes (
  id SERIAL PRIMARY KEY,
  delivery_number VARCHAR(30) UNIQUE NOT NULL,
  sales_order_id INT REFERENCES sales_orders(id) ON DELETE SET NULL,
  customer_id INT REFERENCES customers(id) ON DELETE SET NULL,
  delivery_date DATE DEFAULT CURRENT_DATE,
  status VARCHAR(30) DEFAULT 'draft',
  notes TEXT,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS delivery_note_items (
  id SERIAL PRIMARY KEY,
  delivery_note_id INT NOT NULL REFERENCES delivery_notes(id) ON DELETE CASCADE,
  sales_order_item_id INT REFERENCES sales_order_items(id) ON DELETE SET NULL,
  product_id INT REFERENCES products(id) ON DELETE SET NULL,
  product_name VARCHAR(150) NOT NULL,
  quantity NUMERIC(10,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS sales_returns (
  id SERIAL PRIMARY KEY,
  return_number VARCHAR(30) UNIQUE NOT NULL,
  sales_order_id INT REFERENCES sales_orders(id) ON DELETE SET NULL,
  invoice_id INT REFERENCES invoices(id) ON DELETE SET NULL,
  customer_id INT REFERENCES customers(id) ON DELETE SET NULL,
  return_date DATE DEFAULT CURRENT_DATE,
  total_amount NUMERIC(12,2) DEFAULT 0,
  status VARCHAR(30) DEFAULT 'draft',
  reason TEXT,
  notes TEXT,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales_return_items (
  id SERIAL PRIMARY KEY,
  sales_return_id INT NOT NULL REFERENCES sales_returns(id) ON DELETE CASCADE,
  sales_order_item_id INT REFERENCES sales_order_items(id) ON DELETE SET NULL,
  product_id INT REFERENCES products(id) ON DELETE SET NULL,
  product_name VARCHAR(150) NOT NULL,
  quantity NUMERIC(10,2) NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  restock BOOLEAN DEFAULT true,
  total_price NUMERIC(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED
);

CREATE TABLE IF NOT EXISTS credit_notes (
  id SERIAL PRIMARY KEY,
  credit_note_number VARCHAR(30) UNIQUE NOT NULL,
  customer_id INT REFERENCES customers(id) ON DELETE SET NULL,
  invoice_id INT REFERENCES invoices(id) ON DELETE SET NULL,
  sales_return_id INT REFERENCES sales_returns(id) ON DELETE SET NULL,
  credit_date DATE DEFAULT CURRENT_DATE,
  total_amount NUMERIC(12,2) DEFAULT 0,
  applied_amount NUMERIC(12,2) DEFAULT 0,
  status VARCHAR(30) DEFAULT 'draft',
  reason TEXT,
  notes TEXT,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS credit_note_items (
  id SERIAL PRIMARY KEY,
  credit_note_id INT NOT NULL REFERENCES credit_notes(id) ON DELETE CASCADE,
  product_id INT REFERENCES products(id) ON DELETE SET NULL,
  description VARCHAR(200) NOT NULL,
  quantity NUMERIC(10,2) NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  total_price NUMERIC(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED
);

CREATE TABLE IF NOT EXISTS customer_payments (
  id SERIAL PRIMARY KEY,
  customer_id INT REFERENCES customers(id) ON DELETE CASCADE,
  invoice_id INT REFERENCES invoices(id) ON DELETE SET NULL,
  payment_date DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  payment_method VARCHAR(50),
  reference_number VARCHAR(100),
  evidence_url TEXT,
  evidence_name VARCHAR(255),
  evidence_mime VARCHAR(100),
  notes TEXT,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customer_payment_allocations (
  id SERIAL PRIMARY KEY,
  customer_payment_id INT NOT NULL REFERENCES customer_payments(id) ON DELETE CASCADE,
  invoice_id INT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS accounting_journal_entries (
  id SERIAL PRIMARY KEY,
  entry_number VARCHAR(30) UNIQUE NOT NULL,
  entry_date DATE DEFAULT CURRENT_DATE,
  description TEXT,
  source_type VARCHAR(80) NOT NULL,
  source_id INT NOT NULL,
  memo TEXT,
  status VARCHAR(30) DEFAULT 'posted',
  posted_at TIMESTAMP DEFAULT NOW(),
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS accounting_journal_lines (
  id SERIAL PRIMARY KEY,
  journal_entry_id INT NOT NULL REFERENCES accounting_journal_entries(id) ON DELETE CASCADE,
  account_id INT REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
  account_code VARCHAR(30) NOT NULL,
  account_name VARCHAR(150) NOT NULL,
  debit NUMERIC(12,2) DEFAULT 0,
  credit NUMERIC(12,2) DEFAULT 0,
  customer_id INT REFERENCES customers(id) ON DELETE SET NULL,
  line_memo TEXT
);

-- Idempotent upgrades for databases created before the expanded Sales/Accounting schema.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS tax_number VARCHAR(100);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS payment_terms_days INT DEFAULT 30;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(12,2) DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'active';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

ALTER TABLE products ADD COLUMN IF NOT EXISTS quantity NUMERIC(10,2) DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS quotation_id INT REFERENCES quotations(id) ON DELETE SET NULL;
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12,2) DEFAULT 0;
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS created_by INT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS reserved_at TIMESTAMP;
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

ALTER TABLE sales_order_items ADD COLUMN IF NOT EXISTS product_id INT REFERENCES products(id) ON DELETE SET NULL;
ALTER TABLE sales_order_items ADD COLUMN IF NOT EXISTS fulfilled_quantity NUMERIC(10,2) DEFAULT 0;
ALTER TABLE sales_order_items ADD COLUMN IF NOT EXISTS returned_quantity NUMERIC(10,2) DEFAULT 0;

ALTER TABLE customer_payments ADD COLUMN IF NOT EXISTS invoice_id INT REFERENCES invoices(id) ON DELETE SET NULL;
ALTER TABLE customer_payments ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50);
ALTER TABLE customer_payments ADD COLUMN IF NOT EXISTS reference_number VARCHAR(100);
ALTER TABLE customer_payments ADD COLUMN IF NOT EXISTS evidence_url TEXT;
ALTER TABLE customer_payments ADD COLUMN IF NOT EXISTS evidence_name VARCHAR(255);
ALTER TABLE customer_payments ADD COLUMN IF NOT EXISTS evidence_mime VARCHAR(100);
ALTER TABLE customer_payments ADD COLUMN IF NOT EXISTS created_by INT REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE accounting_journal_entries ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE accounting_journal_entries ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'posted';
ALTER TABLE accounting_journal_entries ADD COLUMN IF NOT EXISTS posted_at TIMESTAMP DEFAULT NOW();

ALTER TABLE accounting_journal_lines ADD COLUMN IF NOT EXISTS account_id INT REFERENCES chart_of_accounts(id) ON DELETE RESTRICT;
ALTER TABLE accounting_journal_lines ADD COLUMN IF NOT EXISTS customer_id INT REFERENCES customers(id) ON DELETE SET NULL;
ALTER TABLE accounting_journal_lines ADD COLUMN IF NOT EXISTS line_memo TEXT;

-- ============================================================
-- PURCHASING MODULE
-- ============================================================
CREATE TABLE IF NOT EXISTS suppliers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(150),
  phone VARCHAR(30),
  address TEXT,
  city VARCHAR(100),
  country VARCHAR(100),
  rating NUMERIC(3,2),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_requests (
  id SERIAL PRIMARY KEY,
  request_number VARCHAR(30) UNIQUE NOT NULL,
  requested_by INT REFERENCES users(id) ON DELETE SET NULL,
  request_date DATE DEFAULT CURRENT_DATE,
  required_date DATE,
  status VARCHAR(30) DEFAULT 'draft',
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
  payment_status VARCHAR(30) DEFAULT 'pending',
  status VARCHAR(30) DEFAULT 'draft',
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
  status VARCHAR(30) DEFAULT 'draft',
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
CREATE TABLE IF NOT EXISTS boms (
  id SERIAL PRIMARY KEY,
  product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  version VARCHAR(50) DEFAULT '1.0',
  base_quantity INT DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bom_materials (
  id SERIAL PRIMARY KEY,
  bom_id INT NOT NULL REFERENCES boms(id) ON DELETE CASCADE,
  material_id INT NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  quantity NUMERIC(10,2) NOT NULL,
  scrap_percentage NUMERIC(5,2) DEFAULT 0,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS production_stages (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  cost_per_hour NUMERIC(10,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS routings (
  id SERIAL PRIMARY KEY,
  product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS routing_steps (
  id SERIAL PRIMARY KEY,
  routing_id INT NOT NULL REFERENCES routings(id) ON DELETE CASCADE,
  stage_id INT NOT NULL REFERENCES production_stages(id) ON DELETE RESTRICT,
  sequence_order INT NOT NULL,
  standard_time_minutes INT DEFAULT 0,
  instructions TEXT
);

CREATE TABLE IF NOT EXISTS production_orders (
  id SERIAL PRIMARY KEY,
  order_number VARCHAR(30) UNIQUE NOT NULL,
  model_number VARCHAR(100),
  planned_quantity INT,
  product_id INT REFERENCES products(id) ON DELETE SET NULL,
  product_name VARCHAR(150) NOT NULL,
  quantity INT NOT NULL,
  produced_qty INT DEFAULT 0,
  sales_order_id INT REFERENCES sales_orders(id) ON DELETE SET NULL,
  assigned_to INT REFERENCES employees(id) ON DELETE SET NULL,
  bom_id INT REFERENCES boms(id) ON DELETE SET NULL,
  routing_id INT REFERENCES routings(id) ON DELETE SET NULL,
  total_material_cost NUMERIC(12,2) DEFAULT 0,
  total_labor_cost NUMERIC(12,2) DEFAULT 0,
  total_machine_cost NUMERIC(12,2) DEFAULT 0,
  start_date DATE,
  due_date DATE,
  status VARCHAR(30) DEFAULT 'pending',  -- pending, in_progress, done, shipped
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS production_materials (
  id SERIAL PRIMARY KEY,
  production_order_id INT NOT NULL REFERENCES production_orders(id) ON DELETE CASCADE,
  material_id INT NOT NULL REFERENCES materials(id) ON DELETE RESTRICT,
  quantity_used NUMERIC(10,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS machines (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  code VARCHAR(60) UNIQUE,
  status VARCHAR(30) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS work_orders (
  id SERIAL PRIMARY KEY,
  production_order_id INT NOT NULL REFERENCES production_orders(id) ON DELETE CASCADE,
  stage_id INT NOT NULL REFERENCES production_stages(id) ON DELETE RESTRICT,
  sequence_order INT NOT NULL,
  scheduled_start TIMESTAMP,
  scheduled_end TIMESTAMP,
  actual_start TIMESTAMP,
  actual_end TIMESTAMP,
  assigned_machine_id INT REFERENCES machines(id) ON DELETE SET NULL,
  assigned_employee_id INT REFERENCES employees(id) ON DELETE SET NULL,
  status VARCHAR(30) DEFAULT 'pending', -- pending, in_progress, completed, rework
  produced_quantity INT DEFAULT 0,
  waste_quantity INT DEFAULT 0,
  rework_quantity INT DEFAULT 0,
  labor_cost NUMERIC(12,2) DEFAULT 0,
  machine_cost NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS work_order_materials (
  id SERIAL PRIMARY KEY,
  work_order_id INT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  material_id INT NOT NULL REFERENCES materials(id) ON DELETE RESTRICT,
  planned_quantity NUMERIC(10,2) NOT NULL,
  consumed_quantity NUMERIC(10,2) DEFAULT 0,
  waste_quantity NUMERIC(10,2) DEFAULT 0
);

-- ============================================================
-- QUALITY CONTROL MODULE
-- ============================================================
CREATE TABLE IF NOT EXISTS qc_inspections (
  id SERIAL PRIMARY KEY,
  inspection_type VARCHAR(50) NOT NULL, -- 'incoming', 'in_process', 'final'
  reference_type VARCHAR(50) NOT NULL, -- 'purchase_order', 'work_order', 'production_order'
  reference_id INT NOT NULL,
  inspector_id INT REFERENCES employees(id) ON DELETE SET NULL,
  total_quantity INT NOT NULL,
  passed_quantity INT DEFAULT 0,
  failed_quantity INT DEFAULT 0,
  rework_quantity INT DEFAULT 0,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'passed', 'failed', 'partial'
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS qc_defect_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) UNIQUE NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS qc_inspection_defects (
  id SERIAL PRIMARY KEY,
  inspection_id INT NOT NULL REFERENCES qc_inspections(id) ON DELETE CASCADE,
  defect_category_id INT NOT NULL REFERENCES qc_defect_categories(id) ON DELETE RESTRICT,
  quantity INT NOT NULL,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS qc_inspection_photos (
  id SERIAL PRIMARY KEY,
  inspection_id INT NOT NULL REFERENCES qc_inspections(id) ON DELETE CASCADE,
  file_path VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- SEED DATA — qc_defect_categories
-- ============================================================
INSERT INTO qc_defect_categories (name, description) VALUES
  ('Stitching Error', 'Incorrect, loose, or missed stitches'),
  ('Fabric Stain', 'Marks or stains on the fabric'),
  ('Color Mismatch', 'Dye or fabric color is inconsistent or wrong'),
  ('Size Mismatch', 'Garment measurements do not match the size spec'),
  ('Hardware Issue', 'Broken or missing zippers, buttons, or snaps'),
  ('Packaging Damage', 'Damage during the final packing stage')
ON CONFLICT DO NOTHING;

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

-- ============================================================
-- SEED DATA — warehouses
-- ============================================================
INSERT INTO warehouses (id, name, type)
VALUES (1, 'Main Warehouse', 'internal')
ON CONFLICT DO NOTHING;

INSERT INTO warehouse_locations (id, warehouse_id, code, description)
VALUES (1, 1, 'DEF-LOC', 'Default Location')
ON CONFLICT DO NOTHING;

-- ============================================================
-- SEED DATA - chart_of_accounts
-- ============================================================
INSERT INTO chart_of_accounts (code, name, account_type, is_cash, is_bank, is_system) VALUES
  ('1000', 'Cash on Hand', 'asset', true, false, true),
  ('1010', 'Main Bank Account', 'asset', false, true, true),
  ('1100', 'Accounts Receivable', 'asset', false, false, true),
  ('1200', 'Inventory', 'asset', false, false, true),
  ('1300', 'Work in Process', 'asset', false, false, true),
  ('2000', 'Accounts Payable', 'liability', false, false, true),
  ('2100', 'Sales Tax Payable', 'liability', false, false, true),
  ('2200', 'Payroll Payable', 'liability', false, false, true),
  ('3000', 'Owner Equity', 'equity', false, false, true),
  ('4000', 'Sales Revenue', 'revenue', false, false, true),
  ('4100', 'Sales Returns and Allowances', 'revenue', false, false, true),
  ('5000', 'Cost of Goods Sold', 'expense', false, false, true),
  ('5100', 'Materials Expense', 'expense', false, false, true),
  ('5200', 'Payroll Expense', 'expense', false, false, true),
  ('5300', 'Production Labor and Overhead', 'expense', false, false, true),
  ('5400', 'Inventory Adjustments', 'expense', false, false, true),
  ('6000', 'Operating Expenses', 'expense', false, false, true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO cash_accounts (account_id, name, currency)
SELECT id, 'Main Cash Box', 'USD' FROM chart_of_accounts WHERE code = '1000'
ON CONFLICT (account_id) DO NOTHING;

INSERT INTO bank_accounts (account_id, bank_name, currency)
SELECT id, 'Main Bank', 'USD' FROM chart_of_accounts WHERE code = '1010'
ON CONFLICT (account_id) DO NOTHING;

-- ============================================================
-- INDEXES FOR PERFORMANCE AND FOREIGN KEYS
-- ============================================================

-- Foreign Key Indexes
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_type ON chart_of_accounts(account_type);
CREATE INDEX IF NOT EXISTS idx_cash_accounts_account_id ON cash_accounts(account_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_account_id ON bank_accounts(account_id);
CREATE INDEX IF NOT EXISTS idx_accounting_expenses_account_id ON accounting_expenses(account_id);
CREATE INDEX IF NOT EXISTS idx_employees_department_id ON employees(department_id);
CREATE INDEX IF NOT EXISTS idx_attendance_punch_events_employee_id ON attendance_punch_events(employee_id);
CREATE INDEX IF NOT EXISTS idx_quotations_customer_id ON quotations(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation_id ON quotation_items(quotation_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_customer_id ON sales_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_quotation_id ON sales_orders(quotation_id);
CREATE INDEX IF NOT EXISTS idx_sales_order_items_sales_order_id ON sales_order_items(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_sales_order_id ON invoices(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_delivery_notes_sales_order_id ON delivery_notes(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_note_items_delivery_note_id ON delivery_note_items(delivery_note_id);
CREATE INDEX IF NOT EXISTS idx_sales_returns_customer_id ON sales_returns(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_return_items_return_id ON sales_return_items(sales_return_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_customer_id ON credit_notes(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_payments_customer_id ON customer_payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_payment_allocations_payment_id ON customer_payment_allocations(customer_payment_id);
CREATE INDEX IF NOT EXISTS idx_customer_payment_allocations_invoice_id ON customer_payment_allocations(invoice_id);
CREATE INDEX IF NOT EXISTS idx_accounting_journal_entries_source ON accounting_journal_entries(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_accounting_journal_lines_entry ON accounting_journal_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_accounting_journal_lines_account_id ON accounting_journal_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_business_expenses_created_by ON business_expenses(created_by);
CREATE INDEX IF NOT EXISTS idx_production_orders_sales_order_id ON production_orders(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_production_orders_assigned_to ON production_orders(assigned_to);
CREATE INDEX IF NOT EXISTS idx_work_orders_production_order_id ON work_orders(production_order_id);
CREATE INDEX IF NOT EXISTS idx_work_order_materials_material_id ON work_order_materials(material_id);
CREATE INDEX IF NOT EXISTS idx_boms_product_id ON boms(product_id);
CREATE INDEX IF NOT EXISTS idx_qc_inspections_ref ON qc_inspections(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_qc_inspections_inspector ON qc_inspections(inspector_id);
CREATE INDEX IF NOT EXISTS idx_qc_inspection_defects_inspection ON qc_inspection_defects(inspection_id);

-- Reporting & Lookup Indexes
CREATE INDEX IF NOT EXISTS idx_sales_orders_order_date ON sales_orders(order_date);
CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON sales_orders(status);
CREATE INDEX IF NOT EXISTS idx_quotations_status ON quotations(status);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_delivery_notes_status ON delivery_notes(status);
CREATE INDEX IF NOT EXISTS idx_sales_returns_status ON sales_returns(status);
CREATE INDEX IF NOT EXISTS idx_credit_notes_status ON credit_notes(status);
CREATE INDEX IF NOT EXISTS idx_business_expenses_expense_date ON business_expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_accounting_journal_entries_date ON accounting_journal_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_accounting_expenses_date ON accounting_expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_production_orders_created_at ON production_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_production_orders_status ON production_orders(status);
CREATE INDEX IF NOT EXISTS idx_materials_category ON materials(category);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_name, entity_id);

CREATE INDEX IF NOT EXISTS idx_inventory_transactions_item ON inventory_transactions(item_type, item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_location ON inventory_transactions(warehouse_id, location_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_ref ON inventory_transactions(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_batch ON inventory_transactions(batch_number, lot_number);

CREATE INDEX IF NOT EXISTS idx_inventory_balances_item ON inventory_balances(item_type, item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_balances_location ON inventory_balances(warehouse_id, location_id);

CREATE INDEX IF NOT EXISTS idx_purchase_requests_status ON purchase_requests(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier_id ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_supplier_id ON supplier_payments(supplier_id);

-- ============================================================
-- TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION update_inventory_balance_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.transaction_type = 'reserve' THEN
    INSERT INTO inventory_balances (
      item_type, item_id, warehouse_id, location_id, batch_number, lot_number, quantity_reserved, updated_at
    )
    VALUES (
      NEW.item_type, NEW.item_id, NEW.warehouse_id, NEW.location_id, COALESCE(NEW.batch_number, ''), COALESCE(NEW.lot_number, ''), NEW.quantity, NOW()
    )
    ON CONFLICT (item_type, item_id, warehouse_id, location_id, batch_number, lot_number)
    DO UPDATE SET
      quantity_reserved = GREATEST(inventory_balances.quantity_reserved + NEW.quantity, 0),
      updated_at = NOW();

    RETURN NEW;
  END IF;

  INSERT INTO inventory_balances (
    item_type, item_id, warehouse_id, location_id, batch_number, lot_number, quantity_on_hand, updated_at
  )
  VALUES (
    NEW.item_type, NEW.item_id, NEW.warehouse_id, NEW.location_id, COALESCE(NEW.batch_number, ''), COALESCE(NEW.lot_number, ''), NEW.quantity, NOW()
  )
  ON CONFLICT (item_type, item_id, warehouse_id, location_id, batch_number, lot_number)
  DO UPDATE SET 
    quantity_on_hand = inventory_balances.quantity_on_hand + NEW.quantity,
    updated_at = NOW();

  IF NEW.item_type = 'material' THEN
    UPDATE materials
    SET quantity = COALESCE(quantity, 0) + NEW.quantity,
        updated_at = NOW()
    WHERE id = NEW.item_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_inventory_transaction_insert ON inventory_transactions;
CREATE TRIGGER trg_inventory_transaction_insert
AFTER INSERT ON inventory_transactions
FOR EACH ROW
EXECUTE FUNCTION update_inventory_balance_trigger();


CREATE OR REPLACE FUNCTION update_products_quantity_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.transaction_type = 'reserve' THEN
    RETURN NEW;
  END IF;

  IF NEW.item_type = 'product' THEN
    UPDATE products
    SET quantity = COALESCE(quantity, 0) + NEW.quantity,
        updated_at = NOW()
    WHERE id = NEW.item_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_inventory_transaction_product ON inventory_transactions;
CREATE TRIGGER trg_inventory_transaction_product
AFTER INSERT ON inventory_transactions
FOR EACH ROW
EXECUTE FUNCTION update_products_quantity_trigger();
