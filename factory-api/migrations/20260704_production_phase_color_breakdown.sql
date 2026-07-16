ALTER TABLE production_phases
  ADD COLUMN IF NOT EXISTS color_breakdown JSONB DEFAULT '[]'::jsonb;

