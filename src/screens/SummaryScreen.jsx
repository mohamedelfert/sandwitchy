import { ChevronLeft, Truck, MessageCircle, Download, FileText, Wallet } from 'lucide-react'
import { C } from '../constants/colors.js'
import { fmt, getWhatsAppLink } from '../utils/helpers.js'
import { generateMD } from '../utils/markdown.js'
import CombinedTotals from '../components/CombinedTotals.jsx'
import CostCard from '../components/CostCard.jsx'
import { Btn, GhostBtn } from '../components/Btn.jsx'
import {
  buildSessionCsv,
  downloadBlob,
  getDrinkBreakdown,
  getGrandTotal,
  getOrdersArray,
  getPaidSummary,
  getPerPersonDelivery,
  getRestaurantBreakdown,
} from '../utils/orders.js'

export default function SummaryScreen({ sessionId, allOrders, delivery, rests, drinkTypes = [], breadTypes = [], sessStatus, sessionTitle = '', announcement = '', expected = [], onBack, onEditOrder }) {
  const orders = getOrdersArray(allOrders)
  const numPeople = orders.length
  const perPerson = getPerPersonDelivery(allOrders, delivery)
  const restaurantBreakdown = getRestaurantBreakdown(allOrders, rests)
  const drinkBreakdown = getDrinkBreakdown(allOrders, drinkTypes)
  const paymentSummary = getPaidSummary(allOrders, delivery)

  const shareWhatsApp = () => {
    let text = `*ملخص طلبات ساندوتشي* 🍽️\n`
    text += `كود الجلسة: ${sessionId}\n`
    text += `--------------------------\n`

    orders.forEach(order => {
      text += `👤 *${order.name}*: ${fmt((order.lines || []).reduce((sum, line) => sum + (line.price || 0) * line.qty, 0) + perPerson)} ج\n`
      ;(order.lines || []).forEach(line => {
        text += `• ${line.iname} ×${line.qty}${order.notes?.[line.key] ? ` (${order.notes[line.key]})` : ''}\n`
      })
      text += `\n`
    })

    text += `🚗 التوصيل الإجمالي: ${delivery} ج\n`
    text += `💰 المدفوع: ${fmt(paymentSummary.totalPaid)} ج / ${fmt(paymentSummary.totalDue)} ج`

    window.open(getWhatsAppLink(text), '_blank')
  }

  return (
    <div style={{ minHeight:'100vh', paddingBottom:50 }} className="animate-fade-in">
      <div className="glass-header" style={{ padding:'16px 18px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <button onClick={onBack} style={{ background:C.primaryLight, border:'none', borderRadius:12, width:38, height:38, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:C.primary }}>
          <ChevronLeft size={22}/>
        </button>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:18, fontWeight:900, color:C.dark }}>{sessionTitle || 'ملخص الطلبات'}</div>
          <div style={{ fontSize:12, color:C.muted, fontWeight:600 }}>{numPeople} شخص شارك</div>
        </div>
        <div style={{ width:38 }}/>
      </div>

      <div style={{ padding:'20px 18px' }}>
        {announcement && (
          <div className="glass-card" style={{ padding:'14px 16px', marginBottom:20, border:`1px solid ${C.primary}22`, background:`${C.primary}08` }}>
            <div style={{ fontSize:12, color:C.primary, fontWeight:900, marginBottom:6 }}>إعلان الجلسة</div>
            <div style={{ fontSize:14, color:C.dark, fontWeight:700, whiteSpace:'pre-wrap' }}>{announcement}</div>
          </div>
        )}

        <div className="stats-grid" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:12, marginBottom:20 }}>
          <div className="glass-card" style={{ padding:18 }}>
            <div style={{ fontSize:12, color:C.muted, fontWeight:700, marginBottom:6 }}>الإجمالي الكلي</div>
            <div style={{ fontSize:28, fontWeight:950, color:C.primary }}>{fmt(getGrandTotal(allOrders, delivery))} <span style={{ fontSize:14 }}>ج</span></div>
          </div>
          <div className="glass-card" style={{ padding:18 }}>
            <div style={{ fontSize:12, color:C.muted, fontWeight:700, marginBottom:6 }}>التوصيل لكل فرد</div>
            <div style={{ fontSize:28, fontWeight:950, color:C.green }}>{fmt(perPerson)} <span style={{ fontSize:14 }}>ج</span></div>
          </div>
          <div className="glass-card" style={{ padding:18 }}>
            <div style={{ fontSize:12, color:C.muted, fontWeight:700, marginBottom:6 }}>حالة التحصيل</div>
            <div style={{ fontSize:28, fontWeight:950, color:C.dark }}>{paymentSummary.paidCount}/{numPeople}</div>
            <div style={{ fontSize:12, fontWeight:800, color: paymentSummary.remaining > 0 ? C.red : C.green }}>
              المتبقي {fmt(paymentSummary.remaining)} ج
            </div>
          </div>
          {expected.length > 0 && (
            <div className="glass-card" style={{ padding:18 }}>
              <div style={{ fontSize:12, color:C.muted, fontWeight:700, marginBottom:6 }}>نسبة الاستجابة</div>
              <div style={{ fontSize:28, fontWeight:950, color:C.dark }}>{numPeople}/{expected.length}</div>
              <div style={{ fontSize:12, fontWeight:800, color:numPeople < expected.length ? C.red : C.green }}>
                {numPeople < expected.length ? `${expected.length - numPeople} لسه ماطلبوش` : 'الكل طلب'}
              </div>
            </div>
          )}
        </div>

        <div className="glass-card" style={{ padding:'18px', marginBottom:20 }}>
          <div style={{ fontSize:14, fontWeight:900, color:C.dark, marginBottom:12, display:'flex', alignItems:'center', gap:8 }}>
            <Truck size={18} color={C.primary}/> التوصيل الحالي
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, flexWrap:'wrap' }}>
            <div>
              <div style={{ fontSize:22, fontWeight:950, color:C.primary }}>{fmt(delivery)} ج</div>
              <div style={{ fontSize:12, color:C.muted, fontWeight:700 }}>يتوزع بالتساوي على المشاركين</div>
            </div>
            <div style={{ background:C.primaryLight, color:C.primary, borderRadius:12, padding:'10px 14px', fontSize:12, fontWeight:800 }}>
              التعديل أصبح من لوحة الإدارة فقط
            </div>
          </div>
        </div>

        <CombinedTotals allOrders={allOrders} breadTypes={breadTypes}/>

        {restaurantBreakdown.length > 0 && (
          <div className="glass-card" style={{ padding:'18px', marginTop:20 }}>
            <div style={{ fontSize:15, fontWeight:900, color:C.dark, marginBottom:14 }}>🍽️ تجميع حسب المطعم</div>
            <div style={{ display:'grid', gap:10 }}>
              {restaurantBreakdown.map(rest => (
                <div key={rest.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:C.tag, borderRadius:14, padding:'12px 14px', gap:12 }}>
                  <div>
                    <div style={{ fontSize:14, fontWeight:900, color:C.dark }}>{rest.name}</div>
                    <div style={{ fontSize:11, color:C.muted, fontWeight:700 }}>{rest.items} قطعة · {rest.peopleCount} أشخاص</div>
                  </div>
                  <div style={{ fontSize:16, fontWeight:900, color:C.primary }}>{fmt(rest.total)} ج</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {drinkBreakdown.length > 0 && (
          <div className="glass-card" style={{ padding:'18px', marginTop:20 }}>
            <div style={{ fontSize:15, fontWeight:900, color:C.dark, marginBottom:14 }}>☕ تجميع المشروبات</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:10 }}>
              {drinkBreakdown.map(drink => (
                <div key={drink.id} style={{ display:'flex', alignItems:'center', gap:8, background:C.tag, borderRadius:14, padding:'10px 14px' }}>
                  <span style={{ fontSize:18 }}>{drink.emoji}</span>
                  <span style={{ fontSize:13, fontWeight:800, color:C.dark }}>{drink.name}</span>
                  <span style={{ fontSize:14, fontWeight:900, color:C.green }}>×{drink.qty}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ fontSize:15, fontWeight:900, color:C.dark, marginBottom:16, marginTop:24, display:'flex', alignItems:'center', gap:8 }}>
          <Wallet size={18} color={C.primary}/> تفاصيل الحساب لكل شخص
        </div>

        {orders.map(order => (
          <CostCard
            key={order.uid}
            name={order.name}
            lines={order.lines}
            deliveryShare={perPerson}
            restDeliveries={{}}
            submittedAt={order.submittedAt}
            breadTypes={breadTypes}
            paid={order.paid}
            paidAmount={order.paidAmount}
          />
        ))}

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:12, marginTop:24 }}>
          <Btn onClick={shareWhatsApp} color="#25D366" style={{ height:54 }}>
            <MessageCircle size={20}/> واتساب
          </Btn>
          <Btn
            onClick={() => downloadBlob(`talabati-${sessionId}.md`, generateMD(allOrders, delivery, sessionId, { breadTypes, drinkTypes, rests }), 'text/markdown;charset=utf-8')}
            color={C.dark}
            style={{ height:54 }}
          >
            <FileText size={18}/> ملف MD
          </Btn>
          <Btn
            onClick={() => downloadBlob(`talabati-${sessionId}.csv`, buildSessionCsv(allOrders, delivery), 'text/csv;charset=utf-8')}
            color={C.gradAdmin}
            style={{ height:54 }}
          >
            <Download size={18}/> ملف CSV
          </Btn>
        </div>

        {sessStatus !== 'complete' && (
          <GhostBtn onClick={onEditOrder} style={{ width:'100%', marginTop:12, height:50 }}>
            تعديل الطلب الخاص بي
          </GhostBtn>
        )}
      </div>
    </div>
  )
}
