-- Admin System Setup SQL
-- Run this in your Supabase SQL Editor to add admin functionality

-- Add admin-related columns to user_profiles table if they don't exist
DO $$
BEGIN
    -- Check if admin_role column exists, if not add it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_profiles' AND column_name = 'admin_role') THEN
        ALTER TABLE user_profiles ADD COLUMN admin_role TEXT DEFAULT NULL;
    END IF;
    
    -- Check if last_admin_action column exists, if not add it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_profiles' AND column_name = 'last_admin_action') THEN
        ALTER TABLE user_profiles ADD COLUMN last_admin_action TIMESTAMP WITH TIME ZONE DEFAULT NULL;
    END IF;
    
    -- Check if admin_notes column exists, if not add it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_profiles' AND column_name = 'admin_notes') THEN
        ALTER TABLE user_profiles ADD COLUMN admin_notes TEXT DEFAULT NULL;
    END IF;
END $$;

-- Create admin activity log table for tracking admin actions
CREATE TABLE IF NOT EXISTS admin_activity_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    admin_user_id UUID REFERENCES auth.users(id),
    admin_email TEXT NOT NULL,
    action_type TEXT NOT NULL, -- 'tier_change', 'user_delete', 'user_create', etc.
    target_user_id UUID REFERENCES auth.users(id),
    target_user_email TEXT,
    old_value TEXT,
    new_value TEXT,
    action_details JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries on admin activity log
CREATE INDEX IF NOT EXISTS idx_admin_activity_admin_user ON admin_activity_log(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_activity_target_user ON admin_activity_log(target_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_activity_created_at ON admin_activity_log(created_at DESC);

-- Function to log admin actions
CREATE OR REPLACE FUNCTION log_admin_action(
    p_admin_user_id UUID,
    p_admin_email TEXT,
    p_action_type TEXT,
    p_target_user_id UUID DEFAULT NULL,
    p_target_user_email TEXT DEFAULT NULL,
    p_old_value TEXT DEFAULT NULL,
    p_new_value TEXT DEFAULT NULL,
    p_action_details JSONB DEFAULT '{}'
) RETURNS void AS $$
BEGIN
    INSERT INTO admin_activity_log (
        admin_user_id,
        admin_email,
        action_type,
        target_user_id,
        target_user_email,
        old_value,
        new_value,
        action_details
    ) VALUES (
        p_admin_user_id,
        p_admin_email,
        p_action_type,
        p_target_user_id,
        p_target_user_email,
        p_old_value,
        p_new_value,
        p_action_details
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to automatically log tier changes
CREATE OR REPLACE FUNCTION log_tier_change_trigger() 
RETURNS TRIGGER AS $$
BEGIN
    -- Only log if user_tier actually changed
    IF OLD.user_tier IS DISTINCT FROM NEW.user_tier THEN
        -- Update last_admin_action timestamp
        NEW.last_admin_action = NOW();
        
        -- Log the change (note: we can't determine which admin made the change from this trigger)
        -- The AdminService will call log_admin_action() separately for proper admin attribution
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for tier changes if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tier_change_log_trigger') THEN
        CREATE TRIGGER tier_change_log_trigger
        BEFORE UPDATE ON user_profiles
        FOR EACH ROW
        EXECUTE FUNCTION log_tier_change_trigger();
    END IF;
END $$;

-- RLS Policies for admin_activity_log
ALTER TABLE admin_activity_log ENABLE ROW LEVEL SECURITY;

-- Policy: Only allow reading admin logs if user is an admin
CREATE POLICY "Admin can read activity logs" ON admin_activity_log
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles up
            WHERE up.id = auth.uid()
            AND up.email IN (
                'nethan.nagendran@gmail.com',
                'admin@yourcompany.com',
                'manager@yourcompany.com', 
                'support@yourcompany.com',
                'dev@yourcompany.com',
                'tech@yourcompany.com'
            )
        )
    );

-- Policy: Only allow inserting admin logs if user is an admin
CREATE POLICY "Admin can insert activity logs" ON admin_activity_log
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles up
            WHERE up.id = auth.uid()
            AND up.email IN (
                'nethan.nagendran@gmail.com',
                'nethmarket@gmail.com',
                'manager@yourcompany.com',
                'support@yourcompany.com', 
                'dev@yourcompany.com',
                'tech@yourcompany.com'
            )
        )
    );

-- Update RLS policy for user_profiles to allow admins to manage users
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;

-- Recreate the policy to allow both self-updates and admin updates
CREATE POLICY "Users can update own profile or admins can update any" ON user_profiles
    FOR UPDATE USING (
        id = auth.uid() OR -- User can update their own profile
        EXISTS (
            SELECT 1 FROM user_profiles up
            WHERE up.id = auth.uid()
            AND up.email IN (
                'nethan.nagendran@gmail.com',
                'nethmarket@gmail.com',
                'manager@yourcompany.com',
                'support@yourcompany.com',
                'dev@yourcompany.com', 
                'tech@yourcompany.com'
            )
        )
    );

-- Allow admins to delete users
CREATE POLICY "Admins can delete users" ON user_profiles
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM user_profiles up
            WHERE up.id = auth.uid()
            AND up.email IN (
                'nethan.nagendran@gmail.com',
                'nethmarket@gmail.com',
                'manager@yourcompany.com',
                'support@yourcompany.com',
                'dev@yourcompany.com',
                'tech@yourcompany.com'
            )
        )
    );

-- Grant necessary permissions
GRANT SELECT, INSERT ON admin_activity_log TO authenticated;

-- Create a view for admin analytics
CREATE OR REPLACE VIEW admin_analytics AS
SELECT 
    COUNT(*) as total_users,
    COUNT(CASE WHEN user_tier != 'guest' THEN 1 END) as active_users,
    COUNT(CASE WHEN user_tier = 'guest' THEN 1 END) as guest_count,
    COUNT(CASE WHEN user_tier = 'pro' THEN 1 END) as pro_count,
    COUNT(CASE WHEN user_tier = 'developer' THEN 1 END) as developer_count,
    ROUND(
        CASE 
            WHEN COUNT(*) > 0 THEN 
                (COUNT(CASE WHEN user_tier != 'guest' THEN 1 END)::NUMERIC / COUNT(*)::NUMERIC) * 100 
            ELSE 0 
        END, 1
    ) as conversion_rate,
    json_build_object(
        'guest', COUNT(CASE WHEN user_tier = 'guest' THEN 1 END),
        'pro', COUNT(CASE WHEN user_tier = 'pro' THEN 1 END),
        'developer', COUNT(CASE WHEN user_tier = 'developer' THEN 1 END)
    ) as tier_counts
FROM user_profiles
WHERE created_at IS NOT NULL;

-- Grant access to the analytics view for admins
GRANT SELECT ON admin_analytics TO authenticated;

-- RLS policy for the analytics view
ALTER VIEW admin_analytics SET (security_invoker = true);

-- Success message
SELECT 'Admin system setup completed successfully! 🎉' as status;