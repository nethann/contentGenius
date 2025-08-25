/**
 * Admin Service - handles admin role management and permissions
 * Now using local storage instead of Supabase
 */
export class AdminService {
  
  // Define admin users by email
  static ADMIN_EMAILS = [
    'nethan.nagendran@gmail.com',
    'nethmarket@gmail.com',
    'admin@yourcompany.com',        // Add more admin emails here
    'manager@yourcompany.com',
    'support@yourcompany.com'
  ];

  static DEVELOPER_EMAILS = [
    'nethan.nagendran@gmail.com',
    'nethmarket@gmail.com',
    'dev@yourcompany.com',          // Add more developer emails here
    'tech@yourcompany.com'
  ];

  /**
   * Check if user is admin based on email
   */
  static isAdmin(email) {
    return this.ADMIN_EMAILS.includes(email?.toLowerCase());
  }

  /**
   * Check if user is developer based on email
   */
  static isDeveloper(email) {
    return this.DEVELOPER_EMAILS.includes(email?.toLowerCase());
  }

  /**
   * Get appropriate tier based on email
   */
  static getUserTierByEmail(email) {
    if (this.isDeveloper(email)) {
      return 'developer';
    }
    return 'guest'; // Default tier
  }

  /**
   * Get all user profiles (admin only) - using local storage
   */
  static async getAllUsers() {
    try {
      console.log('🔍 Fetching users from local storage...');
      
      // Get all user profiles from localStorage
      const users = [];
      
      // Iterate through localStorage to find user profiles
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('user_profile_')) {
          try {
            const profile = JSON.parse(localStorage.getItem(key));
            users.push({
              ...profile,
              created_at: profile.created_at || new Date().toISOString()
            });
          } catch (parseError) {
            console.warn(`Could not parse user profile for key: ${key}`);
          }
        }
      }
      
      // Sort by creation date (newest first)
      users.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      
      console.log(`✅ Successfully fetched ${users.length} users from local storage`);
      return { users, error: null };
    } catch (error) {
      console.error('❌ JavaScript error fetching all users:', error);
      return { 
        users: [], 
        error: { message: error.message || 'Unknown error occurred' }
      };
    }
  }

  /**
   * Update user tier (admin only) - using local storage
   */
  static async updateUserTierAdmin(userId, newTier) {
    try {
      console.log(`🔄 Admin updating user ${userId} tier to ${newTier}`);
      
      // Find and update the user profile in localStorage
      const profileKey = `user_profile_${userId}`;
      const existingProfile = localStorage.getItem(profileKey);
      
      if (!existingProfile) {
        throw new Error('User profile not found');
      }
      
      const profile = JSON.parse(existingProfile);
      const oldTier = profile.user_tier;
      
      // Update the profile
      const updatedProfile = {
        ...profile,
        user_tier: newTier,
        subscription_status: newTier === 'guest' ? 'inactive' : 'active',
        updated_at: new Date().toISOString()
      };
      
      localStorage.setItem(profileKey, JSON.stringify(updatedProfile));
      
      console.log(`✅ Admin updated user ${userId} tier from ${oldTier} to ${newTier}`);
      return { profile: updatedProfile, error: null };
    } catch (error) {
      console.error('Error updating user tier (admin):', error);
      return { profile: null, error };
    }
  }

  /**
   * Get app analytics (admin only) - using local storage
   */
  static async getAppAnalytics() {
    try {
      console.log('📊 Calculating analytics from local storage...');
      
      // Get all user profiles
      const { users: userStats } = await this.getAllUsers();
      
      console.log(`📈 Processing analytics for ${userStats?.length || 0} users`);
      
      // Process statistics manually
      const tierCounts = (userStats || []).reduce((acc, user) => {
        const tier = user.user_tier || 'guest';
        acc[tier] = (acc[tier] || 0) + 1;
        return acc;
      }, { guest: 0, pro: 0, developer: 0 });

      const totalUsers = userStats?.length || 0;
      const activeUsers = (userStats || []).filter(u => u.user_tier && u.user_tier !== 'guest').length;

      const analytics = {
        totalUsers,
        activeUsers,
        tierCounts,
        conversionRate: totalUsers > 0 ? (activeUsers / totalUsers * 100).toFixed(1) : 0
      };

      console.log('✅ Successfully calculated analytics:', analytics);
      return { analytics, error: null };
    } catch (error) {
      console.error('❌ JavaScript error fetching analytics:', error);
      // Return default analytics on error to prevent loading state hang
      return {
        analytics: {
          totalUsers: 0,
          activeUsers: 0,
          tierCounts: { guest: 0, pro: 0, developer: 0 },
          conversionRate: 0
        },
        error: null
      };
    }
  }

  /**
   * Delete user (admin only) - using local storage
   */
  static async deleteUser(userId) {
    try {
      console.log(`🗑️ Admin deleting user ${userId}`);
      
      // Get user info before deletion for logging
      const profileKey = `user_profile_${userId}`;
      const userToDelete = localStorage.getItem(profileKey);
      
      if (!userToDelete) {
        throw new Error('User profile not found');
      }
      
      const userData = JSON.parse(userToDelete);
      
      // Delete the user profile from localStorage
      localStorage.removeItem(profileKey);
      
      // Also remove user tier data
      localStorage.removeItem(`userTier_${userId}`);
      
      console.log(`✅ Admin deleted user ${userId} (${userData?.email})`);
      return { error: null };
    } catch (error) {
      console.error('Error deleting user (admin):', error);
      return { error };
    }
  }
}