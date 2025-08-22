import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useUserTier } from '../contexts/UserTierContext';

/**
 * Development component for testing tier management
 * Remove this in production
 */
const TierManager = () => {
  const { user, userProfile } = useAuth();
  const { userTier, setUserTier, upgradeToPro, USER_TIERS } = useUserTier();

  if (!user) return null;

  const handleUpgradeToPro = async () => {
    const result = await upgradeToPro();
    if (result?.error) {
      alert('Failed to upgrade: ' + result.error.message);
    } else {
      alert('Successfully upgraded to Pro!');
    }
  };

  const handleDowngradeToGuest = async () => {
    const result = await setUserTier(USER_TIERS.GUEST);
    if (result?.error) {
      alert('Failed to downgrade: ' + result.error.message);
    } else {
      alert('Downgraded to Guest tier');
    }
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      background: 'rgba(0,0,0,0.8)',
      color: 'white',
      padding: '15px',
      borderRadius: '10px',
      zIndex: 1000,
      fontSize: '12px'
    }}>
      <div><strong>🔧 Dev Tier Manager</strong></div>
      <div>User: {user.email}</div>
      <div>Current Tier: <strong>{userTier}</strong></div>
      <div>DB Tier: <strong>{userProfile?.user_tier || 'Loading...'}</strong></div>
      <div style={{ marginTop: '10px', display: 'flex', gap: '10px' }}>
        <button 
          onClick={handleUpgradeToPro}
          style={{
            padding: '5px 10px',
            background: '#059669',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          Upgrade to Pro
        </button>
        <button 
          onClick={handleDowngradeToGuest}
          style={{
            padding: '5px 10px',
            background: '#dc2626',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          Downgrade to Guest
        </button>
      </div>
    </div>
  );
};

export default TierManager;