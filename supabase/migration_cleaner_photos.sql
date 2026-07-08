-- CleanConnect: Cleaner profile photo
-- Run in Supabase SQL Editor

-- ─── 1. Add photo_url to profiles ─────────────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- ─── 2. Storage bucket for cleaner photos (public, 5 MB limit) ─────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'cleaner-photos',
  'cleaner-photos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ─── 3. Storage RLS policies ──────────────────────────────────────────────────

DROP POLICY IF EXISTS "Cleaner photos are publicly readable"    ON storage.objects;
DROP POLICY IF EXISTS "Super admins can upload cleaner photos"  ON storage.objects;
DROP POLICY IF EXISTS "Super admins can update cleaner photos"  ON storage.objects;
DROP POLICY IF EXISTS "Super admins can delete cleaner photos"  ON storage.objects;

CREATE POLICY "Cleaner photos are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'cleaner-photos');

CREATE POLICY "Super admins can upload cleaner photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'cleaner-photos'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Super admins can update cleaner photos"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'cleaner-photos'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Super admins can delete cleaner photos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'cleaner-photos'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );
