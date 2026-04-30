import { X, Truck } from 'lucide-react'
import { C, FONT } from '../constants/colors.js'
import { Btn } from './Btn.jsx'
import { useEffect } from 'react'

export default function OrderPreviewModal({ lines, drinks, drinkTypes, delivery, rests, onConfirm, onClose, userName, phone, telegram }) {
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handler)
      document.body.style.overflow = 'auto'
    }
  }, [onClose])

  const restTotals = {}
  let subtotal = 0

  lines.forEach(line => {
    const rest = rests.find(r => r.id === line.rid)
    const item = rest?.items.find(i => i.id === line.iid)
    if (item) {
      const itemTotal = item.price * line.qty
      if (!restTotals[line.rid]) {
        restTotals[line.rid] = { name: line.rname, items: [], total: 0 }
      }
      restTotals[line.rid].items.push({
        name: line.iname,
        price: item.price,
        qty: line.qty,
        bt: line.bt,
        itemTotal
      })
      restTotals[line.rid].total += itemTotal
      subtotal += itemTotal
    }
  })

  let drinkSummary = []
  if (drinks && drinkTypes) {
    Object.entries(drinks).forEach(([drinkId, qty]) => {
      if (qty > 0) {
        const drink = drinkTypes.find(d => d.id === drinkId)
        if (drink) {
          drinkSummary.push({ name: drink.name, qty, emoji: drink.emoji })
        }
      }
    })
  }

  const grandTotal = subtotal + (delivery || 0)

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', zIndex: 999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16
    }}>
      <div className="glass-card" style={{
        width: '100%', maxWidth: 480,
        maxHeight: '90vh', overflow: 'auto',
        padding: 0, display: 'flex', flexDirection: 'column'
      }}>
        <div style={{
          padding: '20px', borderBottom: `2px solid ${C.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, background: 'rgba(255,255,255,0.95)', zIndex: 10
        }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: C.dark }}>📋 تفاصيل الطلب</div>
          <button onClick={onClose}
            style={{ background: C.tag, border: 'none', borderRadius: 10, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: C.muted }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '16px', background: C.primaryLight, borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: C.primary, marginBottom: 8 }}>📝 بيانات الطلب</div>
          <div style={{ fontSize: 12, color: C.dark, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span>👤</span> <span>{userName}</span>
          </div>
          {phone && <div style={{ fontSize: 12, color: C.dark, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span>📱</span> <span>{phone}</span>
          </div>}
          {telegram && <div style={{ fontSize: 12, color: C.dark, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>✈️</span> <span>{telegram}</span>
          </div>}
        </div>

        <div style={{ padding: '16px', flex: 1 }}>
          {Object.entries(restTotals).map(([restId, rest]) => (
            <div key={restId} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 900, color: C.dark, marginBottom: 10, paddingBottom: 10, borderBottom: `1px solid ${C.border}` }}>
                {rest.name}
              </div>
              {rest.items.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: C.dark, fontWeight: 600, marginBottom: 6, paddingLeft: 12 }}>
                  <div>
                    {item.name} {item.bt && <span style={{ fontSize: 11, color: C.muted }}>({item.bt})</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span>x{item.qty}</span>
                    <span style={{ minWidth: 50, textAlign: 'right', fontWeight: 700, color: C.primary }}>{item.itemTotal} ج</span>
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 900, color: C.primary, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
                <span>المجموع</span>
                <span>{rest.total} ج</span>
              </div>
            </div>
          ))}

          {drinkSummary.length > 0 && (
            <div style={{ marginBottom: 16, padding: '12px', background: C.greenLight, borderRadius: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: C.green, marginBottom: 10 }}>☕ المشاريب (مجاناً)</div>
              {drinkSummary.map((drink, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.dark, fontWeight: 600, marginBottom: 4 }}>
                  <div>{drink.emoji} {drink.name}</div>
                  <span>x{drink.qty}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ padding: '16px', borderTop: `2px solid ${C.border}`, background: 'rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: C.dark, fontWeight: 700, marginBottom: 10 }}>
            <span>الأصناف والمشاريب</span>
            <span>{subtotal} ج</span>
          </div>
          {(delivery || 0) > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: C.dark, fontWeight: 700, marginBottom: 10, paddingBottom: 10, borderBottom: `1px solid ${C.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Truck size={14} /> <span>التوصيل</span>
              </div>
              <span style={{ color: C.green, fontWeight: 900 }}>+{delivery} ج</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 950, color: C.primary, marginBottom: 16 }}>
            <span>الإجمالي</span>
            <span>{grandTotal} ج</span>
          </div>
        </div>

        <div style={{ padding: '16px', display: 'flex', gap: 12 }}>
          <button onClick={onClose}
            style={{
              flex: 1, height: 48, border: `2px solid ${C.border}`, background: 'transparent',
              borderRadius: 12, fontSize: 14, fontWeight: 800, color: C.dark, cursor: 'pointer',
              transition: 'all 0.2s'
            }}>
            ← تعديل الطلب
          </button>
          <Btn onClick={onConfirm} style={{ flex: 1, height: 48 }}>
            ✓ تأكيد الطلب
          </Btn>
        </div>
      </div>
    </div>
  )
}