import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Zap, LogOut, User } from 'lucide-react';
import ContentScalar from './ContentScalar';

const Dashboard = () => {
  const { user, signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Top Navigation Bar */}
      <nav className="bg-gray-800 border-b border-gray-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <Zap className="w-8 h-8 text-yellow-400" />
              <span className="text-2xl font-bold text-white">Content Scalar</span>
            </div>

            {/* User Menu */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-white">
                <User className="w-5 h-5 text-gray-400" />
                <span className="text-sm">{user?.email}</span>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content - ContentScalar Component */}
      <div className="relative">
        <ContentScalar />
      </div>
    </div>
  );
};

export default Dashboard;