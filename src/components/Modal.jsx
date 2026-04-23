import { X } from 'lucide-react'
import { C, FONT } from '../constants/colors.js'
import { useEffect } from 'react'

export default function Modal({ title, onClose, children, wide = false }) {
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handler)
      document.body.style.overflow = 'auto'
    }
  }, [onClose])

  return (
    <div
      style={{ position:'fixed', inset:0, background:'rgba(15, 23, 42, 0.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:400, backdropFilter:'blur(8px)', padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      className="animate-fade-in"
    >
      <div 
        className="glass-card"
        style={{ 
          background: '#FFF', padding:'28px 24px', width:'100%', 
          maxWidth: wide ? 700 : 450, maxHeight:'90vh', 
          overflowY:'auto', borderRadius: 32,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          animation: 'modalSlideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)' 
        }}
      >
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
          <h2 style={{ fontSize:20, fontWeight:900, color:C.dark, fontFamily:FONT, letterSpacing: -0.5 }}>{title}</h2>
          <button onClick={onClose} style={{ background:C.tag, border:'none', borderRadius: 12, width:36, height:36, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color: C.muted }}>
            <X size={20} />
          </button>
        </div>
        <div>
          {children}
        </div>
      </div>
      <style>{`
        @keyframes modalSlideUp { 
          from { transform: translateY(30px) scale(0.95); opacity: 0; } 
          to { transform: translateY(0) scale(1); opacity: 1; } 
        }
      `}</style>
    </div>
  )
}
