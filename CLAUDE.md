@AGENTS.md

# CLAUDE HANDOFF / PROJECT CONTEXT

Welcome Claude! You are picking up the development of **CleanConnect**, an AI-enhanced cleaning service operations system for "Cleaning Lady PH". 

## Current Project State (Phase 1 Completed)
1. The PostgreSQL Database Schema, Types, and Enums have been finalized and created in Supabase (see `schema.sql`).
2. An automated PostgreSQL trigger `apply_cleanconnect_operational_rules()` is attached to the `bookings` table to handle property sqm-based required cleaners and pricing.
3. Row-Level Security (RLS) has been strictly applied to all core tables (see `rls.sql`).
4. The basic Next.js App Router structural directories for Route Groups `(marketing)`, `(auth)`, and `(dashboard)` have been created inside `src/app/`.

## EXACT NEXT STEP: Phase 2 (Authentication & Routing Security)
Your immediate task is to implement the Next.js authentication flow and routing protection.

1. **Supabase Auth Setup:** 
   - Integrate the `@supabase/ssr` or `@supabase/supabase-js` package into the Next.js frontend.
   - Set up the Supabase client utility functions (e.g. `src/utils/supabase/server.ts`, `client.ts`).

2. **Universal Login & Registration:** 
   - Build out the UI in `src/app/(auth)/login/page.tsx` and `src/app/(auth)/register/page.tsx`.
   - Ensure the login dynamically routes users to their specific dashboard based on their role in the `profiles` table (`customer`, `cleaner`, `branch_manager`, `super_admin`).

3. **Route Protection (`src/middleware.ts`):** 
   - Create a Next.js middleware that intercepts requests to `/admin`, `/manager`, `/cleaner`, and `/customer` to verify the user has a valid Supabase session AND the correct role.

Please review `IMPLEMENTATION_PLAN.md` for full architectural details and the layout roadmap. Have fun building!
