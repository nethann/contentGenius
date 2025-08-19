import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Zap, ArrowLeft, AlertCircle, Check } from 'lucide-react';

const Signup = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState('');
  const [success, setSuccess] = useState(false);
  
  const { signInWithGoogle } = useAuth();

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setLocalError('');

    const { error } = await signInWithGoogle();
    
    if (error) {
      setLocalError(error.message);
      setIsLoading(false);
    }
    // If successful, user will be redirected by Google OAuth flow
  };

  if (success) {
    return (
      <div className="auth-success">
        <div className="auth-success-card">
          <div className="auth-success-icon">
            <Check className="w-8 h-8 text-green-400" />
          </div>
          <h1 className="auth-success-title">Welcome to Content Scalar!</h1>
          <p className="auth-success-message">
            Your account has been created successfully. You can now start creating viral content.
          </p>
          <div className="auth-success-status">
            Redirecting to your dashboard...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-wrapper">
        {/* Back to Home */}
        <Link to="/" className="auth-back">
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        {/* Signup Card */}
        <div className="auth-card">
          {/* Header */}
          <div className="auth-header">
            <div className="auth-logo">
              <Zap className="w-8 h-8 text-yellow-400" />
              <span className="auth-logo-text">Content Scalar</span>
            </div>
            <h1 className="auth-title">Get Started Free</h1>
            <p className="auth-subtitle">Create your account and start making viral content</p>
          </div>

          {/* Error Message */}
          {localError && (
            <div className="auth-error">
              <AlertCircle className="auth-error-icon" />
              <div>
                <p className="auth-error-title">Sign up failed</p>
                <p className="auth-error-message">{localError}</p>
              </div>
            </div>
          )}

          {/* Google Sign In */}
          <div className="google-auth-container">
            <button
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="google-signin-btn"
            >
              {isLoading ? (
                <>
                  <div className="google-signin-spinner"></div>
                  <span>Creating account...</span>
                </>
              ) : (
                <>
                  <svg className="google-icon" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  <span>Continue with Google</span>
                </>
              )}
            </button>

            <p className="google-auth-description">
              Create your account instantly with Google. No passwords, no verification emails - 
              just one click to get started.
            </p>

            {/* Benefits */}
            <div className="google-auth-benefits">
              <div className="benefit-item">
                <Check className="w-4 h-4 text-green-400" />
                <span>Instant account creation</span>
              </div>
              <div className="benefit-item">
                <Check className="w-4 h-4 text-green-400" />
                <span>No password required</span>
              </div>
              <div className="benefit-item">
                <Check className="w-4 h-4 text-green-400" />
                <span>Secure Google authentication</span>
              </div>
            </div>
          </div>

          {/* Terms Agreement */}
          <div className="auth-terms-simple">
            <p className="text-sm text-gray-400 text-center">
              By continuing, you agree to our{' '}
              <Link to="/terms" className="auth-terms-link">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link to="/privacy" className="auth-terms-link">
                Privacy Policy
              </Link>
            </p>
          </div>

          {/* Sign In Link */}
          <div className="auth-switch">
            <p className="auth-switch-text">
              Already have an account?{' '}
              <Link to="/login" className="auth-switch-link">
                Sign in
              </Link>
            </p>
          </div>
        </div>

        {/* Features Preview */}
        <div className="signup-features">
          <h3 className="text-white font-semibold mb-4 text-center">What you'll get:</h3>
          <div className="auth-features">
            <div className="auth-feature">
              <p className="auth-feature-title">🎬 Smart Clips</p>
              <p className="auth-feature-description">AI finds viral moments</p>
            </div>
            <div className="auth-feature">
              <p className="auth-feature-title">🔥 Red Highlights</p>
              <p className="auth-feature-description">Attention-grabbing text</p>
            </div>
            <div className="auth-feature">
              <p className="auth-feature-title">📱 Social Ready</p>
              <p className="auth-feature-description">Perfect for all platforms</p>
            </div>
            <div className="auth-feature">
              <p className="auth-feature-title">⚡ Instant Download</p>
              <p className="auth-feature-description">Ready-to-share videos</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup;