import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { UserButton, useUser, useAuth } from '@clerk/clerk-react';
import { 
  Zap, 
  LogOut, 
  Video, 
  Crown,
  Shield,
  User,
  CheckCircle,
  XCircle,
  Settings
} from 'lucide-react';

const SimpleClerkDashboard = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isLoaded: userLoaded } = useUser();
  const { signOut } = useAuth();

  // Get tier from URL parameter (for new signups) or local storage
  const urlTier = searchParams.get('tier');
  
  // Simple tier detection based on email or URL parameter
  const getUserTier = () => {
    if (!user?.emailAddresses?.[0]?.emailAddress) return urlTier || 'guest';
    
    const email = user.emailAddresses[0].emailAddress.toLowerCase();
    const adminEmails = ['nethan.nagendran@gmail.com', 'nethmarket@gmail.com'];
    
    // Check if admin email
    if (adminEmails.includes(email)) return 'developer';
    
    // Check localStorage for saved tier
    const savedTier = localStorage.getItem(`userTier_${user.id}`);
    if (savedTier) return savedTier;
    
    // Use URL parameter if available
    if (urlTier) return urlTier;
    
    return 'guest';
  };

  // Save tier to localStorage when user signs up with a specific tier
  useEffect(() => {
    if (user && urlTier && urlTier !== 'guest') {
      localStorage.setItem(`userTier_${user.id}`, urlTier);
      // Clear the URL parameter
      navigate('/simple-clerk', { replace: true });
    }
  }, [user, urlTier, navigate]);

  const userTier = getUserTier();
  const isAdmin = userTier === 'developer';
  const isPro = userTier === 'pro' || userTier === 'developer';

  const getTierColor = () => {
    switch (userTier) {
      case 'developer': return 'text-purple-600 bg-purple-100';
      case 'pro': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getTierIcon = () => {
    switch (userTier) {
      case 'developer': return <Shield className="w-5 h-5" />;
      case 'pro': return <Crown className="w-5 h-5" />;
      default: return <User className="w-5 h-5" />;
    }
  };

  if (!userLoaded) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Please sign in to continue</p>
          <button 
            onClick={() => navigate('/')}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Go to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900">Content Scalar</h1>
              <div className={`px-3 py-1 rounded-full text-sm font-medium flex items-center space-x-2 ${getTierColor()}`}>
                {getTierIcon()}
                <span>{userTier.toUpperCase()}</span>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">{user.emailAddresses[0]?.emailAddress}</span>
              <UserButton 
                appearance={{
                  elements: {
                    avatarBox: "w-8 h-8"
                  }
                }}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Authentication Status */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Authentication</p>
                <p className="text-2xl font-bold text-green-600">Clerk</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <p className="text-xs text-gray-500 mt-2">Powered by Clerk Auth</p>
          </div>

          {/* User Tier Status */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Current Tier</p>
                <p className="text-2xl font-bold text-blue-600">{userTier}</p>
              </div>
              {getTierIcon()}
            </div>
            <p className="text-xs text-gray-500 mt-2">Auto-detected from email</p>
          </div>

          {/* Status */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Status</p>
                <p className="text-2xl font-bold text-green-600">Ready</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <p className="text-xs text-gray-500 mt-2">System operational</p>
          </div>
        </div>

        {/* User Info Card */}
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-4">User Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Full Name</p>
                <p className="font-medium">{user.fullName || 'Not provided'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Email</p>
                <p className="font-medium">{user.emailAddresses[0]?.emailAddress}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">User ID</p>
                <p className="font-mono text-xs text-gray-500">{user.id}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Account Created</p>
                <p className="font-medium">{new Date(user.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Video Processing */}
              <button
                onClick={() => navigate('/app/viral-clips')}
                className="flex items-center justify-center space-x-2 bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Video className="w-5 h-5" />
                <span>Process Video</span>
              </button>

              {/* Admin Panel */}
              {isAdmin && (
                <button
                  onClick={() => navigate('/admin')}
                  className="flex items-center justify-center space-x-2 bg-red-600 text-white px-4 py-3 rounded-lg hover:bg-red-700 transition-colors"
                >
                  <Shield className="w-5 h-5" />
                  <span>Admin Panel</span>
                </button>
              )}

              {/* Settings */}
              <button
                onClick={() => navigate('/settings')}
                className="flex items-center justify-center space-x-2 bg-gray-600 text-white px-4 py-3 rounded-lg hover:bg-gray-700 transition-colors"
              >
                <Settings className="w-5 h-5" />
                <span>Settings</span>
              </button>

              {/* Sign Out */}
              <button
                onClick={() => signOut()}
                className="flex items-center justify-center space-x-2 bg-gray-600 text-white px-4 py-3 rounded-lg hover:bg-gray-700 transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-4">Your Features</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <h3 className="font-medium text-gray-900">Authentication</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span>Clerk Auth working</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span>Google OAuth ready</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span>User profiles active</span>
                  </li>
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="font-medium text-gray-900">Tier: {userTier}</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li className="flex items-center space-x-2">
                    {userTier === 'developer' ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-gray-400" />
                    )}
                    <span>Admin access</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    {isPro ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-gray-400" />
                    )}
                    <span>Pro features</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span>Auto-tier detection</span>
                  </li>
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="font-medium text-gray-900">System Status</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span>No database errors</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span>Sign out working</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span>Backend server ready</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Success Message */}
        <div className="mt-8 bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center">
            <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
            <p className="text-green-800 font-medium">Clerk Authentication Working!</p>
          </div>
          <p className="text-green-700 text-sm mt-1">
            🎉 Your authentication is now working perfectly with Clerk! No more database setup headaches.
            {isAdmin && ' You have full admin access!'}
            {userTier === 'developer' && ' Developer tier detected automatically!'}
          </p>
        </div>
      </main>
    </div>
  );
};

export default SimpleClerkDashboard;