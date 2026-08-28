import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { setUnauthorizedHandler, setAuthToken } from '../api/client'
import { login as apiLogin, logout as apiLogout, tryRestoreSession } from '../api/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState('loading') // 'loading' | 'authenticated' | 'unauthenticated'

  const clearSession = useCallback(() => {
    setAuthToken(null)
    setUser(null)
    setStatus('unauthenticated')
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(clearSession)
    tryRestoreSession()
      .then((restoredUser) => {
        setUser(restoredUser)
        setStatus('authenticated')
      })
      .catch(() => setStatus('unauthenticated'))
  }, [clearSession])

  async function login(email, password) {
    const loggedInUser = await apiLogin(email, password)
    setUser(loggedInUser)
    setStatus('authenticated')
    return loggedInUser
  }

  async function logout() {
    try {
      await apiLogout()
    } finally {
      clearSession()
    }
  }

  return (
    <AuthContext.Provider value={{ user, status, login, logout, isAdmin: user?.role === 'Admin' }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
