import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Zap,
  Play,
  Download,
  Scissors,
  ArrowRight,
  Check,
  Star,
  DollarSign,
  Video,
  MessageSquare,
  TrendingUp,
  Menu,
  X,
} from 'lucide-react';

const Homepage = () => {
  const scrollRef = useRef(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    let animationId;
    let currentScroll = 0;
    let targetScroll = 0;
    const ease = 0.08; // Lower = smoother/slower

    const smoothScroll = () => {
      targetScroll = window.pageYOffset;
      currentScroll += (targetScroll - currentScroll) * ease;
      
      if (scrollRef.current) {
        scrollRef.current.style.transform = `translateY(${-currentScroll}px)`;
      }
      
      animationId = requestAnimationFrame(smoothScroll);
    };

    // Start the smooth scroll animation
    smoothScroll();

    // Update body height to match content
    const updateBodyHeight = () => {
      if (scrollRef.current) {
        document.body.style.height = scrollRef.current.offsetHeight + 'px';
      }
    };

    updateBodyHeight();
    window.addEventListener('resize', updateBodyHeight);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', updateBodyHeight);
      document.body.style.height = '';
    };
  }, []);

  return (
    <div ref={scrollRef} className="smooth-scroll-content">
      <div className="homepage">
      {/* Navbar */}
      <nav className="homepage-nav">
        <div className="nav-container">
          <div className="nav-content">
            <div className="nav-logo">
              <Zap className="w-8 h-8 text-yellow-400" />
              <span className="nav-logo-text">ClipGenius</span>
            </div>
            
            {/* Desktop Navigation */}
            <div className="nav-actions desktop-nav">
              <Link to="/pricing" className="nav-login">
                Pricing
              </Link>
              <Link to="/login" className="nav-login">
                Log In
              </Link>
              <Link to="/pricing" className="nav-signup">
                Sign Up
              </Link>
            </div>
            
            {/* Mobile Hamburger Button */}
            <button 
              className="mobile-menu-button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle mobile menu"
            >
              {isMobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
          
          {/* Mobile Menu Dropdown */}
          {isMobileMenuOpen && (
            <div className="mobile-menu">
              <div className="mobile-menu-content">
                <Link 
                  to="/pricing" 
                  className="mobile-nav-link"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Pricing
                </Link>
                <Link 
                  to="/login" 
                  className="mobile-nav-link"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Log In
                </Link>
                <Link 
                  to="/pricing" 
                  className="mobile-nav-cta"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Sign Up
                </Link>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero-section">
        <h1 className="hero-title">
          Turn Your Videos Into
          <span className="hero-title-accent">
            {' '}Viral Content
          </span>
        </h1>
        <p className="hero-description">
          AI-powered video analysis that extracts the most engaging moments from your content 
          and creates viral clips with attention-grabbing subtitles
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
            <h3 className="feature-title">Smart Clip Generation</h3>
            <p className="feature-description">
              AI analyzes your videos to identify the most engaging and viral-worthy moments automatically
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon feature-icon-yellow">
              <MessageSquare className="w-6 h-6 text-white" />
            </div>
            <h3 className="feature-title">Attention-Grabbing Subtitles</h3>
            <p className="feature-description">
              Auto-generated subtitles with red highlighting on power words, numbers, and key phrases
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon feature-icon-blue">
              <Download className="w-6 h-6 text-white" />
            </div>
            <h3 className="feature-title">Ready-to-Share Content</h3>
            <p className="feature-description">
              Download high-quality videos with embedded subtitles, optimized for social media platforms
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
              Transform your long-form content into viral clips in just a few simple steps
            </p>
          </div>

          <div className="steps-grid">
            <div className="step">
              <div className="step-number">
                1
              </div>
              <div className="step-icon">
                <Video className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="step-title">Upload Video</h3>
              <p className="step-description">Upload your MP4 video or audio file</p>
            </div>

            <div className="step">
              <div className="step-number">
                2
              </div>
              <div className="step-icon">
                <Zap className="w-6 h-6 text-yellow-400" />
              </div>
              <h3 className="step-title">AI Analysis</h3>
              <p className="step-description">AI identifies viral moments and transcribes speech</p>
            </div>

            <div className="step">
              <div className="step-number">
                3
              </div>
              <div className="step-icon">
                <Scissors className="w-6 h-6 text-red-400" />
              </div>
              <h3 className="step-title">Generate Clips</h3>
              <p className="step-description">Create clips with highlighted subtitles</p>
            </div>

            <div className="step">
              <div className="step-number">
                4
              </div>
              <div className="step-icon">
                <TrendingUp className="w-6 h-6 text-green-400" />
              </div>
              <h3 className="step-title">Go Viral</h3>
              <p className="step-description">Share your attention-grabbing content</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="cta-card">
          <h2 className="cta-title">
            Ready to Create Viral Content?
          </h2>
          <p className="cta-description">
            Join thousands of content creators who are already using ClipGenius to boost their engagement
          </p>
          <Link to="/signup" className="cta-button">
            Start Creating Now <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-logo">
            <Zap className="w-6 h-6 text-yellow-400" />
            <span className="footer-logo-text">ClipGenius</span>
          </div>
          <p className="footer-copyright">© 2024 ClipGenius. All rights reserved.</p>
        </div>
      </footer>
      </div>
    </div>
  );
};

export default Homepage;