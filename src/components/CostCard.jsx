import { Clock } from 'lucide-react'
import { C, FONT } from '../constants/colors.js'
import { BREAD } from '../constants/data.js'
import { fmt, formatTime } from '../utils/helpers.js'

export default function CostCard({ name, lines, deliveryShare, restDeliveries, submittedAt }) {
  const itemsTotal   = (lines || []).reduce((s, l) => s + (l.price || 0) * l.qty, 0)
  const restDelTotal = Object.values(restDeliveries || {}).reduce((s, v) => s + v, 0)
  const total        = itemsTotal + deliveryShare + restDelTotal

  return (
    <div className="glass-card" style={{ padding:'16px', marginBottom:12 }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
        <div style={{ width:42, height:42, borderRadius:12, background:C.grad, color:'#FFF', fontWeight:900, fontSize:18, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, boxShadow: '0 4px 12px rgba(99,102,241,0.2)' }}>
          {name[0]}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize:17, fontWeight:900, color:C.dark }}>{name}</div>
          {submittedAt && (
            <div style={{ fontSize:11, color:C.muted, display:'flex', alignItems:'center', gap:4, marginTop: 2 }}>
              <Clock size={10}/> طلب في {formatTime(submittedAt)}
            </div>
          )}
        </div>
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize:22, fontWeight:900, color:C.primary }}>{fmt(total)}<span style={{ fontSize:12, marginRight:3 }}>ج</span></div>
        </div>
      </div>
      
      <div style={{ background: 'rgba(0,0,0,0.02)', borderRadius: 12, padding: '10px 14px' }}>
        {(lines || []).map((l, i) => {
          const b = BREAD.find(x => x.id === l.bt)
          return (
            <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom: i < lines.length - 1 ? `1px solid rgba(0,0,0,0.05)` : 'none' }}>
              <div style={{ fontSize:14, color:C.dark, fontWeight: 600 }}>
                {l.iname}
                {b && <span style={{ fontSize:11, background:b.light, color:b.color, borderRadius:6, padding:'1px 6px', fontWeight:800, marginRight: 6 }}>{b.ar}</span>}
                <span style={{ color: C.muted, marginRight: 6 }}>×{l.qty}</span>
              </div>
              <span style={{ fontSize:14, fontWeight:700, color:C.dark }}>{(l.price || 0) * l.qty} ج</span>
            </div>
          )
        })}
        
        {Object.entries(restDeliveries || {}).filter(([, v]) => v > 0).map(([rname, v]) => (
          <div key={rname} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderTop:`1px dashed rgba(0,0,0,0.1)`, marginTop:4 }}>
            <span style={{ fontSize:12, color:C.green, fontWeight:700 }}>🚗 توصيل {rname}</span>
            <span style={{ fontSize:13, fontWeight:800, color:C.green }}>{fmt(v)} ج</span>
          </div>
        ))}
        
        {deliveryShare > 0 && (
          <div style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderTop:`1px dashed rgba(0,0,0,0.1)`, marginTop:4 }}>
            <span style={{ fontSize:12, color:C.accent, fontWeight:700 }}>🚗 نصيبه من التوصيل</span>
            <span style={{ fontSize:13, fontWeight:800, color:C.accent }}>{fmt(deliveryShare)} ج</span>
          </div>
        )}
      </div>
    </div>
  )
}
