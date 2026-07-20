-- CleanConnect: furniture photo/video uploads for bookings (unlimited count)
-- Run in Supabase SQL Editor
--
-- This file was originally written for a 5-photo-max, image-only version of
-- this feature. The bucket config was later widened directly via the
-- Supabase dashboard (public + 50MB + video support) without this file being
-- updated, and the column ended up named furniture_images (plain TEXT[],
-- written by the mobile app) rather than furniture_photo_urls/
-- furniture_quantity. The statements below reflect what's actually live in
-- production, so a fresh project run against this file matches it exactly.

-- ─── 1. Add furniture photo/video URLs column to bookings ─────────────────────
-- Flat array of fully-qualified public storage URLs (images and/or a video),
-- written by the mobile app. No separate quantity column.

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS furniture_images TEXT[];

-- ─── 2. Storage bucket for furniture photos/videos (public, 50 MB limit) ──────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'furniture-photos',
  'furniture-photos',
  true,
  52428800,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'video/mp4', 'video/quicktime', 'video/webm']
)
ON CONFLICT (id) DO NOTHING;

-- Corrects a bucket already created by an earlier run of this file (private,
-- image-only, 10MB) to match the config that's actually live in production.
UPDATE storage.buckets
SET public             = true,
    file_size_limit    = 52428800,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'video/mp4', 'video/quicktime', 'video/webm']
WHERE id = 'furniture-photos';

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

-- Super admin can read all furniture photos
CREATE POLICY "Staff read all furniture photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'furniture-photos'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role = 'super_admin'
    )
  );
