import { CheckCircle2, Ticket, ArrowLeft } from 'lucide-react'
import { C, FONT } from '../constants/colors.js'
import { fmt } from '../utils/helpers.js'
import CostCard from '../components/CostCard.jsx'
import RestaurantStatusBoard from '../components/RestaurantStatusBoard.jsx'
import { BREAD } from '../constants/data.js'
import { downloadBlob } from '../utils/orders.js'
import { generatePersonalReceipt } from '../utils/receipts.js'

export default function CompleteScreen({ userName, allOrders, delivery, sessionTitle = '', announcement = '', sessionId = '', breadTypes = BREAD, rests = [], restaurantStatuses = {} }) {
  const numPeople = Object.keys(allOrders).length
  const perPerson = numPeople > 0 ? delivery / numPeople : 0
  const myOrder   = Object.values(allOrders).find(o => o.name === userName)
  const myTotal   = myOrder
    ? (myOrder.lines||[]).reduce((s,l) => s+(l.price||0)*l.qty, 0) + perPerson
    : 0

  return (
    <div style={{ minHeight:'100vh', paddingBottom:50 }} className="animate-fade-in">
      <div style={{ background:C.gradAdmin, padding:'60px 24px 40px', textAlign:'center', borderRadius: '0 0 40px 40px', boxShadow: '0 10px 30px rgba(16,185,129,0.2)', color: '#FFF' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 20, maxWidth: 800, margin: '0 auto' }}>
          <button onClick={() => window.history.back()} style={{ background:'rgba(255,255,255,0.2)', border:'none', borderRadius:12, width:40, height:40, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#FFF' }}>
            <ArrowLeft size={20}/>
          </button>
          <div style={{ width:40 }}/>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.2)', width: 80, height: 80, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <CheckCircle2 size={48} />
        </div>
        {sessionTitle && <div style={{ fontSize: 13, fontWeight: 800, color:'rgba(255,255,255,0.85)', marginBottom: 10 }}>{sessionTitle}</div>}
        <h1 style={{ fontSize:32, fontWeight:950, marginBottom: 8 }}>وبالهنا والشفا!</h1>
        {userName && <p style={{ fontSize:16, color:'rgba(255,255,255,0.9)', fontWeight:600 }}>يا {userName}، الأكل أهو جِه وبالهنا والشفا 🥙</p>}
      </div>

      <div style={{ padding:'24px 20px', maxWidth: 800, margin:'0 auto' }}>
        {announcement && (
          <div className="glass-card" style={{ padding:'14px 16px', marginBottom:20, border:`1px solid ${C.primary}22`, background:`${C.primary}08` }}>
            <div style={{ fontSize:12, color:C.primary, fontWeight:900, marginBottom:6 }}>رسالة من الجلسة</div>
            <div style={{ fontSize:14, color:C.dark, fontWeight:700, whiteSpace:'pre-wrap' }}>{announcement}</div>
          </div>
        )}

        <RestaurantStatusBoard allOrders={allOrders} rests={rests} restaurantStatuses={restaurantStatuses} title="آخر حالة للمطاعم" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 24 }}>
          
          {/* Your Total Card */}
          {myOrder && (
            <div className="glass-card" style={{ padding: 24, textAlign: 'center', border: `2px solid ${C.primary}33`, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: C.muted, marginBottom: 8 }}>
                <Ticket size={18} />
                <span style={{ fontSize: 14, fontWeight: 700 }}>الحساب المطلوب منك</span>
              </div>
              <div style={{ fontSize:56, fontWeight: 950, color: C.primary, lineHeight: 1 }}>{fmt(myTotal)} <span style={{ fontSize: 24 }}>ج</span></div>
              {delivery > 0 && <div style={{ fontSize:14, color:C.muted, marginTop:16, fontWeight: 600 }}>يشمل {fmt(perPerson)} ج نصيبك من التوصيل</div>}
              <div style={{ fontSize:13, fontWeight:800, color: myOrder.paid ? C.green : C.red, marginTop: 14 }}>
                {myOrder.paid ? 'تم تسجيل الدفع' : 'الدفع لسه غير متسجل'}
              </div>
              {sessionId && (
                <button
                  onClick={() => downloadBlob(
                    `receipt-${sessionId}-${userName}.txt`,
                    generatePersonalReceipt({ sessionId, sessionTitle, order: myOrder, deliveryShare: perPerson, breadTypes }),
                    'text/plain;charset=utf-8'
                  )}
                  style={{ marginTop:16, height:46, borderRadius:14, border:'none', background:C.dark, color:'#FFF', fontWeight:800, cursor:'pointer' }}
                >
                  تحميل إيصالك
                </button>
              )}
            </div>
          )}

          {/* Your Order Details */}
          {myOrder && (
            <div>
              <div style={{ fontSize:16, fontWeight:900, color:C.dark, marginBottom:16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>🧾 ملخص طلبك النهائي</span>
              </div>
              <CostCard name={myOrder.name} lines={myOrder.lines} deliveryShare={perPerson} restDeliveries={{}} submittedAt={myOrder.submittedAt} paid={myOrder.paid} paidAmount={myOrder.paidAmount}/>
            </div>
          )}
        </div>
        
        {/* If user not found (e.g. joined late or name mismatch) */}
        {!myOrder && (
          <div className="glass-card" style={{ padding: 32, textAlign: 'center' }}>
             <p style={{ fontSize: 16, fontWeight: 800, color: C.muted }}>تقريباً اسمك مش موجود في الجلسة دي، راجع الأدمن عشان تعرف حسابك.</p>
          </div>
        )}
        
        <div style={{ textAlign: 'center', color: C.muted, fontSize: 13, fontWeight: 600, marginTop: 60 }}>
           نتمنى يكون الأكل عجبك! نتقابل المرة الجاية 👋
        </div>
      </div>

    </div>
  )
}
