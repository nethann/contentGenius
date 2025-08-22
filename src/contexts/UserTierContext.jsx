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
  const { user } = useAuth();
  const [userTier, setUserTier] = useState(USER_TIERS.GUEST);
  const [isLoading, setIsLoading] = useState(true);
  const [tierInitialized, setTierInitialized] = useState(false);

  useEffect(() => {
    // For now, all users are Guest tier
    // In a real app, you'd fetch this from your database/subscription service
    const fetchUserTier = async () => {
      try {
        if (user && !tierInitialized) {
          // Check user metadata or make API call to get subscription status
          const tier = user.user_metadata?.tier || USER_TIERS.GUEST;
          setUserTier(tier);
          setTierInitialized(true);
        } else if (!user) {
          setUserTier(USER_TIERS.GUEST);
          setTierInitialized(false);
        }
      } catch (error) {
        console.error('Error fetching user tier:', error);
        setUserTier(USER_TIERS.GUEST);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserTier();
  }, [user, tierInitialized]);

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
    // In a real app, this would integrate with Stripe/payment processor
    console.log('Upgrade to Pro - integrate with payment system');
    // For demo purposes, you could temporarily set tier to PRO
    // setUserTier(USER_TIERS.PRO);
  };

  // Custom setUserTier that also marks tier as initialized
  const updateUserTier = (newTier) => {
    console.log(`Updating user tier to: ${newTier}`);
    setUserTier(newTier);
    setTierInitialized(true);
  };

  const value = {
    userTier,
    setUserTier: updateUserTier,
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