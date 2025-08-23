import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const SimpleDBTest = () => {
  const { user } = useAuth();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const addResult = (test, status, message, details = null) => {
    setResults(prev => [...prev, { test, status, message, details, timestamp: new Date().toLocaleTimeString() }]);
  };

  const runTests = async () => {
    setResults([]);
    setLoading(true);

    // Test 1: Basic connection
    addResult('Connection', 'info', 'Testing basic Supabase connection...');
    try {
      const { data, error } = await supabase.from('_fake_table_').select('*').limit(1);
      if (error && error.message.includes('relation "_fake_table_" does not exist')) {
        addResult('Connection', 'success', 'Supabase connection working');
      } else {
        addResult('Connection', 'error', 'Unexpected connection result', { data, error });
      }
    } catch (error) {
      addResult('Connection', 'error', 'Connection failed', error.message);
    }

    // Test 2: Check if user_profiles table exists
    addResult('Table Check', 'info', 'Checking if user_profiles table exists...');
    try {
      const { error } = await supabase.from('user_profiles').select('count', { count: 'exact', head: true });
      if (error) {
        if (error.message.includes('relation "user_profiles" does not exist')) {
          addResult('Table Check', 'error', 'user_profiles table does not exist!');
        } else {
          addResult('Table Check', 'error', 'Table access error', error.message);
        }
      } else {
        addResult('Table Check', 'success', 'user_profiles table exists');
      }
    } catch (error) {
      addResult('Table Check', 'error', 'Table check failed', error.message);
    }

    // Test 3: Check current user auth
    addResult('Auth Check', 'info', 'Checking user authentication...');
    if (user) {
      addResult('Auth Check', 'success', `User authenticated: ${user.email}`, { id: user.id });
    } else {
      addResult('Auth Check', 'warning', 'No user authenticated');
      setLoading(false);
      return;
    }

    // Test 4: Try to read user profile (without timeout)
    addResult('Profile Read', 'info', 'Testing profile read...');
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      
      if (error) {
        addResult('Profile Read', 'error', 'Cannot read user profile', error.message);
      } else if (data) {
        addResult('Profile Read', 'success', 'Profile found', data);
      } else {
        addResult('Profile Read', 'warning', 'No profile found for current user');
      }
    } catch (error) {
      addResult('Profile Read', 'error', 'Profile read failed', error.message);
    }

    // Test 5: Try to create profile if missing
    if (user) {
      addResult('Profile Creation', 'info', 'Attempting to create/update profile...');
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .upsert({
            id: user.id,
            email: user.email,
            user_tier: 'pro',
            full_name: user.user_metadata?.full_name || '',
            updated_at: new Date().toISOString()
          })
          .select()
          .single();
        
        if (error) {
          addResult('Profile Creation', 'error', 'Cannot create/update profile', error.message);
        } else {
          addResult('Profile Creation', 'success', 'Profile created/updated successfully', data);
        }
      } catch (error) {
        addResult('Profile Creation', 'error', 'Profile creation failed', error.message);
      }
    }

    setLoading(false);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'success': return 'text-green-400';
      case 'error': return 'text-red-400';
      case 'warning': return 'text-yellow-400';
      default: return 'text-blue-400';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      default: return 'ℹ️';
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">Simple Database Test</h2>
          <button
            onClick={runTests}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg"
          >
            {loading ? 'Running Tests...' : 'Run Tests'}
          </button>
        </div>

        {user && (
          <div className="mb-4 p-3 bg-gray-700 rounded">
            <p className="text-sm text-gray-300">
              Current User: <span className="text-white">{user.email}</span> 
              <span className="text-gray-400 ml-2">(ID: {user.id})</span>
            </p>
          </div>
        )}

        <div className="space-y-3">
          {results.map((result, index) => (
            <div key={index} className="flex items-start gap-3 p-3 bg-gray-700 rounded">
              <span className="text-lg">{getStatusIcon(result.status)}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-white">{result.test}</span>
                  <span className="text-xs text-gray-400">{result.timestamp}</span>
                </div>
                <p className={`text-sm mt-1 ${getStatusColor(result.status)}`}>
                  {result.message}
                </p>
                {result.details && (
                  <details className="mt-2">
                    <summary className="text-xs text-gray-400 cursor-pointer">Show Details</summary>
                    <pre className="text-xs text-gray-300 mt-1 p-2 bg-gray-800 rounded overflow-x-auto">
                      {typeof result.details === 'string' 
                        ? result.details 
                        : JSON.stringify(result.details, null, 2)
                      }
                    </pre>
                  </details>
                )}
              </div>
            </div>
          ))}
        </div>

        {results.length === 0 && !loading && (
          <p className="text-center text-gray-400 py-8">
            Click "Run Tests" to diagnose your database setup
          </p>
        )}
      </div>
    </div>
  );
};

export default SimpleDBTest;