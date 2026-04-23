import { useState } from 'react'
import { Copy, Check, Eye, Users, RefreshCw, CheckCircle2, ArrowRight } from 'lucide-react'
import { C, FONT } from '../constants/colors.js'
import { BREAD } from '../constants/data.js'
import { Btn, GhostBtn } from '../components/Btn.jsx'

export default function SubmittedScreen({ sessionId, userName, allOrders, sessStatus, myOrder, onGoSummary, onEditOrder }) {
  const [copied, setCopied] = useState('')

  const orderLink = () => { const u = new URL(window.location.origin); u.searchParams.set('s', sessionId); return u.toString() }
  const adminLink = () => { const u = new URL(window.location.origin); u.searchParams.set('s', sessionId); u.searchParams.set('admin', '1'); return u.toString() }
  
  const copyText = (text, key) => {
    navigator.clipboard?.writeText(text)
    setCopied(key); setTimeout(() => setCopied(''), 2500)
  }

  const orders   = Object.values(allOrders)
  const isLocked = sessStatus === 'complete'

  return (
    <div style={{ minHeight:'100vh', paddingBottom:50 }} className="animate-fade-in">
      {/* Success Header */}
      <div style={{ background:C.gradAdmin, padding:'60px 24px 40px', textAlign:'center', borderRadius: '0 0 32px 32px', boxShadow: '0 10px 30px rgba(16,185,129,0.2)', color: '#FFF' }}>
        <div style={{ background: 'rgba(255,255,255,0.2)', width: 80, height: 80, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <CheckCircle2 size={48} />
        </div>
        <h1 style={{ fontSize:28, fontWeight:950, marginBottom: 8 }}>تم استلام طلبك!</h1>
        <p style={{ fontSize:15, color:'rgba(255,255,255,0.9)', fontWeight:600 }}>طلب {userName} اتسجل بنجاح ✓</p>
      </div>

      <div style={{ padding:'24px 18px', maxWidth: 900, margin:'0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 24, alignItems: 'start' }}>
          
          <div>
            {/* Your Order Summary */}
            {myOrder && (
              <div className="glass-card" style={{ padding: 0, marginBottom: 20, overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', background: `${C.primary}08`, borderBottom: `1px solid var(--border)`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 15, fontWeight: 900, color: C.dark }}>🧾 تفاصيل طلبك</span>
                  <span style={{ fontSize: 13, color: C.primary, fontWeight: 800 }}>{(myOrder.lines||[]).reduce((s,l)=>s+l.qty,0)} صنف</span>
                </div>
                
                <div style={{ padding: '10px 0' }}>
                  {(myOrder.lines||[]).map((l, i) => (
                    <div key={i} style={{ display:'flex', alignItems:'center', padding:'10px 20px', borderBottom: i < (myOrder.lines||[]).length - 1 ? `1px solid var(--border)` : 'none' }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:14, fontWeight:800, color:C.dark }}>{l.iname}</div>
                        <div style={{ fontSize:11, color:C.muted, fontWeight: 700 }}>{l.rname} {l.bt && `· ${BREAD.find(x=>x.id===l.bt)?.ar}`}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                         <div style={{ fontSize:14, fontWeight:900, color:C.dark }}>×{l.qty}</div>
                         {l.price > 0 && <div style={{ fontSize:11, color:C.muted }}>{l.price * l.qty} ج</div>}
                      </div>
                    </div>
                  ))}
                </div>
                
                <div style={{ padding: '16px 20px', background: C.tag, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                   <span style={{ fontSize: 13, fontWeight: 800, color: C.muted }}>إجمالي المنيو</span>
                   <span style={{ fontSize: 18, fontWeight: 950, color: C.primary }}>{(myOrder.lines||[]).reduce((s,l)=>s+(l.price||0)*l.qty,0)} ج</span>
                </div>
              </div>
            )}

            {!isLocked ? (
              <GhostBtn onClick={onEditOrder} style={{ width:'100%', height: 50, marginBottom: 24 }}>
                <RefreshCw size={16} style={{ marginLeft: 8 }}/> تعديل بيانات طلبك
              </GhostBtn>
            ) : (
              <div style={{ background:C.redLight, color:C.red, borderRadius:16, padding:'14px', fontSize:14, fontWeight:800, textAlign:'center', marginBottom: 24, border: `1.5px solid ${C.red}22` }}>
                🔒 انتهى وقت التعديل (الطلب تم تسليمه)
              </div>
            )}
            
            <Btn onClick={onGoSummary} style={{ width:'100%', height: 54 }}>
              شاهد ملخص الحسابات للكل <ArrowRight size={20} style={{ marginRight: 8 }}/>
            </Btn>
          </div>

          <div>
            {/* Sharing Cards */}
            <div className="glass-card" style={{ padding: 20, marginBottom: 16 }}>
               <div style={{ fontSize:13, fontWeight:800, color:C.muted, marginBottom:12, display: 'flex', alignItems: 'center', gap: 6 }}>
                 <Users size={16}/> ابعت الرابط لزمايلك عشان يطلبوا
               </div>
               <div style={{ background:C.tag, borderRadius:12, padding:'12px', fontSize:11, color:C.muted, wordBreak:'break-all', marginBottom:12, fontWeight: 600, textAlign: 'center' }}>{orderLink()}</div>
               <Btn onClick={() => copyText(orderLink(), 'order')} style={{ width: '100%', background: copied === 'order' ? C.gradGreen : C.grad }}>
                  {copied === 'order' ? <Check size={18}/> : <Copy size={18}/>}
                  <span style={{ marginRight: 8 }}>{copied === 'order' ? 'تم النسخ!' : 'نسخ رابط الجروب'}</span>
               </Btn>
            </div>

            <div className="glass-card" style={{ padding: 18, marginBottom: 24, background: C.purpleLight, border: `1.5px solid ${C.purple}22` }}>
               <div style={{ fontSize:12, fontWeight:800, color:C.purple, marginBottom:12 }}>⚠️ رابط الأدمن (للمسؤول فقط)</div>
               <Btn onClick={() => copyText(adminLink(), 'admin')} style={{ width: '100%', background: copied === 'admin' ? C.green : C.purple }}>
                  <Eye size={18}/>
                  <span style={{ marginRight: 8 }}>{copied === 'admin' ? 'تم النسخ!' : 'نسخ رابط الإدارة'}</span>
               </Btn>
            </div>

            {/* Live Status Bar */}
            <div style={{ background: C.tag, borderRadius: 16, padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="live-indicator"></div>
                  <span style={{ fontSize: 14, fontWeight: 800 }}>حالة الجروب الآن</span>
               </div>
               <div style={{ fontSize: 20, fontWeight: 950, color: C.primary }}>{orders.length} طلبات</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {orders.slice(0, 5).map((o, i) => (
                 <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding: '10px 4px' }}>
                    <div style={{ width:34, height:34, borderRadius:10, background: o.name===userName ? C.primary : C.tag, color: o.name===userName ? '#FFF' : C.primary, fontSize:14, fontWeight:900, display:'flex', alignItems:'center', justifyContent:'center' }}>{o.name[0]}</div>
                    <span style={{ flex:1, fontSize:14, fontWeight:700, color:C.dark }}>{o.name} {o.name===userName && <span style={{ color: C.muted }}>(أنت)</span>}</span>
                    <span style={{ color: C.green }}><CheckCircle2 size={16}/></span>
                 </div>
              ))}
              {orders.length > 5 && <div style={{ fontSize: 12, color: C.muted, textAlign: 'center', fontWeight: 700 }}>+ {orders.length - 5} أشخاص آخرين</div>}
            </div>
          </div>

        </div>
      </div>

    </div>
  )
}
