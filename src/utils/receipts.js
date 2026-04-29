import { fmt } from './helpers.js'
import { BREAD } from '../constants/data.js'

export function generatePersonalReceipt({ sessionId, sessionTitle = '', order, deliveryShare = 0, breadTypes = BREAD }) {
  if (!order) return ''
  const itemTotal = (order.lines || []).reduce((sum, line) => sum + (line.price || 0) * line.qty, 0)
  const total = itemTotal + deliveryShare
  const rows = []

  rows.push(sessionTitle || 'ساندوتشي')
  rows.push(`الجلسة: ${sessionId}`)
  rows.push(`الاسم: ${order.name}`)
  rows.push('')
  rows.push('تفاصيل الطلب:')
  ;(order.lines || []).forEach(line => {
    const bread = breadTypes.find(item => item.id === line.bt)
    rows.push(`- ${line.iname}${bread ? ` (${bread.ar})` : ''} ×${line.qty} = ${fmt((line.price || 0) * line.qty)} ج`)
    if (order.notes?.[line.key]) rows.push(`  ملاحظة: ${order.notes[line.key]}`)
  })
  rows.push('')
  rows.push(`إجمالي الأصناف: ${fmt(itemTotal)} ج`)
  if (deliveryShare > 0) rows.push(`نصيب التوصيل: ${fmt(deliveryShare)} ج`)
  rows.push(`الإجمالي المطلوب: ${fmt(total)} ج`)
  rows.push(`الحالة: ${order.paid ? 'مدفوع' : 'غير مدفوع'}`)
  return rows.join('\n')
}
