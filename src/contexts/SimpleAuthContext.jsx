import React, { createContext, useContext, useState } from 'react'

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
  const [loading, setLoading] = useState(false)

  const signInWithGoogle = async () => {
    // Mock implementation since Supabase is removed
    console.log('Google sign in not implemented in simple auth')
    return { error: 'Google sign in not available' }
  }

  const signUp = async (email, password) => {
    setLoading(true)
    try {
      // Mock sign up implementation
      const mockUser = { id: Date.now().toString(), email, name: email.split('@')[0] }
      setUser(mockUser)
      const tier = getTierByEmail(email)
      setUserTier(tier)
      return { data: mockUser, error: null }
    } catch (error) {
      console.error('Sign up error:', error)
      return { data: null, error: error.message }
    } finally {
      setLoading(false)
    }
  }

  const signIn = async (email, password) => {
    setLoading(true)
    try {
      // Mock sign in implementation
      const mockUser = { id: Date.now().toString(), email, name: email.split('@')[0] }
      setUser(mockUser)
      const tier = getTierByEmail(email)
      setUserTier(tier)
      return { data: mockUser, error: null }
    } catch (error) {
      console.error('Sign in error:', error)
      return { data: null, error: error.message }
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    try {
      console.log('🚪 Signing out...')
      setUser(null)
      setUserTier('guest')
      console.log('✅ Signed out successfully')
    } catch (error) {
      console.error('Sign out error:', error)
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