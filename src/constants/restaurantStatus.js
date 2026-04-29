export const RESTAURANT_STAGE_OPTIONS = [
  { id: 'collecting', label: 'تجميع الطلبات', color: '#6366F1', light: '#EEF2FF' },
  { id: 'ordering', label: 'جارٍ الطلب', color: '#F59E0B', light: '#FFFBEB' },
  { id: 'confirmed', label: 'تم التأكيد', color: '#0EA5E9', light: '#EFF6FF' },
  { id: 'preparing', label: 'بيتجهز', color: '#8B5CF6', light: '#F5F3FF' },
  { id: 'on_way', label: 'في الطريق', color: '#10B981', light: '#ECFDF5' },
  { id: 'arrived', label: 'وصل', color: '#059669', light: '#D1FAE5' },
]

export function getRestaurantStageMeta(stage) {
  return RESTAURANT_STAGE_OPTIONS.find(option => option.id === stage) || RESTAURANT_STAGE_OPTIONS[0]
}
