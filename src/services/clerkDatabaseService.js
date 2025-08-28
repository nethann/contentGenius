// Clerk Database Service - Using server-side API for persistent storage
import { useUser } from '@clerk/clerk-react';

const API_BASE_URL = 'http://localhost:3001/api';

export class ClerkDatabaseService {
  // Store content creator benefits that will be applied when user signs up
  static async storeCreatorBenefits(email, benefits) {
    try {
      console.log('🗄️ Storing creator benefits via server API for:', email, benefits);
      
      const response = await fetch(`${API_BASE_URL}/creator-benefits`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.toLowerCase(),
          benefits
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('✅ Creator benefits stored via server API:', result);
      return { success: true };
    } catch (error) {
      console.error('❌ Error storing creator benefits via API:', error);
      return { success: false, error: error.message };
    }
  }

  // Get creator benefits for a specific email
  static async getCreatorBenefits(email) {
    try {
      console.log('🔍 Looking for creator benefits via server API for:', email);
      
      const response = await fetch(`${API_BASE_URL}/creator-benefits/${encodeURIComponent(email.toLowerCase())}`, {
        headers: {
          'Cache-Control': 'no-cache'
        },
        credentials: 'same-origin'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        if (result.benefit) {
          console.log('✅ Found benefits via server API:', result.benefit);
          return { success: true, benefits: result.benefit };
        } else {
          console.log('❌ No benefits found via server API for:', email);
          return { success: true, benefits: null };
        }
      } else {
        throw new Error('Server returned error');
      }
    } catch (error) {
      console.error('❌ Error getting creator benefits via API:', error);
      return { success: false, error: error.message };
    }
  }

  // Apply benefits to a user using localStorage (since Clerk doesn't allow client-side metadata updates)
  static async applyBenefitsToUser(user, benefits) {
    try {
      console.log('🎯 Applying benefits to user via localStorage:', user.emailAddresses[0].emailAddress, benefits);
      
      // Clear any existing data for this user to ensure fresh application of benefits
      console.log('🧹 Clearing existing localStorage data for user:', user.id);
      localStorage.removeItem(`userTier_${user.id}`);
      localStorage.removeItem(`tokens_${user.id}`);
      localStorage.removeItem(`proExpiry_${user.id}`);
      localStorage.removeItem(`benefitsApplied_${user.id}`);
      
      // Store benefits in localStorage for immediate access
      localStorage.setItem(`userTier_${user.id}`, benefits.tier || 'guest');
      
      // Always set tokens, even if 0 (to ensure proper initialization)
      const tokenData = {
        count: parseInt(benefits.tokens) || 0,
        lastRefresh: new Date().toISOString(),
        tier: benefits.tier || 'guest'
      };
      console.log('💰 Setting tokens in localStorage:', tokenData);
      localStorage.setItem(`tokens_${user.id}`, JSON.stringify(tokenData));
      
      // Set pro expiry date if available
      if (benefits.pro_expiry_date) {
        localStorage.setItem(`proExpiry_${user.id}`, benefits.pro_expiry_date);
      } else if (benefits.proExpiryDate) {
        localStorage.setItem(`proExpiry_${user.id}`, benefits.proExpiryDate);
      }

      // Store a flag to indicate benefits have been applied
      localStorage.setItem(`benefitsApplied_${user.id}`, JSON.stringify({
        applied: true,
        appliedAt: new Date().toISOString(),
        benefits: benefits
      }));

      console.log('✅ Benefits applied successfully via localStorage');
      return { success: true };
    } catch (error) {
      console.error('❌ Error applying benefits via localStorage:', error);
      return { success: false, error };
    }
  }

  // Check if user already has benefits applied
  static hasUserReceivedBenefits(user) {
    const benefitsData = localStorage.getItem(`benefitsApplied_${user.id}`);
    return benefitsData ? JSON.parse(benefitsData).applied : false;
  }

  // Get user's current tier from localStorage
  static getUserTier(user) {
    return localStorage.getItem(`userTier_${user.id}`) || 'guest';
  }

  // Get user's tokens from localStorage
  static getUserTokens(user) {
    const tokenData = localStorage.getItem(`tokens_${user.id}`);
    return tokenData ? JSON.parse(tokenData).count : 0;
  }

  // Mark creator benefits as used
  static async markBenefitsAsUsed(email, userId) {
    try {
      console.log('🔄 Marking benefits as used via server API for:', email);
      
      const response = await fetch(`${API_BASE_URL}/creator-benefits/${encodeURIComponent(email.toLowerCase())}/used`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      // Also update local content creators list if it exists
      try {
        const creators = JSON.parse(localStorage.getItem('content_creators') || '[]');
        const updatedCreators = creators.map(creator => {
          if (creator.email === email.toLowerCase()) {
            return {
              ...creator,
              benefitsApplied: true,
              benefitsAppliedDate: new Date().toISOString(),
              linkedUserId: userId
            };
          }
          return creator;
        });
        localStorage.setItem('content_creators', JSON.stringify(updatedCreators));
      } catch (localError) {
        console.log('📝 Note: Could not update local creators list (this is normal)');
      }

      console.log('✅ Benefits marked as used via server API:', result);
      return { success: true };
    } catch (error) {
      console.error('❌ Error marking benefits as used via API:', error);
      return { success: false, error: error.message };
    }
  }

  // Add more tokens to existing creator
  static async addTokensToCreator(email, tokens) {
    try {
      console.log('💰 Adding tokens via server API for:', email, 'tokens:', tokens);
      
      const response = await fetch(`${API_BASE_URL}/creator-benefits/${encodeURIComponent(email.toLowerCase())}/add-tokens`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tokens: parseInt(tokens) })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('✅ Tokens added via server API:', result);
      return { success: true, newTotal: result.newTotal };
    } catch (error) {
      console.error('❌ Error adding tokens via API:', error);
      return { success: false, error: error.message };
    }
  }

  // Extend pro access for existing creator
  static async extendProAccess(email, days) {
    try {
      console.log('👑 Extending pro access via server API for:', email, 'days:', days);
      
      const response = await fetch(`${API_BASE_URL}/creator-benefits/${encodeURIComponent(email.toLowerCase())}/extend-pro`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ days: parseInt(days) })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('✅ Pro access extended via server API:', result);
      return { success: true, newExpiryDate: result.newExpiryDate };
    } catch (error) {
      console.error('❌ Error extending pro access via API:', error);
      return { success: false, error: error.message };
    }
  }
}

// React hook for easy access to the service
export const useClerkDatabase = () => {
  const { user } = useUser();
  
  return {
    user,
    storeCreatorBenefits: ClerkDatabaseService.storeCreatorBenefits,
    getCreatorBenefits: ClerkDatabaseService.getCreatorBenefits,
    applyBenefitsToUser: ClerkDatabaseService.applyBenefitsToUser,
    hasUserReceivedBenefits: ClerkDatabaseService.hasUserReceivedBenefits,
    getUserTier: ClerkDatabaseService.getUserTier,
    getUserTokens: ClerkDatabaseService.getUserTokens,
    markBenefitsAsUsed: ClerkDatabaseService.markBenefitsAsUsed,
    addTokensToCreator: ClerkDatabaseService.addTokensToCreator,
    extendProAccess: ClerkDatabaseService.extendProAccess
  };
};