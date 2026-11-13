import { useEffect, useState } from 'react';
import { AlertCircle, Check, Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-react';

const emptyForm = () => ({ title: '', body: '', sortOrder: 0, isActive: false });

async function supportRequest(api, token, path, { method = 'GET', body } = {}) {
  let response;
  try {
    response = await fetch(`${api}${path}`, { method, headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    }, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new Error('Unable to connect to YoMart services. Check your connection and try again.');
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) throw new Error(payload.message || `Request failed (${response.status})`);
  return payload.data;
}

export default function SupportContentManager({ api, token, refresh, notify }) {
  const [items, setItems] = useState([]); const [loading, setLoading] = useState(true);
  const [error, setError] = useState(''); const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm); const [busy, setBusy] = useState(false);
  async function load() {
    setLoading(true); setError('');
    try { setItems(await supportRequest(api, token, '/support-content/admin') || []); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [api, token, refresh]);
  function beginEdit(item) { setEditing(item._id); setForm({ title: item.title || '', body: item.body || '', sortOrder: item.sortOrder ?? 0, isActive: item.isActive === true }); }
  function reset() { setEditing(null); setForm(emptyForm()); }
  function change(key, value) { setForm((current) => ({ ...current, [key]: value })); }
  async function save(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      await supportRequest(api, token, editing ? `/support-content/${encodeURIComponent(editing)}` : '/support-content', {
        method: editing ? 'PUT' : 'POST',
        body: { ...form, sortOrder: Number(form.sortOrder) },
      });
      notify(editing ? 'Help content updated.' : 'Help content added.'); reset(); await load();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function toggle(item) {
    const { _id, createdAt, updatedAt, __v, ...body } = item;
    try { await supportRequest(api, token, `/support-content/${encodeURIComponent(_id)}`, { method: 'PUT', body: { ...body, isActive: !item.isActive } }); notify(item.isActive ? 'Help content unpublished.' : 'Help content published.'); await load(); }
    catch (e) { notify(e.message, 'error'); }
  }
  async function remove(item) {
    if (!window.confirm(`Delete “${item.title}” from Help & Support?`)) return;
    try { await supportRequest(api, token, `/support-content/${encodeURIComponent(item._id)}`, { method: 'DELETE' }); notify('Help content deleted.'); await load(); }
    catch (e) { notify(e.message, 'error'); }
  }
  return <section className="support-content-manager retailer-contact-manager">
    <div className="admin-page-toolbar rc-toolbar"><div className="toolbar-context">Help information shown in the customer app</div><div className="toolbar-actions"><button className="button secondary" onClick={load} disabled={loading}><RefreshCw size={15}/> Refresh</button><button className="button primary" onClick={reset}><Plus size={15}/> Add help content</button></div></div>
    <div className="panel rc-form-panel"><form onSubmit={save}>
      <div className="rc-form-heading"><div><h3>{editing ? 'Edit help content' : 'Add help content'}</h3><p>Plain text only. Published changes are fetched by the app without a new release.</p></div>{editing && <button type="button" className="icon-button" aria-label="Cancel editing" onClick={reset}><X size={17}/></button>}</div>
      <div className="rc-fields"><label className="rc-wide">Title<input required maxLength={100} value={form.title} onChange={(e) => change('title', e.target.value)} /></label><label className="rc-wide">Help text<textarea required maxLength={4000} rows={6} value={form.body} onChange={(e) => change('body', e.target.value)} /></label><label>Display order<input type="number" min="0" max="100000" step="1" value={form.sortOrder} onChange={(e) => change('sortOrder', e.target.value)} /></label><label className="rc-toggle"><input type="checkbox" checked={form.isActive} onChange={(e) => change('isActive', e.target.checked)} /> Published to customers</label></div>
      <button className="button primary" disabled={busy}>{busy ? 'Saving…' : <><Check size={15}/>{editing ? 'Save help content' : 'Add help content'}</>}</button>
    </form></div>
    {error && <div className="inline-alert"><AlertCircle size={16}/>{error}</div>}
    {loading ? <div className="panel table-loading"><span className="spinner"/>Loading help content…</div> : error && !items.length ? <div className="panel resource-error"><b>Could not load help content</b><button className="button secondary" onClick={load}>Try again</button></div> : items.length === 0 ? <div className="panel rc-empty"><b>No help content yet</b><p>Use the editor above to add information approved for customers.</p></div> : <div className="rc-list">{items.map((item) => <article className="panel rc-row" key={item._id}><div className="rc-row-copy"><div className="rc-row-title"><strong>{item.title}</strong><span className={`status-pill ${item.isActive ? 'status-success' : 'status-muted'}`}>{item.isActive ? 'Published' : 'Draft'}</span></div><p>Display order {item.sortOrder}</p><small className="support-content-body">{item.body}</small></div><div className="rc-row-actions"><button className="button secondary" onClick={() => toggle(item)}>{item.isActive ? 'Unpublish' : 'Publish'}</button><button className="icon-button" onClick={() => beginEdit(item)} aria-label={`Edit ${item.title}`}><Pencil size={16}/></button><button className="icon-button danger" onClick={() => remove(item)} aria-label={`Delete ${item.title}`}><Trash2 size={16}/></button></div></article>)}</div>}
  </section>;
}
