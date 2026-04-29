export function getOrdersArray(allOrders) {
  return Object.entries(allOrders || {})
    .map(([uid, order]) => ({ uid, ...order }))
    .sort((a, b) => (a.submittedAt || 0) - (b.submittedAt || 0))
}

export function getItemsTotal(lines) {
  return (lines || []).reduce((sum, line) => sum + (line.price || 0) * line.qty, 0)
}

export function getPerPersonDelivery(allOrders, delivery) {
  const count = Object.keys(allOrders || {}).length
  return count > 0 ? (delivery || 0) / count : 0
}

export function getOrderTotal(order, deliveryShare = 0) {
  return getItemsTotal(order?.lines) + (deliveryShare || 0)
}

export function getGrandTotal(allOrders, delivery) {
  return getOrdersArray(allOrders).reduce((sum, order) => sum + getItemsTotal(order.lines), 0) + (delivery || 0)
}

export function getMissingMembers(expected, allOrders) {
  const orderedNames = new Set(getOrdersArray(allOrders).map(order => order.name))
  return (expected || []).filter(name => !orderedNames.has(name))
}

export function getPaidSummary(allOrders, delivery) {
  const orders = getOrdersArray(allOrders)
  const perPerson = getPerPersonDelivery(allOrders, delivery)
  const totalDue = orders.reduce((sum, order) => sum + getOrderTotal(order, perPerson), 0)
  const totalPaid = orders.reduce((sum, order) => sum + (order.paid ? (order.paidAmount ?? getOrderTotal(order, perPerson)) : 0), 0)
  return {
    totalDue,
    totalPaid,
    remaining: totalDue - totalPaid,
    paidCount: orders.filter(order => order.paid).length,
    unpaidCount: orders.filter(order => !order.paid).length,
  }
}

export function getRestaurantBreakdown(allOrders, rests) {
  const lookup = new Map((rests || []).map(rest => [String(rest.id), rest]))
  const grouped = new Map()

  getOrdersArray(allOrders).forEach(order => {
    ;(order.lines || []).forEach(line => {
      const key = String(line.rid)
      const rest = lookup.get(key) || { id: line.rid, name: line.rname || 'غير معروف' }
      const entry = grouped.get(key) || {
        id: rest.id,
        name: rest.name,
        people: new Set(),
        items: 0,
        lines: 0,
        total: 0,
      }
      entry.people.add(order.name)
      entry.items += line.qty
      entry.lines += 1
      entry.total += (line.price || 0) * line.qty
      grouped.set(key, entry)
    })
  })

  return [...grouped.values()]
    .map(entry => ({ ...entry, peopleCount: entry.people.size }))
    .sort((a, b) => b.total - a.total)
}

export function getDrinkBreakdown(allOrders, drinks) {
  const lookup = new Map((drinks || []).map(drink => [drink.id, drink]))
  const totals = {}

  getOrdersArray(allOrders).forEach(order => {
    Object.entries(order.drinks || {}).forEach(([drinkId, qty]) => {
      if (qty > 0) totals[drinkId] = (totals[drinkId] || 0) + qty
    })
  })

  return Object.entries(totals)
    .map(([drinkId, qty]) => ({
      id: drinkId,
      qty,
      ...(lookup.get(drinkId) || { name: drinkId, emoji: '🥤' }),
    }))
    .sort((a, b) => b.qty - a.qty)
}

export function buildSessionCsv(allOrders, delivery) {
  const orders = getOrdersArray(allOrders)
  const perPerson = getPerPersonDelivery(allOrders, delivery)
  const rows = [
    ['name', 'items_total', 'delivery_share', 'total_due', 'paid', 'paid_amount', 'submitted_at', 'items'],
  ]

  orders.forEach(order => {
    rows.push([
      order.name,
      getItemsTotal(order.lines),
      perPerson.toFixed(2),
      getOrderTotal(order, perPerson).toFixed(2),
      order.paid ? 'yes' : 'no',
      order.paidAmount ?? '',
      order.submittedAt ? new Date(order.submittedAt).toISOString() : '',
      (order.lines || [])
        .map(line => `${line.iname} x${line.qty}${line.bt ? ` (${line.bt})` : ''}`)
        .join(' | '),
    ])
  })

  return rows
    .map(row =>
      row
        .map(cell => {
          const value = String(cell ?? '')
          return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
        })
        .join(',')
    )
    .join('\n')
}

export function downloadBlob(filename, content, mime) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}
