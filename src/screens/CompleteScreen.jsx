import { CheckCircle2, Ticket } from 'lucide-react'
import { C, FONT } from '../constants/colors.js'
import { fmt } from '../utils/helpers.js'
import CostCard from '../components/CostCard.jsx'

export default function CompleteScreen({ userName, allOrders, delivery }) {
  const numPeople = Object.keys(allOrders).length
  const perPerson = numPeople > 0 ? delivery / numPeople : 0
  const myOrder   = Object.values(allOrders).find(o => o.name === userName)
  const myTotal   = myOrder
    ? (myOrder.lines||[]).reduce((s,l) => s+(l.price||0)*l.qty, 0) + perPerson
    : 0

  return (
    <div style={{ minHeight:'100vh', paddingBottom:50 }} className="animate-fade-in">
      <div style={{ background:C.gradAdmin, padding:'60px 24px 40px', textAlign:'center', borderRadius: '0 0 40px 40px', boxShadow: '0 10px 30px rgba(16,185,129,0.2)', color: '#FFF' }}>
        <div style={{ background: 'rgba(255,255,255,0.2)', width: 80, height: 80, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <CheckCircle2 size={48} />
        </div>
        <h1 style={{ fontSize:32, fontWeight:950, marginBottom: 8 }}>وبالهنا والشفا!</h1>
        {userName && <p style={{ fontSize:16, color:'rgba(255,255,255,0.9)', fontWeight:600 }}>يا {userName}، الأكل أهو جِه وبالهنا والشفا 🥙</p>}
      </div>

      <div style={{ padding:'24px 20px', maxWidth: 800, margin:'0 auto' }}>
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
            </div>
          )}

          {/* Your Order Details */}
          {myOrder && (
            <div>
              <div style={{ fontSize:16, fontWeight:900, color:C.dark, marginBottom:16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>🧾 ملخص طلبك النهائي</span>
              </div>
              <CostCard name={myOrder.name} lines={myOrder.lines} deliveryShare={perPerson} restDeliveries={{}} submittedAt={myOrder.submittedAt}/>
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
