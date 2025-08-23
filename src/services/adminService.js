import { supabase } from '../lib/supabase'

/**
 * Admin Service - handles admin role management and permissions
 */

// Timeout helper function
const withTimeout = (promise, timeoutMs = 10000) => {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
};
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
      console.log('🔍 Attempting to fetch users from user_profiles table...');
      const query = supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });
      
      const { data, error } = await withTimeout(query, 5000);
      
      if (error) {
        console.error('❌ Supabase error fetching all users:', error);
        console.error('Error details:', error.message, error.details, error.hint);
        // Return empty array on error to prevent loading state hang
        return { users: [], error: null };
      }
      
      console.log(`✅ Successfully fetched ${data?.length || 0} users from database`);
      return { users: data || [], error: null };
    } catch (error) {
      console.error('❌ JavaScript error fetching all users:', error);
      if (error.message.includes('timed out')) {
        console.error('❌ Database query timed out - possible connection issue');
      }
      // Return empty array on error to prevent loading state hang
      return { users: [], error: null };
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
      console.log('📊 Attempting to fetch analytics from user_profiles table...');
      // Get basic user statistics
      const query = supabase
        .from('user_profiles')
        .select('user_tier, created_at');
      
      const { data: userStats, error: userError } = await withTimeout(query, 5000);
      
      if (userError) {
        console.error('❌ Supabase error fetching user profiles for analytics:', userError);
        console.error('Error details:', userError.message, userError.details, userError.hint);
        // Return default analytics on error
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
      if (error.message.includes('timed out')) {
        console.error('❌ Database query timed out - possible connection issue');
      }
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