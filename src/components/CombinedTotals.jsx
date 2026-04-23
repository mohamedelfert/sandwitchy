import { C } from '../constants/colors.js'
import { BREAD } from '../constants/data.js'

export default function CombinedTotals({ allOrders }) {
  const combined = {}
  ;[...BREAD.map(b => b.id), 'none'].forEach(g => { combined[g] = {} })
  Object.values(allOrders).forEach(o => {
    (o.lines || []).forEach(l => {
      const g = l.bt || 'none'
      if (!combined[g][l.iname]) combined[g][l.iname] = { name: l.iname, qty: 0 }
      combined[g][l.iname].qty += l.qty
    })
  })
  
  const groups = [
    ...BREAD.map(b => ({ id:b.id, ar:b.ar, color:b.color, light:b.light })),
    { id:'none', ar:'بدون عيش', color:C.primary, light:C.primaryLight },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {groups.map(g => {
        const items = Object.values(combined[g.id] || {}).filter(i => i.qty > 0)
        if (!items.length) return null
        const tot = items.reduce((s, i) => s + i.qty, 0)
        return (
          <div key={g.id} className="glass-card" style={{ padding: 0, overflow:'hidden', border:`1px solid ${g.color}33` }}>
            <div style={{ background:g.light, padding:'12px 20px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:17, fontWeight:950, color:g.color }}>{g.ar}</span>
              <div style={{ background:g.color, color:'#FFF', borderRadius:10, padding:'2px 12px', fontSize:14, fontWeight:950 }}>{tot} ساندوتش</div>
            </div>
            <div style={{ padding:'16px 20px', display:'flex', flexWrap:'wrap', gap:10 }}>
              {items.map((item, idx) => (
                <div key={idx} style={{ display:'flex', alignItems:'center', gap:8, background:'#FFF', borderRadius:14, padding:'8px 16px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)', border: `1px solid var(--border)` }}>
                  <span style={{ fontSize:18, fontWeight:950, color:g.color }}>{item.qty}</span>
                  <span style={{ fontSize:15, fontWeight:800, color:C.dark }}>{item.name}</span>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
