import { useState, useEffect } from 'react'
import { Wallet, Plus, Trash2, Edit2, Check, X, Tag, Percent, Gift, RefreshCw } from 'lucide-react'
import { C } from '../constants/colors.js'
import { api } from '../api/client.js'
import { Btn, GhostBtn } from '../components/Btn.jsx'
import Modal from '../components/Modal.jsx'
import { fmt, inpSt } from '../utils/helpers.js'

export default function PromoCodesTab({ promoCodes, onRefresh, showForm, onToggleForm, newPromo, onPromoChange, onCreatePromo }) {
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})

  const handleCreate = async () => {
    const res = await api.createPromoCode({
      ...newPromo,
      value: parseFloat(newPromo.value) || 0,
      min_amount: parseFloat(newPromo.min_amount) || 0,
      max_uses: newPromo.max_uses ? parseInt(newPromo.max_uses) : null,
      expires_at: newPromo.expires_at ? new Date(newPromo.expires_at).getTime() : null
    })
    if (res.ok) {
      onToggleForm()
      onRefresh()
    } else {
      alert(res.error || 'Failed to create promo')
    }
  }

  const handleDelete = async (code) => {
    if (!confirm(`Delete promo code "${code}"?`)) return
    // Would need delete endpoint, for now can't delete
    alert('Delete not implemented yet')
  }

  const toggleActive = async (code, current) => {
    // Would need update endpoint
    alert('Toggle not implemented yet')
  }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <h2 style={{ fontSize:18, fontWeight:900, color:C.dark, display:'flex', alignItems:'center', gap:8 }}>
          <Wallet size={20} color={C.primary}/> إدارة كوبونات الخصم
        </h2>
        <Btn onClick={onToggleForm} color={showForm ? C.red : C.primary} size="small">
          {showForm ? <X size={16}/> : <Plus size={16}/>}
          {showForm ? 'إلغاء' : 'إنشاء كوبون'}
        </Btn>
      </div>

      {showForm && (
        <div className="glass-card" style={{ padding:20, marginBottom:24, border:`2px dashed ${C.primary}33` }}>
          <h3 style={{ fontSize:15, fontWeight:900, color:C.dark, marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>
            <Gift size={18}/> كوبون جديد
          </h3>
          
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:16, marginBottom:16 }}>
            <div>
              <label style={{ fontSize:12, fontWeight:700, color:C.muted, display:'block', marginBottom:6 }}>الكود</label>
              <input
                type="text"
                value={newPromo.code}
                onChange={e => onPromoChange({ ...newPromo, code: e.target.value.toUpperCase() })}
                placeholder="مثلاً: SAVE20"
                style={{ ...inpSt({ direction:'ltr', textAlign:'center', fontWeight:900 })}}
              />
            </div>

            <div>
              <label style={{ fontSize:12, fontWeight:700, color:C.muted, display:'block', marginBottom:6 }}>نوع الخصم</label>
              <select 
                value={newPromo.discount_type}
                onChange={e => onPromoChange({ ...newPromo, discount_type: e.target.value })}
                style={{ ...inpSt({ fontSize:14 })}}
              >
                <option value="percent">نسبة مئوية %</option>
                <option value="fixed">مبلغ ثابت</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize:12, fontWeight:700, color:C.muted, display:'block', marginBottom:6 }}>
                {newPromo.discount_type === 'percent' ? 'النسبة %' : 'المبلغ ج'}
              </label>
              <input
                type="number"
                value={newPromo.value}
                onChange={e => onPromoChange({ ...newPromo, value: e.target.value })}
                placeholder={newPromo.discount_type === 'percent' ? '20' : '10'}
                style={inpSt()}
              />
            </div>

            <div>
              <label style={{ fontSize:12, fontWeight:700, color:C.muted, display:'block', marginBottom:6 }}>الحد الأدنى (ج)</label>
              <input
                type="number"
                value={newPromo.min_amount}
                onChange={e => onPromoChange({ ...newPromo, min_amount: e.target.value })}
                placeholder="0"
                style={inpSt()}
              />
            </div>

            <div>
              <label style={{ fontSize:12, fontWeight:700, color:C.muted, display:'block', marginBottom:6 }}>أقصى استخدامات</label>
              <input
                type="number"
                value={newPromo.max_uses}
                onChange={e => onPromoChange({ ...newPromo, max_uses: e.target.value })}
                placeholder="غير محدود"
                style={inpSt()}
              />
            </div>

            <div>
              <label style={{ fontSize:12, fontWeight:700, color:C.muted, display:'block', marginBottom:6 }}>تاريخ الانتهاء</label>
              <input
                type="date"
                value={newPromo.expires_at}
                onChange={e => onPromoChange({ ...newPromo, expires_at: e.target.value })}
                style={{ ...inpSt({ padding:'8px'}), direction:'ltr' }}
              />
            </div>
          </div>

          <Btn onClick={handleCreate} disabled={!newPromo.code || !newPromo.value} style={{ width:'100%' }}>
            <Plus size={16}/> إنشاء الكوبون
          </Btn>
        </div>
      )}

      {promoCodes.length === 0 ? (
        <div className="glass-card" style={{ padding:40, textAlign:'center', color:C.muted }}>
          <Wallet size={48} style={{ marginBottom:12, opacity:0.5 }}/>
          <p style={{ fontWeight:700 }}>لا توجد كوبونات بعد</p>
          <p style={{ fontSize:13, marginTop:4 }}>أنشئ أول كوبون خصم</p>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:12 }}>
          {promoCodes.map(promo => (
            <div key={promo.code} className="glass-card" style={{ 
              padding:16, 
              borderLeft: `4px solid ${promo.active ? C.green : C.red}`,
              opacity: promo.active ? 1 : 0.6
            }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{
                    width:40, height:40, borderRadius:10,
                    background: promo.discount_type === 'percent' ? `${C.green}15` : `${C.primary}15`,
                    display:'flex', alignItems:'center', justifyContent:'center'
                  }}>
                    {promo.discount_type === 'percent' ? 
                      <Percent size={20} color={C.green}/> : 
                      <Tag size={20} color={C.primary}/>
                    }
                  </div>
                  <div>
                    <div style={{ fontSize:16, fontWeight:900, color:C.dark, letterSpacing:1 }}>
                      {promo.code}
                    </div>
                    <div style={{ fontSize:12, color:C.muted }}>
                      {promo.discount_type === 'percent' ? `${promo.value}%` : `${promo.value} ج`} خصم
                      {promo.min_amount > 0 && ` · من ${fmt(promo.min_amount)} ج`}
                    </div>
                  </div>
                </div>
                <div style={{ display:'flex', gap:4 }}>
                  <button
                    onClick={() => toggleActive(promo.code, promo.active)}
                    style={{ 
                      width:32, height:32, borderRadius:8, border:'none',
                      background: promo.active ? C.greenLight : C.redLight,
                      color: promo.active ? C.green : C.red,
                      cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center'
                    }}
                    title={promo.active ? 'إيقاف' : 'تفعيل'}
                  >
                    {promo.active ? <Check size={16}/> : <X size={16}/>}
                  </button>
                  <button
                    onClick={() => handleDelete(promo.code)}
                    style={{ width:32, height:32, borderRadius:8, border:'none', background:C.redLight, color:C.red, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}
                  >
                    <Trash2 size={16}/>
                  </button>
                </div>
              </div>

              <div style={{ display:'flex', gap:8, flexWrap:'wrap', fontSize:11, color:C.muted }}>
                <span>🛒 استخدم: {promo.used_count || 0} / {promo.max_uses || '∞'}</span>
                {promo.expires_at && (
                  <span>⏰ ينتهي: {new Date(promo.expires_at).toLocaleDateString('ar-EG')}</span>
                )}
                {promo.created_by && (
                  <span>👤 بواسطة: {promo.created_by}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
