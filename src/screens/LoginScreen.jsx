import { useState } from 'react'
import { Eye, EyeOff, LogIn, UserPlus } from 'lucide-react'
import { C } from '../constants/colors.js'
import { useAuth } from '../context/AuthContext.jsx'
import { Btn } from '../components/Btn.jsx'

export default function LoginScreen({ onSwitchToRegister }) {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e) => {
    e.preventDefault()
    if (!username || !password) return
    setLoading(true)
    setError('')
    try {
      await login(username, password)
    } catch (err) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      background: 'linear-gradient(135deg, #F4F3FF 0%, #E8E7FF 100%)'
    }}>
      <div style={{
        width: '100%',
        maxWidth: 400,
        background: '#FFF',
        borderRadius: 24,
        padding: '32px 28px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.1)',
        border: '1px solid rgba(0,0,0,0.05)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🍽️</div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: C.dark, marginBottom: 4 }}>Welcome Back</h1>
          <p style={{ fontSize: 14, color: C.muted }}>Sign in to continue to sandwitchy</p>
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: C.dark, marginBottom: 8 }}>
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Enter your username"
              style={{
                width: '100%',
                padding: '14px 16px',
                border: `2px solid ${error ? C.red : C.border}`,
                borderRadius: 14,
                fontSize: 16,
                fontFamily: 'inherit',
                outline: 'none',
                background: '#FAFAFA',
                transition: 'border-color 0.2s',
                direction: 'ltr'
              }}
              onFocus={e => e.target.style.borderColor = C.primary}
              onBlur={e => e.target.style.borderColor = error ? C.red : C.border}
            />
          </div>

          <div style={{ marginBottom: 8 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: C.dark, marginBottom: 8 }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                style={{
                  width: '100%',
                  padding: '14px 48px 14px 16px',
                  border: `2px solid ${error ? C.red : C.border}`,
                  borderRadius: 14,
                  fontSize: 16,
                  fontFamily: 'inherit',
                  outline: 'none',
                  background: '#FAFAFA',
                  transition: 'border-color 0.2s',
                  direction: 'ltr'
                }}
                onFocus={e => e.target.style.borderColor = C.primary}
                onBlur={e => e.target.style.borderColor = error ? C.red : C.border}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: 14,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  color: C.muted,
                  padding: 4
                }}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {error && (
            <div style={{
              background: `${C.red}15`,
              color: C.red,
              padding: '10px 14px',
              borderRadius: 10,
              fontSize: 13,
              marginBottom: 16,
              fontWeight: 600
            }}>
              {error}
            </div>
          )}

          <Btn
            type="submit"
            loading={loading}
            disabled={!username || !password}
            style={{ width: '100%', marginTop: 16 }}
          >
            <LogIn size={18} style={{ marginLeft: 8 }} />
            Sign In
          </Btn>
        </form>

        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <p style={{ fontSize: 14, color: C.muted }}>
            Don't have an account?{' '}
            <button
              onClick={onSwitchToRegister}
              style={{
                background: 'none',
                border: 'none',
                color: C.primary,
                fontWeight: 800,
                fontSize: 14,
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              Create one
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
