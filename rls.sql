-- CleanConnect Row-Level Security (RLS) Policies

-- 1. Enable RLS on all core tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE cleaner_assignments ENABLE ROW LEVEL SECURITY;

-- 2. PROFILES POLICIES
-- Users can read their own profile
CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
USING (auth.uid() = id);

-- Super admins can view all profiles
CREATE POLICY "Super admins can view all profiles"
ON profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'super_admin'
  )
);


-- Users can update their own profile (e.g. name, phone)
CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
USING (auth.uid() = id);


-- 4. BOOKINGS POLICIES
-- Super Admin Global Access
CREATE POLICY "Super admins have full access to bookings"
ON bookings FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'super_admin'
  )
);


-- Cleaner Job Visibility (Can only SELECT bookings they are assigned to)
CREATE POLICY "Cleaners can view bookings they are assigned to"
ON bookings FOR SELECT
USING (
  id IN (
    SELECT booking_id FROM cleaner_assignments 
    WHERE cleaner_id = auth.uid()
  )
);

-- Customer Data Privacy (Can fully manage their own bookings)
CREATE POLICY "Customers can access their own bookings"
ON bookings FOR ALL
USING (customer_id = auth.uid());


-- 5. CLEANER ASSIGNMENTS POLICIES
-- Super admins have full access
CREATE POLICY "Super admins have full access to cleaner assignments"
ON cleaner_assignments FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'super_admin'
  )
);


-- Cleaners can see their own assignments
CREATE POLICY "Cleaners can access their own assignments"
ON cleaner_assignments FOR SELECT
USING (cleaner_id = auth.uid());

-- Cleaners can update their own assignments (e.g. accepting/declining/completing)
CREATE POLICY "Cleaners can update their own assignments"
ON cleaner_assignments FOR UPDATE
USING (cleaner_id = auth.uid());
