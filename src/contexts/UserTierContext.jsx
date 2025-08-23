import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

const UserTierContext = createContext();

export const useUserTier = () => {
  const context = useContext(UserTierContext);
  if (!context) {
    throw new Error('useUserTier must be used within a UserTierProvider');
  }
  return context;
};

export const USER_TIERS = {
  GUEST: 'guest',
  PRO: 'pro',
  DEVELOPER: 'developer'
};

export const TIER_LIMITS = {
  [USER_TIERS.GUEST]: {
    maxVideoDuration: 600, // 10 minutes in seconds
    maxClipsPerVideo: 3,
    hasWatermark: false,
    hasDetailedAnalytics: false,
    name: 'Guest',
    price: 0
  },
  [USER_TIERS.PRO]: {
    maxVideoDuration: Infinity,
    maxClipsPerVideo: Infinity,
    hasWatermark: false,
    hasDetailedAnalytics: true,
    name: 'Pro',
    price: 4.99
  },
  [USER_TIERS.DEVELOPER]: {
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

export const UserTierProvider = ({ children }) => {
  const { user, userProfile, loading: authLoading, updateUserTier: authUpdateUserTier } = useAuth();
  const [userTier, setUserTier] = useState(USER_TIERS.GUEST);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const updateTierFromProfile = () => {
      try {
        if (authLoading) {
          // Auth is still loading, wait
          setIsLoading(true);
          return;
        }

        if (!user) {
          // No user, set to guest
          if (userTier !== USER_TIERS.GUEST) {
            setUserTier(USER_TIERS.GUEST);
            console.log('✅ Set tier to guest (no user)');
          }
          setIsLoading(false);
          return;
        }

        if (userProfile) {
          // User profile loaded, use tier from database
          const dbTier = userProfile.user_tier || USER_TIERS.GUEST;
          if (userTier !== dbTier) {
            setUserTier(dbTier);
            console.log('✅ Tier set from database:', dbTier);
          }
        } else {
          // User exists but profile not loaded yet, default to guest
          if (userTier !== USER_TIERS.GUEST) {
            setUserTier(USER_TIERS.GUEST);
            console.log('✅ Set tier to guest (no profile yet)');
          }
        }
        
        setIsLoading(false);
      } catch (error) {
        console.error('Error updating tier from profile:', error);
        setUserTier(USER_TIERS.GUEST);
        setIsLoading(false);
      }
    };

    updateTierFromProfile();
  }, [user, userProfile, authLoading]); // userTier removed to prevent infinite loop

  const getTierLimits = () => {
    return TIER_LIMITS[userTier];
  };

  const canUploadVideo = (durationInSeconds) => {
    const limits = getTierLimits();
    return durationInSeconds <= limits.maxVideoDuration;
  };

  const canGenerateClip = (currentClipCount) => {
    const limits = getTierLimits();
    return currentClipCount < limits.maxClipsPerVideo;
  };

  const upgradeToPro = async () => {
    if (!user) {
      console.error('No user logged in');
      return { error: { message: 'No user logged in' } };
    }

    if (userTier === USER_TIERS.PRO) {
      console.log('User is already Pro');
      return { error: { message: 'User is already Pro' } };
    }

    try {
      console.log('🚀 Upgrading user to Pro...');
      console.log('Current user:', user.email);
      console.log('Current tier:', userTier);
      
      const result = await authUpdateUserTier(USER_TIERS.PRO);
      
      if (result?.error) {
        console.error('Failed to upgrade to Pro:', result.error);
        return { error: result.error };
      }
      
      // Update local state immediately for better UX
      setUserTier(USER_TIERS.PRO);
      
      console.log('✅ Successfully upgraded to Pro!');
      return { success: true, tier: USER_TIERS.PRO };
    } catch (error) {
      console.error('Error upgrading to Pro:', error);
      return { error: { message: error.message || 'Unknown error occurred during upgrade' } };
    }
  };

  // Update user tier in both local state and database
  const updateUserTierLocal = async (newTier) => {
    if (!user) {
      console.error('No user logged in');
      return { error: { message: 'No user logged in' } };
    }

    if (userTier === newTier) {
      console.log(`User tier is already ${newTier}`);
      return { success: true, tier: newTier };
    }

    try {
      console.log(`🔄 Updating user tier to: ${newTier}`);
      console.log('Current user:', user.email);
      console.log('Current tier:', userTier);
      
      const result = await authUpdateUserTier(newTier);
      
      if (result?.error) {
        console.error('Failed to update tier:', result.error);
        return { error: result.error };
      }
      
      // Update local state immediately for better UX
      setUserTier(newTier);
      
      console.log('✅ User tier updated successfully');
      return { success: true, tier: newTier };
    } catch (error) {
      console.error('Error updating user tier:', error);
      return { error: { message: error.message || 'Unknown error occurred during tier update' } };
    }
  };

  const value = {
    userTier,
    setUserTier: updateUserTierLocal,
    isLoading,
    getTierLimits,
    canUploadVideo,
    canGenerateClip,
    upgradeToPro,
    USER_TIERS,
    TIER_LIMITS
  };

  return (
    <UserTierContext.Provider value={value}>
      {children}
    </UserTierContext.Provider>
  );
};

export default UserTierProvider;