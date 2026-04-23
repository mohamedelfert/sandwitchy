import { C, FONT } from '../constants/colors.js'

export function Btn({ onClick, children, color = null, style = {}, disabled = false, loading = false }) {
  const bg = color || C.grad
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        background: (disabled || loading) ? C.muted : bg,
        color: '#FFF', border: 'none', borderRadius: 16,
        padding: '12px 24px', fontSize: 16, fontWeight: 700,
        cursor: (disabled || loading) ? 'not-allowed' : 'pointer',
        fontFamily: FONT,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        boxShadow: (disabled || loading) ? 'none' : '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        opacity: (disabled || loading) ? 0.6 : 1,
        transform: 'scale(1)',
        ...style,
      }}
      onMouseEnter={e => { if (!disabled && !loading) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.opacity = '0.9'; } }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.opacity = (disabled || loading) ? '0.6' : '1'; }}
      onMouseDown={e  => { if (!disabled && !loading) e.currentTarget.style.transform = 'scale(0.95)'; }}
      onMouseUp={e    => { e.currentTarget.style.transform = 'translateY(-2px) scale(1)'; }}
    >
      {loading ? (
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg style={{ animation: 'spin 1s linear infinite', width: 20, height: 20 }} viewBox="0 0 24 24">
            <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          جاري...
        </span>
      ) : children}
    </button>
  )
}

export function GhostBtn({ onClick, children, color = C.primary, style = {}, disabled = false }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: 'transparent', color, border: `2px solid ${color}22`,
        borderRadius: 16, padding: '10px 20px', fontSize: 14, fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: FONT,
        display: 'flex', alignItems: 'center', gap: 8,
        transition: 'all 0.2s', opacity: disabled ? 0.6 : 1,
        ...style,
      }}
      onMouseEnter={e => { if (!disabled) { e.currentTarget.style.background = `${color}08`; e.currentTarget.style.borderColor = `${color}44` } }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = `${color}22` }}
    >
      {children}
    </button>
  )
}
