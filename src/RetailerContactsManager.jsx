import { useEffect, useState } from 'react';
import { AlertCircle, Check, Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-react';

const TYPES = ['phone', 'telegram', 'whatsapp', 'email', 'website', 'other'];
const PLACEMENTS = [
  ['product_details', 'Product details'], ['support_page', 'Support page'],
  ['storefront_footer', 'Storefront footer'], ['all', 'All locations'],
];
const blank = () => ({ label: '', description: '', type: 'phone', value: '', placement: 'all', displayOrder: 0, isActive: true });

export async function retailerContactRequest(api, token, path, { method = 'GET', body } = {}) {
  const response = await fetch(`${api}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) throw new Error(payload.message || `Request failed (${response.status})`);
  return payload.data;
}

export default function RetailerContactsManager({ api, token, refresh, notify }) {
  const [rows, setRows] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [editing, setEditing] = useState(null); const [form, setForm] = useState(blank); const [busy, setBusy] = useState(false);
  async function load() {
    setLoading(true); setError('');
    try { setRows(await retailerContactRequest(api, token, '/retailer-contacts/admin') || []); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [api, token, refresh]);
  function startEdit(row) { setEditing(row._id); setForm({ label: row.label || '', description: row.description || '', type: row.type, value: row.value || '', placement: row.placement || 'all', displayOrder: row.displayOrder || 0, isActive: row.isActive !== false }); }
  function startCreate() { setEditing(null); setForm(blank()); }
  async function save(event) {
    event.preventDefault(); setBusy(true); setError('');
    const body = { ...form, displayOrder: Number(form.displayOrder) };
    try {
      await retailerContactRequest(api, token, editing ? `/retailer-contacts/${encodeURIComponent(editing)}` : '/retailer-contacts', { method: editing ? 'PUT' : 'POST', body });
      notify(editing ? 'Retailer contact updated.' : 'Retailer contact added.'); startCreate(); await load();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function toggle(row) {
    try {
      const { _id, createdAt, updatedAt, __v, ...editable } = row;
      await retailerContactRequest(api, token, `/retailer-contacts/${encodeURIComponent(_id)}`, { method: 'PUT', body: { ...editable, isActive: !row.isActive } });
      notify(row.isActive ? 'Contact deactivated.' : 'Contact activated.'); await load();
    } catch (e) { notify(e.message, 'error'); }
  }
  async function remove(row) {
    if (!window.confirm(`Delete “${row.label}” from retailer contacts?`)) return;
    try { await retailerContactRequest(api, token, `/retailer-contacts/${encodeURIComponent(row._id)}`, { method: 'DELETE' }); notify('Contact deleted.'); await load(); }
    catch (e) { notify(e.message, 'error'); }
  }
  const change = (key, value) => setForm((state) => ({ ...state, [key]: value }));
  return <section className="retailer-contact-manager">
    <div className="admin-page-toolbar rc-toolbar"><div className="toolbar-context">Customer-facing contact details</div><div className="toolbar-actions"><button className="button secondary" onClick={load} disabled={loading}><RefreshCw size={15}/> Refresh</button><button className="button primary" onClick={startCreate}><Plus size={15}/> Add contact</button></div></div>
    <div className="panel rc-form-panel"><form onSubmit={save}>
      <div className="rc-form-heading"><div><h3>{editing ? 'Edit contact' : 'Add a contact'}</h3><p>Multiple entries of the same type are supported.</p></div>{editing && <button type="button" className="icon-button" onClick={startCreate} aria-label="Cancel editing"><X size={17}/></button>}</div>
      <div className="rc-fields">
        <label>Display label<input required maxLength={80} value={form.label} onChange={(e) => change('label', e.target.value)} /></label>
        <label>Contact type<select value={form.type} onChange={(e) => change('type', e.target.value)}>{TYPES.map((type) => <option key={type} value={type}>{type[0].toUpperCase()+type.slice(1)}</option>)}</select></label>
        <label className="rc-wide">Contact value<input required maxLength={500} value={form.value} onChange={(e) => change('value', e.target.value)} placeholder={form.type === 'telegram' ? 'Telegram username' : form.type === 'phone' || form.type === 'whatsapp' ? 'Phone number' : form.type === 'email' ? 'Email address' : 'HTTPS URL'} /></label>
        <label>Description (optional)<input maxLength={240} value={form.description} onChange={(e) => change('description', e.target.value)} /></label>
        <label>Placement<select value={form.placement} onChange={(e) => change('placement', e.target.value)}>{PLACEMENTS.map(([value, title]) => <option key={value} value={value}>{title}</option>)}</select></label>
        <label>Display order<input type="number" min="0" max="100000" step="1" value={form.displayOrder} onChange={(e) => change('displayOrder', e.target.value)} /></label>
        <label className="rc-toggle"><input type="checkbox" checked={form.isActive} onChange={(e) => change('isActive', e.target.checked)} /> Active and visible to customers</label>
      </div>
      <button className="button primary" disabled={busy}>{busy ? 'Saving…' : <><Check size={15}/>{editing ? 'Save contact' : 'Add contact'}</>}</button>
    </form></div>
    {error && <div className="inline-alert"><AlertCircle size={16}/>{error}</div>}
    {loading ? <div className="panel table-loading"><span className="spinner"/>Loading retailer contacts…</div> : error && !rows.length ? <div className="panel resource-error"><b>Could not load contacts</b><button className="button secondary" onClick={load}>Try again</button></div> : rows.length === 0 ? <div className="panel rc-empty"><b>No retailer contacts yet</b><p>Add the contact information the customer apps should display.</p></div> : <div className="rc-list">{rows.map((row) => <article className="panel rc-row" key={row._id}>
      <div className="rc-row-copy"><div className="rc-row-title"><strong>{row.label}</strong><span className={`status-pill ${row.isActive ? 'status-success' : 'status-muted'}`}>{row.isActive ? 'Active' : 'Inactive'}</span></div><p>{row.type} · {row.placement.replaceAll('_', ' ')} · order {row.displayOrder}</p><code>{row.value}</code>{row.description && <small>{row.description}</small>}</div>
      <div className="rc-row-actions"><button className="button secondary" onClick={() => toggle(row)}>{row.isActive ? 'Deactivate' : 'Activate'}</button><button className="icon-button" onClick={() => startEdit(row)} aria-label={`Edit ${row.label}`}><Pencil size={16}/></button><button className="icon-button danger" onClick={() => remove(row)} aria-label={`Delete ${row.label}`}><Trash2 size={16}/></button></div>
    </article>)}</div>}
  </section>;
}
