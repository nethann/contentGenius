-- Create Your User Profile Manually
-- Run this in Supabase SQL Editor after signing in

-- Step 1: First, find your user ID
SELECT 
    id as user_id, 
    email, 
    created_at as signed_up_at
FROM auth.users 
ORDER BY created_at DESC 
LIMIT 5;

-- Step 2: Create your profile (REPLACE THE VALUES BELOW)
-- Replace 'YOUR_USER_ID_HERE' with your actual user ID from step 1
-- Replace 'your-email@example.com' with your actual email

INSERT INTO user_profiles (id, email, user_tier, full_name, created_at, updated_at)
VALUES (
    'YOUR_USER_ID_HERE'::UUID,  -- Replace with your actual user ID
    'your-email@example.com',   -- Replace with your actual email
    'pro',                      -- Set to 'pro', 'developer', or 'guest'
    'Your Name',                -- Replace with your name
    NOW(),
    NOW()
)
ON CONFLICT (id) 
DO UPDATE SET 
    user_tier = EXCLUDED.user_tier,
    full_name = EXCLUDED.full_name,
    updated_at = NOW();

-- Step 3: Verify your profile was created
SELECT 
    id,
    email,
    user_tier,
    full_name,
    created_at
FROM user_profiles
WHERE email = 'your-email@example.com';  -- Replace with your email

-- Success message
SELECT 'User profile created successfully!' as status;