import { useState } from 'react'
import { Trash2, Plus } from 'lucide-react'
import { C } from '../../constants/colors.js'
import { api } from '../../api/client.js'
import { GhostBtn } from '../../components/Btn.jsx'
import InlineField from './InlineField.jsx'

export default function VendorCard({ vendor, onChange, onRemove }) {
  const [busy, setBusy] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const patchVendor = async patch => {
    const res = await api.updateVendor(vendor.id, patch)
    onChange({ ...vendor, ...res.vendor })
  }

  const addItem = async () => {
    setBusy(true); setErrorMsg('')
    try {
      const res = await api.createItem(vendor.id, { name: '', price: 0 })
      onChange({ ...vendor, items: [...(vendor.items || []), res.item] })
    } catch (e) {
      setErrorMsg(e?.data?.message || e?.message || 'فشل الإضافة')
    } finally { setBusy(false) }
  }

  const patchItem = async (iid, patch) => {
    const res = await api.updateItem(vendor.id, iid, patch)
    onChange({ ...vendor, items: vendor.items.map(it => it.id === iid ? { ...it, ...res.item } : it) })
  }

  const deleteItem = async iid => {
    if (!confirm('متأكد تمسحه؟')) return
    try {
      await api.deleteItem(vendor.id, iid)
      onChange({ ...vendor, items: vendor.items.filter(it => it.id !== iid) })
    } catch (e) {
      if (e.status === 409) {
        if (confirm(`الصنف مستخدم في ${e.data.sessions.length} جلسة مفتوحة. تخفيه بدل ما تمسحه؟`)) {
          await patchItem(iid, { available: false })
        }
      } else {
        alert(e?.data?.message || e?.message || 'فشل الحذف')
      }
    }
  }

  const deleteVendor = async () => {
    if (!confirm(`متأكد تمسح "${vendor.name}"؟`)) return
    try {
      await api.deleteVendor(vendor.id)
      onRemove()
    } catch (e) {
      if (e.status === 409) {
        if (confirm(`المطعم مستخدم في ${e.data.sessions.length} جلسة مفتوحة. تخفيه بدل ما تمسحه؟`)) {
          await patchVendor({ available: false })
        }
      } else {
        alert(e?.data?.message || e?.message || 'فشل الحذف')
      }
    }
  }

  const dimmed = vendor.available === false
  return (
    <div style={{ background: dimmed ? '#F2F2F2' : C.tag, borderRadius: 14, padding: 14, opacity: dimmed ? 0.6 : 1 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 70px 90px 42px', gap: 8, marginBottom: 10 }}>
        <InlineField value={vendor.name} placeholder="اسم المطعم" onSave={v => patchVendor({ name: v })}/>
        <InlineField value={vendor.emoji || ''} placeholder="🍽️" style={{ textAlign: 'center' }} onSave={v => patchVendor({ emoji: v })}/>
        <InlineField value={vendor.delivery ?? 0} type="number" placeholder="توصيل" coerce={parseFloat} onSave={v => patchVendor({ delivery: v })}/>
        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#FFF', borderRadius: 12, fontSize: 12, fontWeight: 800 }}>
          <input type="checkbox" checked={!!vendor.hasBread} onChange={e => patchVendor({ hasBread: e.target.checked })}/>
          عيش
        </label>
        <button onClick={deleteVendor} style={{ border: 'none', background: C.redLight, color: C.red, borderRadius: 10, cursor: 'pointer' }}>
          <Trash2 size={16}/>
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: C.muted, fontWeight: 800 }}>الخلفية</span>
        <input type="color" value={vendor.bg || '#FFF8E8'} onChange={e => patchVendor({ bg: e.target.value })} style={{ width: 50, height: 34, padding: 0, border: 'none', background: 'transparent' }}/>
        <span style={{ fontSize: 12, color: C.muted, fontWeight: 800 }}>صورة (https://...)</span>
        <div style={{ flex: 1, minWidth: 220 }}>
          <InlineField value={vendor.image || ''} placeholder="https://..." onSave={v => patchVendor({ image: v })}/>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 800 }}>
          <input type="checkbox" checked={vendor.available !== false} onChange={e => patchVendor({ available: e.target.checked })}/>
          مرئي
        </label>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(vendor.items || []).map(item => (
          <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 60px 40px', gap: 8, alignItems: 'center', opacity: item.available === false ? 0.5 : 1 }}>
            <InlineField value={item.name} placeholder="اسم الصنف" onSave={v => patchItem(item.id, { name: v })}/>
            <InlineField value={item.price} type="number" placeholder="السعر" coerce={parseFloat} onSave={v => patchItem(item.id, { price: v })}/>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 11, fontWeight: 800 }}>
              <input type="checkbox" checked={item.available !== false} onChange={e => patchItem(item.id, { available: e.target.checked })}/>
              مرئي
            </label>
            <button onClick={() => deleteItem(item.id)} style={{ border: 'none', background: C.redLight, color: C.red, borderRadius: 10, cursor: 'pointer' }}>×</button>
          </div>
        ))}
      </div>

      <GhostBtn onClick={addItem} disabled={busy} style={{ width: '100%', marginTop: 10, justifyContent: 'center' }}>
        <Plus size={14}/> إضافة صنف
      </GhostBtn>
      {errorMsg && <div style={{ marginTop: 8, color: C.red, fontSize: 12 }}>{errorMsg}</div>}
    </div>
  )
}