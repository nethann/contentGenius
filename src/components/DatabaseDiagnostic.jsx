import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { CheckCircle, XCircle, AlertCircle, RefreshCw, Database, Shield } from 'lucide-react';

const DatabaseDiagnostic = () => {
  const { user } = useAuth();
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState(false);

  const runDiagnostic = async () => {
    setLoading(true);
    const testResults = {};

    try {
      // Test 1: Check if user_profiles table exists
      console.log('🔍 Testing user_profiles table...');
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('count', { count: 'exact', head: true });
        
        testResults.tableExists = {
          status: error ? 'error' : 'success',
          message: error ? `Table error: ${error.message}` : 'user_profiles table exists',
          details: error ? error : `Found ${data?.length || 0} records`
        };
      } catch (error) {
        testResults.tableExists = {
          status: 'error',
          message: 'user_profiles table does not exist or is not accessible',
          details: error.message
        };
      }

      // Test 2: Check current user profile
      if (user) {
        console.log('👤 Testing user profile access...');
        try {
          const { data, error } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', user.id)
            .single();
          
          testResults.userProfile = {
            status: error ? 'error' : 'success',
            message: error ? `Profile error: ${error.message}` : 'User profile accessible',
            details: error ? error : data
          };
        } catch (error) {
          testResults.userProfile = {
            status: 'error',
            message: 'Cannot access user profile',
            details: error.message
          };
        }
      } else {
        testResults.userProfile = {
          status: 'warning',
          message: 'No user logged in',
          details: 'Sign in to test user profile access'
        };
      }

      // Test 3: Check RLS policies
      console.log('🛡️ Testing RLS policies...');
      try {
        // Try to read all profiles (should fail if RLS is working correctly for non-admins)
        const { data, error } = await supabase
          .from('user_profiles')
          .select('id, email, user_tier')
          .limit(5);
        
        if (error && error.message.includes('permission')) {
          testResults.rlsPolicies = {
            status: 'success',
            message: 'RLS policies are working (access restricted)',
            details: 'Cannot read all profiles - this is correct for non-admin users'
          };
        } else if (data && data.length > 0) {
          testResults.rlsPolicies = {
            status: 'warning',
            message: 'RLS policies may be too permissive',
            details: `Can read ${data.length} profiles - check if this is intended`
          };
        } else {
          testResults.rlsPolicies = {
            status: 'success',
            message: 'RLS policies working correctly',
            details: 'Proper access control in place'
          };
        }
      } catch (error) {
        testResults.rlsPolicies = {
          status: 'error',
          message: 'Error testing RLS policies',
          details: error.message
        };
      }

      // Test 4: Test user tier update
      if (user) {
        console.log('🔄 Testing tier update functionality...');
        try {
          const currentProfile = await supabase
            .from('user_profiles')
            .select('user_tier')
            .eq('id', user.id)
            .single();

          if (currentProfile.error) {
            testResults.tierUpdate = {
              status: 'error',
              message: 'Cannot read current user tier',
              details: currentProfile.error.message
            };
          } else {
            // Try to update the tier (just a test, we'll revert it)
            const testTier = currentProfile.data.user_tier === 'guest' ? 'pro' : 'guest';
            const updateResult = await supabase
              .from('user_profiles')
              .update({ user_tier: testTier })
              .eq('id', user.id);

            if (updateResult.error) {
              testResults.tierUpdate = {
                status: 'error',
                message: 'Cannot update user tier',
                details: updateResult.error.message
              };
            } else {
              // Revert the change
              await supabase
                .from('user_profiles')
                .update({ user_tier: currentProfile.data.user_tier })
                .eq('id', user.id);

              testResults.tierUpdate = {
                status: 'success',
                message: 'Tier update functionality works',
                details: 'Successfully tested tier update and rollback'
              };
            }
          }
        } catch (error) {
          testResults.tierUpdate = {
            status: 'error',
            message: 'Error testing tier update',
            details: error.message
          };
        }
      }

      // Test 5: Check database triggers
      console.log('⚡ Testing database triggers...');
      try {
        const { data, error } = await supabase.rpc('test_trigger_function');
        testResults.triggers = {
          status: error ? 'warning' : 'success',
          message: error ? 'Triggers may not be set up' : 'Database triggers working',
          details: error ? 'handle_new_user trigger may be missing' : 'User creation trigger is active'
        };
      } catch (error) {
        testResults.triggers = {
          status: 'warning',
          message: 'Cannot test triggers',
          details: 'Trigger testing function not available (this is normal)'
        };
      }

      setResults(testResults);
    } catch (error) {
      console.error('Diagnostic error:', error);
      setResults({
        general: {
          status: 'error',
          message: 'Diagnostic failed',
          details: error.message
        }
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error': return <XCircle className="w-5 h-5 text-red-500" />;
      case 'warning': return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      default: return <AlertCircle className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'success': return 'border-green-500 bg-green-900/20';
      case 'error': return 'border-red-500 bg-red-900/20';
      case 'warning': return 'border-yellow-500 bg-yellow-900/20';
      default: return 'border-gray-500 bg-gray-900/20';
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Database className="w-6 h-6 text-blue-400" />
            <h2 className="text-xl font-semibold text-white">Supabase Database Diagnostic</h2>
          </div>
          <button
            onClick={runDiagnostic}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Running Tests...' : 'Run Diagnostic'}
          </button>
        </div>

        {loading && (
          <div className="text-center py-8">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-400" />
            <p className="text-gray-300">Testing database configuration...</p>
          </div>
        )}

        {Object.keys(results).length > 0 && !loading && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-white mb-4">Diagnostic Results:</h3>
            
            {Object.entries(results).map(([testName, result]) => (
              <div
                key={testName}
                className={`border rounded-lg p-4 ${getStatusColor(result.status)}`}
              >
                <div className="flex items-start gap-3">
                  {getStatusIcon(result.status)}
                  <div className="flex-1">
                    <h4 className="font-medium text-white capitalize mb-1">
                      {testName.replace(/([A-Z])/g, ' $1').trim()}
                    </h4>
                    <p className="text-gray-300 text-sm mb-2">{result.message}</p>
                    {result.details && (
                      <details className="text-xs text-gray-400">
                        <summary className="cursor-pointer hover:text-gray-300">
                          Show Details
                        </summary>
                        <pre className="mt-2 p-2 bg-gray-900 rounded text-gray-300 overflow-x-auto">
                          {typeof result.details === 'object' 
                            ? JSON.stringify(result.details, null, 2)
                            : result.details
                          }
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Recommendations */}
            <div className="mt-6 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-blue-400 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-200 mb-2">Recommendations:</h4>
                  <ul className="text-sm text-blue-300 space-y-1">
                    <li>• If table errors occur, run the safe_admin_setup.sql script</li>
                    <li>• If RLS errors occur, check your database policies in Supabase dashboard</li>
                    <li>• If tier updates fail, verify you have insert/update permissions</li>
                    <li>• For trigger issues, ensure the handle_new_user function is created</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DatabaseDiagnostic;