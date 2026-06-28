-- Migrate assignment_status ENUM: replace 'offered'/'accepted' with 'assigned'
-- Run in Supabase SQL Editor

-- 1. Rename 'offered' → 'assigned' in-place (no new value added, safe in one transaction)
--    Existing rows with status='offered' are automatically updated by PostgreSQL.
ALTER TYPE assignment_status RENAME VALUE 'offered' TO 'assigned';

-- 2. Update remaining 'accepted' rows to 'assigned'
--    'assigned' now exists (renamed from 'offered'), so this is safe to use immediately.
UPDATE cleaner_assignments SET status = 'assigned' WHERE status = 'accepted';

-- Note: 'accepted' remains in the ENUM definition but is no longer used by the app.
