import { BREAD, DRINKS, INIT_RESTS } from '../constants/data.js'

export function generateMD(allOrders, delivery, sessionId) {
  const orders    = Object.values(allOrders).sort((a, b) => a.submittedAt - b.submittedAt)
  const numPeople = orders.length
  const perPerson = numPeople > 0 ? delivery / numPeople : 0
  const date      = new Date().toLocaleDateString('ar-EG', { year:'numeric', month:'long', day:'numeric' })
  const L = []

  L.push(`# 🥙 طلبات الجروب`)
  L.push(``)
  L.push(`**التاريخ:** ${date}  `)
  L.push(`**كود الجلسة:** \`${sessionId}\``)
  L.push(``)
  L.push(`---`)
  L.push(``)
  L.push(`## 👥 طلب كل شخص`)
  L.push(``)

  orders.forEach(o => {
    const itemsTotal = (o.lines || []).reduce((s, l) => s + (l.price || 0) * l.qty, 0)
    const total = itemsTotal + perPerson
    L.push(`### ${o.name}`)
    ;(o.lines || []).forEach(l => {
      const b = BREAD.find(x => x.id === l.bt)
      L.push(`- ${l.iname}${b ? ` (${b.ar})` : ''} × ${l.qty}${l.price ? ` — ${l.price * l.qty} ج` : ''}`)
    })
    const drinkEntries = Object.entries(o.drinks || {}).filter(([, q]) => q > 0)
    if (drinkEntries.length) {
      L.push(`- **مشاريب:**`)
      drinkEntries.forEach(([did, q]) => {
        const dr = DRINKS.find(x => x.id === did)
        if (dr) L.push(`  - ${dr.emoji} ${dr.name} × ${q}`)
      })
    }
    if (delivery > 0) L.push(`- 🚗 نصيبه من توصيل إضافي: ${perPerson.toFixed(2)} ج`)
    INIT_RESTS.filter(r => r.delivery > 0).forEach(r => {
      const ordered = (o.lines || []).some(l => l.rid === r.id)
      if (!ordered) return
      const cnt   = orders.filter(oo => (oo.lines || []).some(l => l.rid === r.id)).length
      const share = cnt > 0 ? r.delivery / cnt : 0
      L.push(`- 🚗 توصيل ${r.name}: ${share.toFixed(2)} ج`)
    })
    L.push(`- **الإجمالي: ${total.toFixed(2)} ج**`)
    L.push(``)
  })

  L.push(`---`)
  L.push(``)
  L.push(`## 📊 الإجمالي المجمع`)
  L.push(``)

  const combined = {}
  ;[...BREAD.map(b => b.id), 'none'].forEach(g => { combined[g] = {} })
  orders.forEach(o => {
    (o.lines || []).forEach(l => {
      const g = l.bt || 'none'
      if (!combined[g][l.iname]) combined[g][l.iname] = { name: l.iname, qty: 0 }
      combined[g][l.iname].qty += l.qty
    })
  })
  const groups = [...BREAD.map(b => ({ id: b.id, ar: b.ar })), { id: 'none', ar: 'بدون عيش' }]
  groups.forEach(g => {
    const items = Object.values(combined[g.id] || {}).filter(i => i.qty > 0)
    if (!items.length) return
    L.push(`### ${g.ar}`)
    L.push(`| الصنف | الكمية |`)
    L.push(`|-------|--------|`)
    items.forEach(i => L.push(`| ${i.name} | ×${i.qty} |`))
    L.push(``)
  })

  L.push(`---`)
  L.push(``)

  const dCombined = {}
  orders.forEach(o => {
    Object.entries(o.drinks || {}).forEach(([did, q]) => {
      if (q > 0) dCombined[did] = (dCombined[did] || 0) + q
    })
  })
  const dEntries = Object.entries(dCombined).filter(([, q]) => q > 0)
  if (dEntries.length) {
    L.push(`## ☕ مشاريب الشركة`)
    L.push(``)
    L.push(`| المشروب | الكمية |`)
    L.push(`|---------|--------|`)
    dEntries.forEach(([did, q]) => {
      const dr = DRINKS.find(x => x.id === did)
      if (dr) L.push(`| ${dr.emoji} ${dr.name} | ×${q} |`)
    })
    L.push(``)
    L.push(`---`)
    L.push(``)
  }

  L.push(`## 💰 ملخص الدفع`)
  L.push(``)
  if (delivery > 0) {
    L.push(`| الاسم | قيمة الطلب | التوصيل | الإجمالي |`)
    L.push(`|-------|-----------|---------|---------|`)
    orders.forEach(o => {
      const it = (o.lines || []).reduce((s, l) => s + (l.price || 0) * l.qty, 0)
      L.push(`| ${o.name} | ${it} ج | ${perPerson.toFixed(2)} ج | **${(it + perPerson).toFixed(2)} ج** |`)
    })
  } else {
    L.push(`| الاسم | الإجمالي |`)
    L.push(`|-------|---------|`)
    orders.forEach(o => {
      const it = (o.lines || []).reduce((s, l) => s + (l.price || 0) * l.qty, 0)
      L.push(`| ${o.name} | ${it} ج |`)
    })
  }
  L.push(``)
  const grandItems = orders.reduce((s, o) => s + (o.lines || []).reduce((ss, l) => ss + (l.price || 0) * l.qty, 0), 0)
  L.push(`**إجمالي الطلبات:** ${grandItems} ج  `)
  if (delivery > 0) {
    L.push(`**التوصيل:** ${delivery} ج  `)
    L.push(`**الإجمالي الكلي:** ${grandItems + delivery} ج`)
  } else {
    L.push(`**الإجمالي الكلي:** ${grandItems} ج`)
  }
  return L.join('\n')
}

export function downloadMD(content, filename = 'talabati-order.md') {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click()
  document.body.removeChild(a); URL.revokeObjectURL(url)
}
