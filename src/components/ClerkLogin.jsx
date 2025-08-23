import React from 'react';
import { SignIn } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Zap } from 'lucide-react';

const ClerkLogin = () => {
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
            <h1 className="auth-title">Welcome Back</h1>
            <p className="auth-subtitle">Sign in with Google to continue</p>
          </div>

          {/* Google Sign In */}
          <div className="google-auth-container">
            <div className="clerk-auth-wrapper">
              <SignIn 
                redirectUrl="/app"
                appearance={{
                  layout: {
                    socialButtonsPlacement: "top",
                    showOptionalFields: false,
                  }
                }}
                afterSignInUrl="/app"
                signUpUrl="/signup"
                routing="hash"
              />
            </div>
          </div>

          {/* Quick Access */}
          <div className="auth-demo">
            <p className="auth-demo-text">
              One-click sign in with Google OAuth
            </p>
          </div>
        </div>

        {/* Sign Up Link */}
        <div className="auth-switch">
          <p className="auth-switch-text">
            Don't have an account?{' '}
            <Link to="/clerk-signup" className="auth-switch-link">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ClerkLogin;