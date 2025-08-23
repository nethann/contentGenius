import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const SimpleAuthContext = createContext({})

export const useSimpleAuth = () => {
  const context = useContext(SimpleAuthContext)
  if (!context) {
    throw new Error('useSimpleAuth must be used within a SimpleAuthProvider')
  }
  return context
}

// Simple tier assignment based on email
const getTierByEmail = (email) => {
  const adminEmails = ['nethan.nagendran@gmail.com', 'nethmarket@gmail.com']
  return adminEmails.includes(email?.toLowerCase()) ? 'developer' : 'guest'
}

export const SimpleAuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [userTier, setUserTier] = useState('guest')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    const getSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const currentUser = session?.user ?? null
        
        setUser(currentUser)
        if (currentUser) {
          const tier = getTierByEmail(currentUser.email)
          setUserTier(tier)
          console.log(`✅ User: ${currentUser.email}, Tier: ${tier}`)
        }
      } catch (error) {
        console.error('Session error:', error)
      } finally {
        setLoading(false)
      }
    }

    getSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth event:', event)
        const currentUser = session?.user ?? null
        setUser(currentUser)
        
        if (currentUser) {
          const tier = getTierByEmail(currentUser.email)
          setUserTier(tier)
          console.log(`✅ Auth change - User: ${currentUser.email}, Tier: ${tier}`)
        } else {
          setUserTier('guest')
        }
        
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/app`
        }
      })
      if (error) throw error
    } catch (error) {
      console.error('Sign in error:', error)
      return { error: error.message }
    }
  }

  const signUp = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/app`
        }
      })
      if (error) throw error
      
      // Immediately set tier based on email
      if (data.user) {
        const tier = getTierByEmail(data.user.email)
        setUserTier(tier)
      }
      
      return { data, error: null }
    } catch (error) {
      console.error('Sign up error:', error)
      return { data: null, error: error.message }
    }
  }

  const signIn = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
      
      // Immediately set tier based on email
      if (data.user) {
        const tier = getTierByEmail(data.user.email)
        setUserTier(tier)
      }
      
      return { data, error: null }
    } catch (error) {
      console.error('Sign in error:', error)
      return { data: null, error: error.message }
    }
  }

  const signOut = async () => {
    try {
      console.log('🚪 Signing out...')
      await supabase.auth.signOut()
      setUser(null)
      setUserTier('guest')
      console.log('✅ Signed out successfully')
    } catch (error) {
      console.error('Sign out error:', error)
      // Force clear even on error
      setUser(null)
      setUserTier('guest')
    }
  }

  const upgradeToPro = () => {
    // Simple local upgrade - no database needed
    if (userTier === 'guest') {
      setUserTier('pro')
      console.log('✅ Upgraded to Pro!')
      return { success: true }
    }
    return { error: 'Already Pro or higher' }
  }

  const downgradeToGuest = () => {
    if (userTier === 'pro') {
      setUserTier('guest')
      console.log('✅ Downgraded to Guest')
      return { success: true }
    }
    return { error: 'Not a Pro user' }
  }

  const isAdmin = () => {
    return userTier === 'developer'
  }

  const isPro = () => {
    return userTier === 'pro' || userTier === 'developer'
  }

  const value = {
    user,
    userTier,
    loading,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    upgradeToPro,
    downgradeToGuest,
    isAdmin,
    isPro,
  }

  return (
    <SimpleAuthContext.Provider value={value}>
      {children}
    </SimpleAuthContext.Provider>
  )
}

export default SimpleAuthProvider