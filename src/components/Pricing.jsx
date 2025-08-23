import React from 'react';
import { Link } from 'react-router-dom';
import {
  Zap,
  Check,
  X,
  Clock,
  Download,
  BarChart3,
  Shield,
  ArrowLeft,
  Crown,
  Sparkles
} from 'lucide-react';

const Pricing = () => {
  const features = {
    guest: [
      { text: "10-minute video limit", included: true, icon: Clock },
      { text: "Maximum 3 clips per video", included: true, icon: Download },
      { text: "Basic viral score", included: true, icon: BarChart3 },
      { text: "Watermark on clips", included: false, icon: X, note: '"Made with ClipGenius"' },
      { text: "Detailed analytics", included: false, icon: X },
      { text: "Unlimited processing", included: false, icon: X },
    ],
    pro: [
      { text: "Unlimited video length", included: true, icon: Clock },
      { text: "Unlimited clips per video", included: true, icon: Download },
      { text: "Detailed viral analytics", included: true, icon: BarChart3 },
      { text: "No watermarks", included: true, icon: Shield },
      { text: "Extract every viral moment", included: true, icon: Sparkles },
      { text: "Priority processing", included: true, icon: Zap },
    ]
  };

  return (
    <div className="pricing-container">
      {/* Background Effects */}
      <div className="pricing-bg-effects">
        <div className="pricing-gradient-1"></div>
        <div className="pricing-gradient-2"></div>
        <div className="pricing-gradient-3"></div>
      </div>

      {/* Header */}
      <div className="pricing-header">
        <Link to="/" className="pricing-back-btn">
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>
        
        <div className="pricing-hero">
          <div className="pricing-hero-badge">
            <Crown className="w-4 h-4" />
            <span>Choose Your Plan</span>
          </div>
          <h1 className="pricing-hero-title">
            Simple, Transparent Pricing
          </h1>
          <p className="pricing-hero-subtitle">
            Start free, upgrade when you need more power. No hidden fees, cancel anytime.
          </p>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="pricing-grid">
        {/* Guest Tier */}
        <div className="pricing-card pricing-card-guest">
          <div className="pricing-card-header">
            <div className="pricing-card-icon">
              <Zap className="w-6 h-6" />
            </div>
            <div className="pricing-card-title-section">
              <h3 className="pricing-card-title">Guest</h3>
              <p className="pricing-card-subtitle">Perfect for trying out ClipGenius</p>
            </div>
          </div>

          <div className="pricing-card-price">
            <span className="pricing-price-currency">$</span>
            <span className="pricing-price-amount">0</span>
            <span className="pricing-price-period">/month</span>
          </div>

          <div className="pricing-card-features">
            {features.guest.map((feature, index) => (
              <div key={index} className="pricing-feature">
                <div className="pricing-feature-icon">
                  {feature.included ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <X className="w-4 h-4 text-red-400" />
                  )}
                </div>
                <div className="pricing-feature-content">
                  <span className={`pricing-feature-text ${!feature.included ? 'pricing-feature-disabled' : ''}`}>
                    {feature.text}
                  </span>
                  {feature.note && (
                    <span className="pricing-feature-note">{feature.note}</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <Link to="/clerk-signup?tier=guest" className="pricing-card-cta pricing-cta-guest">
            Get Started Free
          </Link>
        </div>

        {/* Pro Tier */}
        <div className="pricing-card pricing-card-pro">
          <div className="pricing-card-badge">
            <Crown className="w-4 h-4" />
            Most Popular
          </div>
          
          <div className="pricing-card-header">
            <div className="pricing-card-icon">
              <Crown className="w-6 h-6" />
            </div>
            <div className="pricing-card-title-section">
              <h3 className="pricing-card-title">Pro</h3>
              <p className="pricing-card-subtitle">For serious content creators</p>
            </div>
          </div>

          <div className="pricing-card-price">
            <span className="pricing-price-currency">$</span>
            <span className="pricing-price-amount">4.99</span>
            <span className="pricing-price-period">/month</span>
          </div>

          <div className="pricing-card-features">
            {features.pro.map((feature, index) => (
              <div key={index} className="pricing-feature">
                <div className="pricing-feature-icon">
                  <Check className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="pricing-feature-content">
                  <span className="pricing-feature-text">{feature.text}</span>
                </div>
              </div>
            ))}
          </div>

          <Link to="/clerk-signup?tier=pro" className="pricing-card-cta pricing-cta-pro">
            Start Pro Trial
            <Sparkles className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="pricing-faq">
        <div className="pricing-faq-content">
          <h2 className="pricing-faq-title">Frequently Asked Questions</h2>
          <div className="pricing-faq-grid">
            <div className="pricing-faq-item">
              <h3 className="pricing-faq-question">Can I change plans anytime?</h3>
              <p className="pricing-faq-answer">
                Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately.
              </p>
            </div>
            <div className="pricing-faq-item">
              <h3 className="pricing-faq-question">What happens to my videos if I downgrade?</h3>
              <p className="pricing-faq-answer">
                Your existing clips remain accessible, but new uploads will follow Guest tier limits.
              </p>
            </div>
            <div className="pricing-faq-item">
              <h3 className="pricing-faq-question">Is there a free trial for Pro?</h3>
              <p className="pricing-faq-answer">
                Yes! New users get a 7-day free trial of Pro features. No credit card required.
              </p>
            </div>
            <div className="pricing-faq-item">
              <h3 className="pricing-faq-question">How does the viral scoring work?</h3>
              <p className="pricing-faq-answer">
                Our AI analyzes engagement patterns, hooks, pacing, and content structure to predict viral potential.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="pricing-bottom-cta">
        <div className="pricing-bottom-content">
          <h2 className="pricing-bottom-title">Ready to create viral content?</h2>
          <p className="pricing-bottom-subtitle">
            Join thousands of creators using ClipGenius to grow their audience
          </p>
          <div className="pricing-bottom-actions">
            <Link to="/clerk-signup?tier=guest" className="pricing-bottom-btn-primary">
              Start Creating Now
            </Link>
            <Link to="/" className="pricing-bottom-btn-secondary">
              Learn More
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Pricing;