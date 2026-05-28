# IMPLEMENTATION PLAN: CleanConnect Operations System

Based on the operational requirements of Cleaning Lady PH, this document outlines the technical blueprint for the CleanConnect platform. It details the Supabase database architecture, PostgreSQL business logic, security policies, and the Next.js routing structure.

## 1. SUPABASE DATABASE ARCHITECTURE & SCHEMAS

### ENUMS
```sql
CREATE TYPE user_role AS ENUM ('super_admin', 'branch_manager', 'cleaner', 'customer');
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled');
CREATE TYPE payment_status AS ENUM ('unpaid', 'partial', 'paid', 'refunded');
```

### TABLES

**1. branches**
Stores the physical/franchise locations (e.g., Manila, Cebu, Baguio, Quezon City, Muntinlupa).
- `id` (UUID, Primary Key)
- `name` (Text, e.g., 'Manila Branch')
- `region` (Text)
- `contact_number` (Text)
- `created_at` (Timestamptz)

**2. profiles**
Extends Supabase `auth.users` to store application-specific user data.
- `id` (UUID, Primary Key, References `auth.users.id`)
- `role` (user_role, default: 'customer')
- `full_name` (Text)
- `phone` (Text)
- `branch_id` (UUID, Foreign Key to `branches.id`, nullable for customers/super_admin)
- `created_at` (Timestamptz)

**3. bookings**
The core operational entity tracking service requests.
- `id` (UUID, Primary Key)
- `customer_id` (UUID, Foreign Key to `profiles.id`)
- `branch_id` (UUID, Foreign Key to `branches.id`)
- `service_date` (Date)
- `service_time` (Time)
- `property_sqm` (Numeric)
- `required_cleaners` (Integer) -- Assigned via trigger
- `duration_hours` (Numeric) -- Assigned via trigger
- `base_price` (Numeric) -- Assigned via trigger
- `status` (booking_status, default: 'pending')
- `payment_status` (payment_status, default: 'unpaid')
- `created_at` (Timestamptz)

**4. cleaner_assignments**
Maps cleaners to specific bookings and tracks their individual job status.
- `id` (UUID, Primary Key)
- `booking_id` (UUID, Foreign Key to `bookings.id`)
- `cleaner_id` (UUID, Foreign Key to `profiles.id`)
- `assigned_at` (Timestamptz)
- `status` (Text: 'offered', 'accepted', 'declined', 'completed')

---

## 2. CORE BUSINESS ENGINE (POSTGRESQL TRIGGERS)

To ensure consistency across the application, manpower estimation and pricing will be handled at the database level using a PostgreSQL trigger.

### Trigger Function: `apply_cleanconnect_operational_rules()`
This function automatically calculates `required_cleaners`, `duration_hours`, and `base_price` before a booking is inserted or updated, based on the property size (`property_sqm`).

> [!NOTE]
> The exact pricing and duration metrics are modeled based on standard cleaning industry benchmarks for property sizes. These can be adjusted to match exact Cleaning Lady PH rates if needed.

```sql
CREATE OR REPLACE FUNCTION apply_cleanconnect_operational_rules()
RETURNS TRIGGER AS $$
BEGIN
    -- Operational Logic for Cleaning Lady PH
    IF NEW.property_sqm <= 30 THEN
        NEW.required_cleaners := 1;
        NEW.duration_hours := 2.0;
        NEW.base_price := 1000.00;
    ELSIF NEW.property_sqm <= 60 THEN
        NEW.required_cleaners := 2;
        NEW.duration_hours := 3.0;
        NEW.base_price := 1800.00;
    ELSIF NEW.property_sqm <= 100 THEN
        NEW.required_cleaners := 3;
        NEW.duration_hours := 4.0;
        NEW.base_price := 2500.00;
    ELSE
        -- For properties larger than 100 sqm, add 1 cleaner and 1 hour per additional 50 sqm
        NEW.required_cleaners := 3 + CEIL((NEW.property_sqm - 100) / 50.0);
        NEW.duration_hours := 4.0 + CEIL((NEW.property_sqm - 100) / 50.0);
        NEW.base_price := 2500.00 + (CEIL((NEW.property_sqm - 100) / 50.0) * 800.00);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_operational_rules
BEFORE INSERT OR UPDATE OF property_sqm ON bookings
FOR EACH ROW
EXECUTE FUNCTION apply_cleanconnect_operational_rules();
```

---

## 3. DATA ISOLATION & MULTI-TENANCY SECURITY (RLS)

Row-Level Security (RLS) ensures that multi-branch operations remain isolated and secure.

> [!IMPORTANT]
> The `auth.uid()` function is used to fetch the current user's profile and evaluate their `role` and `branch_id`.

**Policy 1: Super Admin Global Access**
```sql
CREATE POLICY "Super admins have full access to bookings"
ON bookings FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'super_admin'
  )
);
```

**Policy 2: Branch Manager Isolation**
```sql
CREATE POLICY "Branch managers can access their branch bookings"
ON bookings FOR ALL
USING (
  branch_id IN (
    SELECT branch_id FROM profiles 
    WHERE id = auth.uid() AND role = 'branch_manager'
  )
);
```

**Policy 3: Cleaner Job Visibility**
```sql
CREATE POLICY "Cleaners can view bookings they are assigned to"
ON bookings FOR SELECT
USING (
  id IN (
    SELECT booking_id FROM cleaner_assignments 
    WHERE cleaner_id = auth.uid()
  )
);
```

**Policy 4: Customer Data Privacy**
```sql
CREATE POLICY "Customers can access their own bookings"
ON bookings FOR ALL
USING (customer_id = auth.uid());
```

---

## 4. WEB-FIRST APPLICATION ROUTING BLUEPRINT

The application will use Next.js App Router with Route Groups to logically separate marketing, authentication, and internal dashboards.

### Directory Layout Map

```text
src/app/
├── (marketing)/
│   ├── page.tsx               # Public landing page showcasing services
│   ├── about/page.tsx         # About Cleaning Lady PH
│   └── contact/page.tsx       # Contact information
├── (auth)/
│   ├── login/page.tsx         # Universal login page
│   └── register/page.tsx      # Customer registration
└── (dashboard)/
    ├── layout.tsx             # Shared dashboard shell (Sidebar, Header)
    ├── admin/                 # (super-admin) Global overview, all branches, system settings
    ├── manager/               # (branch-manager) Branch-specific bookings, cleaner deployment
    ├── cleaner/               # Cleaner job offers, schedule, earnings
    └── customer/              # Service requests, booking history, feedback
```

### File-by-File Roadmap

1. **`src/middleware.ts`**
   - **Purpose:** Route protection and role-based redirection.
   - **Logic:** Verifies the user's Supabase session on every request. Determines if the user role (from jwt claims or profile) matches the requested dashboard route (e.g. `/manager`). Unauthenticated users are redirected to `/login`.

2. **`src/app/(auth)/login/page.tsx`**
   - **Purpose:** Universal entry point for all users.
   - **Logic:** Authenticates via Supabase. Upon successful login, fetches the user's role from the `profiles` table and routes them to their respective dashboard route group.

3. **`src/app/(dashboard)/manager/page.tsx`**
   - **Purpose:** The operational nerve center for a specific location.
   - **Logic:** Fetches `bookings` filtered by the manager's `branch_id`. Displays pending bookings requiring deployment, active jobs, and cleaner statuses.

4. **`src/app/(dashboard)/customer/page.tsx`**
   - **Purpose:** Client self-service portal.
   - **Logic:** Allows clients to input property details (sqm), pick a schedule, and submit a booking. The UI displays the base price calculated by the PostgreSQL trigger instantly upon submission.
