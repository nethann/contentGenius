import { supabase } from '../lib/supabase'

/**
 * Admin Service - handles admin role management and permissions
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
   * Get all user profiles (admin only)
   */
  static async getAllUsers() {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return { users: data, error: null };
    } catch (error) {
      console.error('Error fetching all users:', error);
      return { users: null, error };
    }
  }

  /**
   * Update user tier (admin only)
   */
  static async updateUserTierAdmin(userId, newTier) {
    try {
      // Get current user info for logging
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated');
      }

      // Get current user tier before update
      const { data: currentProfile } = await supabase
        .from('user_profiles')
        .select('user_tier, email')
        .eq('id', userId)
        .single();

      // Update the user tier
      const { data, error } = await supabase
        .from('user_profiles')
        .update({ 
          user_tier: newTier,
          subscription_status: newTier === 'guest' ? 'inactive' : 'active',
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single();
      
      if (error) throw error;

      // Log the admin action (optional, requires admin_activity_log table)
      try {
        await supabase.rpc('log_admin_action', {
          p_admin_user_id: user.id,
          p_admin_email: user.email,
          p_action_type: 'tier_change',
          p_target_user_id: userId,
          p_target_user_email: currentProfile?.email,
          p_old_value: currentProfile?.user_tier,
          p_new_value: newTier,
          p_action_details: { 
            timestamp: new Date().toISOString(),
            admin_interface: true 
          }
        });
      } catch (logError) {
        console.warn('Could not log admin action:', logError);
        // Don't fail the main operation if logging fails
      }

      console.log(`✅ Admin updated user ${userId} tier from ${currentProfile?.user_tier} to ${newTier}`);
      return { profile: data, error: null };
    } catch (error) {
      console.error('Error updating user tier (admin):', error);
      return { profile: null, error };
    }
  }

  /**
   * Get app analytics (admin only)
   */
  static async getAppAnalytics() {
    try {
      // Try to use the admin analytics view first
      const { data: analyticsData, error: analyticsError } = await supabase
        .from('admin_analytics')
        .select('*')
        .single();

      if (analyticsData && !analyticsError) {
        return {
          analytics: {
            totalUsers: analyticsData.total_users,
            activeUsers: analyticsData.active_users,
            tierCounts: analyticsData.tier_counts,
            conversionRate: analyticsData.conversion_rate
          },
          error: null
        };
      }

      // Fallback to manual calculation if view doesn't exist
      console.warn('Admin analytics view not available, using fallback method');
      const { data: userStats, error: userError } = await supabase
        .from('user_profiles')
        .select('user_tier')
        .not('user_tier', 'is', null);
      
      if (userError) throw userError;

      // Process statistics manually
      const tierCounts = userStats.reduce((acc, user) => {
        acc[user.user_tier] = (acc[user.user_tier] || 0) + 1;
        return acc;
      }, {});

      const totalUsers = userStats.length;
      const activeUsers = userStats.filter(u => u.user_tier !== 'guest').length;

      return {
        analytics: {
          totalUsers,
          activeUsers,
          tierCounts,
          conversionRate: totalUsers > 0 ? (activeUsers / totalUsers * 100).toFixed(1) : 0
        },
        error: null
      };
    } catch (error) {
      console.error('Error fetching analytics:', error);
      return { analytics: null, error };
    }
  }

  /**
   * Delete user (admin only)
   */
  static async deleteUser(userId) {
    try {
      // Get current user info for logging
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated');
      }

      // Get user info before deletion for logging
      const { data: userToDelete } = await supabase
        .from('user_profiles')
        .select('email, user_tier, full_name')
        .eq('id', userId)
        .single();

      // Delete the user
      const { error } = await supabase
        .from('user_profiles')
        .delete()
        .eq('id', userId);
      
      if (error) throw error;

      // Log the admin action
      try {
        await supabase.rpc('log_admin_action', {
          p_admin_user_id: user.id,
          p_admin_email: user.email,
          p_action_type: 'user_delete',
          p_target_user_id: userId,
          p_target_user_email: userToDelete?.email,
          p_old_value: JSON.stringify({
            tier: userToDelete?.user_tier,
            name: userToDelete?.full_name
          }),
          p_new_value: 'deleted',
          p_action_details: { 
            timestamp: new Date().toISOString(),
            admin_interface: true 
          }
        });
      } catch (logError) {
        console.warn('Could not log admin action:', logError);
        // Don't fail the main operation if logging fails
      }

      console.log(`✅ Admin deleted user ${userId} (${userToDelete?.email})`);
      return { error: null };
    } catch (error) {
      console.error('Error deleting user (admin):', error);
      return { error };
    }
  }
}