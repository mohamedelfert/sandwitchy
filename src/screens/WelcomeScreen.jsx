import { useState } from 'react'
import { PlusCircle, Link, ArrowRight } from 'lucide-react'
import { C, FONT } from '../constants/colors.js'
import { inpSt, genId } from '../utils/helpers.js'
import { Btn, GhostBtn } from '../components/Btn.jsx'

export default function WelcomeScreen({ onStart }) {
  const [joinCode, setJoinCode] = useState('')

  return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column' }} className="animate-fade-in">
      {/* Dynamic Header */}
      <div style={{ background:C.grad, padding:'80px 24px 60px', textAlign:'center', position:'relative', overflow:'hidden', borderRadius: '0 0 40px 40px', boxShadow: '0 10px 30px rgba(99,102,241,0.2)' }}>
        <div style={{ position:'absolute', top:-40, right:-40, width:200, height:200, borderRadius:'50%', background:'rgba(255,255,255,0.1)' }}/>
        <div style={{ position:'absolute', bottom:-20, left:-20, width:120, height:120, borderRadius:'50%', background:'rgba(255,255,255,0.05)' }}/>
        
        <div style={{ fontSize:72, marginBottom:16, filter:'drop-shadow(0 10px 15px rgba(0,0,0,0.1))' }}>🥪</div>
        <h1 style={{ fontSize:42, fontWeight:950, color:'#FFF', letterSpacing:-1.5, lineHeight:1, marginBottom: 12 }}>ساندوتشي</h1>
        <p style={{ fontSize:15, color:'rgba(255,255,255,0.9)', fontWeight:600, maxWidth: 300, margin: '0 auto' }}>
          اطلبوا أكلكوا سوا، والحساب علينا نطلعهولكم مظبوط!
        </p>
      </div>

      <div style={{ flex:1, padding:'40px 24px', display:'flex', flexDirection:'column', gap:20, maxWidth:450, margin:'0 auto', width:'100%' }}>
        
        <button
          onClick={() => onStart(genId())}
          style={{ 
            background: '#FFF', border:'2px solid transparent', borderRadius:24, padding:'24px', 
            cursor:'pointer', fontFamily:FONT, display:'flex', alignItems:'center', gap:20, 
            boxShadow:'0 15px 35px rgba(31,38,135,0.08)', transition:'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            textAlign: 'right', position: 'relative', overflow: 'hidden'
          }}
          onMouseEnter={e => { e.currentTarget.style.transform='translateY(-5px) scale(1.02)'; e.currentTarget.style.borderColor=C.primary }}
          onMouseLeave={e => { e.currentTarget.style.transform='translateY(0) scale(1)'; e.currentTarget.style.borderColor='transparent' }}
        >
          <div style={{ width: 56, height: 56, borderRadius: 16, background: C.grad, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF', flexShrink: 0 }}>
             <PlusCircle size={32} />
          </div>
          <div>
            <div style={{ fontSize:19, fontWeight:900, color: C.dark }}>ابدأ طلب مجمع جديد</div>
            <div style={{ fontSize:13, color: C.muted, fontWeight: 600, marginTop:4 }}>أنشئ جلسة وشارك الرابط مع الجروب</div>
          </div>
        </button>

        <div className="glass-card" style={{ padding:'24px', borderRadius: 24 }}>
          <div style={{ fontSize:15, fontWeight:900, color:C.dark, marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>
            <Link size={18} color={C.primary}/> انضم لطلب شغال
          </div>
          <input
            type="text" placeholder="أدخل الكود (مثلاً: ZH1INJ)"
            value={joinCode}
            onChange={e => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            onKeyDown={e => e.key === 'Enter' && joinCode.length >= 4 && onStart(joinCode)}
            style={{ ...inpSt({ textAlign:'center', fontSize:22, fontWeight:900, letterSpacing:4, marginBottom:16, border: joinCode ? `2px solid ${C.primary}33` : '2px solid rgba(0,0,0,0.05)' }) }}
          />
          <Btn
            onClick={() => joinCode.length >= 4 && onStart(joinCode)}
            disabled={joinCode.length < 4}
            style={{ width:'100%', height: 54 }}
          >
            انضم للجروب <ArrowRight size={20}/>
          </Btn>
        </div>

        <div style={{ marginTop: 'auto', textAlign: 'center', color: C.muted, fontSize: 12, fontWeight: 600 }}>
          Sandwitchy v1.0 • Made with ❤️ for foodies by mohamed elfert
        </div>
      </div>
    </div>
  )
}
