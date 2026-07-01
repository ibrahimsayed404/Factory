-- ============================================================
-- DB ARCHITECTURE REFACTORING MIGRATION
-- Normalization, constraints, and performance indexes.
-- ============================================================

-- 1. Normalization: Add product_id to sales_order_items and production_orders
ALTER TABLE sales_order_items
  ADD COLUMN IF NOT EXISTS product_id INT REFERENCES products(id) ON DELETE SET NULL;

ALTER TABLE production_orders
  ADD COLUMN IF NOT EXISTS product_id INT REFERENCES products(id) ON DELETE SET NULL;

-- Migrate existing records by looking up product names
UPDATE sales_order_items soi
SET product_id = p.id
FROM products p
WHERE soi.product_name = p.name AND soi.product_id IS NULL;

UPDATE production_orders po
SET product_id = p.id
FROM products p
WHERE po.product_name = p.name AND po.product_id IS NULL;


-- 2. Constraints: Prevent duplicate data
-- departments.name
ALTER TABLE departments
  ADD CONSTRAINT departments_name_key UNIQUE (name);

-- materials.name
ALTER TABLE materials
  ADD CONSTRAINT materials_name_key UNIQUE (name);


-- 3. Missing Foreign Key Indexes
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_employees_department_id ON employees(department_id);
CREATE INDEX IF NOT EXISTS idx_attendance_punch_events_employee_id ON attendance_punch_events(employee_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_customer_id ON sales_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_order_items_sales_order_id ON sales_order_items(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_customer_payments_customer_id ON customer_payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_business_expenses_created_by ON business_expenses(created_by);
CREATE INDEX IF NOT EXISTS idx_production_orders_sales_order_id ON production_orders(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_production_orders_assigned_to ON production_orders(assigned_to);
CREATE INDEX IF NOT EXISTS idx_production_materials_production_order_id ON production_materials(production_order_id);
CREATE INDEX IF NOT EXISTS idx_production_materials_material_id ON production_materials(material_id);
CREATE INDEX IF NOT EXISTS idx_production_phases_order_id ON production_phases(order_id);


-- 4. Reporting & Lookup Indexes
-- Used extensively in reportsController.js and listings
CREATE INDEX IF NOT EXISTS idx_sales_orders_order_date ON sales_orders(order_date);
CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON sales_orders(status);
CREATE INDEX IF NOT EXISTS idx_business_expenses_expense_date ON business_expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_production_orders_created_at ON production_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_production_orders_status ON production_orders(status);
CREATE INDEX IF NOT EXISTS idx_materials_category ON materials(category);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_name, entity_id);
