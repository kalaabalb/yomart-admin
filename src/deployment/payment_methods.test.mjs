import test from 'node:test';
import assert from 'node:assert/strict';
import { blankPaymentMethod, customerOrderPaymentLabel, orderNeedsPaymentProof, PAYMENT_CATEGORIES, paymentMethodPayload } from '../paymentMethods.js';

test('payment method management supports arbitrary configured names and provider identifiers', () => {
  const form = {
    ...blankPaymentMethod(), name: 'Local partner transfer', providerName: 'A provider entered by the owner',
    accountIdentifier: 'synthetic-account', requiresProof: true, enabled: true,
  };
  const payload = paymentMethodPayload(form);
  assert.equal(payload.name, 'Local partner transfer');
  assert.equal(payload.providerName, 'A provider entered by the owner');
  assert.equal(payload.accountIdentifier, 'synthetic-account');
  assert.equal(payload.requiresProof, true);
  assert.equal(Object.hasOwn(payload, 'code'), false);
  assert.ok(PAYMENT_CATEGORIES.some(([value]) => value === form.category));
});

test('cash on collection clears account fields and never requires proof', () => {
  const payload = paymentMethodPayload({
    ...blankPaymentMethod(), category: 'cash_collection', requiresProof: true,
    providerName: 'stale', accountHolder: 'stale', accountIdentifier: 'stale',
  });
  assert.equal(payload.requiresProof, false);
  assert.equal(payload.providerName, '');
  assert.equal(payload.accountHolder, '');
  assert.equal(payload.accountIdentifier, '');
});

test('customer order payment details prefer the immutable order snapshot', () => {
  const order = { paymentMethod: 'old-id', paymentMethodSnapshot: { name: 'Original method', requiresProof: true } };
  assert.equal(customerOrderPaymentLabel(order), 'Original method');
  assert.equal(orderNeedsPaymentProof(order), true);
  order.paymentMethodSnapshot.name = 'Renamed later';
  assert.equal(customerOrderPaymentLabel(order), 'Renamed later');
  assert.equal(orderNeedsPaymentProof({ paymentMethod: 'cod' }), false);
  assert.equal(orderNeedsPaymentProof({ paymentMethod: 'historical-transfer' }), true);
});
