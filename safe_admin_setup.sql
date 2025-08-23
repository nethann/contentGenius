-- Safe Admin System Setup SQL
-- This script safely creates/updates admin functionality without conflicts
-- Run this in your Supabase SQL Editor

-- First, let's create the user_profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    user_tier TEXT DEFAULT 'guest' CHECK (user_tier IN ('guest', 'pro', 'developer')),
    subscription_status TEXT DEFAULT 'inactive' CHECK (subscription_status IN ('active', 'inactive', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Admin-specific columns
    admin_role TEXT DEFAULT NULL,
    last_admin_action TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    admin_notes TEXT DEFAULT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_tier ON user_profiles(user_tier);
CREATE INDEX IF NOT EXISTS idx_user_profiles_created_at ON user_profiles(created_at);

-- Enable RLS on user_profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for user_profiles (drop if exists, then recreate)
DROP POLICY IF EXISTS "Users can read own profile" ON user_profiles;
CREATE POLICY "Users can read own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admin can read all profiles" ON user_profiles;
CREATE POLICY "Admin can read all profiles" ON user_profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles up 
            WHERE up.id = auth.uid() 
            AND up.user_tier IN ('developer')
        )
    );

DROP POLICY IF EXISTS "Admin can update all profiles" ON user_profiles;
CREATE POLICY "Admin can update all profiles" ON user_profiles
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM user_profiles up 
            WHERE up.id = auth.uid() 
            AND up.user_tier IN ('developer')
        )
    );

-- Create admin activity log table (safe)
CREATE TABLE IF NOT EXISTS admin_activity_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    admin_user_id UUID REFERENCES auth.users(id),
    admin_email TEXT NOT NULL,
    action_type TEXT NOT NULL,
    target_user_id UUID REFERENCES auth.users(id),
    target_user_email TEXT,
    old_value TEXT,
    new_value TEXT,
    action_details JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for admin activity log (safe)
CREATE INDEX IF NOT EXISTS idx_admin_activity_admin_user ON admin_activity_log(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_activity_target_user ON admin_activity_log(target_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_activity_created_at ON admin_activity_log(created_at);

-- Enable RLS on admin_activity_log
ALTER TABLE admin_activity_log ENABLE ROW LEVEL SECURITY;

-- Create policies for admin_activity_log (drop if exists, then recreate)
DROP POLICY IF EXISTS "Admin can read activity logs" ON admin_activity_log;
CREATE POLICY "Admin can read activity logs" ON admin_activity_log
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles up 
            WHERE up.id = auth.uid() 
            AND up.user_tier IN ('developer')
        )
    );

DROP POLICY IF EXISTS "Admin can insert activity logs" ON admin_activity_log;
CREATE POLICY "Admin can insert activity logs" ON admin_activity_log
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles up 
            WHERE up.id = auth.uid() 
            AND up.user_tier IN ('developer')
        )
    );

-- Drop and recreate the log_admin_action function to avoid conflicts
DROP FUNCTION IF EXISTS log_admin_action(UUID, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, JSONB);

CREATE FUNCTION log_admin_action(
    p_admin_user_id UUID,
    p_admin_email TEXT,
    p_action_type TEXT,
    p_target_user_id UUID DEFAULT NULL,
    p_target_user_email TEXT DEFAULT NULL,
    p_old_value TEXT DEFAULT NULL,
    p_new_value TEXT DEFAULT NULL,
    p_action_details JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    log_id UUID;
BEGIN
    INSERT INTO admin_activity_log (
        admin_user_id,
        admin_email,
        action_type,
        target_user_id,
        target_user_email,
        old_value,
        new_value,
        action_details,
        created_at
    ) VALUES (
        p_admin_user_id,
        p_admin_email,
        p_action_type,
        p_target_user_id,
        p_target_user_email,
        p_old_value,
        p_new_value,
        p_action_details,
        NOW()
    ) RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$;

-- Create a function to handle user profile creation on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, user_tier)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    CASE 
      WHEN NEW.email IN ('nethan.nagendran@gmail.com', 'nethmarket@gmail.com') THEN 'developer'
      ELSE 'guest'
    END
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Create trigger for new user signup (drop if exists, then recreate)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Success message
SELECT 'Safe admin system setup completed successfully! 🎉' as status,
       'user_profiles table created/verified' as user_profiles_status,
       'admin_activity_log table created/verified' as activity_log_status,
       'RLS policies updated' as security_status,
       'Triggers configured' as trigger_status;