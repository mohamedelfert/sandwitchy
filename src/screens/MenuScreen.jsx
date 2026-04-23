import { useState } from 'react'
import { ChevronLeft, PenLine, Truck, MessageSquare, Plus, Minus, X } from 'lucide-react'
import { C, FONT } from '../constants/colors.js'
import { BREAD } from '../constants/data.js'
import { inpSt } from '../utils/helpers.js'
import Modal from '../components/Modal.jsx'
import { Btn } from '../components/Btn.jsx'

// Inline Note Input Component
const InlineNote = ({ value, onChange, FONT }) => {
  return (
    <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }} className="animate-slide-down">
      <div style={{ color: C.muted, flexShrink: 0 }}><MessageSquare size={12}/></div>
      <input 
        type="text" 
        placeholder="ملاحظة: بدون بصل، زيادة صوص..." 
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ 
          flex: 1, border: 'none', background: 'rgba(0,0,0,0.03)', 
          borderRadius: 8, padding: '6px 12px', fontSize: 11, 
          fontFamily: FONT, outline: 'none', 
          borderBottom: `2px solid transparent`,
          transition: 'all 0.2s'
        }}
        onFocus={e => e.target.style.borderBottomColor = C.primary}
        onBlur={e => e.target.style.borderBottomColor = 'transparent'}
      />
      {value && <button onClick={() => onChange('')} style={{ border: 'none', background: 'none', color: C.red, cursor: 'pointer', padding: 4 }}><X size={12}/></button>}
    </div>
  )
}

export default function MenuScreen({ activeRest, lines, notes, totalItems, breadTypes, onBack, onAddL, onSubL, onUpdatePrice, onAddItem, onSetNote }) {
  const [addItemOpen,  setAddItemOpen]  = useState(false)
  const [nItem,        setNItem]        = useState({ name:'', price:'' })
  const [editingPrice, setEditingPrice] = useState(null)
  
  // Use dynamic breadTypes if available, otherwise fallback to static BREAD
  const activeBreadList = breadTypes && breadTypes.length > 0 ? breadTypes : BREAD
  const [activeB,      setActiveB]      = useState(activeBreadList[0].id)

  const lKey   = (r, i, b) => `${r}_${i}_${b||'none'}`
  const lQty   = (r, i, b) => lines.find(l => l.key === lKey(r, i, b))?.qty || 0
  const lTotal = (r, i)    => activeBreadList.reduce((s, b) => s + lQty(r, i, b.id), 0)

  const doAddItem = () => {
    if (!nItem.name.trim()) return
    onAddItem(activeRest.id, { id:`i${Date.now()}`, name:nItem.name, price:parseFloat(nItem.price)||0 })
    setNItem({ name:'', price:'' }); setAddItemOpen(false)
  }

  const doUpdatePrice = (restId, itemId, val) => {
    const p = parseFloat(val)
    if (!isNaN(p) && p >= 0) onUpdatePrice(restId, itemId, p)
    setEditingPrice(null)
  }

  const currentBread = activeBreadList.find(b => b.id === activeB) || activeBreadList[0]

  return (
    <div style={{ minHeight:'100vh', paddingBottom:totalItems>0?100:40 }} className="animate-fade-in">
      {/* Header */}
      <div className="glass-header" style={{ padding:'16px 18px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:110 }}>
        <button onClick={onBack} style={{ background:C.primaryLight, border:'none', borderRadius:'12px', width:38, height:38, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color: C.primary }}>
          <ChevronLeft size={22}/>
        </button>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:18, fontWeight:900, color:C.dark }}>{activeRest.name}</div>
          <div style={{ fontSize:12, color:C.muted, fontWeight:600 }}>
            {activeRest.hasBread ? 'اختار العيش والطلب' : 'أضف طلبك مـباشرة'}
          </div>
        </div>
        <button onClick={() => setAddItemOpen(true)} style={{ background:C.gradAdmin, border:'none', borderRadius:12, padding:'8px 12px', cursor:'pointer', display:'flex', alignItems:'center', gap:5, color:'#FFF', fontWeight:700, fontSize:12 }}>
          <Plus size={14}/>
          صنف
        </button>
      </div>

      <div style={{ padding:'0 18px 20px' }}>
        {activeRest.delivery>0 && (
          <div style={{ marginTop: 20, marginBottom: 20, background: C.primaryLight, borderRadius: 16, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Truck size={18} color={C.primary}/>
            <span style={{ fontSize: 14, color: C.primary, fontWeight: 700 }}>توصيل المطعم: {activeRest.delivery} ج</span>
          </div>
        )}

        {/* Bread Selection Tabs - Sticky */}
        {activeRest.hasBread && (
          <div style={{ position:'sticky', top:70, zIndex:100, background:'rgba(255,255,255,0.9)', backdropFilter:'blur(10px)', padding:'15px 0', margin:'0 -18px', display:'flex', justifyContent:'center', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
            <div style={{ display:'flex', background: 'rgba(0,0,0,0.05)', borderRadius: 16, padding: 4, gap: 4 }}>
              {activeBreadList.map(b => (
                <button 
                  key={b.id} 
                  onClick={() => setActiveB(b.id)}
                  style={{
                    border: 'none', borderRadius: 12, padding: '8px 16px', fontSize: 13, fontWeight: 800, cursor: 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    background: activeB === b.id ? b.color : 'transparent',
                    color: activeB === b.id ? '#FFF' : C.muted,
                    boxShadow: activeB === b.id ? `0 4px 12px ${b.color}44` : 'none'
                  }}
                >
                  {b.ar}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginTop: activeRest.hasBread ? 10 : 20 }}>
          {activeRest.items.length===0 && (
            <div style={{ textAlign:'center', padding:'60px 0', opacity: 0.5 }}>
              <div style={{ fontSize:50, marginBottom:16 }}>🥪</div>
              <div style={{ fontSize:15, fontWeight:700 }}>المطعم لسه معليهوش أصناف</div>
              <div style={{ fontSize:13 }}>تقدر تضيف أصناف من فوق</div>
            </div>
          )}

          {activeRest.items.map(item => {
            const t = activeRest.hasBread ? lTotal(activeRest.id, item.id) : lQty(activeRest.id, item.id, null)
            const q = activeRest.hasBread ? lQty(activeRest.id, item.id, activeB) : t
            const key = lKey(activeRest.id, item.id, activeRest.hasBread ? activeB : null)
            
            return (
              <div key={item.id} className="glass-card" 
                style={{ 
                  marginBottom:16, padding: '16px', 
                  border: t>0 ? `1.5px solid ${activeRest.hasBread ? currentBread.color : C.primary}33` : '1px solid var(--glass-border)',
                  background: t>0 ? `${activeRest.hasBread ? currentBread.color : C.primary}05` : 'transparent'
                }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ fontSize:17, fontWeight:950, color:C.dark }}>{item.name}</div>
                      {t > 0 && (
                        <div style={{ 
                          background: activeRest.hasBread ? currentBread.color : C.primary, 
                          color: '#FFF', fontSize: 10, fontWeight: 900, height: 20, padding: '0 8px', 
                          borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                          {t} طلب
                        </div>
                      )}
                    </div>
                    
                    {editingPrice?.restId===activeRest.id && editingPrice?.itemId===item.id ? (
                      <input type="number" autoFocus defaultValue={item.price} min="0"
                        onBlur={e=>doUpdatePrice(activeRest.id,item.id,e.target.value)}
                        style={inpSt({ width:80, padding: '4px 8px', marginTop: 6 })}/>
                    ) : (
                      <div onClick={()=>setEditingPrice({restId:activeRest.id,itemId:item.id})}
                        style={{ fontSize:12, color:C.muted, marginTop:6, cursor:'pointer', display:'inline-flex', alignItems:'center', gap:4, fontWeight:600 }}>
                        {item.price>0?`${item.price} ج`:'أضف سعر'}<PenLine size={10}/>
                      </div>
                    )}
                  </div>

                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <button onClick={()=>onSubL(activeRest,item,activeRest.hasBread?activeB:null)} disabled={q===0}
                      style={{ 
                        width:32, height:32, borderRadius:12, border:'none', 
                        background:q>0 ? (activeRest.hasBread ? currentBread.light : C.primaryLight) : C.tag, 
                        color:q>0 ? (activeRest.hasBread ? currentBread.color : C.primary) : C.muted, 
                        cursor:q>0?'pointer':'default', display:'flex', alignItems:'center', justifyContent:'center', transition: 'all 0.2s' 
                      }}>
                      <Minus size={18}/>
                    </button>
                    <span style={{ fontSize:20, fontWeight:950, minWidth:26, textAlign:'center', color:q>0 ? (activeRest.hasBread ? currentBread.color : C.dark) : C.dark }}>{q}</span>
                    <button onClick={()=>onAddL(activeRest,item,activeRest.hasBread?activeB:null)}
                      style={{ 
                        width:32, height:32, borderRadius:12, border:'none', 
                        background: activeRest.hasBread ? currentBread.color : C.primary, 
                        color:'#FFF', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', 
                        boxShadow: `0 4px 10px ${activeRest.hasBread ? currentBread.color : C.primary}44` 
                      }}>
                      <Plus size={18}/>
                    </button>
                  </div>
                </div>

                {q > 0 && <InlineNote value={notes[key] || ''} onChange={v => onSetNote(key, v)} FONT={FONT} />}
              </div>
            )
          })}
        </div>
      </div>

      {/* Floating Action Bar */}
      {totalItems>0 && (
        <div style={{ position:'fixed', bottom:20, left:20, right:20, zIndex:200 }} className="animate-fade-in">
          <div className="glass-card" style={{ padding:'12px', display:'flex', gap:12, alignItems:'center', background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)', border: `1px solid ${C.primary}33`, boxShadow: '0 10px 40px rgba(0,0,0,0.1)' }}>
            <div style={{ background:C.primary, borderRadius:14, padding:'12px 24px', display:'flex', alignItems:'center', gap:10, color: '#FFF' }}>
              <span style={{ fontSize:24, fontWeight:950 }}>{totalItems}</span>
              <span style={{ fontSize:14, fontWeight:700 }}>صنف</span>
            </div>
            <Btn onClick={onBack} style={{ flex:1, height:54, borderRadius: 14 }}>
              استكمال الطلب ←
            </Btn>
          </div>
        </div>
      )}

      {/* Add item modal */}
      {addItemOpen && (
        <Modal title={`إضافة صنف لـ ${activeRest.name}`} onClose={()=>setAddItemOpen(false)}>
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:13, color:C.muted, marginBottom:6, fontWeight:700 }}>اسم الصنف</div>
            <input type="text" placeholder="مثال: طعمية مخصوص" value={nItem.name}
              onChange={e=>setNItem(n=>({...n,name:e.target.value}))}
              onKeyDown={e=>e.key==='Enter'&&doAddItem()}
              style={inpSt({ direction: 'rtl' })} autoFocus/>
          </div>
          <div style={{ marginBottom:24 }}>
            <div style={{ fontSize:13, color:C.muted, marginBottom:6, fontWeight:700 }}>السعر (اختياري)</div>
            <input type="number" placeholder="0" min="0" value={nItem.price}
              onChange={e=>setNItem(n=>({...n,price:e.target.value}))} style={inpSt()}/>
          </div>
          <Btn onClick={doAddItem} style={{ width:'100%' }}>+ أضف للمنيو</Btn>
        </Modal>
      )}
    </div>
  )
}
