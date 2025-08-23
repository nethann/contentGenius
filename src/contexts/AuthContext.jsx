import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { UserProfileService } from '../services/userProfileService'
import { DBSetupService } from '../services/dbSetupService'

const AuthContext = createContext({})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  // Initialize state from localStorage
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('auth_user')
      return savedUser ? JSON.parse(savedUser) : null
    } catch {
      return null
    }
  })
  
  const [userProfile, setUserProfile] = useState(() => {
    try {
      const savedProfile = localStorage.getItem('user_profile')
      return savedProfile ? JSON.parse(savedProfile) : null
    } catch {
      return null
    }
  })
  
  const [loading, setLoading] = useState(() => {
    // If we have user data in localStorage, start with loading false
    try {
      const savedUser = localStorage.getItem('auth_user')
      return !savedUser
    } catch {
      return true
    }
  })
  const [error, setError] = useState(null)

  useEffect(() => {
    // Get initial session and user profile
    const getSession = async () => {
      try {
        // If we already have user from localStorage, validate the session in background
        const hasStoredUser = localStorage.getItem('auth_user')
        
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) throw error
        
        const currentUser = session?.user ?? null
        
        // If session doesn't match localStorage, update everything
        if (!currentUser && hasStoredUser) {
          // Session expired, clear localStorage
          localStorage.removeItem('auth_user')
          localStorage.removeItem('user_profile')
          setUser(null)
          setUserProfile(null)
        } else if (currentUser) {
          // Valid session, update user and profile
          setUser(currentUser)
          localStorage.setItem('auth_user', JSON.stringify(currentUser))
          
          // Only load profile if we don't have it in localStorage or user changed
          if (!userProfile || userProfile.id !== currentUser.id) {
            await loadUserProfile(currentUser)
          }
        }
      } catch (error) {
        console.error('Error getting session:', error)
        setError(error.message)
        // Clear localStorage on error
        localStorage.removeItem('auth_user')
        localStorage.removeItem('user_profile')
        setUser(null)
        setUserProfile(null)
      } finally {
        setLoading(false)
      }
    }

    getSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const currentUser = session?.user ?? null
        setUser(currentUser)
        setError(null)
        
        // Update localStorage
        if (currentUser) {
          localStorage.setItem('auth_user', JSON.stringify(currentUser))
          // Load user profile when user signs in
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            await loadUserProfile(currentUser)
          }
        } else {
          localStorage.removeItem('auth_user')
          localStorage.removeItem('user_profile')
          setUserProfile(null)
        }
        
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  // Load user profile from Supabase with automatic setup
  const loadUserProfile = async (user) => {
    try {
      console.log('🔄 Loading user profile for:', user.email);
      
      // First ensure database is set up
      const setupResult = await DBSetupService.ensureDatabaseSetup();
      if (!setupResult.success) {
        console.warn('⚠️ Database setup issues, using fallback profile');
        const fallbackProfile = DBSetupService.getLocalFallbackProfile(user);
        setUserProfile(fallbackProfile);
        localStorage.setItem('user_profile', JSON.stringify(fallbackProfile));
        return;
      }

      // Try to get/create user profile
      const { profile, error } = await UserProfileService.ensureUserProfile(user);
      
      if (error) {
        console.error('❌ Error loading user profile:', error);
        
        // Check if it's a database setup issue
        if (error.needsSetup || error.message?.includes('does not exist')) {
          console.log('🔄 Database needs setup, attempting automatic fix...');
          await DBSetupService.ensureDatabaseSetup();
          
          // Retry once after setup
          const retryResult = await UserProfileService.ensureUserProfile(user);
          if (retryResult.profile) {
            setUserProfile(retryResult.profile);
            localStorage.setItem('user_profile', JSON.stringify(retryResult.profile));
            console.log('✅ User profile loaded after setup:', retryResult.profile);
            return;
          }
        }
        
        // Use fallback profile if still failing
        const fallbackProfile = DBSetupService.getLocalFallbackProfile(user);
        setUserProfile(fallbackProfile);
        localStorage.setItem('user_profile', JSON.stringify(fallbackProfile));
        console.log('⚠️ Using fallback profile:', fallbackProfile);
      } else {
        setUserProfile(profile);
        localStorage.setItem('user_profile', JSON.stringify(profile));
        console.log('✅ User profile loaded:', profile);
      }
    } catch (error) {
      console.error('❌ Error in loadUserProfile:', error);
      
      // Always provide a fallback profile
      const fallbackProfile = DBSetupService.getLocalFallbackProfile(user);
      setUserProfile(fallbackProfile);
      localStorage.setItem('user_profile', JSON.stringify(fallbackProfile));
      console.log('⚠️ Exception fallback profile:', fallbackProfile);
    }
  }

  // Refresh user profile from database
  const refreshUserProfile = async () => {
    if (!user) return
    await loadUserProfile(user)
  }

  // Update user tier
  const updateUserTier = async (newTier) => {
    if (!user) return { error: 'No user logged in' }
    
    try {
      const { profile, error } = await UserProfileService.updateUserTier(user.id, newTier)
      if (error) throw error
      
      setUserProfile(profile)
      localStorage.setItem('user_profile', JSON.stringify(profile))
      return { profile, error: null }
    } catch (error) {
      console.error('Error updating user tier:', error)
      return { profile: null, error }
    }
  }

  const signInWithGoogle = async (customRedirectTo = null) => {
    try {
      setError(null)
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: customRedirectTo || `${window.location.origin}/app`
        }
      })
      if (error) throw error
      return { data, error: null }
    } catch (error) {
      setError(error.message)
      return { data: null, error }
    }
  }

  const signUp = async (email, password) => {
    try {
      setError(null)
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/app`
        }
      })
      if (error) throw error
      
      // Check if user needs email verification
      if (data?.user && !data.session) {
        return { 
          data, 
          error: null, 
          needsVerification: true,
          message: 'Please check your email for verification link' 
        }
      }
      
      return { data, error: null, needsVerification: false }
    } catch (error) {
      setError(error.message)
      return { data: null, error }
    }
  }

  const signIn = async (email, password) => {
    try {
      setError(null)
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
      return { data, error: null }
    } catch (error) {
      setError(error.message)
      return { data: null, error }
    }
  }

  const signOut = async () => {
    try {
      setError(null)
      console.log('🚪 Starting sign out process...')
      
      // Set loading state
      setLoading(true)
      
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('❌ Supabase sign out error:', error)
        throw error
      }
      
      // Clear state immediately
      setUser(null)
      setUserProfile(null)
      
      // Clear localStorage on sign out
      localStorage.removeItem('auth_user')
      localStorage.removeItem('user_profile')
      
      console.log('✅ Sign out completed successfully')
      
    } catch (error) {
      console.error('❌ Sign out error:', error)
      setError(error.message)
      
      // Even on error, try to clear local state
      setUser(null)
      setUserProfile(null)
      localStorage.removeItem('auth_user')
      localStorage.removeItem('user_profile')
    } finally {
      setLoading(false)
    }
  }

  const resetPassword = async (email) => {
    try {
      setError(null)
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) throw error
      return { error: null }
    } catch (error) {
      setError(error.message)
      return { error }
    }
  }

  const value = {
    user,
    userProfile,
    loading,
    error,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    resetPassword,
    refreshUserProfile,
    updateUserTier,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}