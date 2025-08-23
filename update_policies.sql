-- Update Database Policies for Content Scalar
-- Run this in your Supabase SQL Editor to fix existing policies

-- Step 1: Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can read own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can insert any profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON user_profiles;

-- Step 2: Create updated RLS Policies
-- User policies
CREATE POLICY "Users can read own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON user_profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Admin policies for nethan.nagendran@gmail.com and nethmarket@gmail.com
CREATE POLICY "Admins can read all profiles" ON user_profiles
    FOR SELECT USING (
        auth.jwt() ->> 'email' = 'nethan.nagendran@gmail.com' OR 
        auth.jwt() ->> 'email' = 'nethmarket@gmail.com'
    );

CREATE POLICY "Admins can update all profiles" ON user_profiles
    FOR UPDATE USING (
        auth.jwt() ->> 'email' = 'nethan.nagendran@gmail.com' OR 
        auth.jwt() ->> 'email' = 'nethmarket@gmail.com'
    );

CREATE POLICY "Admins can insert any profile" ON user_profiles
    FOR INSERT WITH CHECK (
        auth.jwt() ->> 'email' = 'nethan.nagendran@gmail.com' OR 
        auth.jwt() ->> 'email' = 'nethmarket@gmail.com'
    );

CREATE POLICY "Admins can delete profiles" ON user_profiles
    FOR DELETE USING (
        auth.jwt() ->> 'email' = 'nethan.nagendran@gmail.com' OR 
        auth.jwt() ->> 'email' = 'nethmarket@gmail.com'
    );

-- Step 3: Ensure your user profile exists with correct tier
INSERT INTO user_profiles (id, email, full_name, user_tier, subscription_status, created_at, updated_at)
SELECT 
    auth.users.id,
    auth.users.email,
    COALESCE(auth.users.raw_user_meta_data->>'full_name', auth.users.raw_user_meta_data->>'name', ''),
    'developer',
    'active',
    NOW(),
    NOW()
FROM auth.users 
WHERE auth.users.email = 'nethan.nagendran@gmail.com'
ON CONFLICT (id) DO UPDATE SET
    user_tier = 'developer',
    subscription_status = 'active',
    updated_at = NOW();

-- Step 4: Test the setup
SELECT 
    'Policy update completed!' as status,
    COUNT(*) as total_profiles,
    COUNT(CASE WHEN user_tier = 'developer' THEN 1 END) as developer_profiles,
    COUNT(CASE WHEN user_tier = 'pro' THEN 1 END) as pro_profiles,
    COUNT(CASE WHEN user_tier = 'guest' THEN 1 END) as guest_profiles
FROM user_profiles;