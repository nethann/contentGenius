import React from 'react';
import { Link } from 'react-router-dom';
import {
  Zap,
  Play,
  Download,
  Scissors,
  ArrowRight,
  Check,
  Star,
  Video,
  MessageSquare,
  TrendingUp,
} from 'lucide-react';

const Homepage = () => {
  return (
    <div className="min-h-screen bg-gray-900">
      {/* Navbar */}
      <nav className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-3">
              <Zap className="w-8 h-8 text-yellow-400" />
              <span className="text-2xl font-bold text-white">Content Scalar</span>
            </div>
            <div className="flex items-center gap-4">
              <Link
                to="/login"
                className="px-4 py-2 text-white hover:text-yellow-400 transition-colors"
              >
                Log In
              </Link>
              <Link
                to="/signup"
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Sign Up
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6">
            Turn Your Videos Into
            <span className="text-blue-400">
              {' '}Viral Content
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 mb-8 max-w-3xl mx-auto">
            AI-powered video analysis that extracts the most engaging moments from your content 
            and creates viral clips with attention-grabbing subtitles
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link
              to="/signup"
              className="px-8 py-4 bg-blue-600 text-white text-lg font-semibold rounded-xl hover:bg-blue-700 transition-all duration-300 flex items-center justify-center gap-2"
            >
              Get Started Free <ArrowRight className="w-5 h-5" />
            </Link>
            <button className="px-8 py-4 border-2 border-gray-600 text-white text-lg font-semibold rounded-xl hover:border-gray-500 hover:bg-gray-800 transition-all duration-300 flex items-center justify-center gap-2">
              <Play className="w-5 h-5" />
              Watch Demo
            </button>
          </div>

          {/* Features Preview */}
          <div className="grid md:grid-cols-3 gap-8 mb-20">
            <div className="bg-gray-800 rounded-2xl p-8 border border-gray-700">
              <div className="w-12 h-12 bg-red-600 rounded-xl flex items-center justify-center mb-4 mx-auto">
                <Scissors className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Smart Clip Generation</h3>
              <p className="text-gray-300">
                AI analyzes your videos to identify the most engaging and viral-worthy moments automatically
              </p>
            </div>

            <div className="bg-gray-800 rounded-2xl p-8 border border-gray-700">
              <div className="w-12 h-12 bg-yellow-600 rounded-xl flex items-center justify-center mb-4 mx-auto">
                <MessageSquare className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Attention-Grabbing Subtitles</h3>
              <p className="text-gray-300">
                Auto-generated subtitles with red highlighting on power words, numbers, and key phrases
              </p>
            </div>

            <div className="bg-gray-800 rounded-2xl p-8 border border-gray-700">
              <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mb-4 mx-auto">
                <Download className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Ready-to-Share Content</h3>
              <p className="text-gray-300">
                Download high-quality videos with embedded subtitles, optimized for social media platforms
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* How It Works Section */}
      <div className="bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              How It Works
            </h2>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              Transform your long-form content into viral clips in just a few simple steps
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mb-4 mx-auto">
                1
              </div>
              <div className="w-12 h-12 bg-gray-700 rounded-xl flex items-center justify-center mb-4 mx-auto">
                <Video className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Upload Video</h3>
              <p className="text-gray-300">Upload your MP4 video or audio file</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mb-4 mx-auto">
                2
              </div>
              <div className="w-12 h-12 bg-gray-700 rounded-xl flex items-center justify-center mb-4 mx-auto">
                <Zap className="w-6 h-6 text-yellow-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">AI Analysis</h3>
              <p className="text-gray-300">AI identifies viral moments and transcribes speech</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mb-4 mx-auto">
                3
              </div>
              <div className="w-12 h-12 bg-gray-700 rounded-xl flex items-center justify-center mb-4 mx-auto">
                <Scissors className="w-6 h-6 text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Generate Clips</h3>
              <p className="text-gray-300">Create clips with highlighted subtitles</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mb-4 mx-auto">
                4
              </div>
              <div className="w-12 h-12 bg-gray-700 rounded-xl flex items-center justify-center mb-4 mx-auto">
                <TrendingUp className="w-6 h-6 text-green-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Go Viral</h3>
              <p className="text-gray-300">Share your attention-grabbing content</p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="bg-gray-800 rounded-3xl border border-gray-700 p-12 text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Ready to Create Viral Content?
          </h2>
          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            Join thousands of content creators who are already using Content Scalar to boost their engagement
          </p>
          <Link
            to="/signup"
            className="inline-flex items-center gap-3 px-8 py-4 bg-blue-600 text-white text-lg font-semibold rounded-xl hover:bg-blue-700 transition-all duration-300"
          >
            Start Creating Now <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-800 border-t border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Zap className="w-6 h-6 text-yellow-400" />
              <span className="text-lg font-semibold text-white">Content Scalar</span>
            </div>
            <p className="text-gray-400">© 2024 Content Scalar. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Homepage;