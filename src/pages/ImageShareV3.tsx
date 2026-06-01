import { useEffect, useMemo, useRef, useState } from 'react'
// @ts-ignore types present after deps install
import { useSearchParams } from 'react-router-dom'
import { Configuration, StorageApi } from 'arkturian-storage-sdk'
import VodPlayer from '../components/VodPlayer'
import { Download, Share2, Plus } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

type MediaItem = {
  id: number
  file_url?: string
  hls_url?: string
  mime_type?: string
  title?: string
  description?: string
  original_filename?: string
  collection_id?: string
  ai_safety_status?: string
  ai_safety_rating?: string
}

import { API_BASE_URL } from '../lib/apiBase'
const API_KEY = 'Inetpass1'

export default function ImageShareV3(){
  const [params] = useSearchParams()
  const currentIdParam = params.get('current_id')
  const currentId = currentIdParam ? parseInt(currentIdParam, 10) : undefined
  const collectionIdParam = params.get('collection_id')
  const ownerEmailParam = params.get('owner_email') || params.get('owner') || undefined
  const linkIdParam = params.get('link_id') || undefined
  const [item, setItem] = useState<MediaItem | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [fit, setFit] = useState<boolean>(false)
  const [localTitle, setLocalTitle] = useState<string>('')
  const [localDescription, setLocalDescription] = useState<string>('')
  const [collectionName, setCollectionName] = useState<string>('')
  const [linkedItems, setLinkedItems] = useState<MediaItem[]>([])
  const [groupLinkId, setGroupLinkId] = useState<string | null>(null)
  const [groupCollectionId, setGroupCollectionId] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState<boolean>(false)
  const [layoutMode, setLayoutMode] = useState<'stack'|'overlay'>('stack')

  const sdkRef = useRef<StorageApi | null>(null)
  const mediaInputRef = useRef<HTMLInputElement | null>(null)
  const audioInputRef = useRef<HTMLInputElement | null>(null)

  function TextPreview({ url }: { url: string }){
    const [text, setText] = useState<string>('')
    const [isMd, setIsMd] = useState<boolean>(false)
    useEffect(()=>{ let on = true; (async()=>{ try{ const r = await fetch(url); const t = await r.text(); if(on) setText(t) } catch{} })(); return ()=>{ on=false } }, [url])
    useEffect(()=>{ const looksMd = /(^|\n)\s{0,3}(#|\*\*|\*\s|\d+\.\s|>\s|\-|\*\s|```|\[.+\]\(.+\))/m.test(text); setIsMd(looksMd) }, [text])
    return (
      <div style={{ width:'100%', boxSizing:'border-box', padding:'100px 150px' }}>
        {isMd ? (
          <div style={{ textAlign:'left', width:'100%' }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
          </div>
        ) : (
          <div style={{ whiteSpace:'pre-wrap', wordBreak:'break-word' }}>{text}</div>
        )}
      </div>
    )
  }

  useEffect(()=>{
    sdkRef.current = new StorageApi(new Configuration({ basePath: API_BASE_URL }))
  }, [])

  useEffect(()=>{
    (async ()=>{
      try{
        if(currentId){
          const res = await fetch(`${API_BASE_URL}/storage/objects/${currentId}`, { headers:{ 'X-API-KEY': API_KEY } })
          if(!res.ok) throw new Error('load failed')
          const it = await res.json() as MediaItem
          setItem(it)
          setLocalTitle(it.title || '')
          setLocalDescription(it.description || '')
          setCollectionName(it.collection_id || '')
          const anyIt = it as any
          if(anyIt && typeof anyIt.link_id === 'string'){ setGroupLinkId(anyIt.link_id) }
          if(it.collection_id){ setGroupCollectionId(it.collection_id) }
        } else if(linkIdParam){
          const res = await fetch(`${API_BASE_URL}/storage/list?link_id=${encodeURIComponent(linkIdParam)}`, { headers:{ 'X-API-KEY': API_KEY } })
          if(!res.ok) throw new Error('load failed')
          const data = await res.json() as { items?: MediaItem[] }
          const items = (data.items || [])
          if(!items.length) throw new Error('Not found')
          const first = items[0]
          setItem(first)
          setLocalTitle(first.title || '')
          setLocalDescription(first.description || '')
          setCollectionName(first.collection_id || '')
          setGroupLinkId(linkIdParam)
          setLinkedItems(items.slice(1))
        } else if(collectionIdParam){
          const q = new URLSearchParams()
          q.set('collection_id', collectionIdParam)
          if(ownerEmailParam){ q.set('owner_email', ownerEmailParam) }
          const res = await fetch(`${API_BASE_URL}/storage/list?${q.toString()}`, { headers:{ 'X-API-KEY': API_KEY } })
          if(!res.ok) throw new Error('load failed')
          const data = await res.json() as { items?: MediaItem[] }
          const items = (data.items || [])
          if(!items.length) throw new Error('Not found')
          const first = items[0]
          setItem(first)
          setLocalTitle(first.title || '')
          setLocalDescription(first.description || '')
          setCollectionName(collectionIdParam)
          const anyFirst = first as any
          if(anyFirst && anyFirst.link_id){ setGroupLinkId(anyFirst.link_id) }
          setGroupCollectionId(collectionIdParam)
          setLinkedItems(items.slice(1))
        } else {
          setError('Missing identifier')
        }
      } catch(e){ setError('Could not load media.') } finally { setLoading(false) }
    })()
  }, [currentId, collectionIdParam, ownerEmailParam, linkIdParam])

  // Load linked media in same group (prefer collection_id when present; fallback to link_id)
  useEffect(()=>{
    (async ()=>{
      const q = new URLSearchParams()
      if(groupCollectionId){ q.set('collection_id', groupCollectionId) }
      else if(groupLinkId){ q.set('link_id', groupLinkId) }
      else return
      try{
        const res = await fetch(`${API_BASE_URL}/storage/list?${q.toString()}`, { headers:{ 'X-API-KEY': API_KEY } })
        if(!res.ok) return
        const data = await res.json() as { items?: MediaItem[] }
        const all = (data.items || [])
        const filtered = all.filter(i => i.id !== item?.id)
        setLinkedItems(filtered)
      } catch {}
    })()
  }, [groupLinkId, groupCollectionId, item?.id])

  const navigableMedia = useMemo(()=>{
    const list = item ? [item, ...linkedItems] : [...linkedItems]
    return list.filter(m => {
      const mt = (m.mime_type || '').toLowerCase()
      if(mt.startsWith('audio/')) return false
      return !!m.file_url || !!(m as any).hls_url
    })
  }, [item, linkedItems])

  async function uploadWithCollection(file: File){
    try{
      if(!file || file.size === 0) return
      if(!sdkRef.current){ sdkRef.current = new StorageApi(new Configuration({ basePath: API_BASE_URL })) }
      let linkIdToUse: string = groupLinkId || String(item?.id || Date.now())
      if(!groupLinkId && item?.id){
        try{
          await fetch(`${API_BASE_URL}/storage/objects/${item.id}`, { method:'PATCH', headers:{ 'X-API-KEY': API_KEY, 'Content-Type':'application/json' }, body: JSON.stringify({ link_id: linkIdToUse }) })
          setGroupLinkId(linkIdToUse)
        } catch {}
      }
      const { data } = await sdkRef.current.uploadFileStorageUploadPost({
        file: file,
        xAPIKEY: API_KEY,
        context: undefined,
        isPublic: true,
        ownerEmail: undefined,
        collectionId: item?.collection_id || undefined,
        linkId: linkIdToUse,
        analyze: true
      })
      try{
        const id = (data as any)?.id
        if(id){ await fetch(`${API_BASE_URL}/storage/objects/${id}`, { method:'PATCH', headers:{ 'X-API-KEY': API_KEY, 'Content-Type':'application/json' }, body: JSON.stringify({ link_id: linkIdToUse }) }) }
      } catch{}
      setAddOpen(false)
    } catch(e){ console.error(e) }
  }

  function onPickMedia(e: React.ChangeEvent<HTMLInputElement>){ const f = e.target.files?.[0]; if(f && f.size>0){ void uploadWithCollection(f) }; e.target.value='' }
  function onPickAudio(e: React.ChangeEvent<HTMLInputElement>){ const f = e.target.files?.[0]; if(f && f.size>0){ void uploadWithCollection(f) }; e.target.value='' }

  async function updateCollectionForAllItems(newName: string){
    try{
      setCollectionName(newName)
      const q = new URLSearchParams()
      if(groupCollectionId){ q.set('collection_id', groupCollectionId) }
      else if(groupLinkId){ q.set('link_id', groupLinkId) }
      else {
        await fetch(`${API_BASE_URL}/storage/objects/${item?.id}`, { method:'PATCH', headers:{ 'X-API-KEY': API_KEY, 'Content-Type':'application/json' }, body: JSON.stringify({ collection_id: newName }) })
        return
      }
      const res = await fetch(`${API_BASE_URL}/storage/list?${q.toString()}`, { headers:{ 'X-API-KEY': API_KEY } })
      if(!res.ok){ throw new Error('list failed') }
      const data = await res.json() as { items?: MediaItem[] }
      const all = (data.items || [])
      await Promise.all(all.map(async (it) => {
        await fetch(`${API_BASE_URL}/storage/objects/${it.id}`, { method:'PATCH', headers:{ 'X-API-KEY': API_KEY, 'Content-Type':'application/json' }, body: JSON.stringify({ collection_id: newName }) }).catch(()=>{})
      }))
    } catch {}
  }

  if(loading){ return <main role="main"><section className="section"><p className="muted">Loading…</p></section></main> }
  if(error || !item || !item.file_url){ return <main role="main"><section className="section"><p className="muted" style={{ color:'crimson' }}>{error || 'Not found'}</p></section></main> }
  if(item.ai_safety_rating === 'unsafe' || item.ai_safety_status === 'failed'){
    return (
      <main role="main">
        <section className="section"><div className="card" style={{ padding:16 }}><h2 className="h2" style={{ marginTop:0 }}>Content not allowed</h2><p className="muted">This image failed our safety policy checks and cannot be displayed.</p></div></section>
      </main>
    )
  }

  return (
    <main role="main">
      <section className="section section-full" aria-labelledby="imagesharev3-title" style={{ padding:0 }}>
        <div style={{ width:'100vw', margin:'0', marginLeft:'calc(50% - 50vw)', marginRight:'calc(50% - 50vw)', padding:'0 0 24px', display:'grid', gap:28 }}>
          <div style={{ position:'fixed', top:12, right:12, display:'flex', gap:8, zIndex:10 }}>
            <button className="pill" style={{ background:'var(--glass)', border:'1px solid var(--ring)', color:'#fff' }} onClick={()=> setFit(f=>!f)}>{fit ? 'Fit' : 'Fill'}</button>
            <button className="pill" style={{ background:'var(--glass)', border:'1px solid var(--ring)', color:'#fff' }} onClick={()=> setLayoutMode(m => m==='stack' ? 'overlay' : 'stack')}>{layoutMode === 'stack' ? 'Stack' : 'Overlay'}</button>
          </div>
          {navigableMedia.map((m) => {
            const isVideo = !!(m.mime_type && m.mime_type.startsWith('video/')) || !!(m as any).hls_url
            const isImage = !!(m.mime_type && m.mime_type.startsWith('image/'))
            const isText = ((m.mime_type||'').toLowerCase() === 'text/plain' && !!m.file_url)
            return (
              <article key={`stack-${m.id}`} style={{ display:'grid', gap:12, width:'100vw', marginLeft:'calc(50% - 50vw)', marginRight:'calc(50% - 50vw)' }}>
                {layoutMode === 'stack' ? (
                  <>
                    <div style={{ position:'relative', width:'100%', height: isText ? 'auto' : 'calc(100vh - 180px)', background: isText ? 'transparent' : '#000', borderRadius: 0, overflow: isText ? 'visible' : 'hidden' }}>
                      {isVideo ? (
                        <div style={{ position:'absolute', inset:0 }}>
                          <VodPlayer src={(m as any).hls_url || m.file_url || ''} autoplay={false} muted={false} scaleMode={fit ? 'fit' : 'fill'} isActive={true} />
                        </div>
                      ) : isImage ? (
                        <img src={m.file_url} alt={m.title || ''} loading="lazy" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit: fit ? 'contain' : 'cover', display:'block' }} />
                      ) : isText ? (
                        <div style={{ fontWeight:700, fontSize:'1.15rem', padding:'8px 0' }}>
                          <TextPreview url={m.file_url || ''} />
                        </div>
                      ) : (
                        <div className="card" style={{ background:'var(--glass)', border:'1px solid var(--ring)', color:'#fff', borderRadius:16, padding:18, textAlign:'center' }}>
                          <div style={{ fontSize:22, fontWeight:700, marginBottom:8, color:'var(--text)' }}>{m.original_filename || 'Document'}</div>
                          <div className="muted" style={{ marginBottom:12 }}>{m.mime_type || 'file'}</div>
                          {m.file_url && (<a className="pill" href={m.file_url} download style={{ display:'inline-flex', alignItems:'center', gap:8 }}><Download size={16} /> Download</a>)}
                        </div>
                      )}
                    </div>
                    <div style={{ padding:'0 50px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                        <div
                          className="pill"
                          style={{ background:'var(--glass)', border:'1px solid var(--ring)', borderRadius:12, padding:'8px 12px', backdropFilter:'blur(10px) saturate(180%)', WebkitBackdropFilter:'blur(10px) saturate(180%)', outline:'none' }}
                          contentEditable
                          suppressContentEditableWarning
                          onBlur={(e)=>{ const v = e.currentTarget.textContent || ''; void updateCollectionForAllItems(v) }}
                        >
                          {collectionName || 'Collection'}
                        </div>
                        <div style={{ display:'flex', gap:8 }}>
                          {m.file_url && (
                            <a className="pill" href={m.file_url} download title="Download" style={{ width:42, height:42, padding:0, lineHeight:0, display:'grid', placeItems:'center', borderRadius:999, background:'var(--glass)', border:'1px solid var(--ring)', color:'var(--text)' }}><Download size={18} /></a>
                          )}
                          <button className="pill" title="Share" style={{ width:42, height:42, padding:0, lineHeight:0, display:'grid', placeItems:'center', borderRadius:999, background:'var(--glass)', border:'1px solid var(--ring)', color:'var(--text)' }} onClick={()=>{ if((navigator as any).share){ (navigator as any).share({ url: window.location.href }) } else { navigator.clipboard.writeText(window.location.href) } }}><Share2 size={18} /></button>
                          <div style={{ position:'relative' }}>
                            <button className="pill" title="Add" style={{ width:42, height:42, padding:0, lineHeight:0, display:'grid', placeItems:'center', borderRadius:999, background:'var(--glass)', border:'1px solid var(--ring)', color:'var(--text)' }} onClick={()=> setAddOpen(o=>!o)}><Plus size={18} /></button>
                            {addOpen && (
                              <div style={{ position:'absolute', top:'100%', left:0, marginTop:6, background:'var(--glass)', border:'1px solid var(--ring)', borderRadius:12, backdropFilter:'blur(10px) saturate(180%)', WebkitBackdropFilter:'blur(10px) saturate(180%)', padding:8, display:'grid', gap:6, pointerEvents:'auto', zIndex:5, minWidth:180 }}>
                                <button className="pill" style={{ background:'transparent', border:'1px solid var(--ring)', color:'#fff' }} onClick={()=> mediaInputRef.current?.click()}>Add Media</button>
                                <button className="pill" style={{ background:'transparent', border:'1px solid var(--ring)', color:'#fff' }} onClick={()=> audioInputRef.current?.click()}>Upload Audio</button>
                              </div>
                            )}
                            <input ref={mediaInputRef} type="file" accept="image/*,video/*,application/pdf" onChange={onPickMedia} style={{ display:'none' }} />
                            <input ref={audioInputRef} type="file" accept="audio/*" onChange={onPickAudio} style={{ display:'none' }} />
                          </div>
                        </div>
                      </div>
                      {!!(m.title || localTitle) && (<div style={{ fontWeight:700, fontSize:'1.15rem' }}>{m.title || localTitle}</div>)}
                      {!!(m.description || localDescription) && (<div className="muted" style={{ fontSize:'.95rem' }}>{m.description || localDescription}</div>)}
                    </div>
                  </>
                ) : (
                  <>
                    {/* Overlay-like full-viewport visual followed by footer, scrollable per item */}
                    {!isText && (
                      <div style={{ position:'relative', width:'100%', height:'calc(100vh - 180px)' }}>
                        {isVideo ? (
                          <VodPlayer src={(m as any).hls_url || m.file_url || ''} autoplay={false} muted={false} scaleMode={fit ? 'fit' : 'fill'} isActive={true} />
                        ) : isImage ? (
                          <img src={m.file_url} alt={m.title || ''} loading="lazy" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit: fit ? 'contain' : 'cover' }} />
                        ) : null}
                      </div>
                    )}
                    {/* Footer like V2 vertical */}
                    <div style={{ width:'100vw', marginLeft:'calc(50% - 50vw)', marginRight:'calc(50% - 50vw)', padding:'20px 0' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
                        <div
                          className="pill"
                          style={{ background:'var(--glass)', border:'1px solid var(--ring)', borderRadius:12, padding:'8px 12px', backdropFilter:'blur(10px) saturate(180%)', WebkitBackdropFilter:'blur(10px) saturate(180%)', outline:'none' }}
                          contentEditable
                          suppressContentEditableWarning
                          onBlur={(e)=>{ const v = e.currentTarget.textContent || ''; void updateCollectionForAllItems(v) }}
                        >
                          {collectionName || 'Collection'}
                        </div>
                        <div style={{ display:'flex', gap:8 }}>
                          {m.file_url && (
                            <a className="pill" href={m.file_url} download title="Download" style={{ width:42, height:42, padding:0, lineHeight:0, display:'grid', placeItems:'center', borderRadius:999, background:'var(--glass)', border:'1px solid var(--ring)', color:'var(--text)' }}><Download size={18} /></a>
                          )}
                          <button className="pill" title="Share" style={{ width:42, height:42, padding:0, lineHeight:0, display:'grid', placeItems:'center', borderRadius:999, background:'var(--glass)', border:'1px solid var(--ring)', color:'var(--text)' }} onClick={()=>{ if((navigator as any).share){ (navigator as any).share({ url: window.location.href }) } else { navigator.clipboard.writeText(window.location.href) } }}><Share2 size={18} /></button>
                          <div style={{ position:'relative' }}>
                            <button className="pill" title="Add" style={{ width:42, height:42, padding:0, lineHeight:0, display:'grid', placeItems:'center', borderRadius:999, background:'var(--glass)', border:'1px solid var(--ring)', color:'var(--text)' }} onClick={()=> setAddOpen(o=>!o)}><Plus size={18} /></button>
                            {addOpen && (
                              <div style={{ position:'absolute', top:'100%', left:0, marginTop:6, background:'var(--glass)', border:'1px solid var(--ring)', borderRadius:12, backdropFilter:'blur(10px) saturate(180%)', WebkitBackdropFilter:'blur(10px) saturate(180%)', padding:8, display:'grid', gap:6, pointerEvents:'auto', zIndex:5, minWidth:180 }}>
                                <button className="pill" style={{ background:'transparent', border:'1px solid var(--ring)', color:'#fff' }} onClick={()=> mediaInputRef.current?.click()}>Add Media</button>
                                <button className="pill" style={{ background:'transparent', border:'1px solid var(--ring)', color:'#fff' }} onClick={()=> audioInputRef.current?.click()}>Upload Audio</button>
                              </div>
                            )}
                            <input ref={mediaInputRef} type="file" accept="image/*,video/*,application/pdf" onChange={onPickMedia} style={{ display:'none' }} />
                            <input ref={audioInputRef} type="file" accept="audio/*" onChange={onPickAudio} style={{ display:'none' }} />
                          </div>
                        </div>
                      </div>
                      {isText ? (
                        <div style={{ fontWeight:700, fontSize:'1.15rem' }}><TextPreview url={m.file_url!} /></div>
                      ) : (
                        <>
                          {!!(m.title || localTitle) && (<div style={{ fontWeight:700, fontSize:'1.15rem' }}>{m.title || localTitle}</div>)}
                          {!!(m.description || localDescription) && (<div className="muted" style={{ fontSize:'.95rem' }}>{m.description || localDescription}</div>)}
                        </>
                      )}
                    </div>
                  </>
                )}
              </article>
            )
          })}
        </div>
      </section>
    </main>
  )
}

