-- CleanConnect Supabase Database Schema

-- 1. ENUMS
CREATE TYPE user_role AS ENUM ('super_admin', 'branch_manager', 'cleaner', 'customer');
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled');
CREATE TYPE payment_status AS ENUM ('unpaid', 'partial', 'paid', 'refunded');
CREATE TYPE assignment_status AS ENUM ('offered', 'accepted', 'declined', 'completed');

-- 2. TABLES

-- Table: branches
CREATE TABLE branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    region TEXT NOT NULL,
    contact_number TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: profiles
-- Extends the Supabase auth.users table
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role user_role NOT NULL DEFAULT 'customer',
    full_name TEXT NOT NULL,
    phone TEXT,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


 
-- Table: bookings
CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    service_date DATE NOT NULL,
    service_time TIME NOT NULL,
    property_sqm NUMERIC NOT NULL,
    required_cleaners INTEGER, -- Assigned via trigger
    duration_hours NUMERIC, -- Assigned via trigger
    base_price NUMERIC, -- Assigned via trigger
    status booking_status NOT NULL DEFAULT 'pending',
    payment_status payment_status NOT NULL DEFAULT 'unpaid',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: cleaner_assignments
CREATE TABLE cleaner_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    cleaner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status assignment_status NOT NULL DEFAULT 'offered',
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- A cleaner can only be assigned to a specific booking once
    UNIQUE(booking_id, cleaner_id)
);
--inputed in sql editor up until this here :)--
-- 3. CORE BUSINESS ENGINE (POSTGRESQL TRIGGERS)

-- Trigger Function: apply_cleanconnect_operational_rules
-- Automatically calculates required_cleaners, duration_hours, and base_price
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
        -- For properties larger than 100 sqm:
        -- Base is 3 cleaners, 4 hours, 2500 PHP
        -- Add 1 cleaner and 1 hour per additional 50 sqm (or fraction thereof)
        -- Add 800 PHP per additional 50 sqm (or fraction thereof)
        NEW.required_cleaners := 3 + CEIL((NEW.property_sqm - 100) / 50.0);
        NEW.duration_hours := 4.0 + CEIL((NEW.property_sqm - 100) / 50.0);
        NEW.base_price := 2500.00 + (CEIL((NEW.property_sqm - 100) / 50.0) * 800.00);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger attached to the bookings table
CREATE TRIGGER trigger_operational_rules
BEFORE INSERT OR UPDATE OF property_sqm ON bookings
FOR EACH ROW
EXECUTE FUNCTION apply_cleanconnect_operational_rules();
