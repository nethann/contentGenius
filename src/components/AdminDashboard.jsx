import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { AdminService } from '../services/adminService';
import { TokenService } from '../services/tokenService';
import { CreatorBenefitsService } from '../services/creatorBenefitsService';
import CreatorManagement from './CreatorManagement';
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
  Activity,
  Zap,
  Gift,
  Bell,
  Megaphone,
  Plus,
  Send,
  Edit
} from 'lucide-react';
import '../styles/components/AdminDashboard.css';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  
  console.log('🔍 AdminDashboard - Raw user object:', user);
  
  // Simple tier detection for admin
  const getUserTier = () => {
    if (!user?.emailAddresses?.[0]?.emailAddress) return 'guest';
    const email = user.emailAddresses[0].emailAddress.toLowerCase();
    const adminEmails = ['nethan.nagendran@gmail.com', 'nethmarket@gmail.com'];
    if (adminEmails.includes(email)) return 'developer';
    const savedTier = localStorage.getItem(`userTier_${user.id}`);
    return savedTier || 'guest';
  };
  
  const userTier = getUserTier();
  
  const [users, setUsers] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [reports, setReports] = useState([]);
  const [creatorBenefits, setCreatorBenefits] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [activeReportTab, setActiveReportTab] = useState('bugs');
  const [showAnnouncementForm, setShowAnnouncementForm] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [announcementForm, setAnnouncementForm] = useState({
    title: '',
    description: '',
    targetAudience: 'all',
    bulletPoints: ['']
  });

  // Check admin access
  const userEmail = user?.emailAddresses?.[0]?.emailAddress;
  const isAdmin = user && AdminService.isAdmin(userEmail);
  const isDeveloper = userTier === 'developer';

  useEffect(() => {
    console.log('🔍 AdminDashboard - useEffect check');
    console.log('🔍 AdminDashboard - User email:', userEmail);
    console.log('🔍 AdminDashboard - User tier:', userTier);
    console.log('🔍 AdminDashboard - Is admin:', isAdmin);
    console.log('🔍 AdminDashboard - Is developer:', isDeveloper);
    
    if (!isAdmin && !isDeveloper) {
      console.log('❌ AdminDashboard - Access denied, redirecting to /app');
      navigate('/app');
      return;
    }
    
    console.log('✅ AdminDashboard - Access granted, loading data...');
    
    // Only load data once when component mounts
    let mounted = true;
    
    const loadData = async () => {
      if (mounted) {
        await loadAdminData();
      }
    };
    
    loadData();
    
    return () => {
      mounted = false;
    };
  }, []); // Empty dependency array - only run once

  const loadAdminData = async () => {
    setLoading(true);
    console.log('🔄 Loading admin data...');
    try {
      console.log('📊 Fetching users, analytics, and reports...');
      
      // Load reports from localStorage
      const userReports = JSON.parse(localStorage.getItem('user_reports') || '[]');
      setReports(userReports.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
      
      const [usersResult, analyticsResult, creatorBenefitsResult] = await Promise.all([
        AdminService.getAllUsers(),
        AdminService.getAppAnalytics(),
        CreatorBenefitsService.getAllCreatorBenefits()
      ]);

      // Calculate real analytics from creator benefits and current usage
      let realAnalytics = {
        totalUsers: 0,
        activeUsers: 0,
        tierCounts: { guest: 0, pro: 0, developer: 0 },
        conversionRate: 0
      };

      if (creatorBenefitsResult.success && creatorBenefitsResult.benefits) {
        const benefits = creatorBenefitsResult.benefits;
        console.log('📊 Calculating analytics from benefits:', benefits);
        
        benefits.forEach(benefit => {
          console.log('Processing benefit:', { 
            email: benefit.email, 
            is_used: benefit.is_used, 
            tier: benefit.tier,
            expiry: benefit.pro_expiry_date 
          });
          
          if (benefit.is_used) {
            realAnalytics.totalUsers++;
            
            if (benefit.tier === 'pro') {
              // Check if pro access is still valid
              const expiryDate = new Date(benefit.pro_expiry_date);
              const isValid = expiryDate > new Date();
              console.log('Pro access check:', { expiryDate, isValid });
              
              if (isValid) {
                realAnalytics.tierCounts.pro++;
                realAnalytics.activeUsers++;
              } else {
                realAnalytics.tierCounts.guest++;
              }
            } else if (benefit.tier === 'developer') {
              realAnalytics.tierCounts.developer++;
              realAnalytics.activeUsers++;
            } else {
              realAnalytics.tierCounts.guest++;
            }
          }
        });

        // Add admin users (developers) - count current admin user
        const adminEmails = ['nethan.nagendran@gmail.com', 'nethmarket@gmail.com'];
        realAnalytics.tierCounts.developer += 1; // Just count the current admin user
        realAnalytics.totalUsers += 1;
        realAnalytics.activeUsers += 1;

        // Calculate conversion rate
        if (realAnalytics.totalUsers > 0) {
          realAnalytics.conversionRate = Math.round((realAnalytics.activeUsers / realAnalytics.totalUsers) * 100);
        }
        
        console.log('📊 Final analytics:', realAnalytics);
      }

      console.log('👥 Users result:', usersResult);
      console.log('📈 Analytics result:', analyticsResult);

      // Handle users result
      if (usersResult.error) {
        console.error('❌ Users fetch error:', usersResult.error);
        if (usersResult.error.needsSetup) {
          alert('🛠️ Database Setup Required!\n\nThe user_profiles table is not set up. Please:\n\n1. Go to your Supabase SQL Editor\n2. Run the setup SQL from minimal_setup.sql\n3. Refresh this page');
        } else if (usersResult.error.permission) {
          alert('🔒 Permission Error!\n\nAdmin access is denied. Please check:\n\n1. Your email is in the admin list\n2. Database RLS policies are configured\n3. You are signed in as an admin user');
        } else {
          alert(`Error loading users: ${usersResult.error.message}`);
        }
        setUsers([]); // Set empty array on error
      } else {
        setUsers(usersResult.users || []);
        console.log(`✅ Loaded ${(usersResult.users || []).length} users`);
      }

      // Handle analytics result  
      if (analyticsResult.error) {
        console.error('❌ Analytics fetch error:', analyticsResult.error);
        // Don't show alert for analytics errors, just log them
        setAnalytics({
          totalUsers: 0,
          activeUsers: 0,
          tierCounts: { guest: 0, pro: 0, developer: 0 },
          conversionRate: 0
        });
      } else {
        // Use real analytics from creator benefits instead of localStorage analytics
        setAnalytics(realAnalytics);
        console.log('✅ Loaded real analytics from creator benefits:', realAnalytics);
      }
      
      // Handle creator benefits result
      if (creatorBenefitsResult.error) {
        console.error('❌ Creator benefits fetch error:', creatorBenefitsResult.error);
        setCreatorBenefits([]);
      } else {
        setCreatorBenefits(creatorBenefitsResult.benefits || []);
        console.log('✅ Loaded creator benefits:', creatorBenefitsResult.benefits?.length || 0, 'benefits');
      }
      
      // Load announcements from localStorage
      const existingAnnouncements = JSON.parse(localStorage.getItem('admin_announcements') || '[]');
      setAnnouncements(existingAnnouncements);
      console.log('✅ Loaded announcements:', existingAnnouncements.length, 'announcements');
    } catch (error) {
      console.error('❌ Error loading admin data:', error);
      alert(`Unexpected error: ${error.message}`);
      // Set default values on error
      setUsers([]);
      setAnalytics({
        totalUsers: 0,
        activeUsers: 0,
        tierCounts: { guest: 0, pro: 0, developer: 0 },
        conversionRate: 0
      });
    } finally {
      setLoading(false);
      console.log('✅ Admin data loading completed');
    }
  };

  // Announcement management functions
  const handleEditAnnouncement = (announcement) => {
    setEditingAnnouncement(announcement);
    setAnnouncementForm({
      title: announcement.title,
      description: announcement.description,
      targetAudience: announcement.targetAudience,
      bulletPoints: announcement.bulletPoints.length > 0 ? announcement.bulletPoints : ['']
    });
    setShowAnnouncementForm(true);
  };

  const handleDeleteAnnouncement = (announcementId) => {
    if (window.confirm('Are you sure you want to delete this announcement? This action cannot be undone.')) {
      try {
        const currentAnnouncements = JSON.parse(localStorage.getItem('admin_announcements') || '[]');
        const filteredAnnouncements = currentAnnouncements.filter(a => a.id !== announcementId);
        localStorage.setItem('admin_announcements', JSON.stringify(filteredAnnouncements));
        setAnnouncements(filteredAnnouncements);
        alert('✅ Announcement deleted successfully!');
      } catch (error) {
        console.error('Error deleting announcement:', error);
        alert('❌ Failed to delete announcement. Please try again.');
      }
    }
  };

  const handleSaveAnnouncement = () => {
    if (!announcementForm.title || !announcementForm.description) {
      alert('Please fill in both title and description.');
      return;
    }

    try {
      const currentAnnouncements = JSON.parse(localStorage.getItem('admin_announcements') || '[]');
      
      if (editingAnnouncement) {
        // Update existing announcement
        const updatedAnnouncements = currentAnnouncements.map(announcement => 
          announcement.id === editingAnnouncement.id
            ? {
                ...announcement,
                title: announcementForm.title,
                description: announcementForm.description,
                targetAudience: announcementForm.targetAudience,
                bulletPoints: announcementForm.bulletPoints.filter(point => point.trim() !== ''),
                updatedAt: new Date().toISOString(),
                updatedBy: user?.emailAddresses?.[0]?.emailAddress || 'Admin'
              }
            : announcement
        );
        
        localStorage.setItem('admin_announcements', JSON.stringify(updatedAnnouncements));
        setAnnouncements(updatedAnnouncements);
        alert('✅ Announcement updated successfully!');
      } else {
        // Create new announcement
        const newAnnouncement = {
          id: Date.now(),
          title: announcementForm.title,
          description: announcementForm.description,
          targetAudience: announcementForm.targetAudience,
          bulletPoints: announcementForm.bulletPoints.filter(point => point.trim() !== ''),
          createdAt: new Date().toISOString(),
          createdBy: user?.emailAddresses?.[0]?.emailAddress || 'Admin',
          timestamp: new Date().toISOString()
        };
        
        const updatedAnnouncements = [newAnnouncement, ...currentAnnouncements];
        localStorage.setItem('admin_announcements', JSON.stringify(updatedAnnouncements));
        setAnnouncements(updatedAnnouncements);
        alert('✅ Announcement created successfully! Users will see it when they next log in.');
      }
      
      // Reset form
      setShowAnnouncementForm(false);
      setEditingAnnouncement(null);
      setAnnouncementForm({
        title: '',
        description: '',
        targetAudience: 'all',
        bulletPoints: ['']
      });
    } catch (error) {
      console.error('Error saving announcement:', error);
      alert('❌ Failed to save announcement. Please try again.');
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

  const grantUnlimitedTokens = () => {
    if (!user?.id) {
      alert('❌ Error: No user ID found');
      return;
    }

    try {
      // Set current user to developer tier
      localStorage.setItem(`userTier_${user.id}`, 'developer');
      
      // Remove any existing token data to force re-initialization
      localStorage.removeItem(`tokens_${user.id}`);
      
      // Create unlimited token entry
      const unlimitedTokenData = {
        count: -1,  // -1 = unlimited
        lastRefresh: new Date().toISOString(),
        tier: 'developer'
      };
      
      localStorage.setItem(`tokens_${user.id}`, JSON.stringify(unlimitedTokenData));
      
      alert('🎉 SUCCESS!\n\n✅ Developer tier activated\n✅ Unlimited tokens granted (∞)\n\n🔄 Refresh the page to see changes');
      
      // Force page refresh to update token display
      setTimeout(() => {
        window.location.reload();
      }, 1000);
      
    } catch (error) {
      console.error('Error granting unlimited tokens:', error);
      alert('❌ Failed to grant unlimited tokens: ' + error.message);
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
            onClick={() => setActiveTab('announcements')}
            className={`admin-nav-btn ${activeTab === 'announcements' ? 'active' : ''}`}
          >
            <Megaphone className="w-5 h-5 mr-2" />
            Updates & Announcements
          </button>
          <button
            onClick={() => setActiveTab('creators')}
            className={`admin-nav-btn ${activeTab === 'creators' ? 'active' : ''}`}
          >
            <Gift className="w-5 h-5 mr-2" />
            Content Creators ({creatorBenefits.length})
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`admin-nav-btn ${activeTab === 'reports' ? 'active' : ''}`}
          >
            <Shield className="w-5 h-5 mr-2" />
            User Reports ({reports.length})
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

                  {/* Tier Breakdown - Glass Bar Chart */}
                  <div className="admin-tier-breakdown" style={{ marginTop: '30px' }}>
                    <h3 style={{ color: 'white', marginBottom: '20px', fontWeight: '600' }}>User Tier Breakdown</h3>
                    
                    {/* Glass Container */}
                    <div style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      backdropFilter: 'blur(10px)',
                      borderRadius: '16px',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      padding: '30px 20px 20px 20px',
                      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                      position: 'relative',
                      overflow: 'hidden'
                    }}>
                      {/* Subtle gradient overlay */}
                      <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(16, 185, 129, 0.1) 100%)',
                        pointerEvents: 'none'
                      }}></div>
                      
                      {/* Chart Area */}
                      <div className="tier-bar-chart" style={{
                        display: 'flex',
                        alignItems: 'flex-end',
                        justifyContent: 'space-around',
                        height: '180px',
                        position: 'relative',
                        zIndex: 1,
                        margin: '0 10px'
                      }}>
                        {analytics?.tierCounts && Object.entries(analytics.tierCounts).map(([tier, count]) => {
                          const maxCount = Math.max(...Object.values(analytics.tierCounts));
                          const height = maxCount > 0 ? Math.max((count / maxCount) * 140, count > 0 ? 25 : 0) : 0;
                          const colors = {
                            guest: {
                              main: '#64748b',
                              gradient: 'linear-gradient(135deg, #64748b 0%, #475569 100%)',
                              glow: '0 4px 15px rgba(100, 116, 139, 0.4)'
                            },
                            pro: {
                              main: '#8b5cf6',
                              gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                              glow: '0 4px 15px rgba(139, 92, 246, 0.5)'
                            },
                            developer: {
                              main: '#10b981',
                              gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                              glow: '0 4px 15px rgba(16, 185, 129, 0.5)'
                            }
                          };
                          
                          return (
                            <div key={tier} style={{ 
                              display: 'flex', 
                              flexDirection: 'column', 
                              alignItems: 'center',
                              minWidth: '90px',
                              position: 'relative'
                            }}>
                              {/* Glass Bar */}
                              <div style={{
                                background: colors[tier]?.gradient || colors.guest.gradient,
                                width: '65px',
                                height: `${height}px`,
                                borderRadius: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                fontWeight: 'bold',
                                fontSize: '16px',
                                minHeight: count > 0 ? '25px' : '0px',
                                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                                boxShadow: colors[tier]?.glow,
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                backdropFilter: 'blur(5px)',
                                position: 'relative',
                                overflow: 'hidden'
                              }}>
                                {/* Inner glow */}
                                <div style={{
                                  position: 'absolute',
                                  top: 0,
                                  left: 0,
                                  right: 0,
                                  height: '30%',
                                  background: 'linear-gradient(180deg, rgba(255,255,255,0.3) 0%, transparent 100%)',
                                  borderRadius: '8px 8px 0 0'
                                }}></div>
                                
                                <span style={{ position: 'relative', zIndex: 1 }}>{count}</span>
                              </div>
                              
                              {/* Label */}
                              <div style={{
                                marginTop: '12px',
                                color: 'rgba(255, 255, 255, 0.9)',
                                fontSize: '13px',
                                fontWeight: '600',
                                textAlign: 'center',
                                textTransform: 'capitalize',
                                textShadow: '0 1px 3px rgba(0,0,0,0.5)'
                              }}>
                                {tier}
                              </div>
                              
                              {/* Sub-label for pro */}
                              {tier === 'pro' && (
                                <div style={{
                                  fontSize: '11px',
                                  color: 'rgba(139, 92, 246, 0.8)',
                                  marginTop: '2px',
                                  textShadow: '0 1px 2px rgba(0,0,0,0.5)'
                                }}>
                                  Active Pro
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      
                      {/* Glass Legend */}
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'center', 
                        gap: '25px', 
                        marginTop: '20px',
                        fontSize: '13px',
                        position: 'relative',
                        zIndex: 1
                      }}>
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '8px', 
                          color: 'rgba(255, 255, 255, 0.9)',
                          padding: '6px 12px',
                          borderRadius: '20px',
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          backdropFilter: 'blur(5px)'
                        }}>
                          <div style={{ 
                            width: '12px', 
                            height: '12px', 
                            background: 'linear-gradient(135deg, #64748b 0%, #475569 100%)', 
                            borderRadius: '3px',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                          }}></div>
                          Guest Users
                        </div>
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '8px', 
                          color: 'rgba(255, 255, 255, 0.9)',
                          padding: '6px 12px',
                          borderRadius: '20px',
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          backdropFilter: 'blur(5px)'
                        }}>
                          <div style={{ 
                            width: '12px', 
                            height: '12px', 
                            background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', 
                            borderRadius: '3px',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                          }}></div>
                          Pro Users
                        </div>
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '8px', 
                          color: 'rgba(255, 255, 255, 0.9)',
                          padding: '6px 12px',
                          borderRadius: '20px',
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          backdropFilter: 'blur(5px)'
                        }}>
                          <div style={{ 
                            width: '12px', 
                            height: '12px', 
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', 
                            borderRadius: '3px',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                          }}></div>
                          Developers
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Updates & Announcements Tab */}
              {activeTab === 'announcements' && (
                <div className="admin-announcements">
                  <div className="admin-announcements-header">
                    <h3>Updates & Announcements</h3>
                    <button
                      onClick={() => setShowAnnouncementForm(true)}
                      style={{
                        background: 'linear-gradient(45deg, #6366f1, #8b5cf6)',
                        color: 'white',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontWeight: '600',
                        fontSize: '14px'
                      }}
                    >
                      <Plus className="w-4 h-4" />
                      New Announcement
                    </button>
                  </div>

                  {/* Announcement Form */}
                  {showAnnouncementForm && (
                    <div style={{
                      background: '#1f2937',
                      padding: '25px',
                      borderRadius: '12px',
                      marginBottom: '25px',
                      border: '1px solid #374151',
                      boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
                    }}>
                      <h4 style={{ color: 'white', marginBottom: '20px', fontSize: '18px' }}>
                        {editingAnnouncement ? 'Edit Announcement' : 'Create New Announcement'}
                      </h4>
                      
                      {/* Title */}
                      <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', color: 'white' }}>
                          Title
                        </label>
                        <input
                          type="text"
                          value={announcementForm.title}
                          onChange={(e) => setAnnouncementForm({...announcementForm, title: e.target.value})}
                          placeholder="New feature: AI-powered clip suggestions"
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            border: '1px solid #4b5563',
                            borderRadius: '6px',
                            fontSize: '14px',
                            background: '#374151',
                            color: 'white'
                          }}
                        />
                      </div>

                      {/* Description */}
                      <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', color: 'white' }}>
                          Description
                        </label>
                        <textarea
                          value={announcementForm.description}
                          onChange={(e) => setAnnouncementForm({...announcementForm, description: e.target.value})}
                          placeholder="We're excited to announce our latest feature that helps you create better viral clips..."
                          rows={3}
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            border: '1px solid #4b5563',
                            borderRadius: '6px',
                            fontSize: '14px',
                            background: '#374151',
                            color: 'white',
                            resize: 'vertical'
                          }}
                        />
                      </div>

                      {/* Bullet Points */}
                      <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', color: 'white' }}>
                          Key Points (Bullet Points)
                        </label>
                        {announcementForm.bulletPoints.map((point, index) => (
                          <div key={index} style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
                            <input
                              type="text"
                              value={point}
                              onChange={(e) => {
                                const newPoints = [...announcementForm.bulletPoints];
                                newPoints[index] = e.target.value;
                                setAnnouncementForm({...announcementForm, bulletPoints: newPoints});
                              }}
                              placeholder={`Key point ${index + 1}`}
                              style={{
                                flex: 1,
                                padding: '8px 12px',
                                border: '1px solid #4b5563',
                                borderRadius: '6px',
                                fontSize: '14px',
                                background: '#374151',
                                color: 'white'
                              }}
                            />
                            {announcementForm.bulletPoints.length > 1 && (
                              <button
                                onClick={() => {
                                  const newPoints = announcementForm.bulletPoints.filter((_, i) => i !== index);
                                  setAnnouncementForm({...announcementForm, bulletPoints: newPoints});
                                }}
                                style={{
                                  background: '#ef4444',
                                  color: 'white',
                                  border: 'none',
                                  padding: '8px 12px',
                                  borderRadius: '6px',
                                  cursor: 'pointer'
                                }}
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        ))}
                        <button
                          onClick={() => {
                            setAnnouncementForm({
                              ...announcementForm, 
                              bulletPoints: [...announcementForm.bulletPoints, '']
                            });
                          }}
                          style={{
                            background: '#10b981',
                            color: 'white',
                            border: 'none',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          + Add Point
                        </button>
                      </div>

                      {/* Target Audience */}
                      <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', color: 'white' }}>
                          Target Audience
                        </label>
                        <select
                          value={announcementForm.targetAudience}
                          onChange={(e) => setAnnouncementForm({...announcementForm, targetAudience: e.target.value})}
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            border: '1px solid #4b5563',
                            borderRadius: '6px',
                            fontSize: '14px',
                            background: '#374151',
                            color: 'white'
                          }}
                        >
                          <option value="all">All Users</option>
                          <option value="guest">Guest Users Only</option>
                          <option value="pro">Pro Users Only</option>
                          <option value="developer">Developers Only</option>
                        </select>
                      </div>

                      {/* Action Buttons */}
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                          onClick={handleSaveAnnouncement}
                          style={{
                            background: '#10b981',
                            color: 'white',
                            border: 'none',
                            padding: '10px 20px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: '600',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}
                        >
                          <Send className="w-4 h-4" />
                          {editingAnnouncement ? 'Update Announcement' : 'Send Announcement'}
                        </button>
                        <button
                          onClick={() => {
                            setShowAnnouncementForm(false);
                            setEditingAnnouncement(null);
                            setAnnouncementForm({
                              title: '',
                              description: '',
                              targetAudience: 'all',
                              bulletPoints: ['']
                            });
                          }}
                          style={{
                            background: '#6b7280',
                            color: 'white',
                            border: 'none',
                            padding: '10px 20px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: '600'
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Announcements List */}
                  <div style={{ marginTop: '20px' }}>
                    <h4 style={{ color: 'white', marginBottom: '15px' }}>Recent Announcements</h4>
                    {announcements.length === 0 ? (
                      <div style={{
                        textAlign: 'center',
                        padding: '40px',
                        background: '#1f2937',
                        borderRadius: '8px',
                        border: '1px solid #374151',
                        color: 'white'
                      }}>
                        <Megaphone className="w-16 h-16 mb-4 opacity-50" style={{ margin: '0 auto' }} />
                        <h4>No Announcements Yet</h4>
                        <p>Create your first announcement to communicate updates to your users.</p>
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gap: '15px' }}>
                        {announcements.map((announcement) => (
                          <div key={announcement.id} style={{
                            background: '#1f2937',
                            padding: '20px',
                            borderRadius: '8px',
                            border: '1px solid #374151',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                              <h5 style={{ color: 'white', margin: 0, fontSize: '16px' }}>{announcement.title}</h5>
                              <span style={{
                                padding: '4px 8px',
                                borderRadius: '12px',
                                fontSize: '12px',
                                fontWeight: '600',
                                background: announcement.targetAudience === 'all' ? '#3b82f6' : 
                                           announcement.targetAudience === 'pro' ? '#8b5cf6' :
                                           announcement.targetAudience === 'developer' ? '#10b981' : '#6b7280',
                                color: 'white'
                              }}>
                                {announcement.targetAudience === 'all' ? 'All Users' : 
                                 announcement.targetAudience.charAt(0).toUpperCase() + announcement.targetAudience.slice(1)}
                              </span>
                            </div>
                            
                            <p style={{ color: '#d1d5db', marginBottom: '10px', fontSize: '14px' }}>
                              {announcement.description}
                            </p>
                            
                            {announcement.bulletPoints && announcement.bulletPoints.length > 0 && (
                              <ul style={{ color: '#d1d5db', marginBottom: '10px', paddingLeft: '20px' }}>
                                {announcement.bulletPoints.map((point, index) => (
                                  <li key={index} style={{ fontSize: '14px', marginBottom: '4px' }}>{point}</li>
                                ))}
                              </ul>
                            )}
                            
                            <div style={{ 
                              fontSize: '12px', 
                              color: '#9ca3af', 
                              display: 'flex', 
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              borderTop: '1px solid #374151',
                              paddingTop: '10px',
                              marginTop: '15px'
                            }}>
                              <div>
                                <span>Created: {new Date(announcement.createdAt).toLocaleDateString()}</span>
                                <span style={{ marginLeft: '15px' }}>By: {announcement.createdBy}</span>
                              </div>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                  onClick={() => handleEditAnnouncement(announcement)}
                                  style={{
                                    background: '#3b82f6',
                                    color: 'white',
                                    border: 'none',
                                    padding: '6px 12px',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                  }}
                                >
                                  <Edit className="w-3 h-3" />
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteAnnouncement(announcement.id)}
                                  style={{
                                    background: '#dc2626',
                                    color: 'white',
                                    border: 'none',
                                    padding: '6px 12px',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                  }}
                                >
                                  <Trash2 className="w-3 h-3" />
                                  Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Content Creators Tab */}
              {activeTab === 'creators' && (
                <div className="admin-creators-section">
                  <CreatorManagement 
                    creatorBenefits={creatorBenefits} 
                    onRefresh={loadAdminData}
                  />
                </div>
              )}

              {/* Reports Tab */}
              {activeTab === 'reports' && (
                <div className="admin-reports">
                  <div className="admin-section-header">
                    <h3>User Reports & Feedback</h3>
                    <div className="admin-section-stats">
                      <span className="stat-badge">
                        {reports.filter(r => r.type === 'bug').length} Bugs
                      </span>
                      <span className="stat-badge">
                        {reports.filter(r => r.type === 'idea').length} Ideas
                      </span>
                    </div>
                  </div>

                  {/* Report Sub-tabs */}
                  <div className="report-tabs">
                    <button
                      onClick={() => setActiveReportTab('bugs')}
                      className={`report-tab ${activeReportTab === 'bugs' ? 'active' : ''}`}
                    >
                      🐛 Bugs ({reports.filter(r => r.type === 'bug').length})
                    </button>
                    <button
                      onClick={() => setActiveReportTab('ideas')}
                      className={`report-tab ${activeReportTab === 'ideas' ? 'active' : ''}`}
                    >
                      💡 Ideas ({reports.filter(r => r.type === 'idea').length})
                    </button>
                  </div>

                  {reports.filter(report => report.type === (activeReportTab === 'bugs' ? 'bug' : 'idea')).length === 0 ? (
                    <div className="admin-empty-state">
                      <Shield className="w-16 h-16 mb-4 opacity-50" />
                      <h4>No {activeReportTab === 'bugs' ? 'Bug Reports' : 'Ideas'} Yet</h4>
                      <p>User {activeReportTab === 'bugs' ? 'bug reports' : 'feature suggestions'} will appear here.</p>
                    </div>
                  ) : (
                    <div className="admin-reports-list">
                      {reports
                        .filter(report => report.type === (activeReportTab === 'bugs' ? 'bug' : 'idea'))
                        .map((report) => (
                        <div key={report.id} className={`admin-report-card ${report.type}`}>
                          <div className="report-header">
                            <div className="report-type">
                              <span className="report-type-icon">
                                {report.type === 'bug' ? '🐛' : '💡'}
                              </span>
                              <span className="report-type-text">
                                {report.type === 'bug' ? 'Bug Report' : 'Feature Idea'}
                              </span>
                            </div>
                            <div className="report-meta">
                              <span className="report-date">
                                {new Date(report.timestamp).toLocaleDateString()}
                              </span>
                              <span className={`report-status ${report.status}`}>
                                {report.status}
                              </span>
                            </div>
                          </div>
                          
                          <div className="report-content">
                            <h4 className="report-title">{report.title}</h4>
                            <p className="report-description">{report.description}</p>
                          </div>
                          
                          <div className="report-footer">
                            <div className="report-user">
                              <UserCheck className="w-4 h-4" />
                              <span>{report.user.name} ({report.user.email})</span>
                            </div>
                            <div className="report-actions">
                              <button 
                                className="report-action-btn"
                                onClick={() => {
                                  const updatedReports = reports.map(r => 
                                    r.id === report.id 
                                      ? { ...r, status: r.status === 'open' ? 'resolved' : 'open' }
                                      : r
                                  );
                                  setReports(updatedReports);
                                  localStorage.setItem('user_reports', JSON.stringify(updatedReports));
                                }}
                              >
                                {report.status === 'open' ? 'Mark Resolved' : 'Reopen'}
                              </button>
                              <button 
                                className="report-action-btn delete"
                                onClick={() => {
                                  if (confirm('Delete this report?')) {
                                    const filteredReports = reports.filter(r => r.id !== report.id);
                                    setReports(filteredReports);
                                    localStorage.setItem('user_reports', JSON.stringify(filteredReports));
                                  }
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
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
                    
                    <div className="dev-tool-card">
                      <Zap className="w-8 h-8 mb-3 text-yellow-500" />
                      <h4>Token Management</h4>
                      <p>Grant unlimited tokens to your account</p>
                      <button
                        onClick={grantUnlimitedTokens}
                        className="dev-action-btn"
                        style={{
                          background: 'linear-gradient(45deg, #f59e0b, #eab308)',
                          color: 'white',
                          border: 'none',
                          padding: '8px 16px',
                          borderRadius: '6px',
                          marginTop: '8px',
                          cursor: 'pointer',
                          fontWeight: '600',
                          fontSize: '14px'
                        }}
                      >
                        🚀 Get Unlimited Tokens
                      </button>
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