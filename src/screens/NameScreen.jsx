import { useState } from 'react'
import { RotateCcw, User, AtSign, ArrowRight } from 'lucide-react'
import { C, FONT } from '../constants/colors.js'
import { inpSt } from '../utils/helpers.js'
import { Btn, GhostBtn } from '../components/Btn.jsx'

export default function NameScreen({ sessionId, hasLastOrder, onConfirm, onRepeatLast }) {
  const [name,     setName]     = useState('')
  const [telegram, setTelegram] = useState('')
  const clean  = t => t.trim().replace(/^@/, '')
  const canGo  = name.trim().length > 0

  return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24 }} className="animate-fade-in">
      <div style={{ width:'100%', maxWidth:400 }} className="glass-card">
        <div style={{ padding: '32px 24px' }}>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:24 }}>
            <div style={{ width:70, height:70, borderRadius:24, background:C.grad, display:'flex', alignItems:'center', justifyContent:'center', fontSize:32, boxShadow:'0 10px 25px rgba(99,102,241,0.3)', color: '#FFF' }}>
              <User size={36} />
            </div>
            
            <div style={{ textAlign:'center' }}>
              <h1 style={{ fontSize:28, fontWeight:900, color:C.dark, marginBottom: 8 }}>منوّرنا!</h1>
              <p style={{ fontSize:14, color:C.muted, fontWeight: 600 }}>اكتب اسمك عشان نعرف طلبك بتاع مين</p>
            </div>

            <div style={{ width:'100%', background: C.tag, borderRadius:12, padding:'10px 18px', fontSize:13, fontWeight:800, color:C.primary, textAlign: 'center' }}>
              كود الجلسة: <span style={{ fontFamily: 'monospace', fontSize: 16 }}>{sessionId}</span>
            </div>

            <div style={{ width:'100%' }}>
              <label style={{ fontSize:13, color:C.muted, fontWeight:700, marginBottom:8, display: 'block' }}>الاسم بالكامل</label>
              <input type="text" placeholder="مثال: محمد أحمد"
                value={name} onChange={e=>setName(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&canGo&&onConfirm(name.trim(),clean(telegram))}
                style={inpSt({ direction:'rtl', fontSize:18, fontWeight:800, border: name ? `2px solid ${C.primary}33` : '2px solid rgba(0,0,0,0.05)' })} autoFocus/>
            </div>

            <div style={{ width:'100%' }}>
              <label style={{ fontSize:13, color:C.muted, fontWeight:700, marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
                <span>يوزرنيم تيليجرام (اختياري)</span>
              </label>
              <div style={{ position:'relative', direction: 'ltr' }}>
                <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', fontSize:16, color:C.muted, fontWeight:700, pointerEvents:'none' }}>@</span>
                <input type="text" placeholder="username"
                  value={telegram}
                  onChange={e=>setTelegram(e.target.value.replace(/[^a-zA-Z0-9_]/g,'').toLowerCase())}
                  onKeyDown={e=>e.key==='Enter'&&canGo&&onConfirm(name.trim(),clean(telegram))}
                  style={inpSt({ textAlign:'left', paddingLeft:36, fontSize:15, fontWeight: 600, border: telegram ? `2px solid ${C.primary}33` : '2px solid rgba(0,0,0,0.05)' })}/>
              </div>
            </div>

            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
              <Btn onClick={()=>canGo&&onConfirm(name.trim(),clean(telegram))} disabled={!canGo} style={{ width: '100%', height: 56 }}>
                ابدأ الطلب <ArrowRight size={20}/>
              </Btn>

              {hasLastOrder && (
                <GhostBtn onClick={()=>canGo&&onRepeatLast(name.trim(),clean(telegram))} disabled={!canGo} style={{ width: '100%', height: 52, color: C.purple, borderColor: `${C.purple}22` }}>
                   <RotateCcw size={16}/> كرر نفس طلبي الأخير
                </GhostBtn>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
