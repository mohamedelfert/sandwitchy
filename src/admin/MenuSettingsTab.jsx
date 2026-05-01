import { useEffect, useState } from 'react'
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { C } from '../constants/colors.js'
import { api } from '../api/client.js'
import { GhostBtn, Btn } from '../components/Btn.jsx'
import VendorCard from './menu/VendorCard.jsx'
import InlineField from './menu/InlineField.jsx'

function Section({ title, children, count, defaultOpen = true, color = C.primary }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ 
      background: '#FFF', 
      borderRadius: 16, 
      boxShadow: '0 2px 16px rgba(0,0,0,0.06)', 
      marginBottom: 16, 
      overflow: 'hidden' 
    }}>
      <button 
        onClick={() => setOpen(o => !o)} 
        style={{ 
          width: '100%', 
          textAlign: 'start', 
          padding: '14px 20px', 
          border: 'none', 
          background: open ? `${color}08` : 'transparent',
          fontWeight: 900, 
          fontSize: 16, 
          color: C.dark, 
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          transition: 'background 0.2s'
        }}
      >
        <span>{title}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {count !== undefined && (
            <span style={{ 
              background: color, 
              color: '#FFF', 
              fontSize: 12, 
              padding: '4px 10px', 
              borderRadius: 20,
              fontWeight: 700
            }}>
              {count}
            </span>
          )}
          {open ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
      </button>
      {open && <div style={{ padding: '0 16px 16px' }}>{children}</div>}
    </div>
  )
}

function BreadRow({ bread, onSave, onDelete }) {
  return (
    <div style={{ 
      display: 'grid', 
      gridTemplateColumns: '1fr 50px 60px 40px', 
      gap: 10, 
      alignItems: 'center', 
      opacity: bread.available === false ? 0.45 : 1,
      padding: '10px 12px',
      background: C.tag,
      borderRadius: 12,
      transition: 'all 0.2s'
    }}>
      <InlineField 
        value={bread.ar} 
        placeholder="اسم العيش" 
        onSave={onSave}
      />
      <input 
        type="color" 
        value={bread.color || '#B83A0A'} 
        onChange={e => onSave({ color: e.target.value, light: `${e.target.value}15` })} 
        style={{ 
          width: '100%', 
          height: 36, 
          padding: 0, 
          border: 'none', 
          background: 'transparent',
          cursor: 'pointer',
          borderRadius: 8
        }}
      />
      <label style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        gap: 6, 
        fontSize: 11, 
        fontWeight: 800,
        background: '#FFF',
        padding: '6px 8px',
        borderRadius: 8,
        cursor: 'pointer',
        whiteSpace: 'nowrap'
      }}>
        <input 
          type="checkbox" 
          checked={bread.available !== false} 
          onChange={e => onSave({ available: e.target.checked })}
          style={{ width: 14, height: 14 }}
        />
        نشط
      </label>
      <button 
        onClick={onDelete} 
        style={{ 
          border: 'none', 
          background: C.redLight, 
          color: C.red, 
          borderRadius: 8, 
          height: 36, 
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <Trash2 size={16}/>
      </button>
    </div>
  )
}

function DrinkCard({ drink, onSave, onDelete }) {
  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: 12, 
      padding: '12px 14px',
      background: drink.available === false ? `${C.muted}15` : C.tag,
      borderRadius: 12,
      opacity: drink.available === false ? 0.5 : 1,
      transition: 'all 0.2s'
    }}>
      <div style={{ 
        width: 40, 
        height: 40, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#FFF',
        borderRadius: 10,
        fontSize: 20
      }}>
        {drink.emoji || '🥤'}
      </div>
      <div style={{ flex: 1 }}>
        <InlineField 
          value={drink.name} 
          placeholder="اسم المشروب" 
          onSave={v => onSave({ name: v })}
        />
      </div>
      <label style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 6, 
        fontSize: 11, 
        fontWeight: 800,
        color: C.muted,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        padding: '0 4px'
      }}>
        <input 
          type="checkbox" 
          checked={drink.available !== false} 
          onChange={e => onSave({ available: e.target.checked })}
          style={{ width: 14, height: 14 }}
        />
        نشط
      </label>
      <button 
        onClick={onDelete} 
        style={{ 
          border: 'none', 
          background: C.redLight, 
          color: C.red, 
          borderRadius: 8, 
          width: 36,
          height: 36,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <Trash2 size={16}/>
      </button>
    </div>
  )
}

export default function MenuSettingsTab() {
  const [rests, setRests] = useState([])
  const [breadTypes, setBreadTypes] = useState([])
  const [drinks, setDrinks] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [newBread, setNewBread] = useState({ ar: '', color: '#B83A0A' })
  const [newDrink, setNewDrink] = useState({ name: '', emoji: '🥤' })

  const load = async () => {
    try {
      const s = await api.getSettings()
      setRests(s.rests || [])
      setBreadTypes(s.bread_types || [])
      setDrinks(s.drinks || [])
    } catch (e) {
      setErrorMsg('فشل تحميل البيانات')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const addVendor = async () => {
    try {
      const res = await api.createVendor({ name: 'مطعم جديد' })
      setRests(prev => [...prev, res.vendor])
    } catch (e) { alert(e?.data?.message || 'فشل الإضافة') }
  }

  const handleAddBread = async () => {
    if (!newBread.ar.trim()) return
    try {
      const res = await api.createBread({ ar: newBread.ar, color: newBread.color })
      setBreadTypes(prev => [...prev, res.bread])
      setNewBread({ ar: '', color: '#B83A0A' })
    } catch (e) { alert(e?.data?.message || 'فشل الإضافة') }
  }

  const handleAddDrink = async () => {
    if (!newDrink.name.trim()) return
    try {
      const res = await api.createDrink(newDrink)
      setDrinks(prev => [...prev, res.drink])
      setNewDrink({ name: '', emoji: '🥤' })
    } catch (e) { alert(e?.data?.message || 'فشل الإضافة') }
  }

  const deleteBread = async id => {
    if (!confirm('متأكد تمسحه؟')) return
    try {
      await api.deleteBread(id)
      setBreadTypes(prev => prev.filter(b => b.id !== id))
    } catch (e) {
      if (e.status === 409) {
        if (confirm(`مستخدم في ${e.data.sessions.length} جلسة. تخفيه؟`)) {
          await api.updateBread(id, { available: false })
          setBreadTypes(prev => prev.map(b => b.id === id ? { ...b, available: false } : b))
        }
      } else alert(e?.data?.message || 'فشل الحذف')
    }
  }

  const deleteDrink = async id => {
    if (!confirm('متأكد تمسحه؟')) return
    try {
      await api.deleteDrink(id)
      setDrinks(prev => prev.filter(d => d.id !== id))
    } catch (e) {
      if (e.status === 409) {
        if (confirm(`مستخدم في ${e.data.sessions.length} جلسة. تخفيه؟`)) {
          await api.updateDrink(id, { available: false })
          setDrinks(prev => prev.map(d => d.id === id ? { ...d, available: false } : d))
        }
      } else alert(e?.data?.message || 'فشل الحذف')
    }
  }

  const patchBread = async (id, patch) => {
    try {
      const res = await api.updateBread(id, patch)
      setBreadTypes(prev => prev.map(b => b.id === id ? { ...b, ...res.bread } : b))
    } catch (e) { console.error(e) }
  }

  const patchDrink = async (id, patch) => {
    try {
      const res = await api.updateDrink(id, patch)
      setDrinks(prev => prev.map(d => d.id === id ? { ...d, ...res.drink } : d))
    } catch (e) { console.error(e) }
  }

  const replaceVendor = nextVendor =>
    setRests(prev => prev.map(v => v.id === nextVendor.id ? nextVendor : v))

  const removeVendor = id =>
    setRests(prev => prev.filter(v => v.id !== id))

  if (loading) return <div style={{ padding: 40, color: C.muted, textAlign: 'center', fontSize: 16 }}>...جاري التحميل</div>
  if (errorMsg) return <div style={{ padding: 40, color: C.red, textAlign: 'center', fontSize: 16 }}>{errorMsg}</div>

  return (
    <div style={{ 
      padding: '0 8px',
      maxWidth: 800,
      margin: '0 auto',
      height: '100%',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    }}>
      
      
      <Section title="🍽️ المطاعم والأماكن" count={rests.length}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {rests.map(v => (
            <VendorCard key={v.id} vendor={v} onChange={replaceVendor} onRemove={() => removeVendor(v.id)}/>
          ))}
        </div>
        <GhostBtn onClick={addVendor} style={{ width: '100%', marginTop: 16, justifyContent: 'center', height: 44 }}>
          <Plus size={18}/> إضافة مطعم جديد
        </GhostBtn>
      </Section>

      <Section title="🍞 أنواع العيش" count={breadTypes.length} color="#B83A0A">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {breadTypes.map(b => (
            <BreadRow 
              key={b.id} 
              bread={b} 
              onSave={patch => patchBread(b.id, patch)} 
              onDelete={() => deleteBread(b.id)}
            />
          ))}
        </div>
        
        <div style={{ 
          marginTop: 14, 
          padding: 14, 
          background: `${C.primary}06`, 
          borderRadius: 12,
          display: 'grid',
          gridTemplateColumns: '1fr 50px auto',
          gap: 10,
          alignItems: 'center'
        }}>
          <input 
            type="text" 
            placeholder="نوع عيش جديد (مثل: فينو)" 
            value={newBread.ar}
            onChange={e => setNewBread(prev => ({ ...prev, ar: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && handleAddBread()}
            style={{
              padding: '12px 14px',
              border: `2px solid ${C.border}`,
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 700,
              fontFamily: 'inherit',
              outline: 'none',
              background: '#FFF'
            }}
          />
          <input 
            type="color" 
            value={newBread.color}
            onChange={e => setNewBread(prev => ({ ...prev, color: e.target.value }))}
            style={{
              width: '100%',
              height: 42,
              padding: 0,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              borderRadius: 8
            }}
          />
          <GhostBtn onClick={handleAddBread} disabled={!newBread.ar.trim()} style={{ height: 42, justifyContent: 'center', fontSize: 14 }}>
            <Plus size={16}/> إضافة
          </GhostBtn>
        </div>
      </Section>

      <Section title="🥤 المشروبات" count={drinks.length} color="#10B981">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {drinks.map(d => (
            <DrinkCard 
              key={d.id} 
              drink={d} 
              onSave={patch => patchDrink(d.id, patch)} 
              onDelete={() => deleteDrink(d.id)}
            />
          ))}
        </div>
        
        <div style={{ 
          marginTop: 14, 
          padding: 14, 
          background: `${C.green}06`, 
          borderRadius: 12,
          display: 'grid',
          gridTemplateColumns: '45px 1fr auto',
          gap: 10,
          alignItems: 'center'
        }}>
          <input 
            type="text" 
            placeholder="🥤"
            value={newDrink.emoji}
            onChange={e => setNewDrink(prev => ({ ...prev, emoji: e.target.value }))}
            style={{
              padding: '8px 4px',
              border: `2px solid ${C.border}`,
              borderRadius: 10,
              fontSize: 18,
              textAlign: 'center',
              fontFamily: 'inherit',
              outline: 'none',
              background: '#FFF'
            }}
          />
          <input 
            type="text" 
            placeholder="مشروب جديد (مثل: عصير برتقال)" 
            value={newDrink.name}
            onChange={e => setNewDrink(prev => ({ ...prev, name: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && handleAddDrink()}
            style={{
              padding: '12px 14px',
              border: `2px solid ${C.border}`,
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 700,
              fontFamily: 'inherit',
              outline: 'none',
              background: '#FFF'
            }}
          />
          <GhostBtn onClick={handleAddDrink} disabled={!newDrink.name.trim()} style={{ height: 42, justifyContent: 'center', fontSize: 14 }}>
            <Plus size={16}/> إضافة
          </GhostBtn>
        </div>
      </Section>
    </div>
  )
}