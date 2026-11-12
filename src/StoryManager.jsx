import React, { useEffect, useState } from 'react';
import { AlertCircle, Pencil, Plus, RefreshCw, Trash2, Upload, Video, X } from 'lucide-react';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
async function apiRequest(api, path, token, options = {}) {
  const response = await fetch(`${api}${path}`, {
    method: options.method || 'GET',
    headers: { Authorization: `Bearer ${token}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) throw new Error(payload.message || `Request failed (${response.status}).`);
  return payload.data;
}

function uploadVideo(api, token, form, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${api}/stories`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = event => event.lengthComputable && onProgress(Math.round(event.loaded / event.total * 100));
    xhr.onerror = () => reject(new Error('Could not reach the API while uploading.'));
    xhr.onload = () => {
      const payload = (() => { try { return JSON.parse(xhr.responseText); } catch { return {}; } })();
      xhr.status >= 200 && xhr.status < 300 && payload.success !== false
        ? resolve(payload.data)
        : reject(new Error(payload.message || `Upload failed (${xhr.status}).`));
    };
    xhr.send(form);
  });
}

export default function StoryManager({ api, token, refresh, notify }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [sortOrder, setSortOrder] = useState(0);
  const [localPreview, setLocalPreview] = useState('');

  async function load() {
    setLoading(true); setLoadError('');
    try { setRows(await apiRequest(api, '/stories', token) || []); }
    catch (e) { setLoadError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [api, token, refresh]);
  useEffect(() => () => { if (localPreview) URL.revokeObjectURL(localPreview); }, [localPreview]);

  function openCreate() {
    setModal({ id: null, isPublished: false, isActive: true }); setTitle(''); setSubtitle(''); setSortOrder(0); setFile(null); setError(''); setProgress(0);
  }
  function openEdit(row) {
    setModal(row); setTitle(row.title); setSubtitle(row.subtitle || ''); setSortOrder(row.sortOrder || 0); setFile(null); setError(''); setProgress(0);
  }
  function chooseFile(next) {
    if (localPreview) URL.revokeObjectURL(localPreview);
    setLocalPreview(next ? URL.createObjectURL(next) : ''); setFile(next || null); setError('');
  }
  async function save(event) {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      if (modal.id) {
        await apiRequest(api, `/stories/${encodeURIComponent(modal.id)}`, token, { method: 'PUT', body: { title, subtitle, sortOrder: Number(sortOrder) } });
        notify('Story details saved.');
      } else {
        if (!file) throw new Error('Choose an MP4 or WebM video.');
        if (file.size > MAX_UPLOAD_BYTES) throw new Error('Choose a video smaller than 10 MiB.');
        if (!['video/mp4', 'video/webm'].includes(file.type)) throw new Error('Choose an MP4 or WebM video.');
        const body = new FormData(); body.append('title', title); body.append('subtitle', subtitle); body.append('sortOrder', String(sortOrder)); body.append('video', file);
        await uploadVideo(api, token, body, setProgress);
        notify('Video uploaded as an unpublished story.');
      }
      setModal(null); await load();
    } catch (e) { setError(e.message); await load(); }
    finally { setBusy(false); }
  }
  async function toggle(row, key) {
    setError('');
    try { await apiRequest(api, `/stories/${encodeURIComponent(row.id)}`, token, { method: 'PUT', body: { [key]: !row[key] } }); notify(key === 'isPublished' ? (!row[key] ? 'Story published.' : 'Story unpublished.') : 'Story visibility updated.'); await load(); }
    catch (e) { notify(e.message, 'error'); await load(); }
  }
  async function remove(row) {
    if (!window.confirm(`Delete “${row.title}” and its video permanently?`)) return;
    try { await apiRequest(api, `/stories/${encodeURIComponent(row.id)}`, token, { method: 'DELETE' }); notify('Story and video deleted.'); await load(); }
    catch (e) { notify(e.message, 'error'); await load(); }
  }

  return <section className="story-manager">
    <div className="admin-page-toolbar story-toolbar"><div className="story-toolbar-actions"><button className="button secondary" onClick={load} disabled={loading}><RefreshCw size={15}/> Refresh</button><button className="button primary" onClick={openCreate}><Plus size={15}/> Add story</button></div></div>
    {loadError ? <div className="resource-error"><AlertCircle/><b>Could not load stories</b><p>{loadError}</p><button className="button secondary" onClick={load}>Try again</button></div> : loading ? <div className="table-loading"><span className="spinner"/>Loading stories…</div> : rows.length === 0 ? <div className="panel story-empty"><Video size={25}/><b>No stories yet</b><p>Upload a video to create the first story.</p><button className="button primary" onClick={openCreate}><Plus size={15}/> Add story</button></div> : <div className="story-grid">{rows.map(row => <article className="panel story-card" key={row.id}>
      {row.previewUrl ? <video src={row.previewUrl} controls preload="metadata" aria-label={`Preview ${row.title}`} /> : <div className="story-preview-placeholder"><Video size={30}/></div>}
      <div className="story-card-content"><div className="story-card-title"><div><h3>{row.title}</h3><p>{row.subtitle || 'No subtitle'}</p></div><span className={`status-pill ${row.uploadStatus==='cleanup_pending'?'status-warning':row.isPublished && row.isActive ? 'status-good' : 'status-muted'}`}>{row.uploadStatus==='cleanup_pending'?'Cleanup needed':row.isPublished && row.isActive ? 'Published' : row.isPublished ? 'Hidden' : 'Draft'}</span></div>
      <small>{row.format.toUpperCase()} · {Number(row.durationSeconds).toFixed(1)} sec · {(row.bytes / 1024 / 1024).toFixed(1)} MB</small>
      <div className="story-card-actions"><button className="button secondary" onClick={() => openEdit(row)}><Pencil size={14}/> Edit</button><button className="button secondary" disabled={row.uploadStatus!=='ready'} onClick={() => toggle(row, 'isPublished')}>{row.isPublished ? 'Unpublish' : 'Publish'}</button><button className="icon-button danger-hover" title="Delete story and clean up video" onClick={() => remove(row)}><Trash2 size={15}/></button></div></div>
    </article>)}</div>}
    {modal && <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && !busy && setModal(null)}><div className="modal story-modal"><div className="modal-head"><div><div className="eyebrow">{modal.id ? 'EDIT STORY' : 'NEW STORY'}</div><h2>{modal.id ? 'Story details' : 'Upload a video story'}</h2></div><button className="icon-button" onClick={() => setModal(null)} disabled={busy} aria-label="Close"><X size={18}/></button></div><form onSubmit={save}><div className="modal-body">
      {error && <div className="form-error" role="alert"><AlertCircle size={15}/>{error}</div>}
      {!modal.id && <label className="field"><span>Video file</span><label className="upload-zone story-upload"><input type="file" accept="video/mp4,video/webm,.mp4,.webm" onChange={e => chooseFile(e.target.files?.[0])}/><Upload size={20}/><b>{file?.name || 'Choose MP4 or WebM'}</b><small>Maximum file size: 10 MiB. Server validates the actual media.</small></label></label>}
      {(localPreview || (modal.id && modal.previewUrl)) && <video className="story-modal-preview" src={localPreview || modal.previewUrl} controls playsInline preload="metadata"/>}
      <label className="field"><span>Title *</span><input value={title} onChange={e => setTitle(e.target.value)} maxLength={80} required/></label>
      <label className="field"><span>Subtitle</span><input value={subtitle} onChange={e => setSubtitle(e.target.value)} maxLength={140}/></label>
      <label className="field"><span>Sort order</span><input type="number" min="0" step="1" value={sortOrder} onChange={e => setSortOrder(e.target.value)}/></label>
      {busy && !modal.id && <div className="story-progress" role="status"><span style={{ width: `${progress}%` }}/><small>{progress}% uploaded; server is validating and processing the video…</small></div>}
      <p className="field-hint">New uploads start unpublished. Publish only after previewing the stored video.</p>
    </div><div className="modal-actions"><button type="button" className="button secondary" onClick={() => setModal(null)} disabled={busy}>Cancel</button><button type="submit" className="button primary" disabled={busy}>{busy ? 'Saving…' : modal.id ? 'Save changes' : 'Upload story'}</button></div></form></div></div>}
  </section>;
}
