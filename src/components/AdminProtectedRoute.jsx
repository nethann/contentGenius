import React from 'react';
import { Navigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { AdminService } from '../services/adminService';

const AdminProtectedRoute = ({ children }) => {
  const { user, isLoaded } = useUser();

  // Show loading while auth is loading
  if (!isLoaded) {
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

  // Check admin access using Clerk user email
  const userEmail = user?.emailAddresses?.[0]?.emailAddress;
  console.log('🔍 AdminProtectedRoute - User email:', userEmail);
  console.log('🔍 AdminProtectedRoute - Admin emails:', AdminService.ADMIN_EMAILS);
  
  const isAdmin = userEmail && AdminService.isAdmin(userEmail);
  console.log('🔍 AdminProtectedRoute - Is admin:', isAdmin);

  if (!isAdmin) {
    console.log('❌ AdminProtectedRoute - Access denied, redirecting to /app');
    return <Navigate to="/app" replace />;
  }
  
  console.log('✅ AdminProtectedRoute - Admin access granted');

  return children;
};

export default AdminProtectedRoute;