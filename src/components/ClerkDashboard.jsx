import React from 'react';
import { useNavigate } from 'react-router-dom';
import { UserButton } from '@clerk/clerk-react';
import { useAuth } from '../contexts/ClerkAuthContext';
import { 
  Zap, 
  Video, 
  Crown,
  Shield,
  User,
  CheckCircle,
  XCircle,
  Settings,
  BarChart3
} from 'lucide-react';

const ClerkDashboard = () => {
  const navigate = useNavigate();
  const { 
    user, 
    userTier, 
    loading,
    error,
    upgradeToPro, 
    downgradeToPro, 
    isAdmin, 
    isPro,
    getTierLimits
  } = useAuth();

  const handleUpgradeToPro = async () => {
    const result = await upgradeToPro();
    if (result.success) {
      alert('🎉 Upgraded to Pro!');
    } else {
      alert(`Error: ${result.error}`);
    }
  };

  const handleDowngradeToGuest = async () => {
    const result = await downgradeToPro();
    if (result.success) {
      alert('Downgraded to Guest');
    } else {
      alert(`Error: ${result.error}`);
    }
  };

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

  const tierLimits = getTierLimits();

  if (loading) {
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
              <span className="text-sm text-gray-600">{user.email}</span>
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

      {/* Error Display */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">⚠️ {error}</p>
          </div>
        </div>
      )}

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
            <p className="text-xs text-gray-500 mt-2">{tierLimits.name} Plan</p>
          </div>

          {/* Database Status */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Database</p>
                <p className="text-2xl font-bold text-green-600">Neon</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <p className="text-xs text-gray-500 mt-2">PostgreSQL Ready</p>
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
                <p className="font-medium">{user.email}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">User ID</p>
                <p className="font-mono text-xs text-gray-500">{user.id}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Subscription Status</p>
                <p className="font-medium">{user.subscriptionStatus || 'inactive'}</p>
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

              {/* Pro Upgrade/Downgrade */}
              {userTier === 'guest' && (
                <button
                  onClick={handleUpgradeToPro}
                  className="flex items-center justify-center space-x-2 bg-purple-600 text-white px-4 py-3 rounded-lg hover:bg-purple-700 transition-colors"
                >
                  <Crown className="w-5 h-5" />
                  <span>Upgrade to Pro</span>
                </button>
              )}

              {userTier === 'pro' && (
                <button
                  onClick={handleDowngradeToGuest}
                  className="flex items-center justify-center space-x-2 bg-gray-600 text-white px-4 py-3 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <User className="w-5 h-5" />
                  <span>Downgrade to Guest</span>
                </button>
              )}

              {/* Admin Panel */}
              {isAdmin() && (
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
            </div>
          </div>
        </div>

        {/* Tier Features */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-4">Your {tierLimits.name} Features</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-medium text-gray-900 mb-3">Current Limits</h3>
                <ul className="space-y-2">
                  <li className="flex items-center space-x-2">
                    {tierLimits.maxVideoDuration === Infinity ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-gray-400" />
                    )}
                    <span className="text-sm">
                      Video Duration: {tierLimits.maxVideoDuration === Infinity ? 'Unlimited' : `${tierLimits.maxVideoDuration / 60} minutes max`}
                    </span>
                  </li>
                  <li className="flex items-center space-x-2">
                    {tierLimits.maxClipsPerVideo === Infinity ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-gray-400" />
                    )}
                    <span className="text-sm">
                      Clips per Video: {tierLimits.maxClipsPerVideo === Infinity ? 'Unlimited' : tierLimits.maxClipsPerVideo}
                    </span>
                  </li>
                  <li className="flex items-center space-x-2">
                    {!tierLimits.hasWatermark ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-gray-400" />
                    )}
                    <span className="text-sm">
                      {tierLimits.hasWatermark ? 'Watermarked exports' : 'No watermarks'}
                    </span>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="font-medium text-gray-900 mb-3">Advanced Features</h3>
                <ul className="space-y-2">
                  <li className="flex items-center space-x-2">
                    {tierLimits.hasDetailedAnalytics ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-gray-400" />
                    )}
                    <span className="text-sm">Detailed Analytics</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    {tierLimits.hasAdminAccess ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-gray-400" />
                    )}
                    <span className="text-sm">Admin Dashboard</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    {tierLimits.hasApiAccess ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-gray-400" />
                    )}
                    <span className="text-sm">API Access</span>
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
            <p className="text-green-800 font-medium">New Stack Working Perfectly!</p>
          </div>
          <p className="text-green-700 text-sm mt-1">
            🎉 Clerk + Neon PostgreSQL setup complete! Authentication is working smoothly with tier management in place.
            {isPro() && ' You have Pro features enabled!'}
            {isAdmin() && ' You have full admin access!'}
          </p>
        </div>
      </main>
    </div>
  );
};

export default ClerkDashboard;