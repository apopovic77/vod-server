import { useEffect, useState } from 'react'
// @ts-ignore
import { useSearchParams } from 'react-router-dom'

import { API_BASE_URL } from '../lib/apiBase'
import { getApiKey } from '../lib/apiKey'
const API_KEY = getApiKey()

type MediaItem = {
  id: number
  file_url?: string
  hls_url?: string
  mime_type?: string
  title?: string
  description?: string
  original_filename?: string
  collection_id?: string
}

export default function ShareInfo(){
  const [params] = useSearchParams()
  const idParam = params.get('id')
  const id = idParam ? parseInt(idParam, 10) : undefined
  const [item, setItem] = useState<any | null>(null)
  const [groupItems, setGroupItems] = useState<any[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(()=>{
    (async ()=>{
      try{
        if(!id){ setError('Missing id'); return }
        const res = await fetch(`${API_BASE_URL}/storage/objects/${id}`, { headers:{ 'X-API-KEY': API_KEY } })
        if(!res.ok) throw new Error('load object failed')
        const it = await res.json()
        setItem(it)
        const linkId = (it as any)?.link_id
        if(linkId){
          // Use mine=false to avoid owner scoping and get full linked set
          const res2 = await fetch(`${API_BASE_URL}/storage/list?link_id=${encodeURIComponent(linkId)}&mine=false`, { headers:{ 'X-API-KEY': API_KEY } })
          if(res2.ok){
            const data2 = await res2.json() as { items?: MediaItem[] }
            setGroupItems((data2.items || []).sort((a:any,b:any)=> (a.id||0)-(b.id||0)))
          } else {
            setGroupItems([])
          }
        } else {
          setGroupItems([])
        }
      } catch(e: any){ setError(e?.message || 'Error') } finally { setLoading(false) }
    })()
  }, [id])

  if(loading){ return <main role="main"><section className="section"><div className="card"><div>Loading…</div></div></section></main> }
  if(error){ return <main role="main"><section className="section"><div className="card"><div style={{ color:'crimson' }}>{error}</div></div></section></main> }
  if(!item){ return <main role="main"><section className="section"><div className="card"><div>No item</div></div></section></main> }

  const linkId = (item as any)?.link_id

  return (
    <main role="main">
      <section className="section">
        <div className="card" style={{ overflow:'auto' }}>
          <h2 className="h2" style={{ marginTop:0 }}>Share Info</h2>
          <div style={{ display:'grid', gap:12 }}>
            <div>
              <strong>Object ID:</strong> {item.id}
            </div>
            <div>
              <strong>Link ID:</strong> {String(linkId || '—')}
            </div>
            <div>
              <strong>Collection ID:</strong> {String(item.collection_id || '—')}
            </div>
            <div>
              <strong>Title:</strong> {item.title || '—'}
            </div>
            <div>
              <strong>Filename:</strong> {item.original_filename || '—'}
            </div>
            <div>
              <strong>Mime:</strong> {item.mime_type || '—'}
            </div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              <a className="pill" href={`https://vod.arkturian.com/share/v1?current_id=${item.id}`} target="_blank" rel="noreferrer">Open v1</a>
              <a className="pill" href={`https://vod.arkturian.com/share/v2?current_id=${item.id}`} target="_blank" rel="noreferrer">Open v2</a>
              <a className="pill" href={`https://vod.arkturian.com/share/v3?current_id=${item.id}`} target="_blank" rel="noreferrer">Open v3</a>
              {item.collection_id && (
                <a className="pill" href={`https://vod.arkturian.com/share/v2?collection_id=${encodeURIComponent(item.collection_id)}`} target="_blank" rel="noreferrer">Open Collection v2</a>
              )}
            </div>
            <hr />
            <div>
              <strong>Group Items (same link_id):</strong>
              <div style={{ fontSize:12, color:'var(--muted)' }}>{(groupItems || []).length} items</div>
            </div>
            <div style={{ display:'grid', gap:8 }}>
              {(groupItems || []).map((gi:any)=> (
                <div key={gi.id} style={{ border:'1px solid var(--ring)', borderRadius:8, padding:10 }}>
                  <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                    {gi.thumbnail_url ? (
                      <img src={gi.thumbnail_url} alt="thumb" style={{ width:46, height:46, borderRadius:8, objectFit:'cover', border:'1px solid var(--ring)' }} />
                    ) : (
                      <div style={{ width:46, height:46, borderRadius:8, background:'rgba(0,0,0,0.05)', display:'grid', placeItems:'center', color:'var(--muted)' }}>—</div>
                    )}
                    <div style={{ display:'grid', gap:4 }}>
                      <div><strong>ID:</strong> {gi.id} <span className="mono" style={{ marginLeft:8 }}>{gi.mime_type || 'file'}</span></div>
                      <div style={{ fontSize:12, color:'var(--muted)' }}>{gi.title || gi.original_filename || '—'}</div>
                      <div className="mono" style={{ fontSize:11 }}>file_url: {gi.file_url || '—'}</div>
                      <div className="mono" style={{ fontSize:11 }}>hls_url: {gi.hls_url || '—'}</div>
                    </div>
                    <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
                      <a className="pill" href={`https://vod.arkturian.com/share/v2?current_id=${gi.id}`} target="_blank" rel="noreferrer">Open</a>
                      {gi.file_url && (<a className="pill" href={gi.file_url} target="_blank" rel="noreferrer">File</a>)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <hr />
            <details>
              <summary>Raw Object JSON</summary>
              <pre style={{ whiteSpace:'pre-wrap', wordBreak:'break-word' }}>{JSON.stringify(item, null, 2)}</pre>
            </details>
            <details>
              <summary>Raw Group JSON</summary>
              <pre style={{ whiteSpace:'pre-wrap', wordBreak:'break-word' }}>{JSON.stringify(groupItems, null, 2)}</pre>
            </details>
          </div>
        </div>
      </section>
    </main>
  )
}