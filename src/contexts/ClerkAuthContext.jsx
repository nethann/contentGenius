import React, { createContext, useContext, useEffect, useState } from 'react';
import { useUser, useAuth as useClerkAuth } from '@clerk/clerk-react';

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

  useEffect(() => {
    const initializeUser = async () => {
      if (!userLoaded || !authLoaded) {
        return; // Still loading
      }

      if (!clerkUser) {
        // No user signed in
        setUser(null);
        setUserTier('guest');
        setLoading(false);
        return;
      }

      try {
        console.log('🔄 Initializing user from Clerk:', clerkUser.emailAddresses[0]?.emailAddress);
        
        // Determine tier based on email
        const adminEmails = ['nethan.nagendran@gmail.com', 'nethmarket@gmail.com'];
        const userTierFromEmail = adminEmails.includes(clerkUser.emailAddresses[0]?.emailAddress?.toLowerCase()) 
          ? 'developer' 
          : 'guest';
        
        setUser({
          id: clerkUser.id,
          email: clerkUser.emailAddresses[0]?.emailAddress || '',
          firstName: clerkUser.firstName || '',
          lastName: clerkUser.lastName || '',
          fullName: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim(),
          imageUrl: clerkUser.imageUrl || '',
          userTier: userTierFromEmail,
          subscriptionStatus: userTierFromEmail === 'guest' ? 'inactive' : 'active'
        });
        
        setUserTier(userTierFromEmail);
        
        console.log('✅ User initialized:', userTierFromEmail);
        
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

    initializeUser();
  }, [clerkUser, userLoaded, authLoaded]);

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