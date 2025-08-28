// Creator Benefits Service
// Handles all creator benefits operations with the database

const API_URL = 'http://localhost:3001/api';

class CreatorBenefitsService {
  static async createCreatorBenefit(email, tokens, proDays) {
    try {
      console.log('🎁 Creating creator benefit:', { email, tokens, proDays });

      // Calculate pro expiry date
      const proExpiryDate = proDays > 0 ? new Date(Date.now() + (proDays * 24 * 60 * 60 * 1000)) : null;
      const tier = proDays > 0 ? 'pro' : 'guest';

      const response = await fetch(`${API_URL}/creator-benefits`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          email: email.toLowerCase(),
          tokens: parseInt(tokens) || 0,
          proDays: parseInt(proDays) || 0,
          proExpiryDate: proExpiryDate?.toISOString(),
          tier
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create creator benefit');
      }

      return { success: true, data: result };
    } catch (error) {
      console.error('❌ Create creator benefit error:', error);
      return { error: error.message };
    }
  }

  static async getAllCreatorBenefits() {
    try {
      console.log('📋 Fetching all creator benefits...');

      const response = await fetch(`${API_URL}/creator-benefits`, {
        headers: {
          'Cache-Control': 'no-cache'
        },
        credentials: 'same-origin'
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch creator benefits');
      }

      return { success: true, benefits: result.benefits || [] };
    } catch (error) {
      console.error('❌ Get all creator benefits error:', error);
      return { error: error.message };
    }
  }

  static async getCreatorBenefit(email) {
    try {
      console.log('🔍 Fetching creator benefit for:', email);

      const response = await fetch(`${API_URL}/creator-benefits/${encodeURIComponent(email)}`, {
        headers: {
          'Cache-Control': 'no-cache'
        },
        credentials: 'same-origin'
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch creator benefit');
      }

      return { success: true, benefit: result.benefit };
    } catch (error) {
      console.error('❌ Get creator benefit error:', error);
      return { error: error.message };
    }
  }

  static async updateTokens(email, additionalTokens) {
    try {
      console.log('💰 Adding tokens:', { email, additionalTokens });

      const response = await fetch(`${API_URL}/creator-benefits/${encodeURIComponent(email)}/add-tokens`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tokens: parseInt(additionalTokens)
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to add tokens');
      }

      return { success: true, data: result };
    } catch (error) {
      console.error('❌ Add tokens error:', error);
      return { error: error.message };
    }
  }

  static async extendProAccess(email, additionalDays) {
    try {
      console.log('👑 Extending pro access:', { email, additionalDays });

      const response = await fetch(`${API_URL}/creator-benefits/${encodeURIComponent(email)}/extend-pro`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          days: parseInt(additionalDays)
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to extend pro access');
      }

      return { success: true, data: result };
    } catch (error) {
      console.error('❌ Extend pro access error:', error);
      return { error: error.message };
    }
  }

  static async markAsUsed(email, userId) {
    try {
      console.log('✅ Marking benefit as used:', { email, userId });

      const response = await fetch(`${API_URL}/creator-benefits/${encodeURIComponent(email)}/used`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userId
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to mark as used');
      }

      return { success: true, data: result };
    } catch (error) {
      console.error('❌ Mark as used error:', error);
      return { error: error.message };
    }
  }

  static async deleteCreatorBenefit(email) {
    try {
      console.log('🗑️ Deleting creator benefit:', email);

      const response = await fetch(`${API_URL}/creator-benefits/${encodeURIComponent(email)}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete creator benefit');
      }

      return { success: true };
    } catch (error) {
      console.error('❌ Delete creator benefit error:', error);
      return { error: error.message };
    }
  }

  // Helper method to check if pro access is still valid
  static isProAccessValid(benefit) {
    if (!benefit || !benefit.pro_expiry_date) return false;
    return new Date(benefit.pro_expiry_date) > new Date();
  }

  // Helper method to format expiry date
  static formatExpiryDate(dateString) {
    if (!dateString) return 'No expiry';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
}

export { CreatorBenefitsService };