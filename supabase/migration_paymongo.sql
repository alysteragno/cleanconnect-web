-- PayMongo integration ------------------------------------------------------
-- Moves digital payment collection (GCash, Maya, cards, etc.) from a manual
-- proof-of-payment / QR flow to PayMongo hosted Checkout Sessions. A booking
-- gets a hosted checkout URL; a webhook flips payment_status to 'paid' once
-- PayMongo confirms the payment. Cash remains manual (cleaner-confirmed).
--
-- These columns are additive and nullable so existing manual/cash bookings are
-- unaffected. Digital bookings that have not yet been sent to PayMongo simply
-- have NULL PayMongo ids.

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS paymongo_checkout_id       TEXT,   -- cs_...  (Checkout Session)
  ADD COLUMN IF NOT EXISTS paymongo_payment_intent_id TEXT,   -- pi_...  (Payment Intent)
  ADD COLUMN IF NOT EXISTS paymongo_payment_id        TEXT,   -- pay_... (settled Payment)
  ADD COLUMN IF NOT EXISTS paymongo_checkout_url       TEXT,   -- hosted checkout page URL
  ADD COLUMN IF NOT EXISTS paid_at                     TIMESTAMPTZ;

-- The webhook looks bookings up by their PayMongo checkout id; index it.
CREATE INDEX IF NOT EXISTS bookings_paymongo_checkout_id_idx
  ON bookings (paymongo_checkout_id);
