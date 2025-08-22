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
  PRO: 'pro'
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
          setUserTier(USER_TIERS.GUEST);
          setIsLoading(false);
          return;
        }

        if (userProfile) {
          // User profile loaded, use tier from database
          const dbTier = userProfile.user_tier || USER_TIERS.GUEST;
          setUserTier(dbTier);
          console.log('✅ Tier set from database:', dbTier);
        } else {
          // User exists but profile not loaded yet, default to guest
          setUserTier(USER_TIERS.GUEST);
        }
        
        setIsLoading(false);
      } catch (error) {
        console.error('Error updating tier from profile:', error);
        setUserTier(USER_TIERS.GUEST);
        setIsLoading(false);
      }
    };

    updateTierFromProfile();
  }, [user, userProfile, authLoading]);

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
      return { error: 'No user logged in' };
    }

    try {
      console.log('🚀 Upgrading user to Pro...');
      const result = await authUpdateUserTier(USER_TIERS.PRO);
      
      if (result.error) {
        console.error('Failed to upgrade to Pro:', result.error);
        return result;
      }
      
      console.log('✅ Successfully upgraded to Pro!');
      return result;
    } catch (error) {
      console.error('Error upgrading to Pro:', error);
      return { error };
    }
  };

  // Update user tier in both local state and database
  const updateUserTierLocal = async (newTier) => {
    if (!user) {
      console.error('No user logged in');
      return { error: 'No user logged in' };
    }

    try {
      console.log(`🔄 Updating user tier to: ${newTier}`);
      const result = await authUpdateUserTier(newTier);
      
      if (result.error) {
        console.error('Failed to update tier:', result.error);
        return result;
      }
      
      // Local state will be updated automatically via useEffect when userProfile changes
      console.log('✅ User tier updated successfully');
      return result;
    } catch (error) {
      console.error('Error updating user tier:', error);
      return { error };
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