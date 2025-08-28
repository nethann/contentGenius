import React, { createContext, useContext, useEffect, useState } from 'react';
import { useUser, useAuth as useClerkAuth } from '@clerk/clerk-react';
import { ClerkDatabaseService } from '../services/clerkDatabaseService';

const ClerkAuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(ClerkAuthContext);
  if (!context) {
    throw new Error('useAuth must be used within a ClerkAuthProvider');
  }
  return context;
};

export const ClerkAuthProvider = ({ children }) => {
  const { user: clerkUser, isLoaded: userLoaded } = useUser();
  const { signOut: clerkSignOut, isLoaded: authLoaded } = useClerkAuth();
  
  const [user, setUser] = useState(null);
  const [userTier, setUserTier] = useState('guest');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const initializeUser = async () => {
      console.log('🏁 initializeUser called', { userLoaded, authLoaded, hasUser: !!clerkUser });
      
      if (!userLoaded || !authLoaded) {
        console.log('⏳ Still loading Clerk...', { userLoaded, authLoaded });
        return; // Still loading
      }

      if (!clerkUser) {
        // No user signed in
        console.log('👤 No user signed in, setting guest');
        setUser(null);
        setUserTier('guest');
        setLoading(false);
        return;
      }

      try {
        console.log('🔄 Initializing user from Clerk:', clerkUser.emailAddresses[0]?.emailAddress);
        
        // Determine base tier based on admin emails
        const adminEmails = ['nethan.nagendran@gmail.com', 'nethmarket@gmail.com'];
        const isAdmin = adminEmails.includes(clerkUser.emailAddresses[0]?.emailAddress?.toLowerCase());
        let finalTier = isAdmin ? 'developer' : 'guest';
        
        // Check for creator benefits
        const userEmail = clerkUser.emailAddresses[0]?.emailAddress?.toLowerCase();
        console.log('🎁 Checking for creator benefits for:', userEmail);
        
        const benefitsResult = await ClerkDatabaseService.getCreatorBenefits(userEmail);
        
        if (benefitsResult.success && benefitsResult.benefits) {
          console.log('✅ Found creator benefits:', benefitsResult.benefits);
          
          // Check if benefits have been updated on the server
          const hasLocalBenefits = ClerkDatabaseService.hasUserReceivedBenefits(clerkUser);
          const hasLocalTier = localStorage.getItem(`userTier_${clerkUser.id}`);
          
          let shouldApplyBenefits = false;
          
          if (!hasLocalBenefits || !hasLocalTier) {
            // No local benefits - apply them
            shouldApplyBenefits = true;
            console.log('🎯 Applying creator benefits to user (first time)...');
          } else {
            // Check if server benefits are different from local benefits
            const localBenefitsData = localStorage.getItem(`benefitsApplied_${clerkUser.id}`);
            if (localBenefitsData) {
              try {
                const localBenefits = JSON.parse(localBenefitsData).benefits;
                const serverUpdatedAt = new Date(benefitsResult.benefits.updated_at);
                const localUpdatedAt = localBenefits.updated_at ? new Date(localBenefits.updated_at) : new Date(0);
                
                if (serverUpdatedAt > localUpdatedAt || 
                    localBenefits.tokens !== benefitsResult.benefits.tokens ||
                    localBenefits.pro_expiry_date !== benefitsResult.benefits.pro_expiry_date) {
                  shouldApplyBenefits = true;
                  console.log('🔄 Benefits updated on server - refreshing local benefits...');
                  console.log('Server tokens:', benefitsResult.benefits.tokens, 'Local tokens:', localBenefits.tokens);
                } else {
                  console.log('ℹ️ Creator benefits are up to date');
                }
              } catch (error) {
                console.error('Error parsing local benefits:', error);
                shouldApplyBenefits = true;
              }
            }
          }
          
          if (shouldApplyBenefits) {
            // Apply benefits to localStorage
            await ClerkDatabaseService.applyBenefitsToUser(clerkUser, benefitsResult.benefits);
            
            // Only mark benefits as used on the server if they haven't been used before
            if (!benefitsResult.benefits.is_used) {
              await ClerkDatabaseService.markBenefitsAsUsed(userEmail, clerkUser.id);
            }
            
            console.log('✅ Creator benefits applied successfully');
          }
          
          // Update tier based on benefits (even for non-admin users)
          if (!isAdmin && benefitsResult.benefits.tier === 'pro') {
            // Check if pro access is still valid
            if (benefitsResult.benefits.pro_expiry_date) {
              const expiryDate = new Date(benefitsResult.benefits.pro_expiry_date);
              const isValid = expiryDate > new Date();
              console.log('⏰ Pro access validation:', { expiryDate: expiryDate.toISOString(), isValid });
              
              if (isValid) {
                finalTier = 'pro';
                console.log('👑 User has active pro access until:', expiryDate.toLocaleDateString());
              } else {
                console.log('⏰ User\'s pro access has expired');
                finalTier = 'guest';
              }
            } else if (benefitsResult.benefits.tier === 'pro') {
              finalTier = 'pro';
              console.log('👑 User has pro access (no expiry date specified)');
            }
          }
        } else {
          console.log('ℹ️ No creator benefits found for user');
        }
        
        setUser({
          id: clerkUser.id,
          email: clerkUser.emailAddresses[0]?.emailAddress || '',
          firstName: clerkUser.firstName || '',
          lastName: clerkUser.lastName || '',
          fullName: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim(),
          imageUrl: clerkUser.imageUrl || '',
          userTier: finalTier,
          subscriptionStatus: finalTier === 'guest' ? 'inactive' : 'active'
        });
        
        setUserTier(finalTier);
        
        console.log('✅ User initialized with tier:', finalTier);
        
      } catch (error) {
        console.error('❌ Error initializing user:', error);
        setError('Failed to initialize user profile');
        
        // Fallback to basic user info from Clerk
        const adminEmails = ['nethan.nagendran@gmail.com', 'nethmarket@gmail.com'];
        const fallbackTier = adminEmails.includes(clerkUser.emailAddresses[0]?.emailAddress?.toLowerCase()) 
          ? 'developer' 
          : 'guest';
          
        setUser({
          id: clerkUser.id,
          email: clerkUser.emailAddresses[0]?.emailAddress || '',
          firstName: clerkUser.firstName || '',
          lastName: clerkUser.lastName || '',
          fullName: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim(),
          imageUrl: clerkUser.imageUrl || '',
          userTier: fallbackTier,
          subscriptionStatus: fallbackTier === 'guest' ? 'inactive' : 'active'
        });
        
        setUserTier(fallbackTier);
      } finally {
        setLoading(false);
      }
    };

  // Function to manually refresh benefits (can be called from components)
  const refreshBenefits = async () => {
    if (clerkUser) {
      console.log('🔄 Manually refreshing creator benefits...');
      await initializeUser();
    }
  };

  useEffect(() => {
    console.log('🔄 ClerkAuthContext useEffect triggered', { userLoaded, authLoaded, clerkUser: clerkUser?.emailAddresses?.[0]?.emailAddress });
    initializeUser();
  }, [clerkUser, userLoaded, authLoaded]);

  // Auto-refresh benefits when user returns to the tab
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && clerkUser) {
        console.log('👀 Tab became visible - checking for benefit updates...');
        refreshBenefits();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [clerkUser]);

  const upgradeToPro = async () => {
    if (!user) {
      return { error: 'No user logged in' };
    }

    if (userTier === 'pro' || userTier === 'developer') {
      return { error: 'User already has premium access' };
    }

    try {
      console.log('🚀 Upgrading user to Pro...');
      
      // Simple local upgrade for now
      setUserTier('pro');
      setUser({ ...user, userTier: 'pro', subscriptionStatus: 'active' });
      
      console.log('✅ Successfully upgraded to Pro!');
      return { success: true, tier: 'pro' };
      
    } catch (error) {
      console.error('❌ Error upgrading to Pro:', error);
      return { error: 'Failed to upgrade to Pro' };
    }
  };

  const downgradeToPro = async () => {
    if (!user) {
      return { error: 'No user logged in' };
    }

    if (userTier === 'guest') {
      return { error: 'User is already on guest tier' };
    }

    if (userTier === 'developer') {
      return { error: 'Cannot downgrade developer accounts' };
    }

    try {
      console.log('🔄 Downgrading user to Guest...');
      
      // Simple local downgrade for now
      setUserTier('guest');
      setUser({ ...user, userTier: 'guest', subscriptionStatus: 'inactive' });
      
      console.log('✅ Successfully downgraded to Guest');
      return { success: true, tier: 'guest' };
      
    } catch (error) {
      console.error('❌ Error downgrading:', error);
      return { error: 'Failed to downgrade account' };
    }
  };

  const signOut = async () => {
    try {
      console.log('🚪 Signing out...');
      
      await clerkSignOut();
      
      setUser(null);
      setUserTier('guest');
      setError(null);
      
      console.log('✅ Signed out successfully');
      
    } catch (error) {
      console.error('❌ Sign out error:', error);
      // Force clear state even on error
      setUser(null);
      setUserTier('guest');
      setError(null);
    }
  };

  const isAdmin = () => {
    return userTier === 'developer';
  };

  const isPro = () => {
    return userTier === 'pro' || userTier === 'developer';
  };

  const getTierLimits = () => {
    const limits = {
      guest: {
        maxVideoDuration: 600, // 10 minutes
        maxClipsPerVideo: 3,
        hasWatermark: true,
        hasDetailedAnalytics: false,
        name: 'Guest',
        price: 0
      },
      pro: {
        maxVideoDuration: Infinity,
        maxClipsPerVideo: Infinity,
        hasWatermark: false,
        hasDetailedAnalytics: true,
        name: 'Pro',
        price: 4.99
      },
      developer: {
        maxVideoDuration: Infinity,
        maxClipsPerVideo: Infinity,
        hasWatermark: false,
        hasDetailedAnalytics: true,
        hasAdminAccess: true,
        hasApiAccess: true,
        hasDebugMode: true,
        name: 'Developer',
        price: 0
      }
    };

    return limits[userTier] || limits.guest;
  };

  const value = {
    user,
    userTier,
    loading,
    error,
    signOut,
    upgradeToPro,
    downgradeToPro,
    isAdmin,
    isPro,
    getTierLimits,
    refreshBenefits,
    // Expose Clerk user for direct access if needed
    clerkUser,
  };

  return (
    <ClerkAuthContext.Provider value={value}>
      {children}
    </ClerkAuthContext.Provider>
  );
};

export default ClerkAuthProvider;