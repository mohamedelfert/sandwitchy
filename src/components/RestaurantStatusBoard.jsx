import { Clock3 } from 'lucide-react'
import { C } from '../constants/colors.js'
import { getRestaurantStageMeta } from '../constants/restaurantStatus.js'
import { formatTime } from '../utils/helpers.js'
import { getSessionRestaurants } from '../utils/orders.js'

export default function RestaurantStatusBoard({ allOrders, rests, restaurantStatuses = {}, title = 'حالة المطاعم' }) {
  const restaurants = getSessionRestaurants(allOrders, rests, restaurantStatuses)
  if (restaurants.length === 0) return null

  return (
    <div className="glass-card" style={{ padding:'18px', marginTop:20 }}>
      <div style={{ fontSize:15, fontWeight:900, color:C.dark, marginBottom:14 }}>🍽️ {title}</div>
      <div style={{ display:'grid', gap:10 }}>
        {restaurants.map(rest => {
          const meta = getRestaurantStageMeta(rest.status?.stage)
          return (
            <div key={rest.id} style={{ background:C.tag, borderRadius:16, padding:'12px 14px', display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12 }}>
              <div style={{ display:'flex', gap:10, flex:1 }}>
                <div style={{ width:42, height:42, borderRadius:14, background:rest.bg || '#FFF', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>
                  {rest.emoji || '🍽️'}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:900, color:C.dark }}>{rest.name}</div>
                  <div style={{ fontSize:11, color:C.muted, fontWeight:700, marginTop:3 }}>{rest.items} قطعة · {rest.peopleCount} أشخاص</div>
                  {rest.status?.note && <div style={{ fontSize:12, color:C.dark, fontWeight:700, marginTop:6 }}>{rest.status.note}</div>}
                  {rest.status?.updatedAt && (
                    <div style={{ fontSize:10, color:C.muted, fontWeight:700, display:'flex', alignItems:'center', gap:4, marginTop:6 }}>
                      <Clock3 size={10}/> آخر تحديث {formatTime(rest.status.updatedAt)}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ background:meta.light, color:meta.color, borderRadius:999, padding:'6px 12px', fontSize:12, fontWeight:900, whiteSpace:'nowrap' }}>
                {meta.label}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
