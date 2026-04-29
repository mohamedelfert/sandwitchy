import { useState } from 'react'
import { Eye, EyeOff, UserPlus, LogIn } from 'lucide-react'
import { C } from '../constants/colors.js'
import { useAuth } from '../context/AuthContext.jsx'
import { Btn } from '../components/Btn.jsx'

export default function RegisterScreen({ onSwitchToLogin }) {
  const { register } = useAuth()
  const [form, setForm] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    email: '',
    phone: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (field) => (e) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }))
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    const { username, password, confirmPassword } = form
    if (!username || !password) return
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    if (username.length < 3) {
      setError('Username must be at least 3 characters')
      return
    }

    setLoading(true)
    setError('')
    try {
      await register(username, password, {
        email: form.email,
        phone: form.phone
      })
    } catch (err) {
      setError(err.message || 'Registration failed')
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
          <h1 style={{ fontSize: 24, fontWeight: 900, color: C.dark, marginBottom: 4 }}>Create Account</h1>
          <p style={{ fontSize: 14, color: C.muted }}>Join sandwitchy today</p>
        </div>

        <form onSubmit={handleRegister}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: C.dark, marginBottom: 8 }}>
              Username
            </label>
            <input
              type="text"
              value={form.username}
              onChange={handleChange('username')}
              placeholder="Choose a username"
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

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: C.dark, marginBottom: 8 }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={handleChange('password')}
                placeholder="Create a password"
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

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: C.dark, marginBottom: 8 }}>
              Confirm Password
            </label>
            <input
              type="password"
              value={form.confirmPassword}
              onChange={handleChange('confirmPassword')}
              placeholder="Confirm your password"
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

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: C.dark, marginBottom: 8 }}>
              Email (optional)
            </label>
            <input
              type="email"
              value={form.email}
              onChange={handleChange('email')}
              placeholder="your@email.com"
              style={{
                width: '100%',
                padding: '14px 16px',
                border: `2px solid ${C.border}`,
                borderRadius: 14,
                fontSize: 16,
                fontFamily: 'inherit',
                outline: 'none',
                background: '#FAFAFA',
                transition: 'border-color 0.2s',
                direction: 'ltr'
              }}
              onFocus={e => e.target.style.borderColor = C.primary}
              onBlur={e => e.target.style.borderColor = C.border}
            />
          </div>

          <div style={{ marginBottom: 8 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: C.dark, marginBottom: 8 }}>
              Phone (optional)
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={handleChange('phone')}
              placeholder="+20 100 000 0000"
              style={{
                width: '100%',
                padding: '14px 16px',
                border: `2px solid ${C.border}`,
                borderRadius: 14,
                fontSize: 16,
                fontFamily: 'inherit',
                outline: 'none',
                background: '#FAFAFA',
                transition: 'border-color 0.2s',
                direction: 'ltr'
              }}
              onFocus={e => e.target.style.borderColor = C.primary}
              onBlur={e => e.target.style.borderColor = C.border}
            />
          </div>

          {error && (
            <div style={{
              background: `${C.red}15`,
              color: C.red,
              padding: '10px 14px',
              borderRadius: 10,
              fontSize: 13,
              marginTop: 16,
              marginBottom: 8,
              fontWeight: 600
            }}>
              {error}
            </div>
          )}

          <Btn
            type="submit"
            loading={loading}
            disabled={!form.username || !form.password || !form.confirmPassword}
            style={{ width: '100%', marginTop: 16 }}
          >
            <UserPlus size={18} style={{ marginLeft: 8 }} />
            Create Account
          </Btn>
        </form>

        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <p style={{ fontSize: 14, color: C.muted }}>
            Already have an account?{' '}
            <button
              onClick={onSwitchToLogin}
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
              Sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
