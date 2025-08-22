import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { UserProfileService } from '../services/userProfileService'

const AuthContext = createContext({})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    // Get initial session and user profile
    const getSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) throw error
        
        const currentUser = session?.user ?? null
        setUser(currentUser)
        
        // Load user profile if user exists
        if (currentUser) {
          await loadUserProfile(currentUser)
        } else {
          setUserProfile(null)
        }
      } catch (error) {
        console.error('Error getting session:', error)
        setError(error.message)
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
        
        // Load user profile when user signs in
        if (currentUser && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
          await loadUserProfile(currentUser)
        } else if (!currentUser) {
          setUserProfile(null)
        }
        
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  // Load user profile from Supabase
  const loadUserProfile = async (user) => {
    try {
      const { profile, error } = await UserProfileService.ensureUserProfile(user)
      if (error) {
        console.error('Error loading user profile:', error)
        // Set default profile if database error
        setUserProfile({ user_tier: 'guest' })
      } else {
        setUserProfile(profile)
        console.log('✅ User profile loaded:', profile)
      }
    } catch (error) {
      console.error('Error in loadUserProfile:', error)
      setUserProfile({ user_tier: 'guest' })
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
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    } catch (error) {
      setError(error.message)
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