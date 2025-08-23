const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = 3002;

// Middleware
app.use(cors());
app.use(express.json());

// Supabase configuration
const supabaseUrl = 'https://tfxncujtkajtihizutfj.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmeG5jdWp0a2FqdGloaXp1dGZqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODkwNzc4NywiZXhwIjoyMDY0NDgzNzg3fQ.wL98zSNDHBXkyPWgBpHsk9p0ebTin6U4JN5V5owzWGA';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log('🚀 Database Management Server Starting...');
console.log('📡 Supabase URL:', supabaseUrl);

// Test endpoint
app.get('/test', (req, res) => {
    res.json({ 
        status: 'Server is running!', 
        timestamp: new Date().toISOString(),
        supabase_url: supabaseUrl 
    });
});

// Database setup endpoint
app.post('/setup-database', async (req, res) => {
    console.log('🔧 Setting up database...');
    
    try {
        // Step 1: Create user_profiles table
        console.log('📝 Creating user_profiles table...');
        const createTableSQL = `
            CREATE TABLE IF NOT EXISTS user_profiles (
                id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                full_name TEXT,
                user_tier TEXT DEFAULT 'guest' CHECK (user_tier IN ('guest', 'pro', 'developer')),
                subscription_status TEXT DEFAULT 'inactive' CHECK (subscription_status IN ('active', 'inactive', 'cancelled')),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `;
        
        const { error: createError } = await supabase.rpc('exec_sql', { sql: createTableSQL });
        if (createError && !createError.message.includes('already exists')) {
            throw createError;
        }
        
        // Step 2: Enable RLS
        console.log('🛡️ Enabling RLS...');
        await supabase.rpc('exec_sql', { sql: 'ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;' });
        
        // Step 3: Create policies
        console.log('📋 Creating RLS policies...');
        await supabase.rpc('exec_sql', { sql: 'DROP POLICY IF EXISTS "users_select_own" ON user_profiles;' });
        await supabase.rpc('exec_sql', { sql: 'DROP POLICY IF EXISTS "users_insert_own" ON user_profiles;' });
        await supabase.rpc('exec_sql', { sql: 'DROP POLICY IF EXISTS "users_update_own" ON user_profiles;' });
        
        await supabase.rpc('exec_sql', { sql: `
            CREATE POLICY "users_select_own" ON user_profiles
                FOR SELECT USING (auth.uid() = id);
        `});
        
        await supabase.rpc('exec_sql', { sql: `
            CREATE POLICY "users_insert_own" ON user_profiles
                FOR INSERT WITH CHECK (auth.uid() = id);
        `});
        
        await supabase.rpc('exec_sql', { sql: `
            CREATE POLICY "users_update_own" ON user_profiles
                FOR UPDATE USING (auth.uid() = id);
        `});
        
        console.log('✅ Database setup completed!');
        
        res.json({
            success: true,
            message: 'Database setup completed successfully!',
            steps: [
                'Created user_profiles table',
                'Enabled Row Level Security',
                'Created RLS policies'
            ]
        });
        
    } catch (error) {
        console.error('❌ Database setup failed:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            details: error
        });
    }
});

// Check database status
app.get('/check-database', async (req, res) => {
    console.log('🔍 Checking database status...');
    
    const results = {};
    
    try {
        // Test 1: Check if table exists
        console.log('📊 Checking if user_profiles table exists...');
        const { data: tableData, error: tableError } = await supabase
            .from('user_profiles')
            .select('count', { count: 'exact', head: true });
        
        if (tableError) {
            results.table = {
                exists: false,
                error: tableError.message
            };
        } else {
            results.table = {
                exists: true,
                message: 'user_profiles table exists'
            };
        }
        
        // Test 2: Check users count
        if (results.table.exists) {
            const { count, error: countError } = await supabase
                .from('user_profiles')
                .select('*', { count: 'exact', head: true });
            
            results.users = {
                count: countError ? 0 : count,
                error: countError?.message
            };
        }
        
        res.json({
            success: true,
            database_status: results,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Database check failed:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Create user profile
app.post('/create-profile', async (req, res) => {
    const { user_id, email, tier = 'pro' } = req.body;
    
    console.log(`👤 Creating profile for user: ${email} (${user_id})`);
    
    if (!user_id || !email) {
        return res.status(400).json({
            success: false,
            error: 'user_id and email are required'
        });
    }
    
    try {
        const { data, error } = await supabase
            .from('user_profiles')
            .upsert({
                id: user_id,
                email: email,
                user_tier: tier,
                subscription_status: tier === 'guest' ? 'inactive' : 'active',
                updated_at: new Date().toISOString()
            })
            .select()
            .single();
        
        if (error) throw error;
        
        console.log('✅ Profile created successfully:', data);
        
        res.json({
            success: true,
            message: 'Profile created successfully!',
            profile: data
        });
        
    } catch (error) {
        console.error('❌ Profile creation failed:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get user profile
app.get('/profile/:userId', async (req, res) => {
    const { userId } = req.params;
    
    console.log(`🔍 Getting profile for user: ${userId}`);
    
    try {
        const { data, error } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', userId)
            .single();
        
        if (error) {
            if (error.code === 'PGRST116') {
                return res.json({
                    success: true,
                    profile: null,
                    message: 'No profile found'
                });
            }
            throw error;
        }
        
        res.json({
            success: true,
            profile: data
        });
        
    } catch (error) {
        console.error('❌ Profile fetch failed:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Update user tier
app.post('/update-tier', async (req, res) => {
    const { user_id, tier } = req.body;
    
    console.log(`🔄 Updating tier for user ${user_id} to ${tier}`);
    
    if (!user_id || !tier) {
        return res.status(400).json({
            success: false,
            error: 'user_id and tier are required'
        });
    }
    
    try {
        const { data, error } = await supabase
            .from('user_profiles')
            .update({
                user_tier: tier,
                subscription_status: tier === 'guest' ? 'inactive' : 'active',
                updated_at: new Date().toISOString()
            })
            .eq('id', user_id)
            .select()
            .single();
        
        if (error) throw error;
        
        console.log('✅ Tier updated successfully:', data);
        
        res.json({
            success: true,
            message: 'Tier updated successfully!',
            profile: data
        });
        
    } catch (error) {
        console.error('❌ Tier update failed:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Start server
app.listen(port, () => {
    console.log(`🌟 Database Management Server running at http://localhost:${port}`);
    console.log(`🔧 Setup database: POST http://localhost:${port}/setup-database`);
    console.log(`🔍 Check database: GET http://localhost:${port}/check-database`);
    console.log(`👤 Create profile: POST http://localhost:${port}/create-profile`);
    console.log(`📊 Test server: GET http://localhost:${port}/test`);
});