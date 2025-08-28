/**
 * Token Service - handles token management for different user tiers
 */
export class TokenService {
  
  // Get tier info based on user tier
  static getTokenInfo(userTier) {
    switch (userTier) {
      case 'pro':
        return { 
          name: 'Pro', 
          maxTokens: 100, 
          refreshType: 'monthly',
          maxClips: 25, 
          maxVideoLength: 3600 
        };
      case 'developer':
        return { 
          name: 'Developer', 
          maxTokens: -1, 
          refreshType: 'unlimited',
          maxClips: -1, 
          maxVideoLength: -1 
        };
      default:
        return { 
          name: 'Guest', 
          maxTokens: 5, 
          refreshType: 'one-time',
          maxClips: 3, 
          maxVideoLength: 600 
        };
    }
  }

  // Get current tokens for user
  static getCurrentTokens(userId, userTier) {
    if (!userId) return 0;
    
    const tokenKey = `tokens_${userId}`;
    const tokenData = localStorage.getItem(tokenKey);
    
    if (!tokenData) {
      // Check if user has creator benefits first
      const benefitsKey = `benefitsApplied_${userId}`;
      const benefitsData = localStorage.getItem(benefitsKey);
      
      if (benefitsData) {
        // User has creator benefits - check if token data exists in benefits
        try {
          const benefitsWrapper = JSON.parse(benefitsData);
          const benefits = benefitsWrapper.benefits; // Benefits are nested inside
          if (benefits && benefits.tokens && typeof benefits.tokens === 'number') {
            // Create token data from benefits
            const tokenInfo = {
              count: benefits.tokens,
              lastRefresh: new Date().toISOString(),
              tier: userTier
            };
            console.log('💰 Initializing tokens from creator benefits:', benefits.tokens);
            localStorage.setItem(tokenKey, JSON.stringify(tokenInfo));
            return benefits.tokens;
          }
        } catch (error) {
          console.error('Error parsing benefits data:', error);
        }
      }
      
      // Initialize tokens for new users without creator benefits
      const tierInfo = this.getTokenInfo(userTier);
      const initialTokens = tierInfo.maxTokens === -1 ? -1 : tierInfo.maxTokens;
      const tokenInfo = {
        count: initialTokens,
        lastRefresh: new Date().toISOString(),
        tier: userTier
      };
      console.log('💰 Initializing default tokens for tier:', userTier, 'tokens:', initialTokens);
      localStorage.setItem(tokenKey, JSON.stringify(tokenInfo));
      return initialTokens;
    }
    
    const tokens = JSON.parse(tokenData);
    const tierInfo = this.getTokenInfo(userTier);
    
    // Check if we need to refresh monthly tokens for pro users
    if (userTier === 'pro') {
      const lastRefresh = new Date(tokens.lastRefresh);
      const now = new Date();
      const monthsDiff = (now.getFullYear() - lastRefresh.getFullYear()) * 12 + 
                         (now.getMonth() - lastRefresh.getMonth());
      
      if (monthsDiff >= 1) {
        // Refresh tokens for pro users monthly
        tokens.count = tierInfo.maxTokens;
        tokens.lastRefresh = now.toISOString();
        localStorage.setItem(tokenKey, JSON.stringify(tokens));
      }
    }
    
    return tokens.count;
  }

  // Use a token (consume one token)
  static useToken(userId, userTier) {
    if (!userId) return false;
    
    const currentTokens = this.getCurrentTokens(userId, userTier);
    if (currentTokens === -1) return true; // Unlimited for developers
    if (currentTokens <= 0) return false; // No tokens left
    
    const tokenKey = `tokens_${userId}`;
    const tokenData = JSON.parse(localStorage.getItem(tokenKey));
    tokenData.count -= 1;
    localStorage.setItem(tokenKey, JSON.stringify(tokenData));
    
    return true;
  }

  // Check if user has sufficient tokens
  static hasTokens(userId, userTier, required = 1) {
    const currentTokens = this.getCurrentTokens(userId, userTier);
    if (currentTokens === -1) return true; // Unlimited
    return currentTokens >= required;
  }

  // Get token display info
  static getTokenDisplay(userId, userTier) {
    const tokens = this.getCurrentTokens(userId, userTier);
    const tierInfo = this.getTokenInfo(userTier);
    
    return {
      current: tokens,
      max: tierInfo.maxTokens,
      display: tokens === -1 ? '∞' : tokens.toString(),
      label: tokens === -1 ? 'Unlimited' : 'Tokens',
      tierName: tierInfo.name
    };
  }
}