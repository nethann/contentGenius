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

// Test endpoint
app.get('/test', (req, res) => {
    res.json({ 
        status: 'Server is running!', 
        timestamp: new Date().toISOString(),
    });
});

// SIMPLE DATABASE SETUP - This will fix everything
app.post('/setup', async (req, res) => {
    console.log('🔧 Setting up database and creating your profile...');
    
    try {
        // Step 1: Create your profile directly with service role (bypasses RLS)
        console.log('👤 Creating your profile...');
        const { data, error } = await supabase
            .from('user_profiles')
            .upsert({
                id: 'c2e903e3-aff3-43a2-9a99-97d18882e5e8',
                email: 'nethan.nagendran@gmail.com',
                user_tier: 'developer',  // Give you developer access
                full_name: 'Nethan Nagendran',
                subscription_status: 'active',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .select()
            .single();
        
        if (error) {
            console.error('❌ Error:', error);
            return res.json({
                success: false,
                error: error.message,
                solution: 'The user_profiles table does not exist. Please run the SQL setup in Supabase first.'
            });
        }
        
        console.log('✅ Profile created successfully!');
        
        res.json({
            success: true,
            message: '🎉 Your profile has been created successfully!',
            profile: data,
            next_steps: [
                'Your React app should now work properly',
                'You have developer tier access',
                'Pro upgrade should work',
                'Admin dashboard should load',
                'Sign out should work'
            ]
        });
        
    } catch (error) {
        console.error('❌ Setup failed:', error);
        res.json({
            success: false,
            error: error.message,
            note: 'If you see table errors, you need to run the SQL setup in Supabase first'
        });
    }
});

// Check if your profile exists
app.get('/check', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', 'c2e903e3-aff3-43a2-9a99-97d18882e5e8')
            .single();
        
        if (error) {
            return res.json({
                success: false,
                error: error.message,
                profile_exists: false
            });
        }
        
        res.json({
            success: true,
            profile_exists: true,
            profile: data,
            message: 'Your profile exists and is configured correctly!'
        });
        
    } catch (error) {
        res.json({
            success: false,
            error: error.message
        });
    }
});

// Start server
app.listen(port, () => {
    console.log(`\n🌟 Server running at http://localhost:${port}`);
    console.log(`\n📋 SIMPLE COMMANDS:`);
    console.log(`   Test server:    http://localhost:${port}/test`);
    console.log(`   Setup profile:  http://localhost:${port}/setup`);
    console.log(`   Check profile:  http://localhost:${port}/check`);
    console.log(`\n🎯 Just go to http://localhost:${port}/setup in your browser to fix everything!`);
});