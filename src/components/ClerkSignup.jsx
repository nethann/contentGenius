import React from 'react';
import { SignUp } from '@clerk/clerk-react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Zap, Check } from 'lucide-react';

const ClerkSignup = () => {
  const [searchParams] = useSearchParams();
  const tier = searchParams.get('tier') || 'guest';
  
  return (
    <div className="auth-container">
      <div className="auth-wrapper">
        {/* Back Button */}
        <Link to="/" className="auth-back">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to home</span>
        </Link>

        <div className="auth-card">
          {/* Header */}
          <div className="auth-header">
            <div className="auth-logo">
              <Zap className="w-8 h-8 text-yellow-400" />
              <span className="auth-logo-text">Content Scalar</span>
            </div>
            <h1 className="auth-title">Join Content Scalar</h1>
            <p className="auth-subtitle">
              {tier === 'pro' ? 'Sign up with Google to start your Pro trial' : 'Sign up with Google to get started'}
            </p>
            {tier === 'pro' && (
              <div className="tier-selection-badge">
                <Zap className="w-4 h-4" />
                Starting Pro Trial - 7 days free
              </div>
            )}
          </div>

          {/* Google Sign Up */}
          <div className="google-auth-container">
            <div className="clerk-auth-wrapper">
              <SignUp 
                redirectUrl={`/app?tier=${tier}`}
                appearance={{
                  layout: {
                    socialButtonsPlacement: "top",
                    showOptionalFields: false,
                  }
                }}
                afterSignUpUrl={`/app?tier=${tier}`}
                signInUrl="/login"
                routing="hash"
                skipInvitationScreen={true}
              />
            </div>
          </div>

          {/* Features Preview */}
          <div className="auth-features">
            <div className="auth-feature">
              <div className="auth-feature-title">🎬 Video Processing</div>
              <div className="auth-feature-description">AI-powered clip generation</div>
            </div>
            <div className="auth-feature">
              <div className="auth-feature-title">⚡ Fast & Easy</div>
              <div className="auth-feature-description">Upload and process instantly</div>
            </div>
          </div>
        </div>

        {/* Sign In Link */}
        <div className="auth-switch">
          <p className="auth-switch-text">
            Already have an account?{' '}
            <Link to="/clerk-login" className="auth-switch-link">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ClerkSignup;