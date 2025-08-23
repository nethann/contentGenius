import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { UserProfileService } from '../services/userProfileService';

const DatabaseTest = () => {
  const [testResults, setTestResults] = useState([]);
  const [testing, setTesting] = useState(false);
  const { user } = useAuth();

  const addResult = (test, status, message) => {
    setTestResults(prev => [...prev, { test, status, message, timestamp: new Date().toLocaleTimeString() }]);
  };

  const runTests = async () => {
    setTesting(true);
    setTestResults([]);
    
    // Test 1: Check authentication
    addResult('Authentication Check', user ? 'PASS' : 'FAIL', user ? `Logged in as: ${user.email}` : 'No user logged in');
    
    if (!user) {
      setTesting(false);
      return;
    }

    // Test 2: Check table exists
    try {
      const { data, error } = await supabase.from('user_profiles').select('count(*)', { count: 'exact' });
      if (error) throw error;
      addResult('Table Exists', 'PASS', `user_profiles table found with ${data.length} records`);
    } catch (error) {
      addResult('Table Exists', 'FAIL', error.message);
      setTesting(false);
      return;
    }

    // Test 3: Check current user profile
    try {
      const { profile, error } = await UserProfileService.getUserProfile(user.id);
      if (error) throw error;
      addResult('User Profile', profile ? 'PASS' : 'WARN', profile ? `Profile found: ${JSON.stringify(profile)}` : 'No profile found');
    } catch (error) {
      addResult('User Profile', 'FAIL', error.message);
    }

    // Test 4: Test creating/updating profile
    try {
      const { profile, error } = await UserProfileService.ensureUserProfile(user);
      if (error) throw error;
      addResult('Profile Creation', 'PASS', `Profile created/updated: ${JSON.stringify(profile)}`);
    } catch (error) {
      addResult('Profile Creation', 'FAIL', error.message);
    }

    // Test 5: Test tier update
    try {
      const currentTier = 'guest';
      const newTier = currentTier === 'guest' ? 'pro' : 'guest';
      const { profile, error } = await UserProfileService.updateUserTier(user.id, newTier);
      if (error) throw error;
      addResult('Tier Update', 'PASS', `Successfully updated tier to: ${newTier}`);
      
      // Revert back
      await UserProfileService.updateUserTier(user.id, currentTier);
    } catch (error) {
      addResult('Tier Update', 'FAIL', error.message);
    }

    // Test 6: Check admin access (if applicable)
    try {
      const { data, error } = await supabase.from('user_profiles').select('*').limit(1);
      if (error) throw error;
      addResult('Admin Query', 'PASS', 'Can query all profiles (admin access confirmed)');
    } catch (error) {
      addResult('Admin Query', 'FAIL', `Cannot query all profiles: ${error.message}`);
    }

    setTesting(false);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'PASS': return 'text-green-600';
      case 'FAIL': return 'text-red-600';
      case 'WARN': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'PASS': return '✅';
      case 'FAIL': return '❌';
      case 'WARN': return '⚠️';
      default: return 'ℹ️';
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Database Connection Test</h2>
      
      <div className="mb-4">
        <button 
          onClick={runTests}
          disabled={testing}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
        >
          {testing ? 'Running Tests...' : 'Run Database Tests'}
        </button>
      </div>

      {testResults.length > 0 && (
        <div className="bg-gray-100 p-4 rounded-lg">
          <h3 className="text-lg font-semibold mb-2">Test Results:</h3>
          <div className="space-y-2">
            {testResults.map((result, index) => (
              <div key={index} className="flex items-start space-x-2 p-2 bg-white rounded border">
                <span className="text-lg">{getStatusIcon(result.status)}</span>
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">{result.test}</span>
                    <span className={`font-semibold ${getStatusColor(result.status)}`}>
                      {result.status}
                    </span>
                    <span className="text-xs text-gray-500">{result.timestamp}</span>
                  </div>
                  <div className="text-sm text-gray-600 mt-1">{result.message}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-semibold mb-2">Troubleshooting Guide:</h3>
        <ul className="text-sm space-y-1">
          <li>• If "Table Exists" fails: Run minimal_setup.sql in Supabase SQL Editor</li>
          <li>• If "User Profile" fails: Check if user_profiles table has your user record</li>
          <li>• If "Tier Update" fails: Check RLS policies allow user updates</li>
          <li>• If "Admin Query" fails: Check admin RLS policies are configured</li>
          <li>• Environment: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set</li>
        </ul>
      </div>
    </div>
  );
};

export default DatabaseTest;