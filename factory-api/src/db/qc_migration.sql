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

CREATE INDEX IF NOT EXISTS idx_qc_inspections_ref ON qc_inspections(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_qc_inspections_inspector ON qc_inspections(inspector_id);
CREATE INDEX IF NOT EXISTS idx_qc_inspection_defects_inspection ON qc_inspection_defects(inspection_id);

INSERT INTO qc_defect_categories (name, description) VALUES
  ('Stitching Error', 'Incorrect, loose, or missed stitches'),
  ('Fabric Stain', 'Marks or stains on the fabric'),
  ('Color Mismatch', 'Dye or fabric color is inconsistent or wrong'),
  ('Size Mismatch', 'Garment measurements do not match the size spec'),
  ('Hardware Issue', 'Broken or missing zippers, buttons, or snaps'),
  ('Packaging Damage', 'Damage during the final packing stage')
ON CONFLICT DO NOTHING;
