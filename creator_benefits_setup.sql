-- Creator Benefits Management System
-- Run this in your Supabase SQL Editor

-- Create creator_benefits table
CREATE TABLE IF NOT EXISTS creator_benefits (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text NOT NULL UNIQUE,
    tokens integer DEFAULT 0,
    pro_days integer DEFAULT 0,
    pro_expiry_date timestamp,
    tier text DEFAULT 'guest',
    is_used boolean DEFAULT false,
    used_by text,
    used_at timestamp,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_creator_benefits_email ON creator_benefits(email);
CREATE INDEX IF NOT EXISTS idx_creator_benefits_used ON creator_benefits(is_used);

-- Enable RLS (Row Level Security)
ALTER TABLE creator_benefits ENABLE ROW LEVEL SECURITY;

-- Create policies
-- Policy for admins to read all data
CREATE POLICY "Admins can view all creator benefits" ON creator_benefits
    FOR SELECT USING (
        auth.jwt() ->> 'email' IN (
            'nethan.nagendran@gmail.com',
            'nethmarket@gmail.com'
        )
    );

-- Policy for admins to insert/update data
CREATE POLICY "Admins can manage creator benefits" ON creator_benefits
    FOR ALL USING (
        auth.jwt() ->> 'email' IN (
            'nethan.nagendran@gmail.com',
            'nethmarket@gmail.com'
        )
    );

-- Policy for users to read their own benefits
CREATE POLICY "Users can view their own benefits" ON creator_benefits
    FOR SELECT USING (
        email = auth.jwt() ->> 'email'
    );

-- Policy for users to update their own usage status
CREATE POLICY "Users can mark their benefits as used" ON creator_benefits
    FOR UPDATE USING (
        email = auth.jwt() ->> 'email'
    ) WITH CHECK (
        email = auth.jwt() ->> 'email'
    );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_creator_benefits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_creator_benefits_updated_at
    BEFORE UPDATE ON creator_benefits
    FOR EACH ROW
    EXECUTE FUNCTION update_creator_benefits_updated_at();

-- Grant permissions (if needed)
GRANT ALL ON creator_benefits TO authenticated;
GRANT ALL ON creator_benefits TO service_role;

-- Optional: Insert some sample data for testing
-- INSERT INTO creator_benefits (email, tokens, pro_days, tier) VALUES
-- ('test@example.com', 1000, 30, 'pro'),
-- ('creator@example.com', 2000, 60, 'pro');

COMMENT ON TABLE creator_benefits IS 'Stores creator benefit codes and redemption tracking';