import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, Share2, Plus } from 'lucide-react'
// @ts-ignore types present after deps install
import { useSearchParams } from 'react-router-dom'
import { Configuration, StorageApi } from 'arkturian-storage-sdk'
import VodPlayer from '../components/VodPlayer'
import RadialAudioPlayer from '../components/RadialAudioPlayer'
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

export default function ImageShareV2(){
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
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [linkedItems, setLinkedItems] = useState<MediaItem[]>([])
  const [groupLinkId, setGroupLinkId] = useState<string | null>(null)
  const [groupCollectionId, setGroupCollectionId] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<number | null>(null)
  const [crossfadeKey, setCrossfadeKey] = useState<number>(0)
  const [addOpen, setAddOpen] = useState<boolean>(false)
  const [layoutMode, setLayoutMode] = useState<'auto'|'vertical'|'left'|'right'>('auto')
  const [isLandscape, setIsLandscape] = useState<boolean>(typeof window !== 'undefined' ? window.innerWidth >= window.innerHeight : true)
  // Toggle to control the visual area's height. When true, the image/video fills the viewport (legacy).
  // When false, we reserve a fixed-height footer section for controls/text, independent of viewport height.
  const FULL_VISUAL = false
  const FOOTER_HEIGHT_PX = 180
  const VISUAL_HEIGHT = FULL_VISUAL ? '100vh' : `calc(100vh - ${FOOTER_HEIGHT_PX}px)`

  const sdkRef = useRef<StorageApi | null>(null)
  const mediaInputRef = useRef<HTMLInputElement | null>(null)
  const audioInputRef = useRef<HTMLInputElement | null>(null)

  function TextPreview({ url }: { url: string }){
    const [text, setText] = useState<string>('')
    const [isMd, setIsMd] = useState<boolean>(false)
    useEffect(()=>{
      let active = true
      ;(async()=>{
        try{
          const res = await fetch(url)
          const t = await res.text()
          if(active){
            setText(t)
            // Heuristic: Markdown if it contains common MD syntax
            const looksMd = /(^|\n)\s{0,3}(#|\*\*|\*\s|\d+\.\s|>\s|\-|\*\s|```|\[.+\]\(.+\))/m.test(t)
            setIsMd(looksMd)
          }
        } catch {}
      })()
      return ()=>{ active = false }
    }, [url])
    return (
      <div style={{ width:'100%', boxSizing:'border-box', padding:'0 200px' }}>
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
    const onResize = ()=> setIsLandscape(window.innerWidth >= window.innerHeight)
    window.addEventListener('resize', onResize)
    return ()=> window.removeEventListener('resize', onResize)
  }, [])

  useEffect(()=>{
    (async ()=>{
      try{
        if(currentId){
          const res = await fetch(`${API_BASE_URL}/storage/objects/${currentId}`, { headers:{ 'X-API-KEY': API_KEY } })
          if(!res.ok) throw new Error('load failed')
          const it = await res.json() as MediaItem
          setItem(it)
          setActiveId(it.id)
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
          setActiveId(first.id)
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
          setActiveId(first.id)
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

  // Poll main item for delayed AI metadata
  useEffect(()=>{
    if(!currentId) return
    let attempts = 0
    const iv = window.setInterval(async ()=>{
      attempts += 1
      try{
        const res = await fetch(`${API_BASE_URL}/storage/objects/${currentId}`, { headers:{ 'X-API-KEY': API_KEY } })
        if(!res.ok) return
        const it = await res.json() as MediaItem
        setItem(prev => prev ? { ...prev, ...it } : it)
        if(it.title){ setLocalTitle(it.title) }
        if(it.description){ setLocalDescription(it.description) }
        if(it.collection_id){ setCollectionName(it.collection_id) }
      } catch {}
      if(attempts >= 6){ window.clearInterval(iv) }
    }, 5000)
    return ()=> window.clearInterval(iv)
  }, [currentId])

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
        const aud = filtered.find(i => (i.mime_type && i.mime_type.startsWith('audio/')) || (i.original_filename && /\.(mp3|wav|m4a|ogg|weba)$/i.test(i.original_filename || '')))
        if(aud && aud.file_url){ setAudioUrl(aud.file_url) }
      } catch {}
    })()
  }, [groupLinkId, groupCollectionId, item?.id])

  // Poll linked items for delayed metadata
  useEffect(()=>{
    if(!groupLinkId && !groupCollectionId) return
    let attempts = 0
    const iv = window.setInterval(async ()=>{
      attempts += 1
      try{
        const q = new URLSearchParams()
        if(groupCollectionId){ q.set('collection_id', groupCollectionId) }
        else if(groupLinkId){ q.set('link_id', groupLinkId) }
        const res = await fetch(`${API_BASE_URL}/storage/list?${q.toString()}`, { headers:{ 'X-API-KEY': API_KEY } })
        if(!res.ok) return
        const data = await res.json() as { items?: MediaItem[] }
        const all = (data.items || [])
        const filtered = all.filter(i => i.id !== item?.id)
        setLinkedItems(filtered)
        const aud = filtered.find(i => (i.mime_type && i.mime_type.startsWith('audio/')) || (i.original_filename && /\.(mp3|wav|m4a|ogg|weba)$/i.test(i.original_filename || '')))
        if(aud && aud.file_url){ setAudioUrl(aud.file_url) }
      } catch {}
      if(attempts >= 6){ window.clearInterval(iv) }
    }, 5000)
    return ()=> window.clearInterval(iv)
  }, [groupLinkId, groupCollectionId, item?.id])

  const navigableMedia = useMemo(()=>{
    const list = item ? [item, ...linkedItems] : [...linkedItems]
    return list.filter(m => {
      const mt = (m.mime_type || '').toLowerCase()
      if(mt.startsWith('audio/')) return false
      return !!m.file_url || !!(m as any).hls_url
    })
  }, [item, linkedItems])

  // Only render active item + adjacent items for performance (prevents HTTP2 overload)
  const visibleMedia = useMemo(()=>{
    if(!navigableMedia.length) return []
    const idx = navigableMedia.findIndex(m => m.id === activeId)
    if(idx === -1) return navigableMedia.slice(0, 1)
    const prev = (idx - 1 + navigableMedia.length) % navigableMedia.length
    const next = (idx + 1) % navigableMedia.length
    const indices = new Set([prev, idx, next])
    return navigableMedia.filter((_, i) => indices.has(i))
  }, [navigableMedia, activeId])

  useEffect(()=>{
    if(!activeId && navigableMedia.length){ setActiveId(navigableMedia[0].id) }
    else if(activeId && !navigableMedia.some(m=> m.id===activeId) && navigableMedia.length){ setActiveId(navigableMedia[0].id) }
  }, [navigableMedia, activeId])

  // Ensure title/description reflect currently active media
  useEffect(()=>{
    if(!activeId) return
    const current = navigableMedia.find(m => m.id === activeId) || item
    if(!current) return
    setLocalTitle(current.title || '')
    setLocalDescription(current.description || '')
  }, [activeId, navigableMedia, item?.id])

  function next(){ if(!navigableMedia.length) return; const i = navigableMedia.findIndex(m=> m.id===activeId); const n = navigableMedia[(i+1)%navigableMedia.length]; setActiveId(n.id); setCrossfadeKey(k=>k+1) }
  function prev(){ if(!navigableMedia.length) return; const i = navigableMedia.findIndex(m=> m.id===activeId); const n = navigableMedia[(i-1+navigableMedia.length)%navigableMedia.length]; setActiveId(n.id); setCrossfadeKey(k=>k+1) }

  async function uploadWithCollection(file: File){
    try{
      if(!file || file.size === 0) return
      if(!sdkRef.current){ sdkRef.current = new StorageApi(new Configuration({ basePath: API_BASE_URL })) }
      // Use current object's id as stable group link if none present
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
      // Decide scope: prefer collection_id when we already have it, else use link_id.
      const q = new URLSearchParams()
      if(groupCollectionId){ q.set('collection_id', groupCollectionId) }
      else if(groupLinkId){ q.set('link_id', groupLinkId) }
      else {
        // Fallback: just update current item
        await fetch(`${API_BASE_URL}/storage/objects/${item?.id}`, { method:'PATCH', headers:{ 'X-API-KEY': API_KEY, 'Content-Type':'application/json' }, body: JSON.stringify({ collection_id: newName }) })
        return
      }
      const res = await fetch(`${API_BASE_URL}/storage/list?${q.toString()}`, { headers:{ 'X-API-KEY': API_KEY } })
      if(!res.ok){ throw new Error('list failed') }
      const data = await res.json() as { items?: MediaItem[] }
      const all = (data.items || [])
      // Parallel PATCH all items to new collection name
      await Promise.all(all.map(async (it) => {
        await fetch(`${API_BASE_URL}/storage/objects/${it.id}`, { method:'PATCH', headers:{ 'X-API-KEY': API_KEY, 'Content-Type':'application/json' }, body: JSON.stringify({ collection_id: newName }) }).catch(()=>{})
      }))
      setGroupCollectionId(newName)
    } catch {}
  }

  const effectiveLayout: 'vertical'|'left'|'right' = useMemo(()=>{
    if(layoutMode === 'auto'){
      return isLandscape ? 'left' : 'vertical'
    }
    return layoutMode
  }, [layoutMode, isLandscape])

  const cycleLayout = ()=>{
    const order: Array<'auto'|'left'|'right'|'vertical'> = ['auto','left','right','vertical']
    setLayoutMode(m => order[(order.indexOf(m)+1) % order.length])
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

  // Side-by-side layout (left or right panel)
  if(effectiveLayout === 'left' || effectiveLayout === 'right'){
    const SidePanel = (
      <div style={{ width:420, minWidth:300, maxWidth:520, padding:'20px 18px', boxSizing:'border-box', height:'100vh', overflow:'auto', display:'flex', flexDirection:'column', justifyContent:'flex-start', paddingTop: effectiveLayout === 'left' ? '5%' : undefined }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
          {effectiveLayout !== 'left' && (() => { const i = navigableMedia.findIndex(m=> m.id===activeId); const hasPrev = i>0; return hasPrev ? (
            <button aria-label="Previous" className="pill" onClick={prev} style={{ width:36, height:36, padding:0, lineHeight:0, borderRadius:999, background:'var(--glass)', border:'1px solid var(--ring)', color:'var(--text)', display:'grid', placeItems:'center' }}><ChevronLeft size={18} /></button>
          ) : null })()}
          <div
            className="pill"
            style={{ background:'var(--glass)', border:'1px solid var(--ring)', borderRadius:12, padding:'8px 12px', backdropFilter:'blur(10px) saturate(180%)', WebkitBackdropFilter:'blur(10px) saturate(180%)', outline:'none' }}
            contentEditable
            suppressContentEditableWarning
            onBlur={(e)=>{ const v = e.currentTarget.textContent || ''; void updateCollectionForAllItems(v) }}
          >
            {collectionName || 'Collection'}
          </div>
          {(() => {
            const current = navigableMedia.find(m => m.id === activeId) || item
            const downloadHref = current?.file_url
            return (
              <div style={{ display:'flex', gap:8 }}>
                {downloadHref && (
                  <a className="pill" href={downloadHref} download title="Download" style={{ width:42, height:42, padding:0, lineHeight:0, display:'grid', placeItems:'center', borderRadius:999, background:'var(--glass)', border:'1px solid var(--ring)', color:'var(--text)' }}><Download size={18} /></a>
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
            )
          })()}
          <div style={{ flex:1 }} />
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginTop:4 }}>
          {!!localTitle && (<div style={{ fontWeight:700, fontSize:'1.15rem' }}>{localTitle}</div>)}
          <div style={{ flex:1 }} />
          {effectiveLayout !== 'left' && navigableMedia.length > 1 && (
            <>
              <button aria-label="Previous" className="pill" onClick={prev} style={{ width:36, height:36, padding:0, lineHeight:0, borderRadius:999, background:'var(--glass)', border:'1px solid var(--ring)', color:'var(--text)', display:'grid', placeItems:'center' }}><ChevronLeft size={18} /></button>
              <button aria-label="Next" className="pill" onClick={next} style={{ width:36, height:36, padding:0, lineHeight:0, borderRadius:999, background:'var(--glass)', border:'1px solid var(--ring)', color:'var(--text)', display:'grid', placeItems:'center' }}><ChevronRight size={18} /></button>
            </>
          )}
        </div>
        {!!localDescription && (<div className="muted" style={{ fontSize:'.95rem', marginTop:8 }}>{localDescription}</div>)}
        {effectiveLayout === 'left' && navigableMedia.length > 1 && (
          <div style={{ display:'flex', alignItems:'center', gap:12, marginTop:12, justifyContent:'flex-start' }}>
            <button aria-label="Previous" className="pill" onClick={prev} style={{ width:36, height:36, padding:0, lineHeight:0, borderRadius:999, background:'var(--glass)', border:'1px solid var(--ring)', color:'var(--text)', display:'grid', placeItems:'center' }}><ChevronLeft size={18} /></button>
            <button aria-label="Next" className="pill" onClick={next} style={{ width:36, height:36, padding:0, lineHeight:0, borderRadius:999, background:'var(--glass)', border:'1px solid var(--ring)', color:'var(--text)', display:'grid', placeItems:'center' }}><ChevronRight size={18} /></button>
          </div>
        )}
      </div>
    )

    return (
      <main role="main">
        <section className="section section-full" aria-labelledby="imagesharev2-title" style={{ padding:0 }}>
          <div style={{ display:'flex', width:'100%', height:'100vh' }}>
            {effectiveLayout === 'left' ? SidePanel : null}
            <div style={{ position:'relative', flex:1 }}>
              <div style={{ position:'relative', width:'100%', height:'100%' }}>
                {visibleMedia.map(m => {
                  const isVideo = !!(m.mime_type && m.mime_type.startsWith('video/')) || !!(m as any).hls_url
                  const isImage = !!(m.mime_type && m.mime_type.startsWith('image/'))
                  if(isVideo){
                    return (
                      <div key={`vid-${m.id}-${crossfadeKey}`} style={{ position:'absolute', inset:0, opacity: m.id === activeId ? 1 : 0, transition:'opacity 800ms ease-in-out' }}>
                        <VodPlayer src={(m as any).hls_url || m.file_url || ''} autoplay muted={false} scaleMode={fit ? 'fit' : 'fill'} isActive={m.id === activeId} />
                      </div>
                    )
                  }
                  if(isImage){
                    return (
                      <img key={`img-${m.id}-${crossfadeKey}`} src={m.file_url} alt={m.title || ''} style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit: fit ? 'contain' : 'cover', opacity: m.id === activeId ? 1 : 0, transition: 'opacity 800ms ease-in-out' }} loading="lazy" />
                    )
                  }
                  return (
                    <div key={`doc-${m.id}-${crossfadeKey}`} style={{ position:'absolute', inset:0, background:'transparent', opacity: m.id === activeId ? 1 : 0, transition:'opacity 800ms ease-in-out', display:'grid', placeItems:'center' }}>
                      <div className="card" style={{ background:'var(--glass)', border:'1px solid var(--ring)', color:'#fff', borderRadius:16, padding:18, minWidth:260, textAlign:'center', backdropFilter:'blur(10px) saturate(180%)', WebkitBackdropFilter:'blur(10px) saturate(180%)' }}>
                        <div style={{ fontSize:22, fontWeight:700, marginBottom:8, color:'var(--text)' }}>{m.original_filename || 'Document'}</div>
                        <div className="muted" style={{ marginBottom:12 }}>{m.mime_type || 'file'}</div>
                        <div style={{ display:'flex', gap:8, justifyContent:'center' }}>
                          {m.file_url && (
                            <a className="pill" href={m.file_url} download style={{ display:'inline-flex', alignItems:'center', gap:8, background:'var(--brand-2)', border:'1px solid var(--brand-2)', color:'#fff' }}><Download size={16} /> Download</a>
                          )}
                          <button className="pill" onClick={()=> { if((navigator as any).share){ (navigator as any).share({ url: m.file_url || window.location.href }) } else { navigator.clipboard.writeText(m.file_url || window.location.href) } }} style={{ display:'inline-flex', alignItems:'center', gap:8, background:'var(--brand-2)', border:'1px solid var(--brand-2)', color:'#fff' }}><Share2 size={16} /> Share</button>
                        </div>
                      </div>
                    </div>
                  )
                })}

                {(() => {
                  const current = navigableMedia.find(m => m.id === activeId)
                  const activeIsVideo = !!(current && ((current.mime_type && current.mime_type.startsWith('video/')) || (current as any).hls_url))
                  if(!audioUrl || activeIsVideo) return null
                  return (
                    <div style={{ position:'absolute', inset:0, display:'grid', placeItems:'center', pointerEvents:'none' }}>
                      <div style={{ pointerEvents:'auto' }}>
                        <RadialAudioPlayer src={audioUrl} title={localTitle} artist={undefined} size={420} />
                      </div>
                    </div>
                  )
                })()}

                <div style={{ position:'absolute', inset:0, pointerEvents:'none' }}>
                  <div style={{ position:'absolute', top:12, right:12, display:'flex', gap:8 }}>
                    <button className="pill" style={{ pointerEvents:'auto', background:'var(--glass)', border:'1px solid var(--ring)', borderRadius:12, backdropFilter:'blur(10px) saturate(180%)', WebkitBackdropFilter:'blur(10px) saturate(180%)', color:'#fff' }} onClick={()=> setFit(f=>!f)}>{fit ? 'Fit' : 'Fill'}</button>
                    <button className="pill" style={{ pointerEvents:'auto', background:'var(--glass)', border:'1px solid var(--ring)', borderRadius:12, backdropFilter:'blur(10px) saturate(180%)', WebkitBackdropFilter:'blur(10px) saturate(180%)', color:'#fff' }} onClick={cycleLayout}>{layoutMode === 'auto' ? 'Auto' : (layoutMode === 'vertical' ? 'Top' : layoutMode.charAt(0).toUpperCase()+layoutMode.slice(1))}</button>
                  </div>

                  {navigableMedia.length > 1 && (
                    <div style={{ position:'absolute', bottom:28, left:'50%', transform:'translateX(-50%)', pointerEvents:'auto' }}>
                      {navigableMedia.length <= 10 ? (
                        <div style={{ display:'flex', gap:10, padding:'6px 10px', background:'var(--glass)', border:'1px solid var(--ring)', borderRadius:999, backdropFilter:'blur(10px) saturate(180%)', WebkitBackdropFilter:'blur(10px) saturate(180%)' }}>
                          {navigableMedia.map(m => (
                            <button
                              key={`dot-${m.id}`}
                              aria-label="Go to"
                              onClick={()=> setActiveId(m.id)}
                              style={{
                                width:12,
                                height:12,
                                borderRadius:'50%',
                                border: m.id===activeId ? '1px solid var(--brand)' : '1px solid var(--ring)',
                                background: m.id===activeId ? 'var(--brand)' : 'transparent',
                                display:'block',
                                padding:0,
                                cursor:'pointer',
                                boxSizing:'border-box'
                              }}
                            />
                          ))}
                        </div>
                      ) : (
                        <div style={{ padding:'8px 16px', background:'var(--glass)', border:'1px solid var(--ring)', borderRadius:999, backdropFilter:'blur(10px) saturate(180%)', WebkitBackdropFilter:'blur(10px) saturate(180%)', color:'#fff', fontSize:14, fontWeight:500 }}>
                          {navigableMedia.findIndex(m => m.id === activeId) + 1} / {navigableMedia.length}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
            {effectiveLayout === 'right' ? SidePanel : null}
          </div>
        </section>
      </main>
    )
  }

  return (
    <main role="main">
      <section className="section section-full" aria-labelledby="imagesharev2-title" style={{ padding:0 }}>
        <div style={{ position:'relative', width:'100%', height:VISUAL_HEIGHT }}>
          {/* Visuals - only render active + adjacent items for performance */}
          {visibleMedia.map(m => {
            const isVideo = !!(m.mime_type && m.mime_type.startsWith('video/')) || !!(m as any).hls_url
            const isImage = !!(m.mime_type && m.mime_type.startsWith('image/'))
            if(isVideo){
              return (
                <div key={`vid-${m.id}-${crossfadeKey}`} style={{ position:'absolute', inset:0, opacity: m.id === activeId ? 1 : 0, transition:'opacity 800ms ease-in-out' }}>
                  <VodPlayer src={(m as any).hls_url || m.file_url || ''} autoplay muted={false} scaleMode={fit ? 'fit' : 'fill'} isActive={m.id === activeId} />
                </div>
              )
            }
            if(isImage){
              return (
                <img key={`img-${m.id}-${crossfadeKey}`} src={m.file_url} alt={m.title || ''} style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit: fit ? 'contain' : 'cover', opacity: m.id === activeId ? 1 : 0, transition: 'opacity 800ms ease-in-out' }} loading="lazy" />
              )
            }
            const mt = (m.mime_type || '').toLowerCase()
            if(mt === 'text/plain' && m.file_url){
              return (
                <div key={`txt-${m.id}-${crossfadeKey}`} style={{ position:'absolute', inset:0, opacity: m.id === activeId ? 1 : 0, transition:'opacity 800ms ease-in-out', display:'grid', placeItems:'start center', padding:'24px' }}>
                  <div style={{ fontWeight:700, fontSize:'1.15rem' }}><TextPreview url={m.file_url} /></div>
                </div>
              )
            }
            // Fallback for other documents
            return (
              <div key={`doc-${m.id}-${crossfadeKey}`} style={{ position:'absolute', inset:0, background:'transparent', opacity: m.id === activeId ? 1 : 0, transition:'opacity 800ms ease-in-out', display:'grid', placeItems:'center' }}>
                <div className="card" style={{ background:'var(--glass)', border:'1px solid var(--ring)', color:'#fff', borderRadius:16, padding:18, minWidth:260, textAlign:'center', backdropFilter:'blur(10px) saturate(180%)', WebkitBackdropFilter:'blur(10px) saturate(180%)' }}>
                  <div style={{ fontSize:22, fontWeight:700, marginBottom:8, color:'var(--text)' }}>{m.original_filename || 'Document'}</div>
                  <div className="muted" style={{ marginBottom:12 }}>{m.mime_type || 'file'}</div>
                  <div style={{ display:'flex', gap:8, justifyContent:'center' }}>
                    {m.file_url && (
                      <a className="pill" href={m.file_url} download style={{ display:'inline-flex', alignItems:'center', gap:8 }}><Download size={16} /> Download</a>
                    )}
                    <button className="pill" onClick={()=> { if((navigator as any).share){ (navigator as any).share({ url: m.file_url || window.location.href }) } else { navigator.clipboard.writeText(m.file_url || window.location.href) } }} style={{ display:'inline-flex', alignItems:'center', gap:8 }}><Share2 size={16} /> Share</button>
                  </div>
                </div>
              </div>
            )
          })}

          {/* Audio overlay (center) if present, but hide when active is a video so clicks hit the video */}
          {(() => {
            const current = navigableMedia.find(m => m.id === activeId)
            const activeIsVideo = !!(current && (
              (current.mime_type && current.mime_type.startsWith('video/')) || (current as any).hls_url
            ))
            if(!audioUrl || activeIsVideo) return null
            return (
            <div style={{ position:'absolute', inset:0, display:'grid', placeItems:'center', pointerEvents:'none' }}>
              <div style={{ pointerEvents:'auto' }}>
                <RadialAudioPlayer src={audioUrl} title={localTitle} artist={undefined} size={420} />
              </div>
            </div>
            )
          })()}

          {/* Controls overlay */}
          <div style={{ position:'absolute', inset:0, pointerEvents:'none' }}>
            {/* Fit/Fill */}
            <div style={{ position:'absolute', top:12, right:12, display:'flex', gap:8 }}>
              <button className="pill" style={{ pointerEvents:'auto', background:'var(--glass)', border:'1px solid var(--ring)', borderRadius:12, backdropFilter:'blur(10px) saturate(180%)', WebkitBackdropFilter:'blur(10px) saturate(180%)', color:'#fff' }} onClick={()=> setFit(f=>!f)}>{fit ? 'Fit' : 'Fill'}</button>
              <button className="pill" style={{ pointerEvents:'auto', background:'var(--glass)', border:'1px solid var(--ring)', borderRadius:12, backdropFilter:'blur(10px) saturate(180%)', WebkitBackdropFilter:'blur(10px) saturate(180%)', color:'#fff' }} onClick={cycleLayout}>{layoutMode === 'auto' ? 'Auto' : (layoutMode === 'vertical' ? 'Top' : layoutMode.charAt(0).toUpperCase()+layoutMode.slice(1))}</button>
            </div>

            {/* Arrows (show only if more than one navigable item) */}
            {FULL_VISUAL && navigableMedia.length > 1 && (
              <>
                <button aria-label="Previous" className="pill" style={{ position:'absolute', top:'50%', left:12, transform:'translateY(-50%)', pointerEvents:'auto', width:46, height:46, padding:0, lineHeight:0, borderRadius:999, background:'var(--white)', border:'1px solid var(--ring)', color:'var(--text)', display:'grid', placeItems:'center' }} onClick={prev}><ChevronLeft size={22} /></button>
                <button aria-label="Next" className="pill" style={{ position:'absolute', top:'50%', right:12, transform:'translateY(-50%)', pointerEvents:'auto', width:46, height:46, padding:0, lineHeight:0, borderRadius:999, background:'var(--white)', border:'1px solid var(--ring)', color:'var(--text)', display:'grid', placeItems:'center' }} onClick={next}><ChevronRight size={22} /></button>
              </>
            )}

            {/* Dots or counter (show only if more than one) */}
            {navigableMedia.length > 1 && (
              <div style={{ position:'absolute', bottom:28, left:'50%', transform:'translateX(-50%)', pointerEvents:'auto' }}>
                {navigableMedia.length <= 10 ? (
                  <div style={{ display:'flex', gap:10, padding:'6px 10px', background:'var(--glass)', border:'1px solid var(--ring)', borderRadius:999, backdropFilter:'blur(10px) saturate(180%)', WebkitBackdropFilter:'blur(10px) saturate(180%)' }}>
                    {navigableMedia.map(m => (
                      <button
                        key={`dot-${m.id}`}
                        aria-label="Go to"
                        onClick={()=> setActiveId(m.id)}
                        style={{
                          width:12,
                          height:12,
                          borderRadius:'50%',
                          border: m.id===activeId ? '1px solid var(--brand)' : '1px solid var(--ring)',
                          background: m.id===activeId ? 'var(--brand)' : 'transparent',
                          display:'block',
                          padding:0,
                          cursor:'pointer',
                          boxSizing:'border-box'
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <div style={{ padding:'8px 16px', background:'var(--glass)', border:'1px solid var(--ring)', borderRadius:999, backdropFilter:'blur(10px) saturate(180%)', WebkitBackdropFilter:'blur(10px) saturate(180%)', color:'#fff', fontSize:14, fontWeight:500 }}>
                    {navigableMedia.findIndex(m => m.id === activeId) + 1} / {navigableMedia.length}
                  </div>
                )}
              </div>
            )}

            {FULL_VISUAL && (
              <div style={{ position:'absolute', bottom:60, left:'5%', maxWidth:700, color:'#fff', pointerEvents:'auto' }}>
                <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:8 }}>
                  <div
                    className="pill"
                    style={{ background:'var(--glass)', border:'1px solid var(--ring)', borderRadius:12, padding:'8px 12px', backdropFilter:'blur(10px) saturate(180%)', WebkitBackdropFilter:'blur(10px) saturate(180%)', outline:'none' }}
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e)=>{ const v = e.currentTarget.textContent || ''; void updateCollectionForAllItems(v) }}
                  >
                    {collectionName || 'Collection'}
                  </div>
                  {(() => {
                    const current = navigableMedia.find(m => m.id === activeId) || item
                    const downloadHref = current?.file_url
                    return (
                      <div style={{ display:'flex', gap:8 }}>
                        {downloadHref && (
                          <a className="pill" href={downloadHref} download title="Download" style={{ width:42, height:42, padding:0, lineHeight:0, display:'grid', placeItems:'center', borderRadius:999, background:'var(--glass)', border:'1px solid var(--ring)', color:'#fff' }}><Download size={18} /></a>
                        )}
                        <button className="pill" title="Share" style={{ width:42, height:42, padding:0, lineHeight:0, display:'grid', placeItems:'center', borderRadius:999, background:'var(--glass)', border:'1px solid var(--ring)', color:'#fff' }} onClick={()=>{ if((navigator as any).share){ (navigator as any).share({ url: window.location.href }) } else { navigator.clipboard.writeText(window.location.href) } }}><Share2 size={18} /></button>
                        <div style={{ position:'relative' }}>
                          <button className="pill" title="Add" style={{ width:42, height:42, padding:0, lineHeight:0, display:'grid', placeItems:'center', borderRadius:999, background:'var(--glass)', border:'1px solid var(--ring)', color:'#fff' }} onClick={()=> setAddOpen(o=>!o)}><Plus size={18} /></button>
                          {addOpen && (
                            <div style={{ position:'absolute', bottom:'100%', left:0, marginBottom:6, background:'var(--glass)', border:'1px solid var(--ring)', borderRadius:12, backdropFilter:'blur(10px) saturate(180%)', WebkitBackdropFilter:'blur(10px) saturate(180%)', padding:8, display:'grid', gap:6, pointerEvents:'auto', zIndex:5, minWidth:180 }}>
                              <button className="pill" style={{ background:'transparent', border:'1px solid var(--ring)', color:'#fff' }} onClick={()=> mediaInputRef.current?.click()}>Add Media</button>
                              <button className="pill" style={{ background:'transparent', border:'1px solid var(--ring)', color:'#fff' }} onClick={()=> audioInputRef.current?.click()}>Upload Audio</button>
                            </div>
                          )}
                          <input ref={mediaInputRef} type="file" accept="image/*,video/*,application/pdf" onChange={onPickMedia} style={{ display:'none' }} />
                          <input ref={audioInputRef} type="file" accept="audio/*" onChange={onPickAudio} style={{ display:'none' }} />
                        </div>
                      </div>
                    )
                  })()}
                </div>
                {!!localTitle && (<div style={{ fontWeight:700, fontSize:'1.15rem', marginBottom:6, color:'#fff' }}>{localTitle}</div>)}
                {!!localDescription && (<div className="muted" style={{ fontSize:'.95rem', color:'#fff' }}>{localDescription}</div>)}
              </div>
            )}
          </div>
        </div>

        {!FULL_VISUAL && (
          <div style={{ padding:'20px 18px', maxWidth:1100, margin:'0 auto', height: `${FOOTER_HEIGHT_PX}px`, boxSizing:'border-box' }}>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
              {/* Prev moved below description in vertical layout */}
              <div
                className="pill"
                style={{ background:'var(--glass)', border:'1px solid var(--ring)', borderRadius:12, padding:'8px 12px', backdropFilter:'blur(10px) saturate(180%)', WebkitBackdropFilter:'blur(10px) saturate(180%)', outline:'none' }}
                contentEditable
                suppressContentEditableWarning
                onBlur={(e)=>{ const v = e.currentTarget.textContent || ''; void updateCollectionForAllItems(v) }}
              >
                {collectionName || 'Collection'}
              </div>
              {(() => {
                const current = navigableMedia.find(m => m.id === activeId) || item
                const downloadHref = current?.file_url
                return (
                  <div style={{ display:'flex', gap:8 }}>
                    {downloadHref && (
                      <a className="pill" href={downloadHref} download title="Download" style={{ width:42, height:42, padding:0, lineHeight:0, display:'grid', placeItems:'center', borderRadius:999, background:'var(--glass)', border:'1px solid var(--ring)', color:'var(--text)' }}><Download size={18} /></a>
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
                    <button aria-label="Previous" className="pill" onClick={prev} style={{ width:42, height:42, padding:0, lineHeight:0, display:'grid', placeItems:'center', borderRadius:999, background:'var(--glass)', border:'1px solid var(--ring)', color:'var(--text)' }}><ChevronLeft size={18} /></button>
                    <button aria-label="Next" className="pill" onClick={next} style={{ width:42, height:42, padding:0, lineHeight:0, display:'grid', placeItems:'center', borderRadius:999, background:'var(--glass)', border:'1px solid var(--ring)', color:'var(--text)' }}><ChevronRight size={18} /></button>
                  </div>
                )
              })()}
              <div style={{ flex:1 }} />
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginTop:4 }}>
              {!!localTitle && (<div style={{ fontWeight:700, fontSize:'1.15rem' }}>{localTitle}</div>)}
              <div style={{ flex:1 }} />
              {/* Prev/Next moved below description */}
            </div>
            {!!localDescription && (<div className="muted" style={{ fontSize:'.95rem' }}>{localDescription}</div>)}
            {/* Prev/Next moved to toolbar next to plus button in vertical mode */}
          </div>
        )}
      </section>
    </main>
  )
}

