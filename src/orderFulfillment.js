export const ORDER_STATUS_OPTIONS = [
  'pending', 'processing', 'shipped', 'ready_for_collection', 'collected',
  'delivered', 'cancelled', 'payment_pending', 'payment_verified',
];

export function orderUpdatePayload(form) {
  const payload = { orderStatus: form.orderStatus, trackingUrl: form.trackingUrl || '' };
  const point = form.collectionPoint || {};
  if ([point.name, point.address, point.city].some((value) => String(value || '').trim())) {
    payload.collectionPoint = {
      name: String(point.name || '').trim(),
      address: String(point.address || '').trim(),
      city: String(point.city || '').trim(),
    };
  }
  return payload;
}
