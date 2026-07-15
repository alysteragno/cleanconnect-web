-- Complaint archiving --------------------------------------------------------
-- Lets admins archive a complaint to clear it from the active list WITHOUT
-- deleting any data. Archiving is orthogonal to `status` (open/in_progress/
-- resolved) — the original status is preserved. A NULL archived_at means active;
-- a timestamp means archived (and records when). Archived complaints remain fully
-- readable and can be restored (archived_at set back to NULL).

ALTER TABLE complaints
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS complaints_archived_at_idx
  ON complaints (archived_at);
