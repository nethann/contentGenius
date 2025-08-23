import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSimpleAuth } from '../contexts/SimpleAuthContext';
import { 
  Zap, 
  LogOut, 
  Video, 
  Crown,
  Shield,
  User,
  CheckCircle,
  XCircle
} from 'lucide-react';

const SimpleDashboard = () => {
  const navigate = useNavigate();
  const { 
    user, 
    userTier, 
    signOut, 
    upgradeToPro, 
    downgradeToGuest, 
    isAdmin, 
    isPro 
  } = useSimpleAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate('/', { replace: true });
  };

  const handleUpgradeToPro = () => {
    const result = upgradeToPro();
    if (result.success) {
      alert('🎉 Upgraded to Pro!');
    } else {
      alert(result.error);
    }
  };

  const handleDowngradeToGuest = () => {
    const result = downgradeToGuest();
    if (result.success) {
      alert('Downgraded to Guest');
    } else {
      alert(result.error);
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
              <span className="text-sm text-gray-600">{user?.email}</span>
              <button
                onClick={handleSignOut}
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
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
                <p className="text-2xl font-bold text-green-600">Working</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
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
          </div>

          {/* Pro Status */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pro Access</p>
                <p className={`text-2xl font-bold ${isPro() ? 'text-green-600' : 'text-gray-400'}`}>
                  {isPro() ? 'Active' : 'Inactive'}
                </p>
              </div>
              {isPro() ? 
                <CheckCircle className="w-8 h-8 text-green-600" /> : 
                <XCircle className="w-8 h-8 text-gray-400" />
              }
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-white rounded-lg shadow">
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

              {/* Emergency Fix */}
              <button
                onClick={() => navigate('/emergency-fix')}
                className="flex items-center justify-center space-x-2 bg-orange-600 text-white px-4 py-3 rounded-lg hover:bg-orange-700 transition-colors"
              >
                <Zap className="w-5 h-5" />
                <span>Emergency Fix</span>
              </button>
            </div>
          </div>
        </div>

        {/* Features by Tier */}
        <div className="mt-8 bg-white rounded-lg shadow">
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-4">Available Features</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <h3 className="font-medium text-gray-900">Guest Features</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Basic video processing</li>
                  <li>• 3 clips per video</li>
                  <li>• 10 minute video limit</li>
                  <li>• Watermarked exports</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="font-medium text-gray-900">Pro Features</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Unlimited clips</li>
                  <li>• No video duration limit</li>
                  <li>• No watermarks</li>
                  <li>• Multiple aspect ratios</li>
                  <li>• AI-powered cropping</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="font-medium text-gray-900">Developer Features</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• All Pro features</li>
                  <li>• Admin dashboard access</li>
                  <li>• Debug mode</li>
                  <li>• API access</li>
                  <li>• Advanced analytics</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Current Status */}
        <div className="mt-8 bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center">
            <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
            <p className="text-green-800 font-medium">Authentication Working!</p>
          </div>
          <p className="text-green-700 text-sm mt-1">
            You are successfully authenticated as <strong>{user?.email}</strong> with <strong>{userTier}</strong> tier access.
            {isPro() && ' You have Pro features enabled!'}
            {isAdmin() && ' You have full admin access!'}
          </p>
        </div>
      </main>
    </div>
  );
};

export default SimpleDashboard;