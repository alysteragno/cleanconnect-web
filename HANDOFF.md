# CleanConnect — Session Handoff

## What Was Done This Session

### Auth & Profile Fixes
- Fixed "Database error saving new user" — was caused by a trigger conflict
- `register` server action now uses `createAdminClient()` to bypass RLS on profile insert
- Added `SELECT` RLS policy on `profiles` so the login action can read role after sign-in
- `createCleanerAccount` in `src/app/actions/admin.ts` now uses `auth.admin.createUser()` instead of `anonClient.auth.signUp()` — bypasses email rate limits and confirmation
- Removed `src/utils/supabase/anon-client.ts` dependency from admin actions

### Marketing Pages (Phase 3)
- Extracted shared constants to `src/lib/marketing-data.ts` (SERVICES, BRANCHES, STEPS, NAV_LINKS)
- Built shared components: `src/components/marketing/header.tsx`, `footer.tsx`, `section-header.tsx`
- Created `src/app/(marketing)/layout.tsx`
- Built `src/app/(marketing)/about/page.tsx` and `src/app/(marketing)/contact/page.tsx`
- Refactored `src/app/page.tsx` to use shared components

### Phase 9 — Payment (Modified: No PayMongo)
- Client changed requirement: PayMongo dropped, replaced with Cash / GCash / Bank Transfer (manual)
- Updated `booking-stepper.tsx` payment options: `card` → `bank_transfer`
- Payment details now stored in Supabase `settings` table (admin-editable, no code changes needed)
- Built `src/app/(dashboard)/admin/settings/page.tsx` — admin can update GCash number, bank account, reference note
- Built `src/app/actions/settings.ts`
- `src/app/(dashboard)/customer/bookings/[id]/page.tsx` shows payment instructions (GCash/bank) pulled from DB
- Booking action now redirects to `/customer/bookings/[id]?new=true` after creation (was `/customer?booked=true`)
- Deleted `src/lib/payment-config.ts`

### Phase 10 — Notifications + Complaints
- Built `src/app/actions/notifications.ts` — `createNotification()` + `markAllNotificationsRead()`
- Built `src/app/actions/complaints.ts` — `fileComplaint()`, `sendComplaintMessage()`, `updateComplaintStatus()`
- Built `src/components/dashboard/notification-bell.tsx` — Supabase Realtime bell, shows unread badge, role-aware links
- Built `src/components/dashboard/complaint-thread.tsx` — shared Realtime chat component used by customer + admin
- Wired notifications into `src/app/actions/bookings.ts` — notifies customer + staff on booking submit
- Updated `src/app/(dashboard)/layout.tsx` — added bell to header, Complaints nav link for customer + admin
- Built customer complaints: list, new form, thread detail
- Built admin complaints: list, thread detail + status control (Open → In Progress → Resolved)

### Schema
- `schema.sql` fully rewritten — single source of truth, includes all tables, columns, trigger, RLS, Realtime
- `seed.sql` created — branches, payment settings, super admin bootstrap
- New tables added this session: `complaints`, `notifications`, `complaint_messages`, `settings`
- Client name in seed data: **Maid For You Cleaning Services** (not yet renamed in code — see below)

---

## Pending / Not Yet Done

### Client Name Rename
- Codebase still says "Cleaning Lady PH" and "CleanConnect" in many places
- Client name is **Maid For You Cleaning Services**
- User will give the go-ahead for a full rename pass — do it with a codebase-wide find + replace
- Files most affected: `src/app/page.tsx`, `src/app/(marketing)/about/page.tsx`, `src/components/marketing/header.tsx`, `src/components/marketing/footer.tsx`, `schema.sql` comments

### Geo-tagging Arrival Validation (FRS Requirement — not built)
- FRS requires: "Validates the cleaner's arrival at the service location using geo-tagging"
- Needs: Browser Geolocation API on the cleaner's active job page
- When cleaner taps "Start Job", capture their lat/lng and compare to `bookings.service_lat/lng`
- Allow start if within ~500m radius; warn if outside
- Relevant file: cleaner active job view (check `src/app/(dashboard)/cleaner/`)

### PayMongo → Deferred to Pre-Deployment
- Will be swapped in before go-live using invite flow pattern
- Swap point: `src/app/actions/admin.ts` `createCleanerAccount` → change to `auth.admin.inviteUserByEmail()`

### SMTP / Invite Flow for Staff Accounts
- Currently using `auth.admin.createUser()` — admin sets password manually
- Before deployment: configure Supabase SMTP (Resend or Brevo) and switch to invite flow
- Swap point: same as above

### Reporting & Analytics Page
- `/admin/reports` page exists but contents are unknown — verify it has real data-driven reports
- FRS requires: bookings, revenue, cleaner performance reports

### Customer ↔ Cleaner Messaging
- FRS Messaging & Support module says: "communication between customer and cleaner for service coordination"
- Currently only customer ↔ admin complaints are built
- Needs assessment: is this in scope or is it covered by the cleaner seeing booking details (address, notes)?

---

## SQL Still Needed in Supabase (if starting fresh)
Run in order:
1. `schema.sql` — full database setup
2. `seed.sql` — default data + first super admin

If database already exists (current dev Supabase project), the only outstanding SQL is:
- `settings` table + RLS + seed data (added this session — should already be done)
- `complaints`, `notifications`, `complaint_messages` + RLS + Realtime (from Phase 10 SQL given to user)

---

## Environment Variables Required
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

---

## Key Architectural Decisions Made
- `proxy.ts` (not `middleware.ts`) — Next.js 16 breaking change
- Role stored in `cleanconnect-role` cookie for optimistic middleware routing; real auth via `getUser()` in layout
- All admin-side DB writes use `createAdminClient()` (service role) to bypass RLS
- Payment config is DB-stored in `settings` table, editable by super admin at `/admin/settings`
- Notifications use Supabase Realtime `postgres_changes` on INSERT
- Complaint thread is a shared client component used by both customer and admin detail pages
