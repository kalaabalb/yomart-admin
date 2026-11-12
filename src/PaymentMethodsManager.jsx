import { useEffect, useState } from 'react';
import { AlertCircle, Check, CreditCard, Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { blankPaymentMethod, PAYMENT_CATEGORIES, paymentMethodPayload } from './paymentMethods.js';

async function paymentMethodRequest(api, token, path, { method = 'GET', body } = {}) {
  let response;
  try {
    response = await fetch(`${api}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch { throw new Error('Could not reach the payment settings service.'); }
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.success === false) throw new Error(result.message || `Request failed (${response.status})`);
  return result.data;
}

export default function PaymentMethodsManager({ api, token, refresh, notify }) {
  const [methods, setMethods] = useState([]);
  const [form, setForm] = useState(blankPaymentMethod);
  const [editingCode, setEditingCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true); setError('');
    try { setMethods(await paymentMethodRequest(api, token, '/store-settings/payment-methods') || []); }
    catch (cause) { setError(cause.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [api, token, refresh]);

  function edit(method) {
    setEditingCode(method.code);
    setForm({ ...blankPaymentMethod(), ...method });
    setError('');
  }
  function reset() { setEditingCode(''); setForm(blankPaymentMethod()); setError(''); }
  function change(key, value) {
    setForm((current) => ({
      ...current,
      [key]: value,
      ...(key === 'category' && value === 'cash_collection' ? { requiresProof: false, providerName: '', accountHolder: '', accountIdentifier: '' } : {}),
    }));
  }
  async function save(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      await paymentMethodRequest(api, token, editingCode
        ? `/store-settings/payment-methods/${encodeURIComponent(editingCode)}`
        : '/store-settings/payment-methods', {
        method: editingCode ? 'PUT' : 'POST', body: paymentMethodPayload(form),
      });
      notify(editingCode ? 'Payment method updated.' : 'Payment method added.');
      reset(); await load();
    } catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  }
  async function toggle(method) {
    const { code, ...editable } = method;
    try {
      await paymentMethodRequest(api, token, `/store-settings/payment-methods/${encodeURIComponent(code)}`, {
        method: 'PUT', body: { ...editable, enabled: !method.enabled },
      });
      notify(method.enabled ? 'Payment method deactivated.' : 'Payment method activated.'); await load();
    } catch (cause) { notify(cause.message, 'error'); }
  }
  async function remove(method) {
    if (!window.confirm(`Delete “${method.name || method.title}”? Historical orders keep their saved payment details.`)) return;
    try {
      await paymentMethodRequest(api, token, `/store-settings/payment-methods/${encodeURIComponent(method.code)}`, { method: 'DELETE' });
      notify('Payment method deleted.'); await load();
    } catch (cause) { notify(cause.message, 'error'); }
  }

  const needsAccount = form.category !== 'cash_collection';
  return <section className="payment-method-manager">
    <div className="rc-toolbar"><div/><button className="button secondary" onClick={load} disabled={loading}><RefreshCw size={15}/> Refresh</button></div>
    <div className="panel rc-form-panel"><form onSubmit={save}>
      <div className="rc-form-heading"><div><h3>{editingCode ? 'Edit payment method' : 'Add a payment method'}</h3><p>Payment details are copied into each new order so later edits do not change order history.</p></div>{editingCode && <button type="button" className="icon-button" onClick={reset} aria-label="Cancel editing"><X size={17}/></button>}</div>
      <div className="rc-fields payment-method-fields">
        <label>Display name<input required maxLength={80} value={form.name} onChange={(e) => change('name', e.target.value)} /></label>
        <label>Category<select value={form.category} onChange={(e) => change('category', e.target.value)}>{PAYMENT_CATEGORIES.map(([value, title]) => <option key={value} value={value}>{title}</option>)}</select></label>
        <label>Description (optional)<input maxLength={240} value={form.description} onChange={(e) => change('description', e.target.value)} /></label>
        <label>Logo URL (optional)<input type="url" maxLength={500} placeholder="https://…" value={form.logoUrl} onChange={(e) => change('logoUrl', e.target.value)} /></label>
        {needsAccount && <>
          <label>Bank or provider (optional)<input maxLength={100} value={form.providerName} onChange={(e) => change('providerName', e.target.value)} /></label>
          <label>Account holder / recipient (optional)<input maxLength={120} value={form.accountHolder} onChange={(e) => change('accountHolder', e.target.value)} /></label>
          <label>Account or wallet identifier<input maxLength={160} value={form.accountIdentifier} onChange={(e) => change('accountIdentifier', e.target.value)} /></label>
        </>}
        <label className="rc-wide">Additional payment details (optional)<textarea maxLength={500} rows="2" value={form.additionalDetails} onChange={(e) => change('additionalDetails', e.target.value)} /></label>
        <label className="rc-wide">Customer instructions (optional)<textarea maxLength={500} rows="3" value={form.instructions} onChange={(e) => change('instructions', e.target.value)} /></label>
        <label>Display order<input type="number" min="0" max="100000" step="1" value={form.displayOrder} onChange={(e) => change('displayOrder', e.target.value)} /></label>
        <label className="rc-toggle"><input type="checkbox" checked={form.requiresProof} disabled={!needsAccount} onChange={(e) => change('requiresProof', e.target.checked)} /> Require customer payment proof</label>
        <label className="rc-toggle"><input type="checkbox" checked={form.enabled} onChange={(e) => change('enabled', e.target.checked)} /> Active at checkout</label>
      </div>
      {form.category === 'cash_collection' && <p className="field-hint">Cash on collection never requires a receipt or bank details.</p>}
      {error && <div className="inline-alert" role="alert"><AlertCircle size={16}/>{error}</div>}
      <button className="button primary" disabled={busy}>{busy ? 'Saving…' : <><Check size={15}/>{editingCode ? 'Save changes' : 'Add payment method'}</>}</button>
    </form></div>
    {loading ? <div className="panel table-loading"><span className="spinner"/>Loading payment methods…</div> : error && !methods.length ? <div className="panel resource-error"><b>Could not load payment methods</b><p>{error}</p><button className="button secondary" onClick={load}>Try again</button></div> : methods.length === 0 ? <div className="panel rc-empty"><CreditCard size={20}/><b>No payment methods configured</b><p>Checkout remains unavailable until an active method is configured.</p></div> : <div className="rc-list">{methods.map((method) => <article className="panel rc-row" key={method.code}>
      <div className="rc-row-copy"><div className="rc-row-title"><strong>{method.name}</strong><span className={`status-pill ${method.enabled ? 'status-success' : 'status-muted'}`}>{method.enabled ? 'Active' : 'Inactive'}</span></div><p>{method.category.replaceAll('_', ' ')} · {method.requiresProof ? 'proof required' : 'no proof'} · order {method.displayOrder}</p>{method.providerName && <small>{method.providerName}</small>}{method.accountIdentifier && <code>{method.accountIdentifier}</code>}{method.instructions && <small>{method.instructions}</small>}</div>
      <div className="rc-row-actions"><button className="button secondary" onClick={() => toggle(method)}>{method.enabled ? 'Deactivate' : 'Activate'}</button><button className="icon-button" onClick={() => edit(method)} aria-label={`Edit ${method.name}`}><Pencil size={16}/></button><button className="icon-button danger" onClick={() => remove(method)} aria-label={`Delete ${method.name}`}><Trash2 size={16}/></button></div>
    </article>)}</div>}
  </section>;
}

export { paymentMethodRequest };
