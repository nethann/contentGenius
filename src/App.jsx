import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ClerkAuthProvider } from './contexts/ClerkAuthContext';
import Homepage from './components/Homepage';
import Pricing from './components/Pricing';
import Dashboard from './components/Dashboard';
import ViralClipGenerator from './components/ViralClipGenerator';
import AdminDashboard from './components/AdminDashboard';
import SimpleDashboard from './components/SimpleDashboard';
import ClerkDashboard from './components/ClerkDashboard';
import SimpleClerkDashboard from './components/SimpleClerkDashboard';
import ClerkLogin from './components/ClerkLogin';
import ClerkSignup from './components/ClerkSignup';
import { SignIn, SignUp } from '@clerk/clerk-react';
import ProtectedRoute from './components/ProtectedRoute';
import AdminProtectedRoute from './components/AdminProtectedRoute';
import './App.css';

// Scroll to top component
function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

function App() {
  return (
    <ClerkAuthProvider>
      <Router>
        <ScrollToTop />
            <div className="App">
            <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Homepage />} />
            <Route path="/login" element={<ClerkLogin />} />
            <Route path="/signup" element={<ClerkSignup />} />
            <Route path="/pricing" element={<Pricing />} />
            
            {/* Clerk Auth Routes */}
            <Route path="/sign-in" element={<SignIn redirectUrl="/app" />} />
            <Route path="/sign-up" element={<SignUp redirectUrl="/app" />} />
            <Route path="/clerk-login" element={<ClerkLogin />} />
            <Route path="/clerk-signup" element={<ClerkSignup />} />
            
            {/* Protected Routes */}
            <Route 
              path="/app" 
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/app/viral-clips" 
              element={
                <ProtectedRoute>
                  <ViralClipGenerator />
                </ProtectedRoute>
              } 
            />
            
            {/* Admin Routes */}
            <Route 
              path="/admin" 
              element={
                <AdminProtectedRoute>
                  <AdminDashboard />
                </AdminProtectedRoute>
              } 
            />
            
            {/* Temporary unprotected admin route for testing */}
            <Route 
              path="/admin-test" 
              element={<AdminDashboard />}
            />

            
            {/* Simple Dashboard (No Database Required) */}
            <Route path="/simple-dashboard" element={<SimpleDashboard />} />
            
            {/* Clerk Dashboard (New Auth System) */}
            <Route path="/clerk-dashboard" element={<ClerkDashboard />} />
            
            {/* Simple Clerk Dashboard (No Database) */}
            <Route path="/simple-clerk" element={<SimpleClerkDashboard />} />
            
            {/* Redirect old route to new protected route */}
            <Route path="/content-scalar" element={<Navigate to="/app" replace />} />
            <Route path="/clipgenius" element={<Navigate to="/app" replace />} />
            
            {/* Catch all - redirect to home */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </Router>
    </ClerkAuthProvider>
  );
}

export default App;