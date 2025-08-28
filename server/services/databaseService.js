// Database Service for Creator Benefits
// Using direct SQL queries to interact with the database

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use service role key for server-side operations

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  throw new Error('Missing Supabase credentials');
}

const supabase = createClient(supabaseUrl, supabaseKey);

class DatabaseService {
  // Create a new creator benefit
  static async createCreatorBenefit(email, tokens, proDays) {
    try {
      console.log('🎁 Creating creator benefit:', { email, tokens, proDays });

      const proExpiryDate = proDays > 0 ? 
        new Date(Date.now() + (proDays * 24 * 60 * 60 * 1000)).toISOString() : 
        null;
      
      const tier = proDays > 0 ? 'pro' : 'guest';

      const { data, error } = await supabase
        .from('creator_benefits')
        .insert({
          email: email.toLowerCase(),
          tokens: parseInt(tokens) || 0,
          pro_days: parseInt(proDays) || 0,
          pro_expiry_date: proExpiryDate,
          tier: tier,
          is_used: false
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Database error:', error);
        throw error;
      }

      console.log('✅ Creator benefit created:', data);
      return { success: true, data };
    } catch (error) {
      console.error('❌ Create creator benefit error:', error);
      return { error: error.message };
    }
  }

  // Get all creator benefits
  static async getAllCreatorBenefits() {
    try {
      console.log('📋 Fetching all creator benefits...');

      const { data, error } = await supabase
        .from('creator_benefits')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Database error:', error);
        throw error;
      }

      console.log(`✅ Found ${data.length} creator benefits`);
      return { success: true, benefits: data };
    } catch (error) {
      console.error('❌ Get all creator benefits error:', error);
      return { error: error.message };
    }
  }

  // Get creator benefit by email
  static async getCreatorBenefitByEmail(email) {
    try {
      console.log('🔍 Fetching creator benefit for:', email);

      const { data, error } = await supabase
        .from('creator_benefits')
        .select('*')
        .eq('email', email.toLowerCase())
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        console.error('❌ Database error:', error);
        throw error;
      }

      console.log('✅ Creator benefit found:', !!data);
      return { success: true, benefit: data };
    } catch (error) {
      console.error('❌ Get creator benefit error:', error);
      return { error: error.message };
    }
  }

  // Add tokens to existing creator
  static async addTokens(email, additionalTokens) {
    try {
      console.log('💰 Adding tokens:', { email, additionalTokens });

      // First get current tokens
      const { data: currentData, error: fetchError } = await supabase
        .from('creator_benefits')
        .select('tokens')
        .eq('email', email.toLowerCase())
        .single();

      if (fetchError) {
        console.error('❌ Fetch error:', fetchError);
        throw fetchError;
      }

      const newTokenCount = (currentData.tokens || 0) + parseInt(additionalTokens);

      const { data, error } = await supabase
        .from('creator_benefits')
        .update({
          tokens: newTokenCount,
          updated_at: new Date().toISOString()
        })
        .eq('email', email.toLowerCase())
        .select()
        .single();

      if (error) {
        console.error('❌ Database error:', error);
        throw error;
      }

      console.log(`✅ Added ${additionalTokens} tokens. New total: ${newTokenCount}`);
      return { success: true, data, newTotal: newTokenCount };
    } catch (error) {
      console.error('❌ Add tokens error:', error);
      return { error: error.message };
    }
  }

  // Extend pro access
  static async extendProAccess(email, additionalDays) {
    try {
      console.log('👑 Extending pro access:', { email, additionalDays });

      // Get current expiry date
      const { data: currentData, error: fetchError } = await supabase
        .from('creator_benefits')
        .select('pro_expiry_date')
        .eq('email', email.toLowerCase())
        .single();

      if (fetchError) {
        console.error('❌ Fetch error:', fetchError);
        throw fetchError;
      }

      const currentExpiry = currentData.pro_expiry_date ? 
        new Date(currentData.pro_expiry_date) : 
        new Date();
      
      // If current expiry is in the past, start from now
      const baseDate = currentExpiry > new Date() ? currentExpiry : new Date();
      const newExpiry = new Date(baseDate.getTime() + (additionalDays * 24 * 60 * 60 * 1000));

      const { data, error } = await supabase
        .from('creator_benefits')
        .update({
          pro_expiry_date: newExpiry.toISOString(),
          tier: 'pro',
          updated_at: new Date().toISOString()
        })
        .eq('email', email.toLowerCase())
        .select()
        .single();

      if (error) {
        console.error('❌ Database error:', error);
        throw error;
      }

      console.log(`✅ Pro access extended until: ${newExpiry.toLocaleDateString()}`);
      return { success: true, data, newExpiryDate: newExpiry.toISOString() };
    } catch (error) {
      console.error('❌ Extend pro access error:', error);
      return { error: error.message };
    }
  }

  // Mark benefit as used
  static async markAsUsed(email, userId) {
    try {
      console.log('✅ Marking benefit as used:', { email, userId });

      const { data, error } = await supabase
        .from('creator_benefits')
        .update({
          is_used: true,
          used_by: userId,
          used_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('email', email.toLowerCase())
        .select()
        .single();

      if (error) {
        console.error('❌ Database error:', error);
        throw error;
      }

      console.log('✅ Benefit marked as used');
      return { success: true, data };
    } catch (error) {
      console.error('❌ Mark as used error:', error);
      return { error: error.message };
    }
  }

  // Delete creator benefit
  static async deleteCreatorBenefit(email) {
    try {
      console.log('🗑️ Deleting creator benefit:', email);

      const { error } = await supabase
        .from('creator_benefits')
        .delete()
        .eq('email', email.toLowerCase());

      if (error) {
        console.error('❌ Database error:', error);
        throw error;
      }

      console.log('✅ Creator benefit deleted');
      return { success: true };
    } catch (error) {
      console.error('❌ Delete creator benefit error:', error);
      return { error: error.message };
    }
  }
}

export { DatabaseService };