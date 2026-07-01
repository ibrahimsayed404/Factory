-- ============================================================
-- INVENTORY REDESIGN MIGRATION
-- Adds warehouses, locations, transactions, and balances.
-- ============================================================

BEGIN;

-- 1. Create Enums if they don't exist
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

-- 2. Warehouses & Locations
CREATE TABLE IF NOT EXISTS warehouses (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) UNIQUE NOT NULL,
  type VARCHAR(50) DEFAULT 'internal', -- internal, external, quarantine
  location_address TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS warehouse_locations (
  id SERIAL PRIMARY KEY,
  warehouse_id INT NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  code VARCHAR(100) NOT NULL, -- e.g., A1-B2-C3
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (warehouse_id, code)
);

-- 3. Inventory Transactions (The Ledger)
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id SERIAL PRIMARY KEY,
  item_type inventory_item_type NOT NULL,
  item_id INT NOT NULL, -- Logical FK to either materials or products
  warehouse_id INT REFERENCES warehouses(id) ON DELETE RESTRICT,
  location_id INT REFERENCES warehouse_locations(id) ON DELETE RESTRICT,
  quantity NUMERIC(10,2) NOT NULL, -- Positive for IN/ADD, Negative for OUT/DEDUCT
  transaction_type inventory_transaction_type NOT NULL,
  batch_number VARCHAR(100),
  lot_number VARCHAR(100),
  barcode VARCHAR(255),
  qr_code VARCHAR(255),
  reference_type VARCHAR(100), -- e.g. 'sales_order', 'production_order'
  reference_id INT,
  user_id INT, -- Logical FK to users
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 4. Inventory Balances (Fast Query Cache)
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

-- Indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_item ON inventory_transactions(item_type, item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_location ON inventory_transactions(warehouse_id, location_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_ref ON inventory_transactions(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_batch ON inventory_transactions(batch_number, lot_number);

CREATE INDEX IF NOT EXISTS idx_inventory_balances_item ON inventory_balances(item_type, item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_balances_location ON inventory_balances(warehouse_id, location_id);

-- 5. Trigger to update balances AND legacy tables automatically
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

  -- Update the granular inventory_balances table
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

  -- Update legacy `materials` table if applicable
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

-- Add quantity to products if it doesn't exist to maintain parity
ALTER TABLE products ADD COLUMN IF NOT EXISTS quantity NUMERIC(10,2) DEFAULT 0;

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


-- 6. Insert Default Main Warehouse so existing system has a fallback
INSERT INTO warehouses (id, name, type)
VALUES (1, 'Main Warehouse', 'internal')
ON CONFLICT DO NOTHING;

-- If it got ID 1 from conflict or insert, ensure we have a default location
INSERT INTO warehouse_locations (id, warehouse_id, code, description)
VALUES (1, 1, 'DEF-LOC', 'Default Location')
ON CONFLICT DO NOTHING;

COMMIT;
