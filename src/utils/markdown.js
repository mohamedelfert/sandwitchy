import { BREAD, DRINKS } from '../constants/data.js'
import { getDrinkBreakdown, getItemsTotal, getOrdersArray, getPerPersonDelivery, getRestaurantBreakdown } from './orders.js'

export function generateMD(allOrders, delivery, sessionId, options = {}) {
  const breadTypes = options.breadTypes?.length ? options.breadTypes : BREAD
  const drinkTypes = options.drinkTypes?.length ? options.drinkTypes : DRINKS
  const rests = options.rests || []
  const orders = getOrdersArray(allOrders)
  const perPerson = getPerPersonDelivery(allOrders, delivery)
  const date = new Date().toLocaleDateString('ar-EG', { year:'numeric', month:'long', day:'numeric' })
  const lines = []

  lines.push('# طلبات الجروب')
  lines.push('')
  lines.push(`**التاريخ:** ${date}  `)
  lines.push(`**كود الجلسة:** \`${sessionId}\``)
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('## طلب كل شخص')
  lines.push('')

  orders.forEach(order => {
    const total = getItemsTotal(order.lines) + perPerson
    lines.push(`### ${order.name}`)
    ;(order.lines || []).forEach(line => {
      const bread = breadTypes.find(item => item.id === line.bt)
      lines.push(`- ${line.iname}${bread ? ` (${bread.ar})` : ''} × ${line.qty}${line.price ? ` — ${line.price * line.qty} ج` : ''}`)
    })
    if (delivery > 0) lines.push(`- نصيبه من التوصيل: ${perPerson.toFixed(2)} ج`)
    lines.push(`- **الإجمالي: ${total.toFixed(2)} ج**`)
    lines.push(`- **الحالة:** ${order.paid ? 'مدفوع' : 'غير مدفوع'}`)
    lines.push('')
  })

  lines.push('---')
  lines.push('')
  lines.push('## التجميع حسب المطعم')
  lines.push('')

  const restaurants = getRestaurantBreakdown(allOrders, rests)
  if (restaurants.length) {
    lines.push('| المطعم | المشاركون | القطع | الإجمالي |')
    lines.push('|--------|-----------|-------|----------|')
    restaurants.forEach(rest => {
      lines.push(`| ${rest.name} | ${rest.peopleCount} | ${rest.items} | ${rest.total} ج |`)
    })
  } else {
    lines.push('لا توجد مطاعم مجمعة.')
  }

  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('## التجميع حسب نوع العيش')
  lines.push('')

  const grouped = {}
  ;[...breadTypes.map(bread => bread.id), 'none'].forEach(id => {
    grouped[id] = {}
  })

  orders.forEach(order => {
    ;(order.lines || []).forEach(line => {
      const key = line.bt || 'none'
      if (!grouped[key]) grouped[key] = {}
      if (!grouped[key][line.iname]) grouped[key][line.iname] = { name: line.iname, qty: 0 }
      grouped[key][line.iname].qty += line.qty
    })
  })

  ;[...breadTypes.map(bread => ({ id: bread.id, name: bread.ar })), { id: 'none', name: 'بدون عيش' }].forEach(group => {
    const items = Object.values(grouped[group.id] || {}).filter(item => item.qty > 0)
    if (!items.length) return
    lines.push(`### ${group.name}`)
    items.forEach(item => lines.push(`- ${item.name}: ×${item.qty}`))
    lines.push('')
  })

  const drinks = getDrinkBreakdown(allOrders, drinkTypes)
  if (drinks.length) {
    lines.push('---')
    lines.push('')
    lines.push('## مشروبات الشركة')
    lines.push('')
    drinks.forEach(drink => lines.push(`- ${drink.emoji} ${drink.name}: ×${drink.qty}`))
    lines.push('')
  }

  lines.push('---')
  lines.push('')
  lines.push('## ملخص الدفع')
  lines.push('')
  lines.push('| الاسم | قيمة الطلب | التوصيل | الإجمالي | الحالة |')
  lines.push('|-------|-----------|---------|----------|--------|')
  orders.forEach(order => {
    const itemsTotal = getItemsTotal(order.lines)
    lines.push(`| ${order.name} | ${itemsTotal} ج | ${perPerson.toFixed(2)} ج | ${(itemsTotal + perPerson).toFixed(2)} ج | ${order.paid ? 'مدفوع' : 'غير مدفوع'} |`)
  })
  lines.push('')
  lines.push(`**إجمالي الطلبات:** ${orders.reduce((sum, order) => sum + getItemsTotal(order.lines), 0)} ج  `)
  lines.push(`**التوصيل:** ${delivery} ج  `)
  lines.push(`**الإجمالي الكلي:** ${orders.reduce((sum, order) => sum + getItemsTotal(order.lines), 0) + delivery} ج`)

  return lines.join('\n')
}
