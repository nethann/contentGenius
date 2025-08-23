-- Cleanup Script for Duplicate Supabase Policies
-- Run this in your Supabase SQL Editor to fix the policy conflicts

-- Step 1: Drop all existing policies on user_profiles
DROP POLICY IF EXISTS "Admin can read all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admin can update all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can delete users" ON user_profiles;
DROP POLICY IF EXISTS "Enable all for users" ON user_profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile or admins can update any" ON user_profiles;

-- Step 2: Create clean, simple policies
CREATE POLICY "users_select_own" ON user_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users_insert_own" ON user_profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "users_update_own" ON user_profiles
    FOR UPDATE USING (auth.uid() = id);

-- Step 3: Create admin policies for developer tier users
CREATE POLICY "developers_select_all" ON user_profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles up 
            WHERE up.id = auth.uid() 
            AND up.user_tier = 'developer'
        )
    );

CREATE POLICY "developers_update_all" ON user_profiles
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM user_profiles up 
            WHERE up.id = auth.uid() 
            AND up.user_tier = 'developer'
        )
    );

-- Step 4: Verify the table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
ORDER BY ordinal_position;

-- Step 5: Check if you have a user profile
SELECT 
    id, 
    email, 
    user_tier, 
    created_at
FROM user_profiles 
WHERE id = auth.uid();

-- Success message
SELECT 'Policies cleaned up successfully!' as status;