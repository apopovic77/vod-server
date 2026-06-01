import { useEffect, useMemo, useState } from 'react'

type CollectionSummary = {
  id: string
  name?: string
  item_count?: number
}

type MediaItem = {
  id: number
  title?: string
  original_filename?: string
  file_url?: string
  thumbnail_url?: string
  mime_type?: string
  created_at?: string
  file_size_bytes?: number
  hls_url?: string
  collection_id?: string
}

import { API_BASE_URL } from '../lib/apiBase'
const API_KEY = 'Inetpass1'

export default function Collections(){
  const [emails, setEmails] = useState<Array<{ email: string; collection_count: number }>>([])
  const [selectedEmail, setSelectedEmail] = useState<string>('')
  const [collections, setCollections] = useState<CollectionSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [view, setView] = useState<'collections'|'items'>('collections')
  const [activeCollection, setActiveCollection] = useState<{ id: string; name: string; userEmail: string } | null>(null)
  const [items, setItems] = useState<MediaItem[] | null>(null)

  useEffect(()=>{ void loadEmailsWithCollections() }, [])

  async function loadEmailsWithCollections(){
    try{
      const res = await fetch(`${API_BASE_URL}/storage/admin/users-with-collections`, {
        headers: { 'X-API-KEY': API_KEY }
      })
      if(!res.ok) throw new Error('Failed to fetch users')
      const data = await res.json() as Array<{ email: string; collection_count: number }>
      setEmails(data)
    }catch(e: any){ setError(e?.message || 'Error'); }
  }

  async function onSelectEmail(email: string){
    setSelectedEmail(email)
    setCollections(null)
    setItems(null)
    setView('collections')
    setActiveCollection(null)
    if(!email) return
    setLoading(true)
    setError(null)
    try{
      let url = ''
      if(email === 'public') url = `${API_BASE_URL}/storage/admin/collections?public_only=true`
      else url = `${API_BASE_URL}/storage/admin/collections?user_email=${encodeURIComponent(email)}`
      const res = await fetch(url, { headers: { 'X-API-KEY': API_KEY } })
      if(!res.ok) throw new Error('Failed to fetch collections')
      const data = await res.json() as CollectionSummary[]
      setCollections(data)
    }catch(e: any){ setError(e?.message || 'Error') }
    finally{ setLoading(false) }
  }

  async function openCollection(col: CollectionSummary){
    if(!selectedEmail) return
    setActiveCollection({ id: col.id, name: col.name || col.id, userEmail: selectedEmail })
    setView('items')
    setItems(null)
    setLoading(true)
    setError(null)
    try{
      const q = new URLSearchParams()
      q.set('mine', 'false')
      if(col.id !== 'null'){ q.set('collection_id', col.id) }
      const res = await fetch(`${API_BASE_URL}/storage/list?${q.toString()}`, { headers: { 'X-API-KEY': API_KEY } })
      if(!res.ok) throw new Error('Failed to fetch items')
      const data = await res.json() as { items?: MediaItem[] }
      let list = data.items || []
      if(col.id === 'null'){
        list = list.filter(it => (it.collection_id == null) && (selectedEmail === 'public' ? true : true))
      }
      setItems(list)
    }catch(e: any){ setError(e?.message || 'Error') }
    finally{ setLoading(false) }
  }

  function backToCollections(){
    setView('collections')
    setItems(null)
    setActiveCollection(null)
  }

  const content = useMemo(()=>{
    if(!selectedEmail){
      return <div className="loading">Select an email to view collections...</div>
    }
    if(loading){ return <div className="loading">Loading…</div> }
    if(error){ return <div className="error">{error}</div> }

    if(view === 'collections'){
      if(!collections || collections.length === 0){
        return (
          <div className="empty-state">
            <h3>No Collections Found</h3>
            <p>This {selectedEmail === 'public' ? 'public area has' : 'user has'} no collections yet.</p>
          </div>
        )
      }
      return (
        <div className="collections-grid">
          {collections.map(c => (
            <div key={c.id} className="collection-card" onClick={()=> openCollection(c)}>
              <div className="collection-name">
                {c.name || c.id}
                {selectedEmail === 'public' ? (<span className="public-badge" style={{ marginLeft: 8 }}>Public</span>) : null}
              </div>
              <div className="collection-id">ID: {c.id}</div>
              <div className="collection-stats">
                <div><strong>Items:</strong> {c.item_count ?? 0}</div>
                <div className="item-count">{c.item_count ?? 0}</div>
              </div>
            </div>
          ))}
        </div>
      )
    }

    // items view
    if(!activeCollection){ return null }
    if(!items || items.length === 0){
      return (
        <div className="collection-detail">
          <button className="back-button" onClick={backToCollections}>← Back to Collections</button>
          <h2>
            {activeCollection.name}
            <span className="collection-badge">0 items</span>
          </h2>
          <div className="empty-state"><h3>No Items Found</h3><p>This collection is empty.</p></div>
        </div>
      )
    }

    return (
      <div className="collection-detail">
        <button className="back-button" onClick={backToCollections}>← Back to Collections</button>
        <h2>
          {activeCollection.name}
          <span className="collection-badge">{items.length} items</span>
          <a
            className="pill"
            style={{ marginLeft: 12, textDecoration: 'none' }}
            href={`https://vod.arkturian.com/share/v2?collection_id=${encodeURIComponent(activeCollection.id)}${selectedEmail && selectedEmail !== 'public' ? `&owner_email=${encodeURIComponent(selectedEmail)}` : ''}`}
            target="_blank"
            rel="noreferrer"
          >Open in Viewer</a>
        </h2>
        <div className="items-grid">
          {items.map(it => (
            <div key={it.id} className="item-card">
              {it.thumbnail_url ? (
                <img src={it.thumbnail_url} alt="Thumbnail" className="item-thumbnail" loading="lazy" />
              ) : (
                <div className="item-thumbnail" style={{ display:'flex', alignItems:'center', justifyContent:'center', color:'var(--muted)', fontSize:24 }}>📄</div>
              )}
              <div className="item-content">
                <div className="item-name">{it.title || it.original_filename || 'Untitled'}</div>
                <div className="item-meta">
                  <span>Created: {it.created_at ? new Date(it.created_at).toLocaleDateString() : '—'}</span>
                  <span className="item-size">{formatFileSize(it.file_size_bytes || 0)}</span>
                </div>
                <div className="item-actions" style={{ marginTop: 8, display:'flex', gap:12, flexWrap:'wrap' }}>
                  {it.file_url && (
                    <a href={it.file_url} className="action-link" download target="_blank" rel="noreferrer">download</a>
                  )}
                  <a className="action-link" href={`https://vod.arkturian.com/share/v2?current_id=${it.id}`} target="_blank" rel="noreferrer">open</a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }, [selectedEmail, loading, error, collections, view, activeCollection, items])

  return (
    <main role="main">
      <section className="section" aria-labelledby="collections-title" style={{ paddingTop: 20 }}>
        <div className="card" style={{ padding:16, marginBottom:16 }}>
          <div className="form-group">
            <label htmlFor="email-select">Select User Email:</label>
            <select id="email-select" value={selectedEmail} onChange={e=> onSelectEmail(e.target.value)}>
              <option value="">Choose an email...</option>
              <option value="public">🌍 Public Collections (No Owner)</option>
              {emails.map(u => (
                <option key={u.email} value={u.email}>{u.email} ({u.collection_count} collections)</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          {content}
        </div>
      </section>
    </main>
  )
}

function formatFileSize(bytes: number){
  if(bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B','KB','MB','GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}