import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useUserTier } from '../contexts/UserTierContext';
import { AdminService } from '../services/adminService';
import {
  Shield,
  Users,
  Settings,
  BarChart3,
  Crown,
  UserCheck,
  Trash2,
  RefreshCw,
  ArrowLeft,
  Code,
  Database,
  Activity
} from 'lucide-react';
import '../styles/components/AdminDashboard.css';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { userTier } = useUserTier();
  
  const [users, setUsers] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // Check admin access
  const isAdmin = user && AdminService.isAdmin(user.email);
  const isDeveloper = userTier === 'developer';

  useEffect(() => {
    if (!isAdmin && !isDeveloper) {
      navigate('/app');
      return;
    }
    loadAdminData();
  }, []);

  const loadAdminData = async () => {
    setLoading(true);
    console.log('🔄 Loading admin data...');
    try {
      console.log('📊 Fetching users and analytics...');
      const [usersResult, analyticsResult] = await Promise.all([
        AdminService.getAllUsers(),
        AdminService.getAppAnalytics()
      ]);

      console.log('👥 Users result:', usersResult);
      console.log('📈 Analytics result:', analyticsResult);

      if (usersResult.users) {
        setUsers(usersResult.users);
        console.log(`✅ Loaded ${usersResult.users.length} users`);
      }
      if (analyticsResult.analytics) {
        setAnalytics(analyticsResult.analytics);
        console.log('✅ Loaded analytics:', analyticsResult.analytics);
      }
    } catch (error) {
      console.error('❌ Error loading admin data:', error);
    } finally {
      setLoading(false);
      console.log('✅ Admin data loading completed');
    }
  };

  const handleUpdateUserTier = async (userId, newTier) => {
    try {
      const result = await AdminService.updateUserTierAdmin(userId, newTier);
      if (result.error) {
        alert('Failed to update user tier: ' + result.error.message);
      } else {
        alert(`Successfully updated user tier to ${newTier}`);
        loadAdminData(); // Refresh data
      }
    } catch (error) {
      console.error('Error updating user tier:', error);
      alert('Failed to update user tier');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      const result = await AdminService.deleteUser(userId);
      if (result.error) {
        alert('Failed to delete user: ' + result.error.message);
      } else {
        alert('User deleted successfully');
        loadAdminData(); // Refresh data
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Failed to delete user');
    }
  };

  if (!isAdmin && !isDeveloper) {
    return (
      <div className="admin-access-denied">
        <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h1>Access Denied</h1>
        <p>You don't have permission to access this page.</p>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <div className="admin-container">
        {/* Header */}
        <div className="admin-header">
          <div className="admin-header-content">
            <button
              onClick={() => navigate('/app')}
              className="admin-back-btn"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back to App
            </button>
            
            <div className="admin-title-section">
              <div className="admin-title">
                <Shield className="w-8 h-8 text-purple-500 mr-3" />
                Admin Dashboard
              </div>
              <div className="admin-user-info">
                Welcome, {user?.email} • {userTier === 'developer' ? 'Developer' : 'Admin'}
              </div>
            </div>

            <button
              onClick={loadAdminData}
              className="admin-refresh-btn"
              disabled={loading}
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="admin-nav">
          <button
            onClick={() => setActiveTab('overview')}
            className={`admin-nav-btn ${activeTab === 'overview' ? 'active' : ''}`}
          >
            <BarChart3 className="w-5 h-5 mr-2" />
            Overview
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`admin-nav-btn ${activeTab === 'users' ? 'active' : ''}`}
          >
            <Users className="w-5 h-5 mr-2" />
            User Management
          </button>
          {isDeveloper && (
            <button
              onClick={() => setActiveTab('developer')}
              className={`admin-nav-btn ${activeTab === 'developer' ? 'active' : ''}`}
            >
              <Code className="w-5 h-5 mr-2" />
              Developer Tools
            </button>
          )}
        </div>

        {/* Content */}
        <div className="admin-content">
          {loading ? (
            <div className="admin-loading">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
              <p>Loading admin data...</p>
            </div>
          ) : (
            <>
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div className="admin-overview">
                  <div className="admin-stats-grid">
                    <div className="admin-stat-card">
                      <div className="stat-icon">
                        <Users className="w-8 h-8" />
                      </div>
                      <div className="stat-info">
                        <div className="stat-value">{analytics?.totalUsers || 0}</div>
                        <div className="stat-label">Total Users</div>
                      </div>
                    </div>

                    <div className="admin-stat-card">
                      <div className="stat-icon">
                        <Crown className="w-8 h-8" />
                      </div>
                      <div className="stat-info">
                        <div className="stat-value">{analytics?.activeUsers || 0}</div>
                        <div className="stat-label">Pro/Dev Users</div>
                      </div>
                    </div>

                    <div className="admin-stat-card">
                      <div className="stat-icon">
                        <Activity className="w-8 h-8" />
                      </div>
                      <div className="stat-info">
                        <div className="stat-value">{analytics?.conversionRate || 0}%</div>
                        <div className="stat-label">Conversion Rate</div>
                      </div>
                    </div>
                  </div>

                  {/* Tier Breakdown */}
                  <div className="admin-tier-breakdown">
                    <h3>User Tier Breakdown</h3>
                    <div className="tier-chart">
                      {analytics?.tierCounts && Object.entries(analytics.tierCounts).map(([tier, count]) => (
                        <div key={tier} className="tier-bar">
                          <div className="tier-label">
                            {tier.charAt(0).toUpperCase() + tier.slice(1)} ({count})
                          </div>
                          <div className="tier-progress">
                            <div 
                              className={`tier-progress-fill tier-${tier}`}
                              style={{ width: `${(count / analytics.totalUsers) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Users Tab */}
              {activeTab === 'users' && (
                <div className="admin-users">
                  <div className="admin-users-header">
                    <h3>User Management ({users.length} users)</h3>
                  </div>
                  
                  <div className="admin-users-table">
                    {users.map(user => (
                      <div key={user.id} className="admin-user-row">
                        <div className="user-info">
                          <div className="user-name">{user.full_name || 'No name'}</div>
                          <div className="user-email">{user.email}</div>
                          <div className="user-meta">
                            <span className={`user-tier tier-${user.user_tier}`}>
                              {user.user_tier.charAt(0).toUpperCase() + user.user_tier.slice(1)}
                            </span>
                            <span className="user-date">
                              Joined {new Date(user.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        
                        <div className="user-actions">
                          <select
                            value={user.user_tier}
                            onChange={(e) => handleUpdateUserTier(user.id, e.target.value)}
                            className="admin-tier-select"
                          >
                            <option value="guest">Guest</option>
                            <option value="pro">Pro</option>
                            <option value="developer">Developer</option>
                          </select>
                          
                          {!AdminService.isAdmin(user.email) && (
                            <button
                              onClick={() => handleDeleteUser(user.id)}
                              className="admin-delete-btn"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Developer Tab */}
              {activeTab === 'developer' && isDeveloper && (
                <div className="admin-developer">
                  <h3>Developer Tools</h3>
                  
                  <div className="dev-tools-grid">
                    <div className="dev-tool-card">
                      <Database className="w-8 h-8 mb-3" />
                      <h4>Database Status</h4>
                      <p>All systems operational</p>
                      <div className="dev-status online">Online</div>
                    </div>
                    
                    <div className="dev-tool-card">
                      <Code className="w-8 h-8 mb-3" />
                      <h4>API Access</h4>
                      <p>Full API access enabled</p>
                      <div className="dev-status enabled">Enabled</div>
                    </div>
                    
                    <div className="dev-tool-card">
                      <Activity className="w-8 h-8 mb-3" />
                      <h4>Debug Mode</h4>
                      <p>Enhanced logging active</p>
                      <div className="dev-status active">Active</div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;