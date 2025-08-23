import { supabase } from '../lib/supabase'

/**
 * User Profile Service - handles user tier management in Supabase
 */
export class UserProfileService {
  
  /**
   * Get user profile with tier information
   */
  static async getUserProfile(userId) {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single()
      
      if (error) {
        // If no rows found, that's expected for new users
        if (error.code === 'PGRST116') {
          console.log('No profile found for user, will create one');
          return { profile: null, error: null }
        }
        throw error
      }
      return { profile: data, error: null }
    } catch (error) {
      console.error('Error fetching user profile:', error)
      
      // Handle table not found error
      if (error.message.includes('relation "public.user_profiles" does not exist') || 
          error.message.includes('Could not find the table')) {
        return { 
          profile: null, 
          error: { 
            message: 'Database table not set up. Please run the Supabase SQL setup first.',
            needsSetup: true 
          }
        }
      }
      
      return { profile: null, error }
    }
  }

  /**
   * Create or update user profile
   */
  static async upsertUserProfile(userId, profileData) {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .upsert({
          id: userId,
          ...profileData,
          updated_at: new Date().toISOString()
        })
        .select()
        .single()
      
      if (error) throw error
      return { profile: data, error: null }
    } catch (error) {
      console.error('Error upserting user profile:', error)
      return { profile: null, error }
    }
  }

  /**
   * Update user tier (guest -> pro or pro -> guest)
   */
  static async updateUserTier(userId, newTier) {
    console.log(`🔄 UserProfileService: Updating tier for ${userId} to ${newTier}`);
    
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .upsert({
          id: userId,
          user_tier: newTier,
          subscription_status: newTier === 'pro' ? 'active' : 'inactive',
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) throw error;
      
      console.log(`✅ Successfully updated user ${userId} tier to ${newTier}`, data);
      return { profile: data, error: null };
      
    } catch (error) {
      console.error('❌ Error updating user tier:', error);
      
      if (error.message.includes('relation "user_profiles" does not exist') || 
          error.message.includes('Could not find the table')) {
        return { 
          profile: null, 
          error: { 
            message: 'Database table not set up. Please run the Supabase SQL setup first.',
            needsSetup: true 
          }
        };
      }

      if (error.message.includes('permission')) {
        return { 
          profile: null, 
          error: { 
            message: 'Permission denied. Please check your database policies.',
            permission: true 
          }
        };
      }
      
      return { profile: null, error: { message: error.message } };
    }
  }

  /**
   * Check if user exists in profiles table, create if not
   */
  static async ensureUserProfile(user) {
    if (!user) return { profile: null, error: 'No user provided' }

    try {
      // First try to get existing profile
      const { profile, error } = await this.getUserProfile(user.id)
      
      if (profile) {
        return { profile, error: null }
      }

      // If profile doesn't exist, create it
      const profileData = {
        email: user.email,
        full_name: user.user_metadata?.full_name || user.user_metadata?.name || '',
        user_tier: 'guest' // Default tier for new users
      }

      return await this.upsertUserProfile(user.id, profileData)
    } catch (error) {
      console.error('Error ensuring user profile:', error)
      return { profile: null, error }
    }
  }

  /**
   * Upgrade user to pro tier
   */
  static async upgradeUserToPro(userId) {
    return await this.updateUserTier(userId, 'pro')
  }

  /**
   * Downgrade user to guest tier  
   */
  static async downgradeUserToGuest(userId) {
    return await this.updateUserTier(userId, 'guest')
  }
}