ALTER TABLE materials
  ADD COLUMN IF NOT EXISTS color VARCHAR(80);

UPDATE materials
SET color = COALESCE(color, NULLIF(TRIM(colors), ''))
WHERE (color IS NULL OR TRIM(COALESCE(color, '')) = '')
  AND colors IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'materials_name_key'
  ) THEN
    ALTER TABLE materials DROP CONSTRAINT materials_name_key;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'materials_name_color_key'
  ) THEN
    ALTER TABLE materials
      ADD CONSTRAINT materials_name_color_key UNIQUE (name, color);
  END IF;
END $$;

