import { useState, useEffect, useRef } from 'react'
import {
  ShieldCheck, CheckCircle, RotateCcw, Trash2, Edit3,
  Copy, Check, Truck, Eye, Share2, X, Clock, Users, Printer, QrCode, ArrowLeft, Bell, MessageCircle, Settings
} from 'lucide-react'
import { C, FONT } from '../constants/colors.js'
import { DRINKS, BREAD } from '../constants/data.js'
import { fmt, inpSt, formatTime, getWhatsAppLink } from '../utils/helpers.js'
import { api } from '../api/client.js'
import Modal from '../components/Modal.jsx'
import { Btn, GhostBtn } from '../components/Btn.jsx'
import CombinedTotals from '../components/CombinedTotals.jsx'
import Countdown from '../components/Countdown.jsx'

// ── QR Code Component ──
function QRModal({ url, onClose }) {
  const encoded = encodeURIComponent(url)
  return (
    <Modal title="شارك رابط الطلب" onClose={onClose}>
      <div style={{ textAlign:'center', padding:'10px 0' }}>
        <div style={{ background: '#FFF', padding: 20, borderRadius: 20, display: 'inline-block', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', marginBottom: 20 }}>
          <img src={`https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encoded}`}
            alt="QR" style={{ width:240, height:240 }}/>
        </div>
        <div style={{ fontSize:13, color:C.muted, marginTop:12, wordBreak:'break-all', background:C.tag, borderRadius:12, padding:'12px 16px', fontWeight: 600 }}>{url}</div>
        <p style={{ fontSize:14, color:C.primary, marginTop:16, fontWeight: 700 }}>خلّي الشباب يصوروا الكود ويطلبوا!</p>
      </div>
    </Modal>
  )
}

function buildWhatsAppText(allOrders, delivery, sid) {
  const numPeople = Object.keys(allOrders).length
  const perPerson = numPeople > 0 ? delivery / numPeople : 0
  let text = `*ملخص طلبات ساندوتشي* — ${sid}\n`
  text    += `--------------------------\n`
  
  Object.values(allOrders).forEach(o => {
    text += `👤 *${o.name}*: `
    const linesTotal = (o.lines||[]).reduce((s,l) => s + (l.price||0)*l.qty, 0)
    text += `${fmt(linesTotal + perPerson)} ج\n`
    o.lines.forEach(l => {
      text += `• ${l.iname} ×${l.qty}${o.notes?.[l.key] ? ` (${o.notes[l.key]})`:''}\n`
    })
    text += `\n`
  })
  
  text += `📊 *الإجمالي: ${Object.values(allOrders).reduce((s,o)=>s+(o.lines||[]).reduce((ss,l)=>ss+(l.price||0)*l.qty,0),0) + delivery} ج*\n`
  text += `🚗 التوصيل: ${delivery} ج`
  
  return text
}

export default function AdminPage() {
  const [sid,           setSid]           = useState('')
  const [inputCode,     setInputCode]     = useState('')
  const [allOrders,     setAllOrders]     = useState({})
  const [delivery,      setDelivery]      = useState(0)
  const [deliveryInput, setDeliveryInput] = useState('')
  const [status,        setStatus]        = useState('open')
  const [deadline,      setDeadlineState] = useState(null)
  const [expected,      setExpectedState] = useState([])
  const [breadTypes,    setBreadTypes]    = useState([])
  const [showSettings,  setShowSettings]  = useState(false)
  const [newBread,      setNewBread]      = useState({ ar: '', color: '#B83A0A' })
  const [copied,        setCopied]        = useState('')
  const [editOrder,     setEditOrder]     = useState(null)
  const [confirmReset,  setConfirmReset]  = useState(false)
  const [savingDel,     setSavingDel]     = useState(false)
  const [showQR,        setShowQR]        = useState(false)
  const [showExpected,  setShowExpected]  = useState(false)
  const [expectedInput, setExpectedInput] = useState('')
  const [deadlineInput, setDeadlineInput] = useState('')
  const evtRef = useRef(null)
  const prevCount = useRef(0)

  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const s = p.get('s')
    if (s) setSid(s)
  }, [])

  useEffect(() => {
    if (!sid) return
    evtRef.current?.close()
    const connect = () => {
      const es = new EventSource(`/events/${sid}`)
      es.onmessage = e => {
        try {
          const d = JSON.parse(e.data)
          setAllOrders(d.orders||{})
          setDelivery(d.delivery||0)
          setDeliveryInput(v => v==='' ? String(d.delivery||'') : v)
          setStatus(d.status||'open')
          setDeadlineState(d.deadline||null)
          setExpectedState(d.expected||[])
        } catch(_) {}
      }
      es.onerror = () => { es.close(); setTimeout(connect, 3000) }
      evtRef.current = es
    }
    connect()
    api.getSettings().then(s => {
      if (s.bread_types) setBreadTypes(s.bread_types)
    })
    return () => evtRef.current?.close()
  }, [sid])

  useEffect(() => {
    const count = Object.keys(allOrders).length
    if (count > prevCount.current && prevCount.current > 0) {
      try {
        const ctx = new (window.AudioContext||window.webkitAudioContext)()
        const osc = ctx.createOscillator(), gain = ctx.createGain()
        osc.connect(gain); gain.connect(ctx.destination)
        osc.frequency.setValueAtTime(520,ctx.currentTime)
        osc.frequency.setValueAtTime(880,ctx.currentTime+0.1)
        gain.gain.setValueAtTime(0.2,ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.5)
        osc.start(); osc.stop(ctx.currentTime+0.5)
      } catch(_) {}
      if ('vibrate' in navigator) navigator.vibrate([100, 50, 100])
    }
    prevCount.current = count
  }, [allOrders])

  const enterSid = s => {
    setSid(s)
    const url = new URL(window.location.href)
    url.searchParams.set('s',s); url.searchParams.set('admin','1')
    window.history.replaceState({}, '', url)
  }

  const copyText = (text,key) => { navigator.clipboard?.writeText(text); setCopied(key); setTimeout(()=>setCopied(''),2000) }
  const orderLink = () => { const u=new URL(window.location.origin); u.searchParams.set('s',sid); return u.toString() }

  const handleDelivery = async () => { setSavingDel(true); await api.setDelivery(sid, parseFloat(deliveryInput)||0); setSavingDel(false) }

  const handleSetDeadline = async () => {
    if (!deadlineInput) return
    const iso = new Date(deadlineInput).toISOString()
    await api.setDeadline(sid, iso)
    setDeadlineInput('')
  }
  const clearDeadline = () => api.setDeadline(sid, null)

  const saveExpected = async () => {
    const names = expectedInput.split('\n').map(n=>n.trim()).filter(Boolean)
    await api.setExpected(sid, names)
    setShowExpected(false)
  }

  const handleReset = async () => {
    await api.resetSession(sid)
    setSid(''); setAllOrders({}); setDelivery(0); setDeliveryInput(''); setStatus('open')
    const url = new URL(window.location.href); url.searchParams.delete('s')
    window.history.replaceState({}, '', url); setConfirmReset(false)
  }

  const saveEditOrder = async () => {
    if (!editOrder) return
    await api.patchLines(sid, editOrder.uid, editOrder.lines)
    setEditOrder(null)
  }

  const saveBreadSettings = async (newList) => {
    setBreadTypes(newList)
    await api.updateSettings('bread_types', newList)
  }

  const addBreadType = () => {
    if (!newBread.ar.trim()) return
    const id = newBread.ar.toLowerCase().replace(/\s+/g, '_')
    const newList = [...breadTypes, { ...newBread, id, light: newBread.color + '11' }]
    saveBreadSettings(newList)
    setNewBread({ ar: '', color: '#B83A0A' })
  }

  const removeBreadType = (id) => {
    const newList = breadTypes.filter(b => b.id !== id)
    saveBreadSettings(newList)
  }

  const orders    = Object.entries(allOrders).sort(([,a],[,b]) => a.submittedAt - b.submittedAt)
  const numPeople = orders.length
  const perPerson = numPeople > 0 ? delivery / numPeople : 0

  const orderedNames  = new Set(orders.map(([,o]) => o.name))
  const missingMembers = expected.filter(n => !orderedNames.has(n))

  const shareWhatsApp = () => {
    const text = buildWhatsAppText(allOrders, delivery, sid)
    window.open(getWhatsAppLink(text), '_blank')
  }

  if (!sid) return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24 }} className="animate-fade-in">
      <div style={{ width:'100%', maxWidth:400 }} className="glass-card">
        <div style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ width:80, height:80, borderRadius:24, background:C.gradAdmin, display:'flex', alignItems:'center', justifyContent:'center', margin: '0 auto 24px', boxShadow:'0 10px 25px rgba(16,185,129,0.3)', color: '#FFF' }}>
             <ShieldCheck size={40} />
          </div>
          <h1 style={{ fontSize:26, fontWeight:900, color:C.dark, marginBottom: 8 }}>لوحة التحكم</h1>
          <input type="text" placeholder="الكود (مثلاً: ZH1INJ)"
            value={inputCode}
            onChange={e=>setInputCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''))}
            style={inpSt({textAlign:'center',fontSize:20,fontWeight:900,letterSpacing:4, marginBottom: 20})} autoFocus/>
          <Btn onClick={()=>inputCode.length>=4&&enterSid(inputCode)} color={C.gradAdmin} style={{ width:'100%', height: 56 }}>
            متابعة اللوحة <ArrowLeft size={20} style={{ marginRight: 8 }}/>
          </Btn>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', paddingBottom:60 }} className="animate-fade-in">
      <div className="glass-header" style={{ padding:'16px 18px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:18, fontWeight:900, color:C.dark, display:'flex', alignItems:'center', gap:8 }}>
              <ShieldCheck size={20} color={C.green}/> لوحة التحكم <span className="live-indicator"></span>
            </div>
            <div style={{ fontSize:12, color:C.muted, fontWeight:700, marginTop:2 }}>{status==='complete' ? '✅ الطلب مكتمل' : '🟢 يتم المتابعة حالياً'} · {sid}</div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
             <Btn onClick={shareWhatsApp} color="#25D366" style={{ padding: '0 16px', height: 40 }}>
              <MessageCircle size={18} style={{ marginLeft: 6 }}/> واتساب
            </Btn>
            <GhostBtn onClick={()=>setShowSettings(true)} style={{ padding: '8px 12px' }}><Settings size={18}/></GhostBtn>
            <GhostBtn onClick={()=>setShowQR(true)} style={{ padding: '8px 12px' }}><QrCode size={18}/></GhostBtn>
            <GhostBtn onClick={()=>copyText(orderLink(),'link')} style={{ padding: '8px 12px' }}>{copied==='link' ? <Check size={18} color={C.green}/> : <Copy size={18}/>}</GhostBtn>
          </div>
        </div>
      </div>

      <div style={{ padding:'24px', maxWidth: 1200, margin: '0 auto' }}>
        
        {/* Top Stats Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 24 }}>
          <div className="glass-card" style={{ padding: 20, textAlign: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.muted, marginBottom: 8 }}>عدد الأشخاص</div>
            <div style={{ fontSize: 32, fontWeight: 950, color: C.primary }}>{numPeople}</div>
          </div>
          <div className="glass-card" style={{ padding: 20, textAlign: 'center', background: C.grad, color: '#FFF' }}>
            <div style={{ fontSize: 13, fontWeight: 700, opacity: 0.8, marginBottom: 8 }}>إجمالي الحساب</div>
            <div style={{ fontSize: 32, fontWeight: 950 }}>{orders.reduce((s,[,o])=>s+(o.lines||[]).reduce((ss,l)=>ss+(l.price||0)*l.qty,0),0)+delivery} <span style={{ fontSize: 14 }}>ج</span></div>
          </div>
          <div className="glass-card" style={{ padding: 20, textAlign: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.muted, marginBottom: 8 }}>التوصيل لكل فرد</div>
            <div style={{ fontSize: 32, fontWeight: 950, color: C.green }}>{fmt(perPerson)} <span style={{ fontSize: 14 }}>ج</span></div>
          </div>
        </div>

        {/* Action Row */}
        <div style={{ display:'flex', gap: 12, marginBottom: 24 }}>
            {status==='open'
              ? <Btn onClick={()=>api.complete(sid)} color={C.gradAdmin} style={{ flex: 1, height: 50 }}><CheckCircle size={18} style={{ marginLeft: 8 }}/> تسليم الطلب</Btn>
              : <Btn onClick={()=>api.reopen(sid)} color={C.accent} style={{ flex: 1, height: 50 }}><RotateCcw size={18} style={{ marginLeft: 8 }}/> إعادة فتح</Btn>}
            <Btn onClick={()=>window.print()} color={C.dark} style={{ flex: 1, height: 50 }}><Printer size={18} style={{ marginLeft: 8 }}/> طباعة الملخص</Btn>
            <GhostBtn onClick={()=>setConfirmReset(true)} color={C.red} style={{ height: 50, padding: '0 20px' }}><Trash2 size={18}/></GhostBtn>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 24, alignItems: 'start' }}>
          
          {/* Main Column: Orders */}
          <div>
             <div style={{ fontSize:16, fontWeight:900, color:C.dark, marginBottom:16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>📋 قائمة الطلبات</span>
            </div>
            {orders.length === 0 ? (
              <div className="glass-card" style={{ textAlign:'center', padding:'60px 0' }}>
                <div style={{ fontSize:48, marginBottom:16 }}>🍩</div>
                <p style={{ fontSize:15, fontWeight:700, color:C.muted }}>لسه مفيش حد طلب حاجة</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: 16 }}>
                {orders.map(([uid, o]) => (
                  <div key={uid} className="glass-card" style={{ overflow:'hidden' }}>
                    <div style={{ padding:'12px 16px', background:`${C.primary}05`, display:'flex', alignItems:'center', gap:10, borderBottom:`1px solid var(--border)` }}>
                      <div style={{ width:36, height:36, borderRadius:10, background:C.grad, color:'#FFF', fontWeight:900, fontSize:14, display:'flex', alignItems:'center', justifyContent:'center' }}>{o.name[0]}</div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:15, fontWeight:900, color:C.dark }}>{o.name}</div>
                        <div style={{ fontSize:10, color:C.muted, fontWeight: 700 }}>🕐 {formatTime(o.submittedAt)}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={()=>setEditOrder({uid,name:o.name,lines:[...(o.lines||[])]})} style={{ width: 30, height: 30, borderRadius: 8, background: C.tag, border: 'none', color: C.primary, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Edit3 size={14}/>
                        </button>
                        <button onClick={()=>api.deleteOrder(sid,uid)} style={{ width: 30, height: 30, borderRadius: 8, background: C.redLight, border: 'none', color: C.red, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Trash2 size={14}/>
                        </button>
                      </div>
                    </div>
                    <div style={{ padding: '12px 16px' }}>
                      {(o.lines||[]).map((l,i) => (
                        <div key={i} style={{ display:'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <div style={{ fontSize:13, fontWeight:700 }}>
                            {l.iname} <span style={{ color: C.muted, marginRight: 4 }}>×{l.qty}</span>
                            {o.notes?.[l.key] && <div style={{ fontSize:10, color:'#92400E', background:'#FEF9C3', borderRadius:6, padding:'1px 6px', marginTop:2 }}>📝 {o.notes[l.key]}</div>}
                          </div>
                          <span style={{ fontSize:13, fontWeight:800 }}>{l.price * l.qty} ج</span>
                        </div>
                      ))}
                      <div style={{ borderTop: `1px dashed var(--border)`, marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: C.muted }}>الإجمالي مع التوصيل</span>
                        <span style={{ fontSize: 16, fontWeight: 950, color: C.primary }}>{fmt((o.lines||[]).reduce((s,l)=>s+(l.price||0)*l.qty,0)+perPerson)} ج</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Controls & Totals */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Missing members */}
            <div className="glass-card" style={{ padding:'16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                 <div style={{ fontSize:14, fontWeight:900, color:C.dark, display:'flex', alignItems:'center', gap:6 }}>
                  <Users size={16} color={C.purple}/> لسه ماطلبش
                </div>
                <GhostBtn onClick={()=>{setExpectedInput(expected.join('\n'));setShowExpected(true)}} style={{ padding: '4px 8px', height: 28, fontSize: 11 }}>تعديل</GhostBtn>
              </div>
              {expected.length === 0 ? <p style={{ fontSize: 12, color: C.muted, textAlign: 'center' }}>لا توجد قائمة</p> : 
               missingMembers.length === 0 ? <div style={{ color: C.green, textAlign: 'center', fontWeight:800, fontSize: 13 }}>🎉 كلو طلب!</div> :
               <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>{missingMembers.map(n => <div key={n} style={{ background:'#FEF3C7', color:'#92400E', borderRadius:8, padding:'4px 10px', fontSize:12, fontWeight:800 }}>{n}</div>)}</div>}
            </div>

            {/* Timer */}
            <div className="glass-card" style={{ padding:'16px' }}>
              <div style={{ fontSize:14, fontWeight:900, color:C.dark, marginBottom:12, display:'flex', alignItems:'center', gap:6 }}>
                <Clock size={16} color={C.accent}/> المؤقت
              </div>
              {deadline ? (
                <div><Countdown deadline={deadline} /> <GhostBtn onClick={clearDeadline} color={C.red} style={{ width:'100%', marginTop: 8, height: 36 }}>إلغاء</GhostBtn></div>
              ) : (
                <div style={{ display:'flex', gap:8 }}>
                  <input type="datetime-local" value={deadlineInput} onChange={e=>setDeadlineInput(e.target.value)} style={inpSt({flex:1,fontSize:12})}/>
                  <Btn onClick={handleSetDeadline} disabled={!deadlineInput} style={{ padding:'0 12px', height: 36 }}>تفعيل</Btn>
                </div>
              )}
            </div>

            {/* Delivery */}
            <div className="glass-card" style={{ padding:'16px' }}>
              <div style={{ fontSize:14, fontWeight:900, color:C.dark, marginBottom:12, display:'flex', alignItems:'center', gap:6 }}>
                <Truck size={16} color={C.primary}/> التوصيل
              </div>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <input type="number" placeholder="0" value={deliveryInput} onChange={e=>setDeliveryInput(e.target.value)} style={inpSt({flex:1,fontSize:16,fontWeight:800,textAlign:'center'})}/>
                <Btn onClick={handleDelivery} loading={savingDel} style={{ padding:'0 16px', height: 40 }}>حفظ</Btn>
              </div>
            </div>

            <div style={{ fontSize:15, fontWeight:900, color:C.dark, marginTop: 12 }}>📊 الملخص المجمع</div>
            <CombinedTotals allOrders={allOrders}/>
          </div>

        </div>
      </div>

      {/* Modals */}
      {showQR && <QRModal url={orderLink()} onClose={()=>setShowQR(false)}/>}
      {showExpected && (
        <Modal title="قائمة الأشخاص" onClose={()=>setShowExpected(false)}>
          <textarea value={expectedInput} onChange={e=>setExpectedInput(e.target.value)} placeholder="اسم في كل سطر" style={{ ...inpSt({ direction:'rtl' }), height:140, marginBottom:16 }}/>
          <Btn onClick={saveExpected} style={{ width:'100%' }}>حفظ القائمة</Btn>
        </Modal>
      )}
      {confirmReset && (
        <Modal title="تنبيه: مسح الجلسة" onClose={()=>setConfirmReset(false)}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ color:C.muted, fontSize:14, marginBottom:20 }}>هل أنت متأكد من مسح الجلسة؟</p>
            <div style={{ display:'flex', gap:10 }}><GhostBtn onClick={()=>setConfirmReset(false)} style={{ flex:1 }}>إلغاء</GhostBtn><Btn onClick={handleReset} style={{ flex:1, background: C.red }}>نعم، امسح</Btn></div>
          </div>
        </Modal>
      )}
      {editOrder && (
        <Modal title={`تعديل طلب ${editOrder.name}`} onClose={()=>setEditOrder(null)} wide>
           {editOrder.lines.map((l,i) => (
             <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 0', borderBottom:`1px solid ${C.border}` }}>
               <div style={{ flex:1 }}><div style={{ fontSize:14, fontWeight:700 }}>{l.iname}</div></div>
               <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                 <button onClick={()=>setEditOrder(p=>({...p,lines:p.lines.map((x,j)=>j!==i?x:x.qty<=1?null:{...x,qty:x.qty-1}).filter(Boolean)}))} style={{ width:24,height:24,borderRadius:6,border:'none',background:C.tag }}>−</button>
                 <span style={{ fontSize:14, fontWeight:900 }}>{l.qty}</span>
                 <button onClick={()=>setEditOrder(p=>({...p,lines:p.lines.map((x,j)=>j!==i?x:{...x,qty:x.qty+1})}))} style={{ width:24,height:24,borderRadius:6,border:'none',background:C.primary,color:'#FFF' }}>+</button>
               </div>
             </div>
           ))}
           <Btn onClick={saveEditOrder} style={{ width:'100%', marginTop:16 }}>حفظ</Btn>
        </Modal>
      )}
      {showSettings && (
        <Modal title="إعدادات أنواع العيش" onClose={()=>setShowSettings(false)}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 8, fontWeight: 700 }}>الأنواع الموجودة:</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {breadTypes.map(b => (
                <div key={b.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: C.tag, padding: '8px 12px', borderRadius: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 12, height: 12, borderRadius: 6, background: b.color }}></div>
                    <span style={{ fontWeight: 800, fontSize: 14 }}>{b.ar}</span>
                  </div>
                  <button onClick={() => removeBreadType(b.id)} style={{ border: 'none', background: 'none', color: C.red, cursor: 'pointer', padding: 4 }}>
                    <Trash2 size={16}/>
                  </button>
                </div>
              ))}
            </div>
          </div>
          
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 20 }}>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 12, fontWeight: 700 }}>أضف نوع جديد:</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
               <input type="text" placeholder="مثلاً: عيش فينو" value={newBread.ar} 
                 onChange={e => setNewBread(p => ({ ...p, ar: e.target.value }))}
                 style={{ ...inpSt({ flex: 1 }), height: 44 }} />
               <input type="color" value={newBread.color} 
                 onChange={e => setNewBread(p => ({ ...p, color: e.target.value }))}
                 style={{ width: 44, height: 44, padding: 0, border: 'none', borderRadius: 12, overflow: 'hidden', cursor: 'pointer' }} />
            </div>
            <Btn onClick={addBreadType} style={{ width: '100%', height: 44 }}>+ إضافة النوع</Btn>
          </div>
        </Modal>
      )}
    </div>
  )
}
