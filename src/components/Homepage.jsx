import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Mic,
  Download,
  Scissors,
  ArrowRight,
  DollarSign,
  Video,
  MessageSquare,
  TrendingUp,
  Menu,
  X,
  Sparkles,
} from 'lucide-react';

const Homepage = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    // Handle scroll events for navbar transparency
    const handleScroll = () => {
      setScrollY(window.pageYOffset);
    };

    // Add scroll listener for navbar transparency
    window.addEventListener('scroll', handleScroll);

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <>
      {/* Custom Ultra-Transparent Liquid Glass Navbar */}
      <nav className={`liquid-navbar ${scrollY > 50 ? 'scrolled' : ''}`}>
        <div className="liquid-navbar-pill">
          {/* Logo */}
          <div className="navbar-brand">
            <Mic className="brand-icon" />
            <span className="brand-text">ClipGenius</span>
          </div>
          
          {/* Desktop Links */}
          <div className="navbar-links">
            <Link to="/pricing" className="navbar-link">Pricing</Link>
            <Link to="/login" className="navbar-link">Log In</Link>
            <Link to="/pricing" className="navbar-cta">Sign Up</Link>
          </div>
          
          {/* Mobile Menu Toggle */}
          <button 
            className="mobile-toggle"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        
        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="mobile-dropdown">
            <Link 
              to="/pricing" 
              className="mobile-link"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Pricing
            </Link>
            <Link 
              to="/login" 
              className="mobile-link"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Log In
            </Link>
            <Link 
              to="/pricing" 
              className="mobile-cta"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Sign Up
            </Link>
          </div>
        )}
      </nav>

      {/* Content wrapper */}
      <div className="homepage">
          {/* Hero Section */}
      <section className="hero-section">
        <h1 className="hero-title">
          Turn Your Podcast Into
          <span className="hero-title-accent">
            {' '}Viral Clips
          </span>
        </h1>
        <p className="hero-description">
          AI-powered clip generation for podcasters. Extract the most engaging moments from your episodes and create shareable clips with professional subtitles
        </p>
        
        <div className="hero-actions">
          <Link to="/signup" className="hero-cta">
            Get Started Free <ArrowRight className="w-5 h-5" />
          </Link>
          <Link to="/pricing" className="hero-demo">
            <DollarSign className="w-5 h-5" />
            View Pricing
          </Link>
        </div>

        {/* Features Preview */}
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon feature-icon-red">
              <Scissors className="w-6 h-6 text-white" />
            </div>
            <h3 className="feature-title">AI Clip Detection</h3>
            <p className="feature-description">
              Automatically identify the most shareable moments from your podcast episodes with AI-powered analysis
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon feature-icon-yellow">
              <MessageSquare className="w-6 h-6 text-white" />
            </div>
            <h3 className="feature-title">Professional Subtitles</h3>
            <p className="feature-description">
              Generate accurate subtitles with emphasis on key words and phrases to boost engagement
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon feature-icon-blue">
              <Download className="w-6 h-6 text-white" />
            </div>
            <h3 className="feature-title">Platform Ready</h3>
            <p className="feature-description">
              Export clips optimized for Instagram, TikTok, YouTube Shorts, and other social platforms
            </p>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="how-it-works">
        <div className="how-it-works-content">
          <div className="how-it-works-header">
            <h2 className="how-it-works-title">
              How It Works
            </h2>
            <p className="how-it-works-description">
              Transform your podcast episodes into shareable clips in four simple steps
            </p>
          </div>

          <div className="steps-grid">
            <div className="step">
              <div className="step-number">
                1
              </div>
              <div className="step-icon">
                <Video className="w-6 h-6 text-gray-600" />
              </div>
              <h3 className="step-title">Upload Episode</h3>
              <p className="step-description">Upload your podcast video or audio file</p>
            </div>

            <div className="step">
              <div className="step-number">
                2
              </div>
              <div className="step-icon">
                <Sparkles className="w-6 h-6 text-gray-600" />
              </div>
              <h3 className="step-title">AI Analysis</h3>
              <p className="step-description">AI identifies engaging moments and transcribes</p>
            </div>

            <div className="step">
              <div className="step-number">
                3
              </div>
              <div className="step-icon">
                <Scissors className="w-6 h-6 text-gray-600" />
              </div>
              <h3 className="step-title">Generate Clips</h3>
              <p className="step-description">Review and customize your clips with subtitles</p>
            </div>

            <div className="step">
              <div className="step-number">
                4
              </div>
              <div className="step-icon">
                <TrendingUp className="w-6 h-6 text-gray-600" />
              </div>
              <h3 className="step-title">Share & Grow</h3>
              <p className="step-description">Export and share on your social platforms</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="cta-card">
          <h2 className="cta-title">
            Ready to Grow Your Podcast?
          </h2>
          <p className="cta-description">
            Join podcasters who are using ClipGenius to expand their reach and grow their audience
          </p>
          <Link to="/signup" className="cta-button">
            Start Creating Clips <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-logo">
            <Mic className="w-6 h-6" />
            <span className="footer-logo-text">ClipGenius</span>
          </div>
          <p className="footer-copyright">© 2024 ClipGenius. All rights reserved.</p>
        </div>
      </footer>
      </div>
    </>
  );
};

export default Homepage;