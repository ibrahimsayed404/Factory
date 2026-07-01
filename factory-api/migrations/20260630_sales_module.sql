-- ============================================================
-- SALES MODULE MIGRATION
-- Adds enterprise sales documents, customer analytics support,
-- inventory reservations, and sales accounting journal entries.
-- ============================================================

BEGIN;

ALTER TABLE customers ADD COLUMN IF NOT EXISTS tax_number VARCHAR(100);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS payment_terms_days INT DEFAULT 30;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(12,2) DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'active';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

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

ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS quotation_id INT REFERENCES quotations(id) ON DELETE SET NULL;
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12,2) DEFAULT 0;
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS created_by INT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS reserved_at TIMESTAMP;
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

ALTER TABLE sales_order_items ADD COLUMN IF NOT EXISTS fulfilled_quantity NUMERIC(10,2) DEFAULT 0;
ALTER TABLE sales_order_items ADD COLUMN IF NOT EXISTS returned_quantity NUMERIC(10,2) DEFAULT 0;

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

ALTER TABLE customer_payments ADD COLUMN IF NOT EXISTS invoice_id INT REFERENCES invoices(id) ON DELETE SET NULL;
ALTER TABLE customer_payments ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50);
ALTER TABLE customer_payments ADD COLUMN IF NOT EXISTS reference_number VARCHAR(100);
ALTER TABLE customer_payments ADD COLUMN IF NOT EXISTS created_by INT REFERENCES users(id) ON DELETE SET NULL;

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
  source_type VARCHAR(80) NOT NULL,
  source_id INT NOT NULL,
  memo TEXT,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS accounting_journal_lines (
  id SERIAL PRIMARY KEY,
  journal_entry_id INT NOT NULL REFERENCES accounting_journal_entries(id) ON DELETE CASCADE,
  account_code VARCHAR(30) NOT NULL,
  account_name VARCHAR(150) NOT NULL,
  debit NUMERIC(12,2) DEFAULT 0,
  credit NUMERIC(12,2) DEFAULT 0,
  customer_id INT REFERENCES customers(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_quotations_customer_id ON quotations(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation_id ON quotation_items(quotation_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_quotation_id ON sales_orders(quotation_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_sales_order_id ON invoices(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_delivery_notes_sales_order_id ON delivery_notes(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_note_items_delivery_note_id ON delivery_note_items(delivery_note_id);
CREATE INDEX IF NOT EXISTS idx_sales_returns_customer_id ON sales_returns(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_return_items_return_id ON sales_return_items(sales_return_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_customer_id ON credit_notes(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_payment_allocations_payment_id ON customer_payment_allocations(customer_payment_id);
CREATE INDEX IF NOT EXISTS idx_customer_payment_allocations_invoice_id ON customer_payment_allocations(invoice_id);
CREATE INDEX IF NOT EXISTS idx_accounting_journal_entries_source ON accounting_journal_entries(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_accounting_journal_lines_entry ON accounting_journal_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_quotations_status ON quotations(status);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_delivery_notes_status ON delivery_notes(status);
CREATE INDEX IF NOT EXISTS idx_sales_returns_status ON sales_returns(status);
CREATE INDEX IF NOT EXISTS idx_credit_notes_status ON credit_notes(status);

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

COMMIT;
