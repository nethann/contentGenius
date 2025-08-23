import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { UserTierProvider } from './contexts/UserTierContext';
import Homepage from './components/Homepage';
import Login from './components/Login';
import Signup from './components/Signup';
import Pricing from './components/Pricing';
import Dashboard from './components/Dashboard';
import ViralClipGenerator from './components/ViralClipGenerator';
import AdminDashboard from './components/AdminDashboard';
import DatabaseDiagnostic from './components/DatabaseDiagnostic';
import SimpleDBTest from './components/SimpleDBTest';
import ProtectedRoute from './components/ProtectedRoute';
import AdminProtectedRoute from './components/AdminProtectedRoute';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <UserTierProvider>
        <Router>
          <div className="App">
            <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Homepage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/pricing" element={<Pricing />} />
            
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

            {/* Database Diagnostic Route (Protected) */}
            <Route 
              path="/diagnostic" 
              element={
                <ProtectedRoute>
                  <DatabaseDiagnostic />
                </ProtectedRoute>
              } 
            />

            {/* Simple Database Test Route (Protected) */}
            <Route 
              path="/dbtest" 
              element={
                <ProtectedRoute>
                  <SimpleDBTest />
                </ProtectedRoute>
              } 
            />
            
            {/* Redirect old route to new protected route */}
            <Route path="/content-scalar" element={<Navigate to="/app" replace />} />
            <Route path="/clipgenius" element={<Navigate to="/app" replace />} />
            
            {/* Catch all - redirect to home */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </Router>
      </UserTierProvider>
    </AuthProvider>
  );
}

export default App;