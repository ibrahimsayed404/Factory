-- ============================================================
-- MANUFACTURING ERP REDESIGN MIGRATION
-- ============================================================

-- 1. BILL OF MATERIALS
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

-- 2. ROUTING & STAGES
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

-- 3. ALTER PRODUCTION ORDERS
ALTER TABLE production_orders
  ADD COLUMN IF NOT EXISTS bom_id INT REFERENCES boms(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS routing_id INT REFERENCES routings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS total_material_cost NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_labor_cost NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_machine_cost NUMERIC(12,2) DEFAULT 0;

-- 4. WORK ORDERS & EXECUTIONS
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

-- INSERT DEFAULT STAGES
INSERT INTO production_stages (name, description, cost_per_hour) VALUES
  ('Cutting', 'Cutting fabric according to patterns', 25.00),
  ('Sewing', 'Stitching and assembly', 30.00),
  ('Quality Control', 'Inspecting garments', 20.00),
  ('Packaging', 'Folding, labeling, and packing', 15.00)
ON CONFLICT (name) DO NOTHING;
