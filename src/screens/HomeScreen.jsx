import { useState } from 'react'
import { Plus, Copy, Check, Users, ShoppingBag, Coffee, ArrowRight, X } from 'lucide-react'
import { C, FONT } from '../constants/colors.js'
import { DRINKS, EMOJIS } from '../constants/data.js'
import { inpSt } from '../utils/helpers.js'
import Modal from '../components/Modal.jsx'
import { Btn, GhostBtn } from '../components/Btn.jsx'
import Countdown from '../components/Countdown.jsx'

export default function HomeScreen({ userName, sessionId, rests, setRests, lines, drinks, allOrders, isEditing, deadline, sessStatus, onGoMenu, onSubmit, submitting, submitError, onDrinkAdd, onDrinkSub, onCancelEdit }) {
  const [copied,      setCopied]      = useState('')
  const [addRestOpen, setAddRestOpen] = useState(false)
  const [nRest,       setNRest]       = useState({ name:'', emoji:'🥙', hasBread:true, delivery:'' })

  const totalItems  = lines.reduce((s,l) => s+l.qty, 0)
  const totalDrinks = Object.values(drinks).reduce((s,q) => s+q, 0)
  const hasAnything = lines.length > 0 || totalDrinks > 0
  const isExpired   = deadline && new Date(deadline) < new Date()

  const orderLink = () => { const u=new URL(window.location.origin); u.searchParams.set('s',sessionId); return u.toString() }
  const copyText = (text,key) => { navigator.clipboard?.writeText(text); setCopied(key); setTimeout(()=>setCopied(''),2500) }

  const doAddRest = () => {
    if (!nRest.name.trim()) return
    const BGS=['#FFF4E8','#E8F5EE','#FFF0E8','#FFFAE8','#F0E8FF','#E8F0FF']
    setRests(r=>[...r,{id:Date.now(),...nRest,delivery:parseFloat(nRest.delivery)||0,bg:BGS[r.length%BGS.length],items:[]}])
    setNRest({name:'',emoji:'🥙',hasBread:true,delivery:''}); setAddRestOpen(false)
  }

  return (
    <div style={{ minHeight:'100vh', paddingBottom:(hasAnything||isEditing)?120:40 }} className="animate-fade-in">
      {/* Premium Header */}
      <div className="glass-header" style={{ padding:'16px 18px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
          <div style={{ fontSize:22, fontWeight:950, color:C.dark, letterSpacing:-0.5 }}>ساندوتشي</div>
          <GhostBtn onClick={()=>copyText(orderLink(),'link')} style={{ padding:'8px 14px', borderRadius: 12 }}>
            {copied==='link'?<Check size={16} color={C.green}/>:<Copy size={16}/>}
            <span style={{ fontSize:13, fontWeight:700 }}>{copied==='link'?'تم النسخ!':'شارك الرابط'}</span>
          </GhostBtn>
        </div>
        
        <div style={{ background: C.grad, borderRadius:16, padding:'12px 16px', display:'flex', alignItems:'center', gap:12, boxShadow: '0 8px 20px rgba(99,102,241,0.2)' }}>
          <div style={{ width:40, height:40, borderRadius:12, background:'rgba(255,255,255,0.2)', color:'#FFF', fontWeight:900, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>{userName[0]}</div>
          <div style={{ flex: 1 }}>
             <div style={{ fontSize:14, color:'#FFF', fontWeight:800 }}>يا أهلاً يا {userName}!</div>
             <div style={{ fontSize:11, color:'rgba(255,255,255,0.8)', fontWeight:600 }}>الجلسة: {sessionId}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
             <div style={{ fontSize:15, fontWeight:900, color:'#FFF' }}>{Object.keys(allOrders).length}</div>
             <div style={{ fontSize:10, color:'rgba(255,255,255,0.7)', fontWeight:700 }}>طلبوا</div>
          </div>
        </div>
      </div>

      <div style={{ padding:'20px 18px' }}>
        {deadline && <Countdown deadline={deadline} />}

        <div style={{ fontSize:16, fontWeight:900, color:C.dark, marginBottom:16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShoppingBag size={18} color={C.primary}/> اختار المطعم
        </div>
        
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:14 }}>
          {rests.map(r => {
            const cnt = lines.filter(l=>l.rid===r.id).reduce((s,l)=>s+l.qty,0)
            return (
              <div key={r.id} onClick={()=>!isExpired&&onGoMenu(r.id)}
                className="glass-card"
                style={{ 
                  padding:'20px 12px', cursor:isExpired?'not-allowed':'pointer', 
                  display:'flex', flexDirection:'column', alignItems:'center', gap:12, 
                  position:'relative', transition:'all 0.3s', 
                  opacity:isExpired?0.6:1,
                  border: cnt > 0 ? `2px solid ${C.primary}` : '1px solid var(--glass-border)',
                  background: cnt > 0 ? `${C.primary}05` : 'var(--glass)'
                }}
              >
                {cnt>0&&<div style={{ position:'absolute', top:-4, right:-4, background:C.grad, color:'#FFF', borderRadius:10, padding: '2px 8px', fontSize:12, fontWeight:900, boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>{cnt}</div>}
                <div style={{ width:60, height:60, borderRadius:18, background:r.bg, fontSize:32, display:'flex', alignItems:'center', justifyContent:'center', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>{r.emoji}</div>
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:15, fontWeight:900, color:C.dark, lineHeight:1.2 }}>{r.name}</div>
                  {r.delivery>0 && <div style={{ fontSize:11, color:C.green, fontWeight:800, marginTop:4 }}>🚗 {r.delivery} ج توصيل</div>}
                </div>
              </div>
            )
          })}
          <button onClick={()=>setAddRestOpen(true)}
            className="glass-card"
            style={{ 
              border:`2px dashed ${C.border}`, display:'flex', flexDirection:'column', 
              alignItems:'center', justifyContent:'center', gap:10, minHeight:150, 
              cursor:'pointer', background: 'transparent'
            }}
          >
            <div style={{ width:44, height:44, borderRadius:14, background:C.tag, display:'flex', alignItems:'center', justifyContent:'center', color: C.primary }}><Plus size={24}/></div>
            <div style={{ fontSize:13, fontWeight:800, color:C.primary }}>إضافة مطعم</div>
          </button>
        </div>

        {/* Drinks Section */}
        <div style={{ marginTop:32 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: C.greenLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Coffee size={20} color={C.green}/>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize:16, fontWeight:900, color:C.dark }}>مشاريب الشركة</div>
              <div style={{ fontSize:12, color:C.muted, fontWeight: 600 }}>مجاناً • اختار براحتك</div>
            </div>
            {totalDrinks > 0 && (
              <div style={{ background:C.green, color:'#FFF', borderRadius:12, padding:'4px 12px', fontSize:14, fontWeight:900 }}>{totalDrinks}</div>
            )}
          </div>
          
          <div className="glass-card" style={{ overflow:'hidden' }}>
            {DRINKS.map((d,idx) => {
              const q = drinks[d.id]||0
              return (
                <div key={d.id} style={{ display:'flex', alignItems:'center', padding:'14px 18px', background:q>0?`${C.green}05`:'transparent', borderBottom:idx<DRINKS.length-1?`1px solid var(--border)`:'none', transition:'all 0.2s' }}>
                  <span style={{ fontSize:24, marginLeft:14, flexShrink:0 }}>{d.emoji}</span>
                  <span style={{ fontSize:16, fontWeight:800, color:q>0?C.green:C.dark, flex:1 }}>{d.name}</span>
                  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                    {q>0&&<button onClick={()=>onDrinkSub(d.id)} style={{ width:32, height:32, borderRadius:10, border:'none', background:C.tag, color:C.muted, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>−</button>}
                    {q>0&&<span style={{ fontSize:18, fontWeight:900, color:C.green, minWidth:24, textAlign:'center' }}>{q}</span>}
                    <button onClick={()=>onDrinkAdd(d.id)} style={{ width:32, height:32, borderRadius:10, border:'none', background:q>0?C.green:C.tag, color:q>0?'#FFF':C.green, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>+</button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Modern Cart / Submit Bar */}
      {(hasAnything||isEditing) && (
        <div style={{ position:'fixed', bottom:24, left:20, right:20, zIndex:100 }} className="animate-fade-in">
          <div className="glass-card" style={{ padding:'12px', background: 'rgba(255,255,255,0.95)', border: `1.5px solid ${C.primary}22` }}>
            {isEditing && (
              <div style={{ background:C.accentLight, color:C.accent, borderRadius:12, padding:'8px', fontSize:12, fontWeight:800, marginBottom:10, textAlign:'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                ✏️ أنت الآن في وضع التعديل
              </div>
            )}
            
            <div style={{ display:'flex', gap:12 }}>
              <div style={{ background:C.primaryLight, borderRadius:16, padding:'0 16px', display:'flex', alignItems:'center', gap:10, border: `1px solid ${C.primary}33` }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize:18, fontWeight:900, color:C.primary }}>{totalItems + totalDrinks}</div>
                  <div style={{ fontSize:10, fontWeight:700, color:C.primary, marginTop: -2 }}>إجمالي</div>
                </div>
              </div>
              
              <Btn onClick={onSubmit} loading={submitting} disabled={!hasAnything||isExpired}
                style={{ flex:1, height: 56, background: isEditing ? C.accent : C.gradGreen }}>
                {isEditing ? 'حفظ التعديلات' : 'إرسال الطلب الآن'} <ArrowRight size={20} style={{ marginRight: 8 }}/>
              </Btn>

              {isEditing && (
                <button onClick={onCancelEdit} style={{ width: 56, height: 56, borderRadius: 16, background: C.tag, border: 'none', color: C.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={24}/>
                </button>
              )}
            </div>
            {submitError && <div style={{ color:C.red, fontSize:12, fontWeight:700, marginTop:10, textAlign:'center' }}>⚠️ {submitError}</div>}
          </div>
        </div>
      )}

      {/* Add Restaurant Modal */}
      {addRestOpen && (
        <Modal title="بشرى سارة! مطعم جديد" onClose={()=>setAddRestOpen(false)}>
          <div style={{ marginBottom:16 }}>
            <label style={{ fontSize:13, color:C.muted, marginBottom:10, fontWeight:700, display: 'block' }}>اسم المطعم</label>
            <input type="text" placeholder="مثلاً: فطاطري الهدى" value={nRest.name}
              onChange={e=>setNRest(n=>({...n,name:e.target.value}))} style={inpSt({ direction: 'rtl' })} autoFocus/>
          </div>
          
          <div style={{ marginBottom:20 }}>
            <label style={{ fontSize:13, color:C.muted, marginBottom:10, fontWeight:700, display: 'block' }}>اختار أيقونة</label>
            <div style={{ display:'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap:10 }}>
              {EMOJIS.map(em=>(
                <button key={em} onClick={()=>setNRest(n=>({...n,emoji:em}))} 
                  style={{ 
                    height:44, borderRadius:12, fontSize:22, cursor:'pointer', 
                    border:`2px solid ${nRest.emoji===em?C.primary:'transparent'}`, 
                    background:nRest.emoji===em?C.primaryLight:C.tag,
                    transition: 'all 0.2s'
                  }}>
                  {em}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom:24 }}>
             <label style={{ fontSize:13, color:C.muted, marginBottom:10, fontWeight:700, display: 'block' }}>مصاريف توصيل المطعم نفسه (إن وجدت)</label>
             <div style={{ position: 'relative' }}>
                <input type="number" placeholder="0" min="0" value={nRest.delivery}
                  onChange={e=>setNRest(n=>({...n,delivery:e.target.value}))} style={inpSt({ paddingRight: 40 })}/>
                <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 13, fontWeight: 700, color: C.muted }}>ج</span>
             </div>
          </div>

          <Btn onClick={doAddRest} style={{ width:'100%', height: 54 }}>
            + أضف المطعم للمجموعة
          </Btn>
        </Modal>
      )}
    </div>
  )
}
