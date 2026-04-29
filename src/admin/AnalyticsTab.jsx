import { useEffect, useState } from 'react'
import { FileText, TrendingUp, Users, ShoppingBag, DollarSign, RefreshCw } from 'lucide-react'
import { C } from '../constants/colors.js'
import { api } from '../api/client.js'
import { Btn, GhostBtn } from '../components/Btn.jsx'
import { fmt } from '../utils/helpers.js'

export default function AnalyticsTab({ analytics, onRefresh }) {
  const [days, setDays] = useState(30)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadStats()
  }, [days])

  const loadStats = async () => {
    setLoading(true)
    const res = await api.getAdminAnalytics(days)
    if (res.ok) setStats(res.stats)
    setLoading(false)
  }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <h2 style={{ fontSize:18, fontWeight:900, color:C.dark, display:'flex', alignItems:'center', gap:8 }}>
          <FileText size={20} color={C.primary}/> إحصائيات الأداء
        </h2>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <select 
            value={days} 
            onChange={e => setDays(Number(e.target.value))}
            style={{ padding:'8px 12px', border:`1px solid ${C.border}`, borderRadius:10, fontSize:14, fontFamily:'inherit', background:'#FFF' }}
          >
            <option value={7}>7 أيام</option>
            <option value={30}>30 يوم</option>
            <option value={90}>90 يوم</option>
            <option value={365}>سنة</option>
          </select>
          <GhostBtn onClick={loadStats} loading={loading}><RefreshCw size={16}/></GhostBtn>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:40, color:C.muted }}><RefreshCw size={24} className="spin"/> جاري التحميل...</div>
      ) : stats ? (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))', gap:16 }}>
          <div className="glass-card" style={{ padding:24, textAlign:'center' }}>
            <div style={{ width:56, height:56, borderRadius:16, background:C.primaryLight, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px', color:C.primary }}>
              <ShoppingBag size={28}/>
            </div>
            <div style={{ fontSize:13, fontWeight:700, color:C.muted, marginBottom:4 }}>إجمالي الطلبات</div>
            <div style={{ fontSize:36, fontWeight:950, color:C.dark }}>{stats.total_orders}</div>
          </div>

          <div className="glass-card" style={{ padding:24, textAlign:'center' }}>
            <div style={{ width:56, height:56, borderRadius:16, background:C.greenLight, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px', color:C.green }}>
              <Users size={28}/>
            </div>
            <div style={{ fontSize:13, fontWeight:700, color:C.muted, marginBottom:4 }}>الجلسات النشطة</div>
            <div style={{ fontSize:36, fontWeight:950, color:C.dark }}>{stats.total_sessions}</div>
          </div>

          <div className="glass-card" style={{ padding:24, textAlign:'center' }}>
            <div style={{ width:56, height:56, borderRadius:16, background:`${C.primary}15`, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px', color:C.primary }}>
              <DollarSign size={28}/>
            </div>
            <div style={{ fontSize:13, fontWeight:700, color:C.muted, marginBottom:4 }}>إجمالي الإيرادات</div>
            <div style={{ fontSize:28, fontWeight:950, color:C.dark }}>{fmt(stats.total_revenue)} ج</div>
          </div>

          <div className="glass-card" style={{ padding:24, textAlign:'center' }}>
            <div style={{ width:56, height:56, borderRadius:16, background:C.accentLight, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px', color:C.accent }}>
              <TrendingUp size={28}/>
            </div>
            <div style={{ fontSize:13, fontWeight:700, color:C.muted, marginBottom:4 }}>متوسط قيمة الطلب</div>
            <div style={{ fontSize:28, fontWeight:950, color:C.dark }}>{fmt(stats.avg_order_value)} ج</div>
          </div>
        </div>
      ) : (
        <div className="glass-card" style={{ textAlign:'center', padding:40, color:C.muted }}>
          لا توجد بيانات كافية
        </div>
      )}
    </div>
  )
}
