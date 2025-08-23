import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const EmergencyFix = () => {
  const [fixing, setFixing] = useState(false);
  const [results, setResults] = useState([]);
  const { user, signOut: originalSignOut } = useAuth();

  const addResult = (message, type = 'info') => {
    setResults(prev => [...prev, { message, type, timestamp: new Date().toLocaleTimeString() }]);
  };

  const forceSignOut = async () => {
    try {
      // Force clear everything
      localStorage.clear();
      sessionStorage.clear();
      
      // Clear Supabase session
      await supabase.auth.signOut();
      
      // Force page reload
      window.location.href = '/';
      
    } catch (error) {
      console.error('Force sign out error:', error);
      // Even if error, clear local storage and reload
      localStorage.clear();
      window.location.reload();
    }
  };

  const emergencyDatabaseFix = async () => {
    setFixing(true);
    setResults([]);
    
    addResult('🚀 Starting emergency database fix...');

    try {
      // Step 1: Check if user is authenticated
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        addResult('❌ No authenticated user. Please sign in first.', 'error');
        setFixing(false);
        return;
      }
      
      addResult(`✅ Authenticated as: ${currentUser.email}`);

      // Step 2: Check if table exists and create if not
      try {
        const { error: testError } = await supabase
          .from('user_profiles')
          .select('count(*)', { count: 'exact', head: true });
        
        if (testError) {
          addResult('⚠️ user_profiles table missing, attempting to create...', 'warn');
          
          // Try to create table using raw SQL
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
            
            ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
          `;
          
          try {
            await supabase.rpc('exec_sql', { sql: createTableSQL });
            addResult('✅ Table created successfully');
          } catch (createError) {
            addResult('❌ Could not create table. Please run simple_fix.sql manually in Supabase.', 'error');
            throw createError;
          }
        } else {
          addResult('✅ user_profiles table exists');
        }
      } catch (tableError) {
        addResult('❌ Table check failed. Manual SQL setup required.', 'error');
        throw tableError;
      }

      // Step 3: Create or update user profile
      try {
        const userTier = ['nethan.nagendran@gmail.com', 'nethmarket@gmail.com'].includes(currentUser.email.toLowerCase()) 
          ? 'developer' 
          : 'guest';

        const { data: profile, error: upsertError } = await supabase
          .from('user_profiles')
          .upsert({
            id: currentUser.id,
            email: currentUser.email,
            full_name: currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || '',
            user_tier: userTier,
            subscription_status: userTier === 'guest' ? 'inactive' : 'active',
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (upsertError) {
          addResult(`❌ Profile creation failed: ${upsertError.message}`, 'error');
          
          // If RLS policies are blocking, show instructions
          if (upsertError.message.includes('policy')) {
            addResult('⚠️ RLS policies not set up. Please run simple_fix.sql in Supabase SQL Editor.', 'warn');
          }
          
          throw upsertError;
        }

        addResult(`✅ Profile created/updated: ${userTier} tier`);
        
        // Update localStorage
        localStorage.setItem('user_profile', JSON.stringify(profile));

      } catch (profileError) {
        addResult(`❌ Profile setup failed: ${profileError.message}`, 'error');
        
        // Create fallback profile in localStorage
        const fallbackProfile = {
          id: currentUser.id,
          email: currentUser.email,
          user_tier: ['nethan.nagendran@gmail.com', 'nethmarket@gmail.com'].includes(currentUser.email.toLowerCase()) 
            ? 'developer' 
            : 'guest',
          subscription_status: 'active'
        };
        localStorage.setItem('user_profile', JSON.stringify(fallbackProfile));
        addResult('⚠️ Using fallback profile in localStorage', 'warn');
      }

      // Step 4: Try to upgrade to Pro (if not already developer)
      const storedProfile = JSON.parse(localStorage.getItem('user_profile') || '{}');
      if (storedProfile.user_tier === 'guest') {
        try {
          const { error: upgradeError } = await supabase
            .from('user_profiles')
            .update({ 
              user_tier: 'pro',
              subscription_status: 'active',
              updated_at: new Date().toISOString()
            })
            .eq('id', currentUser.id);

          if (!upgradeError) {
            addResult('✅ Successfully upgraded to Pro!');
            const updatedProfile = { ...storedProfile, user_tier: 'pro' };
            localStorage.setItem('user_profile', JSON.stringify(updatedProfile));
          } else {
            addResult('⚠️ Pro upgrade failed, staying at current tier', 'warn');
          }
        } catch (upgradeError) {
          addResult('⚠️ Pro upgrade failed (database issues)', 'warn');
        }
      }

      addResult('🎉 Emergency fix completed! Refresh the page.');

    } catch (error) {
      addResult(`❌ Emergency fix failed: ${error.message}`, 'error');
      addResult('📋 Manual steps required:', 'warn');
      addResult('1. Go to Supabase SQL Editor', 'warn');
      addResult('2. Run the simple_fix.sql script', 'warn');  
      addResult('3. Refresh this page', 'warn');
    } finally {
      setFixing(false);
    }
  };

  const getResultColor = (type) => {
    switch (type) {
      case 'error': return 'text-red-600 bg-red-50';
      case 'warn': return 'text-yellow-600 bg-yellow-50';
      case 'info': 
      default: return 'text-blue-600 bg-blue-50';
    }
  };

  const getResultIcon = (type) => {
    switch (type) {
      case 'error': return '❌';
      case 'warn': return '⚠️';
      case 'info':
      default: return 'ℹ️';
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-6">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          <strong>🚨 Emergency Fix Mode</strong>
          <p>Use this page when authentication/database issues prevent normal app usage.</p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-2xl font-bold mb-4">Emergency Database & Auth Fix</h1>
          
          {user && (
            <div className="mb-4 p-3 bg-blue-50 rounded">
              <p><strong>Current User:</strong> {user.email}</p>
              <p><strong>User ID:</strong> {user.id}</p>
            </div>
          )}

          <div className="space-y-4">
            <button 
              onClick={emergencyDatabaseFix}
              disabled={fixing}
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded disabled:opacity-50"
            >
              {fixing ? '🔄 Fixing Database Issues...' : '🔧 Fix Database & Authentication'}
            </button>

            <button 
              onClick={forceSignOut}
              className="bg-red-500 hover:bg-red-700 text-white font-bold py-3 px-6 rounded ml-4"
            >
              🚪 Force Sign Out & Reset
            </button>
          </div>

          {results.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-3">Fix Results:</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {results.map((result, index) => (
                  <div key={index} className={`p-3 rounded ${getResultColor(result.type)}`}>
                    <div className="flex items-start space-x-2">
                      <span>{getResultIcon(result.type)}</span>
                      <div className="flex-1">
                        <span>{result.message}</span>
                        <span className="text-xs opacity-75 ml-2">{result.timestamp}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 p-4 bg-gray-50 rounded">
            <h3 className="font-semibold mb-2">Manual Fix Instructions:</h3>
            <ol className="text-sm space-y-1 list-decimal list-inside">
              <li>Go to your <a href="https://app.supabase.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Supabase Dashboard</a></li>
              <li>Open the SQL Editor</li>
              <li>Copy and paste the contents of <code>simple_fix.sql</code></li>
              <li>Execute the SQL script</li>
              <li>Refresh this page and try again</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmergencyFix;