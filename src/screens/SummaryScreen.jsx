import { useState } from 'react'
import { ChevronLeft, Share2, RefreshCw, Truck, MessageCircle, FileText, Download } from 'lucide-react'
import { C, FONT } from '../constants/colors.js'
import { fmt, inpSt, getWhatsAppLink } from '../utils/helpers.js'
import { generateMD, downloadMD } from '../utils/markdown.js'
import { api } from '../api/client.js'
import CombinedTotals from '../components/CombinedTotals.jsx'
import CostCard from '../components/CostCard.jsx'
import { Btn, GhostBtn } from '../components/Btn.jsx'

export default function SummaryScreen({ sessionId, allOrders, delivery, rests, sessStatus, onBack, onEditOrder }) {
  const [deliveryInput, setDeliveryInput] = useState(String(delivery || ''))
  const [savingDelivery, setSavingDelivery] = useState(false)

  const numPeople  = Object.keys(allOrders).length
  const perPerson  = numPeople > 0 ? delivery / numPeople : 0

  const handleSetDelivery = async () => {
    setSavingDelivery(true)
    const amt = parseFloat(deliveryInput) || 0
    await api.setDelivery(sessionId, amt)
    setSavingDelivery(false)
  }

  const shareWhatsApp = () => {
    let text = `*ملخص طلبات ساندوتشي* 🍽️\n`
    text    += `كود الجلسة: ${sessionId}\n`
    text    += `--------------------------\n`
    
    Object.values(allOrders).forEach(o => {
      text += `👤 *${o.name}*: `
      const linesTotal = (o.lines||[]).reduce((s,l) => s + (l.price||0)*l.qty, 0)
      const total = linesTotal + perPerson
      text += `${fmt(total)} ج\n`
      o.lines.forEach(l => {
        text += `• ${l.iname} ×${l.qty}${o.notes?.[l.key] ? ` (${o.notes[l.key]})`:''}\n`
      })
      text += `\n`
    })
    
    text += `🚗 التوصيل الإجمالي: ${delivery} ج\n`
    text += `👉 اطلب من هنا: ${window.location.origin}/?s=${sessionId}`
    
    window.open(getWhatsAppLink(text), '_blank')
  }

  return (
    <div style={{ minHeight:'100vh', paddingBottom:50 }} className="animate-fade-in">
      <div className="glass-header" style={{ padding:'16px 18px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <button onClick={onBack} style={{ background:C.primaryLight, border:'none', borderRadius:12, width:38, height:38, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color: C.primary }}>
          <ChevronLeft size={22}/>
        </button>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:18, fontWeight:900, color:C.dark }}>ملخص الطلبات</div>
          <div style={{ fontSize:12, color:C.muted, fontWeight:600 }}>{numPeople} شخص شارك</div>
        </div>
        <div style={{ width:38 }}/>
      </div>

      <div style={{ padding:'20px 18px' }}>
        {/* Delivery input */}
        <div className="glass-card" style={{ padding:'18px', marginBottom:20 }}>
          <div style={{ fontSize:14, fontWeight:900, color:C.dark, marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>
            <Truck size={18} color={C.primary}/> مصاريف التوصيل الإضافية
          </div>
          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
            <div style={{ flex: 1, position: 'relative' }}>
               <input type="number" placeholder="0" min="0" value={deliveryInput}
                onChange={e => setDeliveryInput(e.target.value)}
                style={inpSt({ fontSize:18, fontWeight:900, textAlign:'center', paddingRight: 40 })}
              />
              <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 13, fontWeight: 700, color: C.muted }}>ج</span>
            </div>
            <Btn onClick={handleSetDelivery} loading={savingDelivery} style={{ padding:'0 24px', height: 50 }}>حفظ</Btn>
          </div>
          {delivery > 0 && numPeople > 0 && (
            <div style={{ marginTop:16, background:C.primaryLight, borderRadius:12, padding:'12px', display:'flex', justifyContent:'space-between', alignItems: 'center' }}>
              <span style={{ fontSize:13, color:C.primary, fontWeight:700 }}>نصيب الفرد من التوصيل:</span>
              <span style={{ fontSize:18, fontWeight:900, color:C.primary }}>{fmt(perPerson)} ج</span>
            </div>
          )}
        </div>

        <CombinedTotals allOrders={allOrders}/>

        <div style={{ fontSize:15, fontWeight:900, color:C.dark, marginBottom:16, marginTop:24, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>💰 تفاصيل الحساب لكل شخص</span>
        </div>
        
        {Object.values(allOrders).map((o, i) => (
          <CostCard key={i} name={o.name} lines={o.lines} deliveryShare={perPerson} restDeliveries={{}} submittedAt={o.submittedAt}/>
        ))}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 24 }}>
          <Btn onClick={shareWhatsApp} color="#25D366" style={{ height: 54 }}>
            <MessageCircle size={20}/> واتساب
          </Btn>
          <Btn onClick={() => downloadMD(generateMD(allOrders, delivery, sessionId), `talabati-${sessionId}.md`)}
            color={C.dark} style={{ height: 54 }}>
            <Download size={18}/> ملف MD
          </Btn>
        </div>

        {sessStatus !== 'complete' && (
          <GhostBtn onClick={onEditOrder} style={{ width:'100%', marginTop:12, height: 50 }}>
            <RefreshCw size={16}/> تعديل الطلب الخاص بي
          </GhostBtn>
        )}
      </div>
    </div>
  )
}
