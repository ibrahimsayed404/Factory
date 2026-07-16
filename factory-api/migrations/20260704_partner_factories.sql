CREATE TABLE IF NOT EXISTS partner_factories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL UNIQUE,
  code VARCHAR(60) UNIQUE,
  contact_person VARCHAR(120),
  phone VARCHAR(40),
  notes TEXT,
  status VARCHAR(30) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE production_phases
  ADD COLUMN IF NOT EXISTS partner_factory_id INT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'production_phases_partner_factory_id_fkey'
  ) THEN
    ALTER TABLE production_phases
      ADD CONSTRAINT production_phases_partner_factory_id_fkey
      FOREIGN KEY (partner_factory_id) REFERENCES partner_factories(id) ON DELETE SET NULL;
  END IF;
END $$;
