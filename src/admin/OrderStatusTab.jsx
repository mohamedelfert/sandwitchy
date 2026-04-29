import { useState } from 'react'
import { Clock, CheckCircle, Truck, XCircle, PenLine } from 'lucide-react'
import { C } from '../constants/colors.js'
import { api } from '../api/client.js'
import { Btn, GhostBtn } from '../components/Btn.jsx'
import { formatTime, inpSt } from '../utils/helpers.js'

const STATUS_OPTIONS = [
  { value: 'pending', label: 'في الانتظار', icon: Clock, color: C.muted },
  { value: 'preparing', label: 'يتم التحضير', icon: PenLine, color: C.primary },
  { value: 'ready', label: 'جاهز للتوصيل', icon: CheckCircle, color: C.green },
  { value: 'delivered', label: 'تم التوصيل', icon: Truck, color: C.green },
  { value: 'cancelled', label: 'ملغي', icon: XCircle, color: C.red },
]

export default function OrderStatusTab({ orders, onUpdateStatus }) {
  const [statusNotes, setStatusNotes] = useState({})
  const [updating, setUpdating] = useState({})

  const handleStatusChange = async (uid, newStatus) => {
    setUpdating(prev => ({ ...prev, [uid]: true }))
    try {
      await onUpdateStatus(uid, newStatus, statusNotes[uid] || '')
    } catch (err) {
      console.error('Failed to update status:', err)
    } finally {
      setUpdating(prev => ({ ...prev, [uid]: false }))
    }
  }

  const setNote = (uid, note) => {
    setStatusNotes(prev => ({ ...prev, [uid]: note }))
  }

  if (orders.length === 0) {
    return (
      <div className="glass-card" style={{ padding:40, textAlign:'center', color:C.muted }}>
        <Clock size={48} style={{ marginBottom:12, opacity:0.5 }}/>
        <p style={{ fontWeight:700 }}>لا توجد طلبات لتحديث حالتها</p>
      </div>
    )
  }

  return (
    <div>
      <h2 style={{ fontSize:18, fontWeight:900, color:C.dark, marginBottom:20, display:'flex', alignItems:'center', gap:8 }}>
        <Clock size={20} color={C.primary}/> تحديث حالة الطلبات
      </h2>

      <div style={{ display:'grid', gap:12 }}>
        {orders.map(order => {
          const currentStatus = order.status || 'pending'
          const statusOption = STATUS_OPTIONS.find(s => s.value === currentStatus) || STATUS_OPTIONS[0]
          const Icon = statusOption.icon
          
          return (
            <div key={order.uid} className="glass-card" style={{ 
              padding:16,
              borderLeft: `4px solid ${statusOption.color}`
            }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{
                    width:42, height:42, borderRadius:12,
                    background: `${statusOption.color}15`,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    color: statusOption.color
                  }}>
                    <Icon size={22}/>
                  </div>
                  <div>
                    <div style={{ fontSize:16, fontWeight:900, color:C.dark }}>{order.name}</div>
                    <div style={{ fontSize:12, color:C.muted }}>
                      {formatTime(order.submittedAt)} · {(order.lines || []).reduce((s,l)=>s+l.qty,0)} أصناف
                    </div>
                  </div>
                </div>
                <div style={{ 
                  background: `${statusOption.color}15`,
                  color: statusOption.color,
                  padding: '4px 12px',
                  borderRadius: 999,
                  fontSize:12,
                  fontWeight:800
                }}>
                  {statusOption.label}
                </div>
              </div>

              <div style={{ display:'flex', gap:8, alignItems:'flex-start', flexWrap:'wrap' }}>
                <div style={{ flex:1, minWidth:200 }}>
                  <label style={{ fontSize:11, fontWeight:700, color:C.muted, display:'block', marginBottom:4 }}>حالة الطلب</label>
                  <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                    {STATUS_OPTIONS.map(opt => {
                      const OptIcon = opt.icon
                      return (
                        <button
                          key={opt.value}
                          onClick={() => handleStatusChange(order.uid, opt.value)}
                          disabled={updating[order.uid]}
                          style={{
                            display:'flex',
                            alignItems:'center',
                            gap:4,
                            padding:'6px 12px',
                            border:'none',
                            borderRadius:8,
                            background: currentStatus === opt.value ? opt.color : C.tag,
                            color: currentStatus === opt.value ? '#FFF' : C.muted,
                            fontWeight:700,
                            fontSize:12,
                            cursor: currentStatus === opt.value ? 'default' : 'pointer',
                            opacity: updating[order.uid] ? 0.6 : 1
                          }}
                        >
                          <OptIcon size={12}/>
                          {opt.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div style={{ flex:2, minWidth:200 }}>
                  <label style={{ fontSize:11, fontWeight:700, color:C.muted, display:'block', marginBottom:4 }}>ملاحظة (اختياري)</label>
                  <input
                    type="text"
                    value={statusNotes[order.uid] || ''}
                    onChange={e => setNote(order.uid, e.target.value)}
                    placeholder="مثال: جاهز للتوصيل"
                    style={{ ...inpSt({ padding:'8px 12px', fontSize:13 })}}
                  />
                </div>
              </div>

              {(order.phone || order.telegram) && (
                <div style={{ marginTop:10, display:'flex', gap:8, fontSize:12, color:C.muted }}>
                  {order.phone && <span>📱 {order.phone}</span>}
                  {order.telegram && <span>✈️ @{order.telegram}</span>}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
