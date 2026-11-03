export const PAYMENT_CATEGORIES = Object.freeze([
  ['cash_collection', 'Cash on collection'],
  ['bank_transfer', 'Bank transfer'],
  ['mobile_wallet', 'Mobile wallet'],
  ['other', 'Other manual method'],
]);

export const blankPaymentMethod = () => ({
  name: '', description: '', category: 'bank_transfer', logoUrl: '', providerName: '',
  accountHolder: '', accountIdentifier: '', additionalDetails: '', instructions: '',
  requiresProof: true, enabled: false, displayOrder: 0,
});

export function paymentMethodPayload(form) {
  const category = form.category;
  return {
    ...form,
    name: String(form.name || '').trim(),
    description: String(form.description || '').trim(),
    logoUrl: String(form.logoUrl || '').trim(),
    providerName: category === 'cash_collection' ? '' : String(form.providerName || '').trim(),
    accountHolder: category === 'cash_collection' ? '' : String(form.accountHolder || '').trim(),
    accountIdentifier: category === 'cash_collection' ? '' : String(form.accountIdentifier || '').trim(),
    additionalDetails: String(form.additionalDetails || '').trim(),
    instructions: String(form.instructions || '').trim(),
    requiresProof: category === 'cash_collection' ? false : Boolean(form.requiresProof),
    enabled: Boolean(form.enabled),
    displayOrder: Number(form.displayOrder),
  };
}

export function customerOrderPaymentLabel(order) {
  return order?.paymentMethodSnapshot?.name || order?.paymentMethod || 'Payment method unavailable';
}

export function orderNeedsPaymentProof(order) {
  if (typeof order?.paymentMethodSnapshot?.requiresProof === 'boolean') return order.paymentMethodSnapshot.requiresProof;
  return Boolean(order?.paymentMethod && order.paymentMethod !== 'cod');
}
