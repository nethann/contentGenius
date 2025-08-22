import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useUserTier } from '../contexts/UserTierContext';
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
  Settings
} from 'lucide-react';

const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { userTier, getTierLimits, setUserTier, USER_TIERS } = useUserTier();

  // Check for tier parameter from signup redirect
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const tierParam = searchParams.get('tier');
    
    if (tierParam && user) {
      if (tierParam === 'pro' && userTier !== USER_TIERS.PRO) {
        console.log('Setting user to Pro tier from signup');
        setUserTier(USER_TIERS.PRO);
      } else if (tierParam === 'guest' && userTier !== USER_TIERS.GUEST) {
        console.log('Setting user to Guest tier from signup');
        setUserTier(USER_TIERS.GUEST);
      }
      
      // Clear the URL parameter after processing
      navigate('/app', { replace: true });
    }
  }, [user, location.search, userTier, setUserTier, USER_TIERS, navigate]);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/');
    } catch (error) {
      console.error('Sign out error:', error);
    }
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
                Welcome, {user?.user_metadata?.full_name || user?.email || 'User'}
              </span>
            </div>
            <div className="tier-indicator">
              <span className={`tier-badge tier-${userTier}`}>
                {getTierLimits().name} {userTier === 'pro' ? '✨' : '🔓'}
              </span>
            </div>
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
    </div>
  );
};

export default Dashboard;