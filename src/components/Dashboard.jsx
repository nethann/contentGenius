import React, { useEffect, useRef } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useUser, useAuth } from '@clerk/clerk-react';
import { AdminService } from '../services/adminService';
import TierChangeModal from './TierChangeModal';
import { 
  Zap, 
  LogOut, 
  Video, 
  Scissors, 
  TrendingUp, 
  Sparkles,
  Clock,
  Users,
  BarChart3,
  Settings,
  Crown,
  ChevronDown,
  Shield
} from 'lucide-react';

const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user, isLoaded: userLoaded } = useUser();
  const { signOut } = useAuth();
  
  // Simple tier management
  const [userTier, setUserTierState] = React.useState('guest');
  
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

  // Initialize tier
  useEffect(() => {
    if (user) {
      const detectedTier = getUserTier();
      setUserTierState(detectedTier);
      
      // Save tier to localStorage if from URL
      if (urlTier && urlTier !== 'guest') {
        localStorage.setItem(`userTier_${user.id}`, urlTier);
        // Clear the URL parameter
        navigate('/app', { replace: true });
      }
    }
  }, [user, urlTier, navigate]);
  
  // Check admin access
  const isAdmin = user && AdminService.isAdmin(user?.emailAddresses?.[0]?.emailAddress);
  const isDeveloper = userTier === 'developer';
  const [showTierDropdown, setShowTierDropdown] = React.useState(false);
  const [modalState, setModalState] = React.useState({
    isOpen: false,
    type: '',
    message: ''
  });
  const dropdownRef = useRef(null);

  // Simple tier limits
  const getTierLimits = () => {
    switch (userTier) {
      case 'pro':
        return { name: 'Pro', maxClips: -1, maxVideoLength: -1 };
      case 'developer':
        return { name: 'Developer', maxClips: -1, maxVideoLength: -1 };
      default:
        return { name: 'Guest', maxClips: 3, maxVideoLength: 600 };
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowTierDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSignOut = async () => {
    try {
      console.log('🚪 Signing out...');
      await signOut();
      
      // Clear any local state
      setShowTierDropdown(false);
      setModalState({ isOpen: false, type: '', message: '' });
      
      // Navigate to home page
      navigate('/', { replace: true });
      console.log('✅ Signed out successfully');
    } catch (error) {
      console.error('❌ Sign out error:', error);
      // Still navigate to home even if signout fails
      navigate('/', { replace: true });
    }
  };

  const handleUpgradeToPro = async () => {
    console.log('🚀 Starting Pro upgrade process...');
    
    if (!user) {
      alert('Please sign in first to upgrade to Pro.');
      return;
    }

    if (userTier === 'pro') {
      alert('You are already a Pro user!');
      setShowTierDropdown(false);
      return;
    }

    try {
      // Simple localStorage upgrade
      setUserTierState('pro');
      localStorage.setItem(`userTier_${user.id}`, 'pro');
      
      setModalState({
        isOpen: true,
        type: 'upgrade',
        message: '🎉 Welcome to Pro!\n\nYou now have access to:\n• Unlimited video length\n• Unlimited clips per video\n• Detailed viral analytics\n• No watermarks\n• Priority processing'
      });
    } catch (error) {
      console.error('❌ Upgrade error:', error);
      setModalState({
        isOpen: true,
        type: 'error',
        message: 'Failed to upgrade to Pro. Please try again.'
      });
    } finally {
      setShowTierDropdown(false);
    }
  };

  const handleDowngradeToGuest = async () => {
    try {
      console.log('🔄 Starting downgrade process...');
      
      // Simple localStorage downgrade
      setUserTierState('guest');
      localStorage.setItem(`userTier_${user.id}`, 'guest');
      
      setModalState({
        isOpen: true,
        type: 'downgrade', 
        message: 'You\'ve been switched back to Guest tier. You can upgrade again anytime!'
      });
    } catch (error) {
      console.error('Downgrade exception:', error);
      alert('Failed to downgrade. Please try again.');
    }
    setShowTierDropdown(false);
  };

  const features = [
    {
      id: 'viral-clips',
      title: 'Viral Clip Generator',
      description: 'AI finds viral moments and adds attention-grabbing subtitles',
      icon: Video,
      color: 'purple',
      available: true,
      comingSoon: false,
      route: '/app/viral-clips'
    },
    {
      id: 'trending-analyzer',
      title: 'Trending Analyzer',
      description: 'Analyze what content is trending across platforms',
      icon: TrendingUp,
      color: 'blue',
      available: false,
      comingSoon: true,
      route: '/app/trending'
    },
    {
      id: 'content-scheduler',
      title: 'Content Scheduler',
      description: 'Schedule and automate your content publishing',
      icon: Clock,
      color: 'green',
      available: false,
      comingSoon: true,
      route: '/app/scheduler'
    },
    {
      id: 'audience-insights',
      title: 'Audience Insights',
      description: 'Deep analytics on your audience engagement',
      icon: Users,
      color: 'orange',
      available: false,
      comingSoon: true,
      route: '/app/insights'
    },
    {
      id: 'performance-tracker',
      title: 'Performance Tracker',
      description: 'Track your content performance across platforms',
      icon: BarChart3,
      color: 'red',
      available: false,
      comingSoon: true,
      route: '/app/performance'
    },
    {
      id: 'ai-enhancer',
      title: 'AI Content Enhancer',
      description: 'Enhance your content with AI-powered suggestions',
      icon: Sparkles,
      color: 'yellow',
      available: false,
      comingSoon: true,
      route: '/app/enhancer'
    }
  ];

  const handleFeatureClick = (feature) => {
    if (feature.available) {
      navigate(feature.route);
    }
  };

  const getColorClasses = (color) => {
    const colors = {
      purple: 'from-purple-500 to-purple-700 hover:from-purple-600 hover:to-purple-800',
      blue: 'from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800',
      green: 'from-green-500 to-green-700 hover:from-green-600 hover:to-green-800',
      orange: 'from-orange-500 to-orange-700 hover:from-orange-600 hover:to-orange-800',
      red: 'from-red-500 to-red-700 hover:from-red-600 hover:to-red-800',
      yellow: 'from-yellow-500 to-yellow-700 hover:from-yellow-600 hover:to-yellow-800'
    };
    return colors[color] || colors.purple;
  };

  // Loading state
  if (!userLoaded) {
    return (
      <div className="dashboard-container">
        <div className="dashboard-loading">
          <div className="loading-spinner"></div>
          <p>Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // Not signed in
  if (!user) {
    return (
      <div className="dashboard-container">
        <div className="dashboard-loading">
          <p>Please sign in to continue</p>
          <button onClick={() => navigate('/')}>Go to Sign In</button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Header */}
      <header className="dashboard-header">
        <div className="dashboard-header-content">
          <div className="dashboard-logo">
            <Zap className="w-8 h-8 text-yellow-400" />
            <span className="dashboard-logo-text">ClipGenius</span>
          </div>
          
          <div className="dashboard-user-section">
            <div className="dashboard-user-info">
              <span className="dashboard-user-name">
                Welcome, {user?.fullName || user?.emailAddresses?.[0]?.emailAddress || 'User'}
              </span>
            </div>
            
            {/* Tier Management Dropdown */}
            <div className="tier-dropdown-container" ref={dropdownRef}>
              <button
                onClick={() => setShowTierDropdown(!showTierDropdown)}
                className={`tier-dropdown-button tier-${userTier}`}
              >
                <div className="tier-dropdown-content">
                  <div className="tier-badge-info">
                    {userTier === 'pro' ? (
                      <Crown className="w-4 h-4 text-yellow-400" />
                    ) : (
                      <span className="w-4 h-4">🔓</span>
                    )}
                    <span className="tier-name">{getTierLimits().name}</span>
                  </div>
                  <ChevronDown className={`w-4 h-4 transition-transform ${showTierDropdown ? 'rotate-180' : ''}`} />
                </div>
              </button>
              
              {showTierDropdown && (
                <div className="tier-dropdown-menu">
                  <div className="tier-dropdown-header">
                    <span className="tier-dropdown-title">Current Plan</span>
                    <div className="tier-current-info">
                      <span className={`tier-current-badge tier-${userTier}`}>
                        {getTierLimits().name} Plan
                      </span>
                      <span className="tier-db-status">
                        Auth: Clerk
                      </span>
                    </div>
                  </div>
                  
                  <div className="tier-dropdown-divider"></div>
                  
                  {userTier === 'guest' ? (
                    <button
                      onClick={handleUpgradeToPro}
                      className="tier-dropdown-action tier-upgrade"
                    >
                      <Crown className="w-4 h-4 text-yellow-400" />
                      <div className="tier-action-content">
                        <span className="tier-action-title">Upgrade to Pro</span>
                        <span className="tier-action-desc">Get detailed analytics & unlimited clips</span>
                      </div>
                    </button>
                  ) : (
                    <div className="tier-pro-benefits">
                      <div className="tier-benefit-item">✅ Detailed AI Analytics</div>
                      <div className="tier-benefit-item">✅ Unlimited Video Length</div>
                      <div className="tier-benefit-item">✅ Unlimited Clips</div>
                      <div className="tier-benefit-item">✅ No Watermarks</div>
                      <button
                        onClick={handleDowngradeToGuest}
                        className="tier-dropdown-action tier-downgrade"
                      >
                        Downgrade to Guest (Dev Only)
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Admin Panel Button */}
            {(isAdmin || isDeveloper) && (
              <button
                onClick={() => navigate('/admin')}
                className="dashboard-admin-btn"
                title="Admin Panel"
              >
                <Shield className="w-5 h-5" />
              </button>
            )}

            {/* Database Diagnostic Button */}
            <button
              onClick={() => navigate('/dbtest')}
              className="dashboard-admin-btn"
              title="Simple DB Test"
            >
              <Settings className="w-5 h-5" />
            </button>
            
            <button
              onClick={handleSignOut}
              className="dashboard-signout-btn"
              title="Sign Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="dashboard-main">
        <div className="dashboard-content">
          <div className="dashboard-welcome">
            <h1 className="dashboard-title">
              Welcome to Your Content Studio
            </h1>
            <p className="dashboard-subtitle">
              Create viral content with AI-powered tools designed for content creators
            </p>
          </div>

          {/* Feature Cards Grid */}
          <div className="dashboard-grid">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.id}
                  onClick={() => handleFeatureClick(feature)}
                  className={`dashboard-card ${
                    feature.available 
                      ? 'dashboard-card-available' 
                      : 'dashboard-card-disabled'
                  }`}
                >
                  <div className={`dashboard-card-gradient bg-gradient-to-br ${getColorClasses(feature.color)}`}>
                    <div className="dashboard-card-content">
                      <div className="dashboard-card-header">
                        <div className="dashboard-card-icon">
                          <Icon className="w-6 h-6" />
                        </div>
                        {feature.comingSoon && (
                          <span className="dashboard-coming-soon">
                            Coming Soon
                          </span>
                        )}
                      </div>
                      
                      <h3 className="dashboard-card-title">
                        {feature.title}
                        {feature.id === 'viral-clips' && (
                          <span className="beta-pill">
                            Beta
                          </span>
                        )}
                      </h3>
                      
                      <p className="dashboard-card-description">
                        {feature.description}
                      </p>
                      
                      {feature.available && (
                        <div className="dashboard-card-action">
                          <span className="dashboard-card-action-text">
                            Get Started →
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Stats */}
          <div className="dashboard-stats">
            <div className="dashboard-stats-card">
              <div className="dashboard-stats-icon">
                <Video className="w-5 h-5" />
              </div>
              <div className="dashboard-stats-content">
                <span className="dashboard-stats-number">0</span>
                <span className="dashboard-stats-label">Videos Processed</span>
              </div>
            </div>
            
            <div className="dashboard-stats-card">
              <div className="dashboard-stats-icon">
                <Scissors className="w-5 h-5" />
              </div>
              <div className="dashboard-stats-content">
                <span className="dashboard-stats-number">0</span>
                <span className="dashboard-stats-label">Clips Generated</span>
              </div>
            </div>
            
            <div className="dashboard-stats-card">
              <div className="dashboard-stats-icon">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div className="dashboard-stats-content">
                <span className="dashboard-stats-number">0</span>
                <span className="dashboard-stats-label">Viral Moments</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Tier Change Modal */}
      <TierChangeModal
        isOpen={modalState.isOpen}
        type={modalState.type}
        message={modalState.message}
        onClose={() => setModalState({ isOpen: false, type: '', message: '' })}
      />
    </div>
  );
};

export default Dashboard;