import test from 'node:test';
import assert from 'node:assert/strict';
import { ORDER_STATUS_OPTIONS, orderUpdatePayload } from '../orderFulfillment.js';

test('admin order payload sends staff collection point separately from customer destination', () => {
  assert.deepEqual(orderUpdatePayload({
    orderStatus: 'ready_for_collection',
    trackingUrl: '',
    shippingAddress: { city: 'Customer city', street: 'Customer area' },
    collectionPoint: { name: 'Agreed site', address: 'Staff recorded location', city: 'Bahir Dar' },
  }), {
    orderStatus: 'ready_for_collection',
    trackingUrl: '',
    collectionPoint: { name: 'Agreed site', address: 'Staff recorded location', city: 'Bahir Dar' },
  });
});

test('admin does not invent a collection point when no fields have been recorded', () => {
  const payload = orderUpdatePayload({ orderStatus: 'processing' });
  assert.equal(Object.hasOwn(payload, 'collectionPoint'), false);
});

test('admin status selector includes collection steps and historical statuses', () => {
  assert.ok(ORDER_STATUS_OPTIONS.includes('ready_for_collection'));
  assert.ok(ORDER_STATUS_OPTIONS.includes('collected'));
  assert.ok(ORDER_STATUS_OPTIONS.includes('delivered'));
});
