import { createContext, useContext, useEffect, useState } from 'react'
import { api } from '../api/client.js'

const AuthContext = createContext(null)

const TOKEN_KEY = 'sandwitchy_token'
const USER_KEY = 'sandwitchy_user'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (token) {
      api.getCurrentUser().then(res => {
        if (res.ok && res.user) {
          setUser(res.user)
        } else {
          localStorage.removeItem(TOKEN_KEY)
          localStorage.removeItem(USER_KEY)
          setToken(null)
        }
        setLoading(false)
      }).catch(() => {
        setLoading(false)
      })
    } else {
      setLoading(false)
    }
  }, [token])

  const login = async (username, password) => {
    const res = await api.authLogin(username, password)
    if (!res.ok) throw new Error(res.error || 'Login failed')
    localStorage.setItem(TOKEN_KEY, res.token)
    localStorage.setItem(USER_KEY, JSON.stringify(res.user))
    setToken(res.token)
    setUser(res.user)
    return res
  }

  const register = async (username, password, { phone, telegram, email } = {}) => {
    const res = await api.authRegister(username, password, { phone, telegram, email })
    if (!res.ok) throw new Error(res.error || 'Registration failed')
    localStorage.setItem(TOKEN_KEY, res.token)
    localStorage.setItem(USER_KEY, JSON.stringify(res.user))
    setToken(res.token)
    setUser(res.user)
    return res
  }

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setToken(null)
    setUser(null)
    api.authLogout()
  }

  const updateUser = (userData) => {
    setUser(prev => ({ ...prev, ...userData }))
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify({ ...user, ...userData }))
    }
  }

  const value = {
    user,
    token,
    loading,
    login,
    register,
    logout,
    updateUser,
    isAuthenticated: !!user
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}

export default AuthContext
