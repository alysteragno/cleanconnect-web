-- Run in Supabase SQL Editor.
-- Follow-up to migration_paymongo.sql. That migration only ever stored bare
-- PayMongo-issued IDs (checkout id, payment intent id, payment id) and a
-- checkout URL — nothing about what was actually charged. The admin booking
-- page had no PayMongo payment detail to show because none of it was ever
-- persisted anywhere: not the amount PayMongo actually processed, not its
-- fee, not which e-wallet/bank the customer used, not PayMongo's own paid
-- timestamp. This adds columns for all of that, captured in
-- src/lib/paymongo.ts (confirmQrPhPayment / confirmCheckoutPayment) and the
-- webhook handler whenever a payment settles.
--
-- All additive/nullable — existing rows and non-PayMongo (cash/bank check)
-- bookings are unaffected.

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS paymongo_amount        NUMERIC(10, 2), -- what PayMongo actually processed, pesos
  ADD COLUMN IF NOT EXISTS paymongo_fee            NUMERIC(10, 2), -- PayMongo's fee, pesos
  ADD COLUMN IF NOT EXISTS paymongo_net_amount     NUMERIC(10, 2), -- amount - fee, pesos
  ADD COLUMN IF NOT EXISTS paymongo_currency       TEXT,           -- e.g. 'PHP'
  ADD COLUMN IF NOT EXISTS paymongo_source_type    TEXT,           -- e.g. 'qrph', 'gcash', 'card' — which method the customer actually used
  ADD COLUMN IF NOT EXISTS paymongo_status         TEXT,           -- the settled Payment resource's own status string
  ADD COLUMN IF NOT EXISTS paymongo_paid_at        TIMESTAMPTZ;    -- PayMongo's own paid_at (distinct from bookings.paid_at, which is when THIS app recorded it)
