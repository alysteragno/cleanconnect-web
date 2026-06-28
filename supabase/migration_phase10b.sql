-- CleanConnect Phase 10b: Service Categories + Services Enhancement
-- Run AFTER migration_phase10.sql

-- ─── 1. service_categories ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS service_categories (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT    NOT NULL UNIQUE,
  icon       TEXT,           -- Feather icon name used by the mobile app
  sort_order INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE service_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read service_categories"     ON service_categories;
DROP POLICY IF EXISTS "Super admins manage service_categories" ON service_categories;

CREATE POLICY "Anyone can read service_categories"
  ON service_categories FOR SELECT USING (true);

CREATE POLICY "Super admins manage service_categories"
  ON service_categories FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));

-- ─── 2. Rename existing columns (idempotent) ─────────────────────────────────

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'price_from'
  ) THEN
    ALTER TABLE services RENAME COLUMN price_from TO starting_price;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'duration_note'
  ) THEN
    ALTER TABLE services RENAME COLUMN duration_note TO duration;
  END IF;
END $$;

-- ─── 3. Add new columns to services ──────────────────────────────────────────

ALTER TABLE services
  ADD COLUMN IF NOT EXISTS category_id  UUID REFERENCES service_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS service_type TEXT;

-- ─── 4. Seed categories (fixed UUIDs so updates below are deterministic) ─────

INSERT INTO service_categories (id, name, icon, sort_order)
VALUES
  ('11111111-1111-1111-1111-000000000001'::uuid, 'Cleaning Services', 'wind',        1),
  ('11111111-1111-1111-1111-000000000002'::uuid, 'Deep Cleaning',     'layers',      2),
  ('11111111-1111-1111-1111-000000000003'::uuid, 'Aircon Services',   'thermometer', 3),
  ('11111111-1111-1111-1111-000000000004'::uuid, 'Grease Trap',       'droplet',     4)
ON CONFLICT (name) DO NOTHING;

-- ─── 5. Back-fill services with category + display metadata ──────────────────

UPDATE services SET category_id = '11111111-1111-1111-1111-000000000004'::uuid, service_type = 'general',          duration = '30 mins'  WHERE slug = 'grease_trap';
UPDATE services SET category_id = '11111111-1111-1111-1111-000000000003'::uuid, service_type = 'general',          duration = '1 hour'   WHERE slug = 'aircon_cleaning';
UPDATE services SET category_id = '11111111-1111-1111-1111-000000000002'::uuid, service_type = 'general',          duration = '2 hours'  WHERE slug = 'sofa_cleaning';
UPDATE services SET category_id = '11111111-1111-1111-1111-000000000003'::uuid, service_type = 'general',          duration = '2 hours'  WHERE slug = 'aircon_repair';
UPDATE services SET category_id = '11111111-1111-1111-1111-000000000002'::uuid, service_type = 'premium_mattress', duration = '2 hours'  WHERE slug = 'mattress_cleaning';
UPDATE services SET category_id = '11111111-1111-1111-1111-000000000004'::uuid, service_type = 'general',          duration = NULL       WHERE slug = 'grease_trap_installation';
UPDATE services SET category_id = '11111111-1111-1111-1111-000000000002'::uuid, service_type = 'general',          duration = '2 hours'  WHERE slug = 'carpet_cleaning';
UPDATE services SET category_id = '11111111-1111-1111-1111-000000000001'::uuid, service_type = 'general',          duration = '30 mins'  WHERE slug = 'curtain_dry_cleaning';

-- ─── 6. View: average rating per service_type ─────────────────────────────────

CREATE OR REPLACE VIEW service_ratings AS
SELECT
  b.service_type,
  ROUND(AVG(f.rating)::numeric, 1) AS avg_rating,
  COUNT(f.id)::integer              AS review_count
FROM feedback f
JOIN bookings b ON b.id = f.booking_id
GROUP BY b.service_type;
