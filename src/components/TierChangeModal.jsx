import React, { useEffect } from 'react';
import { Crown, CheckCircle, X } from 'lucide-react';
import Confetti from './Confetti';

const TierChangeModal = ({ isOpen, onClose, type, message }) => {
  useEffect(() => {
    if (isOpen) {
      // Auto close after 3 seconds
      const timer = setTimeout(() => {
        onClose();
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [isOpen, onClose]);

  useEffect(() => {
    // Close on escape key
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'upgrade':
        return <Crown className="w-12 h-12 text-yellow-400" />;
      case 'downgrade':
        return <CheckCircle className="w-12 h-12 text-blue-400" />;
      default:
        return <CheckCircle className="w-12 h-12 text-green-400" />;
    }
  };

  const getTitle = () => {
    switch (type) {
      case 'upgrade':
        return 'Welcome to Pro! 🚀';
      case 'downgrade':
        return 'Switched to Guest 👋';
      default:
        return 'Success!';
    }
  };

  const getColors = () => {
    switch (type) {
      case 'upgrade':
        return 'from-yellow-500/20 to-orange-500/20 border-yellow-500/30';
      case 'downgrade':
        return 'from-blue-500/20 to-purple-500/20 border-blue-500/30';
      default:
        return 'from-green-500/20 to-emerald-500/20 border-green-500/30';
    }
  };

  return (
    <div className="tier-modal-overlay">
      {/* Confetti for Pro upgrades */}
      <Confetti show={isOpen && type === 'upgrade'} />
      
      <div className="tier-modal-backdrop" onClick={onClose} />
      <div className={`tier-modal-content ${getColors()}`}>
        {/* Close button */}
        <button 
          onClick={onClose}
          className="tier-modal-close"
          aria-label="Close modal"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Icon */}
        <div className="tier-modal-icon">
          {getIcon()}
        </div>

        {/* Title */}
        <h3 className="tier-modal-title">
          {getTitle()}
        </h3>

        {/* Message */}
        <p className="tier-modal-message">
          {message}
        </p>

        {/* Progress bar */}
        <div className="tier-modal-progress">
          <div className="tier-modal-progress-bar" />
        </div>

        {/* Auto close info */}
        <p className="tier-modal-auto-close">
          This will close automatically in 3 seconds
        </p>
      </div>
    </div>
  );
};

export default TierChangeModal;