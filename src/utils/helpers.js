export const genId = () => Math.random().toString(36).substring(2, 8).toUpperCase()
export const fmt   = n  => n.toLocaleString('ar-EG', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

export const formatTime = (ts) => {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
}

export const getWhatsAppLink = (text) => {
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}

export const inpSt = (ex = {}) => ({
  width: '100%', padding: '14px 16px', borderRadius: 16,
  border: `2px solid rgba(99, 102, 241, 0.1)`, fontSize: 15,
  fontFamily: "'Cairo', sans-serif", outline: 'none',
  boxSizing: 'border-box', background: '#FFF', color: '#1E293B',
  transition: 'all 0.2s',
  boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
  ...ex,
})
