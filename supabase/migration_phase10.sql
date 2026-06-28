-- CleanConnect Phase 10 Migration: Services Catalog
-- Run in Supabase SQL Editor

-- 1. Services table
CREATE TABLE IF NOT EXISTS services (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  slug          TEXT        NOT NULL UNIQUE,
  description   TEXT,
  price_from    NUMERIC     NOT NULL DEFAULT 0,
  price_note    TEXT,
  duration_note TEXT,
  image_url     TEXT,
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  sort_order    INTEGER     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. RLS
ALTER TABLE services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read services"   ON services;
DROP POLICY IF EXISTS "Super admins manage services" ON services;

CREATE POLICY "Anyone can read services"
  ON services FOR SELECT USING (true);

CREATE POLICY "Super admins manage services"
  ON services FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));

-- 3. Storage bucket for service images (public, 5 MB limit)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'service-images',
  'service-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- 4. Storage RLS
DROP POLICY IF EXISTS "Service images are publicly readable"   ON storage.objects;
DROP POLICY IF EXISTS "Super admins can upload service images" ON storage.objects;
DROP POLICY IF EXISTS "Super admins can update service images" ON storage.objects;
DROP POLICY IF EXISTS "Super admins can delete service images" ON storage.objects;

CREATE POLICY "Service images are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'service-images');

CREATE POLICY "Super admins can upload service images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'service-images'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Super admins can update service images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'service-images'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Super admins can delete service images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'service-images'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- 5. Seed services
INSERT INTO services (name, slug, description, price_from, price_note, duration_note, sort_order)
VALUES
  ('Grease Trap Cleaning',        'grease_trap',              'Professional grease trap cleaning to remove built-up fats, oils, and grease. Keeps drains flowing and odor-free.',        700,  '₱700',              '30 mins',  1),
  ('Aircon Cleaning',             'aircon_cleaning',           'Deep cleaning of air conditioning units including filters, coils, and drain pans for optimal cooling performance.',        700,  '₱700 – ₱1,500',    '1 hour',   2),
  ('Sofa / Couch Cleaning',       'sofa_cleaning',             'Professional fabric and leather sofa cleaning. Removes stains, dust mites, and allergens for a fresh, sanitized finish.', 500,  '₱500 – ₱2,500',    '2 hours',  3),
  ('Aircon Repair',               'aircon_repair',             'Diagnosis and repair of common air conditioning issues including refrigerant recharge, electrical faults, and leaks.',     2000, '₱2,000 – ₱2,500',  '2 hours',  4),
  ('Mattress Deep Cleaning',      'mattress_cleaning',         'Deep mattress cleaning with UV treatment to eliminate dust mites, stains, and allergens for a healthier sleep environment.', 800, '₱800 – ₱3,000',   '2 hours',  5),
  ('Grease Trap Installation',    'grease_trap_installation',  'Supply and installation of grease traps for commercial kitchens and food service establishments.',                          4000, '₱4,000 – ₱5,000',  NULL,       6),
  ('Carpet Cleaning',             'carpet_cleaning',           'Hot water extraction carpet cleaning that removes deep-seated dirt, stains, and bacteria from all carpet types.',           800,  '₱800',              '2 hours',  7),
  ('Curtain Dry Cleaning',        'curtain_dry_cleaning',      'Professional on-site curtain dry cleaning. No need to take them down — we clean and freshen them in place.',               500,  '₱500',              '30 mins',  8)
ON CONFLICT (slug) DO NOTHING;
