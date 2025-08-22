import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useUserTier } from '../contexts/UserTierContext';
import { AdminService } from '../services/adminService';

const AdminProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const { userTier, isLoading: tierLoading } = useUserTier();

  // Show loading while auth or tier is loading
  if (loading || tierLoading) {
    return (
      <div className="admin-loading-screen">
        <div className="loading-spinner"></div>
        <p>Verifying admin access...</p>
      </div>
    );
  }

  // Check if user is logged in
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Check admin access
  const isAdmin = AdminService.isAdmin(user.email);
  const isDeveloper = userTier === 'developer';

  if (!isAdmin && !isDeveloper) {
    return <Navigate to="/app" replace />;
  }

  return children;
};

export default AdminProtectedRoute;