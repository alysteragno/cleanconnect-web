-- ─────────────────────────────────────────────────────────────────────────────
-- CleanConnect — Seed Data
-- Run this AFTER schema.sql on a fresh Supabase project.
-- ─────────────────────────────────────────────────────────────────────────────


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. BRANCHES
-- ─────────────────────────────────────────────────────────────────────────────

-- Single branch only — service area is strictly NCR (Metro Manila).
INSERT INTO branches (name, region, contact_number) VALUES
    ('Maid For You Cleaning Services', 'NCR', '+63 2 8XXX XXXX');


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. PAYMENT SETTINGS  (update with real details before go-live)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO settings (key, value) VALUES
  ('gcash_number',          '0917-XXX-XXXX'),
  ('gcash_name',            'Maid For You Cleaning Services'),
  ('bank_name',             'BDO Unibank'),
  ('bank_account_number',   'XXXX-XXXX-XXXX'),
  ('bank_account_name',     'Maid For You Cleaning Services'),
  ('payment_reference_note','Use your Booking ID as the payment reference so we can verify faster.');


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. SUPER ADMIN ACCOUNT
--
-- Step 1: Go to Supabase → Authentication → Users → Add user
--         Create the admin account with the owner's email and a strong password.
-- Step 2: Replace the email below with that exact email, then run this query.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO profiles (id, full_name, role)
VALUES (
    (SELECT id FROM auth.users WHERE email = 'owner@cleaningladyph.com'),
    'Admin',
    'super_admin'
);
