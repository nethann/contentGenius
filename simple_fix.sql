-- Simple Fix for Content Scalar Database Issues
-- Run this FIRST, then try the app again

-- Step 1: Create the exec_sql function if it doesn't exist  
CREATE OR REPLACE FUNCTION exec_sql(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql;
END;
$$;

-- Step 2: Ensure user_profiles table exists
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    user_tier TEXT DEFAULT 'guest' CHECK (user_tier IN ('guest', 'pro', 'developer')),
    subscription_status TEXT DEFAULT 'inactive' CHECK (subscription_status IN ('active', 'inactive', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 3: Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Step 4: Drop and recreate policies to avoid conflicts
DROP POLICY IF EXISTS "Users can read own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can insert any profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON user_profiles;

-- User policies
CREATE POLICY "Users can read own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON user_profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Admin policies
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

-- Step 5: Create your developer profile
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

-- Step 6: Test query
SELECT 
    'Database fix completed!' as status,
    email,
    user_tier,
    subscription_status,
    created_at
FROM user_profiles 
WHERE email = 'nethan.nagendran@gmail.com';