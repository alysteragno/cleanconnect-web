-- CleanConnect: Furniture quantity + 5 required photo uploads for bookings
-- Run in Supabase SQL Editor

-- ─── 1. Add columns to bookings ───────────────────────────────────────────────

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS furniture_quantity  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS furniture_photo_urls TEXT[]  NOT NULL DEFAULT '{}';

-- ─── 2. Storage bucket for furniture photos (authenticated only, 10 MB limit) ─

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'furniture-photos',
  'furniture-photos',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

-- ─── 3. Storage RLS policies ──────────────────────────────────────────────────

DROP POLICY IF EXISTS "Customers upload own furniture photos" ON storage.objects;
DROP POLICY IF EXISTS "Staff read all furniture photos"       ON storage.objects;
DROP POLICY IF EXISTS "Customers read own furniture photos"   ON storage.objects;

-- Customers can upload photos into a folder named after their user id
CREATE POLICY "Customers upload own furniture photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'furniture-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Customers can view only their own photos
CREATE POLICY "Customers read own furniture photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'furniture-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Staff (super_admin, branch_manager) can read all furniture photos
CREATE POLICY "Staff read all furniture photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'furniture-photos'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('super_admin', 'branch_manager')
    )
  );
