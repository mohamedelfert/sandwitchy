import { useState, useEffect } from 'react'
import { RotateCcw, User, ArrowRight, History, ChevronDown, ArrowLeft } from 'lucide-react'
import { C, FONT } from '../constants/colors.js'
import { inpSt } from '../utils/helpers.js'
import { Btn } from '../components/Btn.jsx'
import { api } from '../api/client.js'

function formatDate(ts) {
  const date = new Date(ts)
  const now = new Date()
  const diff = now - date
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1) return 'الآن'
  if (mins < 60) return `من ${mins} دقيقة`
  if (hours < 24) return `من ${hours} ساعة`
  if (days === 1) return 'أمس'
  return `من ${days} يوم`
}

export default function NameScreen({
  sessionId,
  hasLastOrder,
  initialName = '',
  initialPhone = '',
  initialTelegram = '',
  onConfirm,
  onRepeatLast,
}) {
  const [name, setName] = useState(() => initialName)
  const [telegram, setTelegram] = useState(() => initialTelegram)
  const [phone, setPhone] = useState(() => initialPhone)
  const [history, setHistory] = useState([])
  const [showHist, setShowHist] = useState(true)
  const [loadingHist, setLoadingHist] = useState(false)
  const [restoringId, setRestoringId] = useState('')
  const clean = value => value.trim().replace(/^@/, '')
  const canGo = name.trim().length > 0

  useEffect(() => {
    if (name.trim().length < 2) {
      setHistory([])
      return
    }

    const timer = setTimeout(() => {
      setLoadingHist(true)
      api.getOrderHistory(name.trim())
        .then(rows => setHistory(rows || []))
        .finally(() => setLoadingHist(false))
    }, 300)

    return () => clearTimeout(timer)
  }, [name])

  const submitIdentity = snapshot => {
    onConfirm(name.trim(), clean(telegram), phone.trim(), snapshot)
  }

  const handleSelectHistory = async entry => {
    setRestoringId(entry.hid)
    try {
      const snapshot = await api.reorder(entry.hid).catch(() => entry)
      submitIdentity({
        ...entry,
        ...snapshot,
        lines: (snapshot.lines || entry.lines || []).map(line => ({
          ...line,
          key: `${line.rid}_${line.iid}_${line.bt || 'none'}`,
        })),
        drinks: snapshot.drinks || entry.drinks || {},
        notes: snapshot.notes || entry.notes || {},
      })
      setShowHist(false)
    } finally {
      setRestoringId('')
    }
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24 }} className="animate-fade-in">
      <button
        onClick={() => window.history.back()}
        style={{ position:'absolute', top:20, left:20, background:C.tag, border:'none', borderRadius:12, width:40, height:40, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}
      >
        <ArrowLeft size={20} color={C.primary}/>
      </button>

      <div style={{ width:'100%', maxWidth:420 }} className="glass-card">
        <div style={{ padding:'32px 24px' }}>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:22 }}>
            <div style={{ width:70, height:70, borderRadius:24, background:C.grad, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 10px 25px rgba(99,102,241,0.3)', color:'#FFF' }}>
              <User size={36} />
            </div>

            <div style={{ textAlign:'center' }}>
              <h1 style={{ fontSize:28, fontWeight:900, color:C.dark, marginBottom:8 }}>منوّرنا!</h1>
              <p style={{ fontSize:14, color:C.muted, fontWeight:600 }}>اكتب اسمك عشان نعرف الطلب بتاع مين</p>
            </div>

            <div style={{ width:'100%', background:C.tag, borderRadius:12, padding:'10px 18px', fontSize:13, fontWeight:800, color:C.primary, textAlign:'center' }}>
              كود الجلسة: <span style={{ fontFamily:'monospace', fontSize:16 }}>{sessionId}</span>
            </div>

            <div style={{ width:'100%' }}>
              <label style={{ fontSize:13, color:C.muted, fontWeight:700, marginBottom:8, display:'block' }}>الاسم بالكامل</label>
              <input
                type="text"
                placeholder="مثال: محمد أحمد"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && canGo && submitIdentity()}
                style={inpSt({ direction:'rtl', fontSize:18, fontWeight:800, border: name ? `2px solid ${C.primary}33` : '2px solid rgba(0,0,0,0.05)' })}
                autoFocus
              />
            </div>

            {hasLastOrder && (
              <button
                type="button"
                onClick={() => canGo && onRepeatLast(name.trim(), clean(telegram), phone.trim())}
                disabled={!canGo}
                style={{
                  width:'100%',
                  border:'none',
                  borderRadius:16,
                  padding:'14px 16px',
                  background: canGo ? C.primaryLight : C.tag,
                  color: canGo ? C.primary : C.muted,
                  cursor: canGo ? 'pointer' : 'not-allowed',
                  fontFamily: FONT,
                  display:'flex',
                  alignItems:'center',
                  justifyContent:'space-between',
                  fontWeight:800,
                }}
              >
                <span style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <RotateCcw size={18}/>
                  كرر آخر طلب محفوظ
                </span>
                <span style={{ fontSize:12 }}>حمّله في ثانية</span>
              </button>
            )}

            {history.length > 0 && (
              <div style={{ width:'100%' }}>
                <button
                  type="button"
                  onClick={() => setShowHist(value => !value)}
                  style={{ width:'100%', height:44, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 16px', background:C.tag, borderRadius:12, border:'none', cursor:'pointer', color:C.primary, fontSize:14, fontWeight:700 }}
                >
                  <span style={{ display:'flex', alignItems:'center', gap:8 }}><History size={16}/> طلبات سابقة ({history.length})</span>
                  <ChevronDown size={18} style={{ transform: showHist ? 'rotate(180deg)' : 'none', transition:'0.2s' }}/>
                </button>

                {showHist && (
                  <div style={{ marginTop:10, background:'#FFF', borderRadius:16, boxShadow:'0 10px 40px rgba(0,0,0,0.08)', overflow:'hidden', maxHeight:280, overflowY:'auto', border:'1px solid rgba(99,102,241,0.08)' }}>
                    {history.map(entry => {
                      const itemCount = (entry.lines || []).reduce((sum, line) => sum + line.qty, 0)
                      const drinkCount = Object.values(entry.drinks || {}).reduce((sum, qty) => sum + qty, 0)
                      const preview = (entry.lines || []).slice(0, 2).map(line => line.iname).join(' • ')
                      return (
                        <button
                          key={entry.hid}
                          type="button"
                          onClick={() => handleSelectHistory(entry)}
                          disabled={restoringId === entry.hid}
                          style={{ width:'100%', padding:'14px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', background:'transparent', border:'none', borderBottom:'1px solid #f0f0f0', cursor:'pointer', textAlign:'right', opacity: restoringId === entry.hid ? 0.6 : 1 }}
                        >
                          <div style={{ textAlign:'right' }}>
                            <div style={{ fontSize:13, fontWeight:800, color:C.dark }}>{itemCount} عناصر + {drinkCount} مشروبات</div>
                            <div style={{ fontSize:11, color:C.muted, fontWeight:600, marginTop:2 }}>{formatDate(entry.createdAt)} · جلسة {entry.sessionId}</div>
                            {preview && <div style={{ fontSize:11, color:C.primary, fontWeight:700, marginTop:4 }}>{preview}</div>}
                          </div>
                          <ArrowRight size={16} style={{ color: restoringId === entry.hid ? C.primary : C.muted }}/>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            <div style={{ width:'100%' }}>
              <label style={{ fontSize:13, color:C.muted, fontWeight:700, marginBottom:8, display:'block' }}>رقم الموبايل / واتساب (اختياري)</label>
              <input
                type="tel"
                placeholder="مثال: 01011731954"
                value={phone}
                onChange={e => setPhone(e.target.value.replace(/[^0-9+]/g, ''))}
                onKeyDown={e => e.key === 'Enter' && canGo && submitIdentity()}
                style={inpSt({ direction:'ltr', textAlign:'left', fontSize:15, fontWeight:600, border: phone ? `2px solid ${C.primary}33` : '2px solid rgba(0,0,0,0.05)' })}
              />
            </div>

            <div style={{ width:'100%' }}>
              <label style={{ fontSize:13, color:C.muted, fontWeight:700, marginBottom:8, display:'block' }}>يوزرنيم تيليجرام (اختياري)</label>
              <div style={{ position:'relative', direction:'ltr' }}>
                <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', fontSize:16, color:C.muted, fontWeight:700, pointerEvents:'none' }}>@</span>
                <input
                  type="text"
                  placeholder="username"
                  value={telegram}
                  onChange={e => setTelegram(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase())}
                  onKeyDown={e => e.key === 'Enter' && canGo && submitIdentity()}
                  style={inpSt({ textAlign:'left', paddingLeft:36, fontSize:15, fontWeight:600, border: telegram ? `2px solid ${C.primary}33` : '2px solid rgba(0,0,0,0.05)' })}
                />
              </div>
            </div>

            <div style={{ width:'100%', display:'flex', flexDirection:'column', gap:12, marginTop:8 }}>
              <Btn onClick={() => canGo && submitIdentity()} disabled={!canGo} style={{ width:'100%', height:56 }}>
                ابدأ الطلب <ArrowRight size={20}/>
              </Btn>
              {loadingHist && <div style={{ textAlign:'center', fontSize:12, color:C.muted, fontWeight:700 }}>بنجيب طلباتك السابقة...</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
