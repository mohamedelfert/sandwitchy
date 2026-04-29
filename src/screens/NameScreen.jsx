import { useState, useEffect } from 'react'
import { RotateCcw, User, AtSign, ArrowRight, History, ChevronDown, ArrowLeft } from 'lucide-react'
import { C, FONT } from '../constants/colors.js'
import { inpSt } from '../utils/helpers.js'
import { Btn, GhostBtn } from '../components/Btn.jsx'
import { api } from '../api/client.js'

function formatDate(ts) {
  const d = new Date(ts)
  const now = new Date()
  const diff = now - d
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1) return 'الآن'
  if (mins < 60) return `من ${mins} دقيقة`
  if (hours < 24) return `من ${hours} ساعة`
  if (days === 1) return 'أمس'
  return `من ${days} يوم`
}

export default function NameScreen({ sessionId, hasLastOrder, onConfirm, onRepeatLast }) {
  const [name,     setName]     = useState('')
  const [telegram, setTelegram] = useState('')
  const [phone,    setPhone]    = useState('')
  const [history,  setHistory] = useState([])
  const [showHist, setShowHist] = useState(false)
  const [loadingHist, setLoadingHist] = useState(false)
  const clean  = t => t.trim().replace(/^@/, '')
  const canGo  = name.trim().length > 0

  useEffect(() => {
    if (name.trim().length < 2) { setHistory([]); return }
    const timer = setTimeout(() => {
      setLoadingHist(true)
      api.getOrderHistory(name.trim()).then(h => {
        setHistory(h || [])
        setLoadingHist(false)
      }).catch(() => setLoadingHist(false))
    }, 300)
    return () => clearTimeout(timer)
  }, [name])

  const handleSelectHistory = (h) => {
    const cleaned = { ...h, lines: h.lines.map(l => ({ ...l, key: `${l.rid}_${l.iid}_${l.bt||'none'}` })) }
    onConfirm(name.trim(), clean(telegram), phone.trim(), cleaned)
    setShowHist(false)
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24 }} className="animate-fade-in">
      <button onClick={() => window.history.back()} style={{ position:'absolute', top:20, left:20, background:C.tag, border:'none', borderRadius:12, width:40, height:40, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <ArrowLeft size={20} color={C.primary}/>
      </button>
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
                onKeyDown={e=>e.key==='Enter'&&canGo&&onConfirm(name.trim(),clean(telegram),phone.trim())}
                style={inpSt({ direction:'rtl', fontSize:18, fontWeight:800, border: name ? `2px solid ${C.primary}33` : '2px solid rgba(0,0,0,0.05)' })} autoFocus/>
            </div>

            {history.length > 0 && (
              <div style={{ width:'100%', position:'relative', zIndex: 100 }}>
                <button type="button" onClick={() => setShowHist(!showHist)} disabled style={{ width:'100%', height:44, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 16px', background:C.tag, borderRadius:12, border:'none', cursor:'pointer', color:C.primary, fontSize:14, fontWeight:700 }}>
                  <span style={{ display:'flex', alignItems:'center', gap:8 }}><History size={16}/> طلبات سابقة ({history.length})</span>
                  <ChevronDown size={18} style={{ transform: showHist ? 'rotate(180deg)' : 'none', transition:'0.2s' }}/>
                </button>
                {showHist && (
                  <div style={{ position:'absolute', top:'110%', right:0, left:0, background:'#FFF', borderRadius:12, boxShadow:'0 10px 40px rgba(0,0,0,0.15)', overflow:'hidden', maxHeight:250, overflowY:'auto' }}>
                    {history.map(h => {
                      const itemCount = (h.lines||[]).reduce((s,l)=>s+l.qty,0)
                      const drinkCount = Object.values(h.drinks||{}).reduce((s,v)=>s+v,0)
                      return (
                        <button key={h.hid} type="button" onClick={() => handleSelectHistory(h)} style={{ width:'100%', padding:'12px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', background:'transparent', border:'none', borderBottom:'1px solid #f0f0f0', cursor:'pointer', textAlign:'right' }}>
                          <div>
                            <div style={{ fontSize:13, fontWeight:800, color:C.dark }}>{itemCount} عناصر + {drinkCount} مشروبات</div>
                            <div style={{ fontSize:11, color:C.muted, fontWeight:600 }}>{formatDate(h.createdAt)}</div>
                          </div>
                          <ArrowRight size={16} style={{ color:C.muted }}/>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            <div style={{ width:'100%' }}>
              <label style={{ fontSize:13, color:C.muted, fontWeight:700, marginBottom:8, display: 'block' }}>رقم الموبايل / واتساب (اختياري)</label>
              <input type="tel" placeholder="مثال: 01011731954"
                value={phone} onChange={e=>setPhone(e.target.value.replace(/[^0-9+]/g,''))}
                onKeyDown={e=>e.key==='Enter'&&canGo&&onConfirm(name.trim(),clean(telegram),phone.trim())}
                style={inpSt({ direction:'ltr', textAlign:'left', fontSize:15, fontWeight:600, border: phone ? `2px solid ${C.primary}33` : '2px solid rgba(0,0,0,0.05)' })}/>
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
                  onKeyDown={e=>e.key==='Enter'&&canGo&&onConfirm(name.trim(),clean(telegram),phone.trim())}
                  style={inpSt({ textAlign:'left', paddingLeft:36, fontSize:15, fontWeight: 600, border: telegram ? `2px solid ${C.primary}33` : '2px solid rgba(0,0,0,0.05)' })}/>
              </div>
            </div>

            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
              <Btn onClick={()=>canGo&&onConfirm(name.trim(),clean(telegram),phone.trim())} disabled={!canGo} style={{ width: '100%', height: 56 }}>
                ابدأ الطلب <ArrowRight size={20}/>
              </Btn>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
