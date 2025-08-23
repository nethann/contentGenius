import { supabase } from '../lib/supabase';

/**
 * Database Setup Service - Automatically handles database initialization
 */
export class DBSetupService {
  
  static async ensureDatabaseSetup() {
    try {
      console.log('🔄 Checking database setup...');
      
      // Check if table exists
      const tableExists = await this.checkTableExists();
      if (!tableExists) {
        console.log('⚠️ user_profiles table does not exist, creating...');
        await this.createUserProfilesTable();
      }
      
      // Ensure RLS policies are set up
      await this.ensurePoliciesExist();
      
      // Ensure current user has a profile
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await this.ensureCurrentUserProfile(user);
      }
      
      console.log('✅ Database setup completed');
      return { success: true };
    } catch (error) {
      console.error('❌ Database setup failed:', error);
      return { success: false, error: error.message };
    }
  }

  static async checkTableExists() {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('count(*)', { count: 'exact', head: true });
      
      return !error;
    } catch (error) {
      return false;
    }
  }

  static async createUserProfilesTable() {
    const createTableSQL = `
      -- Create the user_profiles table
      CREATE TABLE IF NOT EXISTS user_profiles (
          id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          full_name TEXT,
          user_tier TEXT DEFAULT 'guest' CHECK (user_tier IN ('guest', 'pro', 'developer')),
          subscription_status TEXT DEFAULT 'inactive' CHECK (subscription_status IN ('active', 'inactive', 'cancelled')),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    const { error } = await supabase.rpc('exec_sql', { sql: createTableSQL });
    if (error) throw error;
  }

  static async ensurePoliciesExist() {
    try {
      // Enable RLS if not already enabled
      await supabase.rpc('exec_sql', { 
        sql: 'ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;' 
      });

      // Create policies (with IF NOT EXISTS equivalent logic)
      const policies = [
        {
          name: 'users_read_own',
          sql: `
            CREATE POLICY "Users can read own profile" ON user_profiles
            FOR SELECT USING (auth.uid() = id);
          `
        },
        {
          name: 'users_update_own', 
          sql: `
            CREATE POLICY "Users can update own profile" ON user_profiles
            FOR UPDATE USING (auth.uid() = id);
          `
        },
        {
          name: 'users_insert_own',
          sql: `
            CREATE POLICY "Users can insert own profile" ON user_profiles
            FOR INSERT WITH CHECK (auth.uid() = id);
          `
        },
        {
          name: 'admins_read_all',
          sql: `
            CREATE POLICY "Admins can read all profiles" ON user_profiles
            FOR SELECT USING (
                auth.jwt() ->> 'email' = 'nethan.nagendran@gmail.com' OR 
                auth.jwt() ->> 'email' = 'nethmarket@gmail.com'
            );
          `
        },
        {
          name: 'admins_update_all',
          sql: `
            CREATE POLICY "Admins can update all profiles" ON user_profiles
            FOR UPDATE USING (
                auth.jwt() ->> 'email' = 'nethan.nagendran@gmail.com' OR 
                auth.jwt() ->> 'email' = 'nethmarket@gmail.com'
            );
          `
        },
        {
          name: 'admins_insert_all',
          sql: `
            CREATE POLICY "Admins can insert any profile" ON user_profiles
            FOR INSERT WITH CHECK (
                auth.jwt() ->> 'email' = 'nethan.nagendran@gmail.com' OR 
                auth.jwt() ->> 'email' = 'nethmarket@gmail.com'
            );
          `
        }
      ];

      // Try to create each policy, ignore if already exists
      for (const policy of policies) {
        try {
          await supabase.rpc('exec_sql', { sql: policy.sql });
        } catch (error) {
          // Ignore "already exists" errors
          if (!error.message.includes('already exists')) {
            console.warn(`Warning creating policy ${policy.name}:`, error.message);
          }
        }
      }
    } catch (error) {
      console.warn('Warning setting up policies:', error);
      // Don't throw - policies might already exist or need manual setup
    }
  }

  static async ensureCurrentUserProfile(user) {
    try {
      // Check if profile exists
      const { data: existingProfile, error: checkError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      if (!existingProfile) {
        // Create profile for current user
        const userTier = this.getUserTierByEmail(user.email);
        const { error: insertError } = await supabase
          .from('user_profiles')
          .insert({
            id: user.id,
            email: user.email,
            full_name: user.user_metadata?.full_name || user.user_metadata?.name || '',
            user_tier: userTier,
            subscription_status: userTier === 'guest' ? 'inactive' : 'active'
          });

        if (insertError) throw insertError;
        console.log(`✅ Created profile for ${user.email} with tier: ${userTier}`);
      } else {
        // Update existing profile if needed
        const correctTier = this.getUserTierByEmail(user.email);
        if (existingProfile.user_tier !== correctTier) {
          const { error: updateError } = await supabase
            .from('user_profiles')
            .update({ 
              user_tier: correctTier,
              subscription_status: correctTier === 'guest' ? 'inactive' : 'active',
              updated_at: new Date().toISOString()
            })
            .eq('id', user.id);

          if (updateError) throw updateError;
          console.log(`✅ Updated profile for ${user.email} to tier: ${correctTier}`);
        }
      }
    } catch (error) {
      console.error('❌ Error ensuring user profile:', error);
      // Don't throw - let app continue with fallback behavior
    }
  }

  static getUserTierByEmail(email) {
    const adminEmails = ['nethan.nagendran@gmail.com', 'nethmarket@gmail.com'];
    return adminEmails.includes(email?.toLowerCase()) ? 'developer' : 'guest';
  }

  // Fallback method for when Supabase is having issues
  static getLocalFallbackProfile(user) {
    if (!user) return null;
    
    return {
      id: user.id,
      email: user.email,
      full_name: user.user_metadata?.full_name || user.user_metadata?.name || '',
      user_tier: this.getUserTierByEmail(user.email),
      subscription_status: this.getUserTierByEmail(user.email) === 'guest' ? 'inactive' : 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }
}