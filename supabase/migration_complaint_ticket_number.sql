-- Adds a human-readable, sequential ticket number to complaints (displayed
-- as "CMP-000123" in the app — see formatTicketNumber in
-- src/lib/complaint-ticket.ts) so admins and customers have a short,
-- memorable reference instead of a UUID, the same way a bank queue number
-- identifies a transaction.
--
-- Run in Supabase SQL Editor.

-- 1. The sequence backing the number. Created before the column so the
--    column can default to it once backfilled.
CREATE SEQUENCE IF NOT EXISTS complaints_ticket_number_seq;

-- 2. Add the column nullable first — existing rows get backfilled next.
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS ticket_number INTEGER;

-- 3. Backfill existing complaints in chronological order, so ticket #1 is
--    the oldest complaint on file rather than an arbitrary assignment.
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) AS rn
  FROM complaints
  WHERE ticket_number IS NULL
)
UPDATE complaints c SET ticket_number = ordered.rn
FROM ordered
WHERE c.id = ordered.id;

-- 4. Advance the sequence past whatever was just backfilled so the next
--    new complaint continues the count instead of colliding with it.
SELECT setval('complaints_ticket_number_seq', COALESCE((SELECT MAX(ticket_number) FROM complaints), 0));

-- 5. New rows get the next number automatically — no application code needs
--    to set ticket_number on insert (see fileComplaint / startCustomerChat
--    in src/app/actions/complaints.ts, both insert without it already).
ALTER TABLE complaints ALTER COLUMN ticket_number SET DEFAULT nextval('complaints_ticket_number_seq');

-- 6. Enforce unique + not-null now that every row has a value.
ALTER TABLE complaints ALTER COLUMN ticket_number SET NOT NULL;
ALTER TABLE complaints ADD CONSTRAINT complaints_ticket_number_unique UNIQUE (ticket_number);

-- 7. Tie the sequence's lifetime to the column (dropped together if the
--    column is ever dropped), same as a native SERIAL column would be.
ALTER SEQUENCE complaints_ticket_number_seq OWNED BY complaints.ticket_number;
