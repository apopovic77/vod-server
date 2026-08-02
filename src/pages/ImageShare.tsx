import { useEffect, useMemo, useRef, useState } from 'react'
// @ts-ignore types present after deps install
import { useSearchParams } from 'react-router-dom'
import { Configuration, StorageApi } from 'arkturian-storage-sdk'
import RadialAudioPlayer from '../components/RadialAudioPlayer'
import VodPlayer from '../components/VodPlayer'
import MediaInfoCard from '../components/MediaInfoCard'
// md5 not needed; we maintain a stable link group by object id

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
  ai_safety_error?: string
}

import { API_BASE_URL } from '../lib/apiBase'
import { getApiKey } from '../lib/apiKey'
const API_KEY = getApiKey()

export default function ImageShare(){
  const [params] = useSearchParams()
  const currentIdParam = params.get('current_id')
  const currentId = currentIdParam ? parseInt(currentIdParam, 10) : undefined
  const [item, setItem] = useState<MediaItem | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [fit, setFit] = useState<boolean>(false) // default to Fill
  const [likes, setLikes] = useState<number>(0)
  const [localTitle, setLocalTitle] = useState<string>('')
  const [localDescription, setLocalDescription] = useState<string>('')
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [linkedItems, setLinkedItems] = useState<MediaItem[]>([])
  const [activeId, setActiveId] = useState<number | null>(null)
  const [crossfadeKey, setCrossfadeKey] = useState<number>(0)
  const [groupLinkId, setGroupLinkId] = useState<string | null>(null)
  // Upload helpers
  const mediaInputRef = useRef<HTMLInputElement | null>(null)
  const audioInputRef = useRef<HTMLInputElement | null>(null)
  const sdkRef = useRef<StorageApi | null>(null)
  const [addOpen, setAddOpen] = useState<boolean>(false)
  // Recording helpers
  const [isRecording, setIsRecording] = useState<boolean>(false)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<BlobPart[]>([])
  // audio visualization
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const rafRef = useRef<number | null>(null)
  const [, setLevel] = useState<number>(0)
  // UI auto-hide not needed after moving actions into glass card
  // no separate touch handling

  useEffect(()=>{
    (async ()=>{
      try{
        if(!currentId){ setError('Missing current_id'); return }
        const res = await fetch(`${API_BASE_URL}/storage/objects/${currentId}`, { headers:{ 'X-API-KEY': API_KEY } })
        if(!res.ok) throw new Error('load failed')
        const it = await res.json() as MediaItem
        setItem(it)
        setActiveId(it.id)
        setLocalTitle(it.title || '')
        setLocalDescription(it.description || '')
        const anyIt = it as any
        if(anyIt && typeof anyIt.link_id === 'string'){
          setGroupLinkId(anyIt.link_id)
        }
        // If API returns likes on this object type in the future, we can set it here
      } catch(e){ setError('Could not load image.') } finally { setLoading(false) }
    })()
  }, [currentId])

  // Periodically refresh metadata to pick up delayed AI title/description
  useEffect(()=>{
    if(!currentId) return
    let attempts = 0
    const iv = window.setInterval(async ()=>{
      attempts += 1
      try{
        const res = await fetch(`${API_BASE_URL}/storage/objects/${currentId}`, { headers:{ 'X-API-KEY': API_KEY } })
        if(!res.ok) return
        const it = await res.json() as MediaItem
        setItem(prev => {
          if(!prev) return it
          const changed = (it.title && it.title !== prev.title) || (it.description && it.description !== prev.description)
          return changed ? { ...prev, title: it.title ?? prev.title, description: it.description ?? prev.description } : prev
        })
        if(it.title){ setLocalTitle(it.title) }
        if(it.description){ setLocalDescription(it.description) }
        const anyIt = it as any
        if(anyIt && anyIt.link_id && !groupLinkId){ setGroupLinkId(anyIt.link_id as string) }
      } catch {}
      if(attempts >= 6){ window.clearInterval(iv) }
    }, 5000)
    return ()=> window.clearInterval(iv)
  }, [currentId, groupLinkId])

  // Load any items already linked to this image via link_id
  useEffect(()=>{
    (async ()=>{
      if(!groupLinkId) return
      try{
        const res = await fetch(`${API_BASE_URL}/storage/list?link_id=${encodeURIComponent(groupLinkId)}&mine=false`, { headers:{ 'X-API-KEY': API_KEY } })
        if(!res.ok) return
        const data = await res.json() as { items?: MediaItem[] }
        const all = (data.items || [])
        const filtered = all.filter(i => i.id !== item?.id)
        setLinkedItems(filtered)
        const aud = filtered.find(i => (i.mime_type && i.mime_type.startsWith('audio/')) || (i.original_filename && /\.(mp3|wav|m4a|ogg|weba)$/i.test(i.original_filename)))
        if(aud && aud.file_url){ setAudioUrl(aud.file_url) }
      } catch {}
    })()
  }, [groupLinkId])

  // Periodically refresh linked items to capture delayed AI metadata/safety updates
  useEffect(()=>{
    if(!groupLinkId) return
    let attempts = 0
    const iv = window.setInterval(async ()=>{
      attempts += 1
      try{
        const res = await fetch(`${API_BASE_URL}/storage/list?link_id=${encodeURIComponent(groupLinkId)}&mine=false`, { headers:{ 'X-API-KEY': API_KEY } })
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
  }, [groupLinkId, item?.id])

  // Touch detection not needed since actions are always visible in the glass card

  // no auto-hide UI; controls live in the glass card

  const visualMedia = useMemo(()=> {
    const list = item ? [item, ...linkedItems] : [...linkedItems]
    // Only include visual media for the background (images, videos, or hls)
    return list.filter(m => {
      const mt = (m.mime_type || '').toLowerCase()
      const isImage = mt.startsWith('image/')
      const isVideo = mt.startsWith('video/')
      const hasHls = !!(m as any).hls_url
      return isImage || isVideo || hasHls
    })
  }, [item, linkedItems])
  // use localDescription for display; keep memo if needed later

  // Auto-advance crossfade through linked media (images only) unless user has clicked a card
  useEffect(()=>{
    if(!item) return
    let cancelled = false
    let timer: number | null = null
    const advance = ()=>{
      if(cancelled) return
      if(visualMedia.length <= 1) return
      const currentIndex = visualMedia.findIndex(m => m.id === activeId)
      const nextIndex = (currentIndex + 1) % visualMedia.length
      const next = visualMedia[nextIndex]
      const isVideo = !!(next.mime_type && next.mime_type.startsWith('video/'))
      if(!isVideo){ setActiveId(next.id); setCrossfadeKey(k=>k+1) }
    }
    timer = window.setInterval(advance, 5000)
    return ()=>{ if(timer) window.clearInterval(timer); cancelled = true }
  }, [item, visualMedia, activeId])

  async function likeFor(objectId: number){
    if(!objectId || objectId < 0) return
    try{
      const res = await fetch(`${API_BASE_URL}/storage/objects/${objectId}/like`, { method:'POST', headers:{ 'X-API-KEY': API_KEY } })
      if(!res.ok) throw new Error('like failed')
      if(item && objectId === item.id){
        const updated = await res.json() as any
        setLikes(updated.likes ?? (likes + 1))
      }
    } catch(e){ console.error(e) }
  }

  async function uploadWithCollection(file: File){
    try{
      if(!file || file.size === 0) return
      if(!sdkRef.current){ sdkRef.current = new StorageApi(new Configuration({ basePath: API_BASE_URL })) }
      // Reuse existing link group if present; otherwise create a stable one and assign it to current object
      let linkIdToUse: string = groupLinkId || String(item?.id || Date.now())
      if(!groupLinkId && item?.id){
        try{
          await fetch(`${API_BASE_URL}/storage/objects/${item.id}`, {
            method:'PATCH',
            headers:{ 'X-API-KEY': API_KEY, 'Content-Type':'application/json' },
            body: JSON.stringify({ link_id: linkIdToUse })
          })
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
        if(id){
          await fetch(`${API_BASE_URL}/storage/objects/${id}`, { method:'PATCH', headers:{ 'X-API-KEY': API_KEY, 'Content-Type':'application/json' }, body: JSON.stringify({ link_id: linkIdToUse }) })
        }
      } catch{}
      setAddOpen(false)
      // refresh linked items after upload
      try{
        if(linkIdToUse){
          const res = await fetch(`${API_BASE_URL}/storage/list?link_id=${encodeURIComponent(linkIdToUse)}&mine=false`, { headers:{ 'X-API-KEY': API_KEY } })
          if(res.ok){
            const data2 = await res.json() as { items?: MediaItem[] }
            const all2 = (data2.items || [])
            const filtered2 = all2.filter(i => i.id !== item?.id)
            setLinkedItems(filtered2)
            const aud2 = filtered2.find(i => (i.mime_type && i.mime_type.startsWith('audio/')) || (i.original_filename && /\.(mp3|wav|m4a|ogg|weba)$/i.test(i.original_filename)))
            if(aud2 && aud2.file_url){ setAudioUrl(aud2.file_url) }
          }
        }
      } catch {}
    } catch(e){ console.error(e) }
  }

  async function deleteObject(objectId: number){
    try{
      const yes = window.confirm('Delete this item?')
      if(!yes) return
      const res = await fetch(`${API_BASE_URL}/storage/${objectId}`, { method:'DELETE', headers:{ 'X-API-KEY': API_KEY } })
      if(!res.ok){ alert('Failed to delete'); return }
      if(item && objectId === item.id){
        setError('Deleted')
      }
      setLinkedItems(prev => prev.filter(li => li.id !== objectId))
      // recompute audioUrl if the deleted was the active audio
      setAudioUrl(prevUrl => {
        const stillHasAudio = linkedItems.some(li => (li.mime_type && li.mime_type.startsWith('audio/')) || (li.original_filename && /\.(mp3|wav|m4a|ogg|weba)$/i.test(li.original_filename)))
        return stillHasAudio ? prevUrl : null
      })
    } catch(e){ console.error(e) }
  }

  function onPickMedia(e: React.ChangeEvent<HTMLInputElement>){
    const f = e.target.files?.[0]
    if(f && f.size > 0){ void uploadWithCollection(f) }
    e.target.value = ''
  }

  function onPickAudio(e: React.ChangeEvent<HTMLInputElement>){
    const f = e.target.files?.[0]
    if(f && f.size > 0){ void uploadWithCollection(f) }
    e.target.value = ''
  }

  const recStartRef = useRef<number>(0)

  async function startRecording(){
    try{
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream
      // Setup audio meter
      try{
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
        audioCtxRef.current = ctx
        const src = ctx.createMediaStreamSource(stream)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 2048
        analyser.smoothingTimeConstant = 0.8
        src.connect(analyser)
        analyserRef.current = analyser
        const data = new Uint8Array(analyser.frequencyBinCount)
        const tick = ()=>{
          analyser.getByteTimeDomainData(data)
          let sum = 0
          for(let i=0;i<data.length;i++){
            const v = (data[i] - 128) / 128
            sum += v * v
          }
          const rms = Math.sqrt(sum / data.length)
          setLevel(Math.min(1, rms * 2))
          rafRef.current = requestAnimationFrame(tick)
        }
        rafRef.current = requestAnimationFrame(tick)
      } catch(e){ console.warn('Audio meter unavailable', e) }
      // Pick best supported mime type
      let mime: string | undefined = undefined
      const candidates = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4;codecs=mp4a.40.2',
        'audio/mp4'
      ]
      for(const c of candidates){ if((window as any).MediaRecorder && (window as any).MediaRecorder.isTypeSupported && (window as any).MediaRecorder.isTypeSupported(c)){ mime = c; break } }
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } as any : undefined)
      recordedChunksRef.current = []
      rec.ondataavailable = (ev: BlobEvent)=>{ if(ev.data && ev.data.size > 0){ recordedChunksRef.current.push(ev.data) } }
      rec.onstop = async ()=>{
        try{
          const elapsed = Date.now() - (recStartRef.current || Date.now())
          const blob = new Blob(recordedChunksRef.current, { type: rec.mimeType || mime || 'audio/webm' })
          if(blob.size === 0 || elapsed < 400){
            alert('No audio captured. Please press Record and speak for a moment.')
          } else {
            const fileExt = (blob.type.includes('mp4') ? 'm4a' : 'webm')
            const file = new File([blob], `recording_${Date.now()}.${fileExt}`, { type: blob.type })
            // Quick preview in UI
            try{ const url = URL.createObjectURL(blob); setAudioUrl(url) } catch{}
            await uploadWithCollection(file)
          }
        } catch(err){ console.error(err) } finally {
          setIsRecording(false)
          try{ mediaStreamRef.current?.getTracks().forEach(t=> t.stop()) } catch {}
          mediaStreamRef.current = null
          mediaRecorderRef.current = null
          if(rafRef.current){ cancelAnimationFrame(rafRef.current); rafRef.current = null }
          try{ await audioCtxRef.current?.close() } catch {}
          audioCtxRef.current = null
          analyserRef.current = null
          setLevel(0)
        }
      }
      mediaRecorderRef.current = rec
      rec.start(250) // collect small chunks so dataavailable isn’t empty
      recStartRef.current = Date.now()
      setIsRecording(true)
    } catch(e){ console.error('Mic access failed', e) }
  }

  function stopRecording(){
    try{ mediaRecorderRef.current?.stop() } catch(e){ console.error(e) }
  }

  if(loading){ return <main role="main"><section className="section"><p className="muted">Loading…</p></section></main> }
  if(error || !item || !item.file_url){ return <main role="main"><section className="section"><p className="muted" style={{ color:'crimson' }}>{error || 'Not found'}</p></section></main> }
  if(item.ai_safety_rating === 'unsafe' || item.ai_safety_status === 'failed'){
    return (
      <main role="main">
        <section className="section">
          <div className="card" style={{ padding:16 }}>
            <h2 className="h2" style={{ marginTop:0 }}>Content not allowed</h2>
            <p className="muted">This image failed our safety policy checks and cannot be displayed.</p>
          </div>
        </section>
      </main>
    )
  }

  // TODO: enhance by probing image size

  return (
    <main role="main">
      <section className="section section-full" aria-labelledby="imageshare-title" style={{ padding:0 }}>
        <div style={{ position:'relative', width:'100%', height:'100vh', background:'#000' }}>
          {/* Crossfade stack: show currently active media file */}
          {visualMedia.map(m => {
            const isVideo = !!(m.mime_type && m.mime_type.startsWith('video/')) || !!m.hls_url
            const isImage = !!(m.mime_type && m.mime_type.startsWith('image/'))
            if(isVideo){
              return (
                <div key={`vid-${m.id}-${crossfadeKey}`} style={{ position:'absolute', inset:0, opacity: m.id === activeId ? 1 : 0, transition:'opacity 800ms ease-in-out' }}>
                  <VodPlayer src={m.hls_url || m.file_url || ''} autoplay muted={false} scaleMode={fit ? 'fit' : 'fill'} onPlayChange={()=>{}} onTimeUpdate={()=>{}} onError={()=>{}}
                    onMetadata={()=>{}}
                  />
                </div>
              )
            }
            if(isImage){
              return (
                <img
                  key={`img-${m.id}-${crossfadeKey}`}
                  src={m.file_url}
                  alt={m.title || ''}
                  style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit: fit ? 'contain' : 'cover', opacity: m.id === activeId ? 1 : 0, transition: 'opacity 800ms ease-in-out' }}
                />
              )
            }
            // Fallback for non-image/video: show a simple document card
            return (
              <div key={`doc-${m.id}-${crossfadeKey}`} style={{ position:'absolute', inset:0, background:'transparent', opacity: m.id === activeId ? 1 : 0, transition:'opacity 800ms ease-in-out', display:'grid', placeItems:'center' }}>
                <div className="card" style={{ background:'var(--glass)', border:'1px solid var(--ring)', color:'#fff', borderRadius:16, padding:18, minWidth:260, textAlign:'center', backdropFilter:'blur(10px) saturate(180%)', WebkitBackdropFilter:'blur(10px) saturate(180%)' }}>
                  <div style={{ fontSize:22, fontWeight:700, marginBottom:8, color:'var(--text)' }}>{m.original_filename || m.title || 'Document'}</div>
                  <div className="muted" style={{ marginBottom:12 }}>{m.mime_type || 'file'}</div>
                  <div style={{ display:'flex', gap:8, justifyContent:'center' }}>
                    {m.file_url && (
                      <a className="pill" href={m.file_url} download style={{ display:'inline-flex', alignItems:'center', gap:8 }}>Download</a>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
          {audioUrl && (
            <div style={{ position:'absolute', inset:0, display:'grid', placeItems:'center', pointerEvents:'none' }}>
              <div style={{ pointerEvents:'auto' }}>
                <RadialAudioPlayer src={audioUrl} title={localTitle} artist={undefined} size={420} />
              </div>
            </div>
          )}

          {/* Overlay UI (no boxes) */}
          <div style={{ position:'absolute', inset:0, pointerEvents:'none' }}>
            {/* top-right controls */}
            <div style={{ position:'absolute', top:12, right:12, display:'flex', gap:8 }}>
              <button
                className="pill"
                style={{ pointerEvents:'auto', background:'var(--glass)', border:'1px solid var(--ring)', borderRadius:12, backdropFilter:'blur(10px) saturate(180%)', WebkitBackdropFilter:'blur(10px) saturate(180%)', color:'#fff' }}
                onClick={()=> setFit(f=>!f)}
              >
                {fit ? 'Fit' : 'Fill'}
              </button>
            </div>
            {/* bottom train: [image info] – [+] – [attached audio info] */}
            <div style={{ position:'absolute', bottom:60, left:'5%', pointerEvents:'auto', display:'flex', gap:12, alignItems:'flex-end' }}>
              {/* Image info car */}
              <div style={{ color:'#fff', maxWidth:640 }}>
                <MediaInfoCard
                  id={item.id}
                  title={localTitle}
                  description={localDescription}
                  downloadHref={item.file_url}
                  shareUrl={window.location.href}
                  likeCount={likes}
                  onLike={()=> likeFor(item.id)}
                  onDelete={()=> deleteObject(item.id)}
                  onSelect={()=> setActiveId(item.id)}
                  onTitleChange={(t)=>{
                    setLocalTitle(t)
                    fetch(`${API_BASE_URL}/storage/objects/${item.id}`, { method:'PATCH', headers:{ 'X-API-KEY': API_KEY, 'Content-Type':'application/json' }, body: JSON.stringify({ title: t }) }).catch(()=>{})
                  }}
                  onDescriptionChange={(d)=>{
                    setLocalDescription(d)
                    fetch(`${API_BASE_URL}/storage/objects/${item.id}`, { method:'PATCH', headers:{ 'X-API-KEY': API_KEY, 'Content-Type':'application/json' }, body: JSON.stringify({ description: d }) }).catch(()=>{})
                  }}
                />
              </div>

              {/* Attached cars for all linked items (excluding current) */}
              {linkedItems.map(li => {
                const isAudio = (li.mime_type && li.mime_type.startsWith('audio/')) || (li.original_filename && /(\.mp3|\.wav|\.m4a|\.ogg|\.weba)$/i.test(li.original_filename || ''))
                return (
                  <div key={li.id} style={{ color:'#fff', maxWidth:420 }}>
                    <MediaInfoCard
                      id={li.id}
                      title={li.title || (isAudio ? 'Audio' : undefined)}
                      description={li.description}
                      downloadHref={li.file_url}
                      shareUrl={`${window.location.origin}${window.location.pathname}?current_id=${li.id}`}
                      likeCount={undefined}
                      onLike={()=> likeFor(li.id)}
                      onDelete={()=> deleteObject(li.id)}
                      onSelect={()=> setActiveId(li.id)}
                      onTitleChange={(t)=>{
                        fetch(`${API_BASE_URL}/storage/objects/${li.id}`, { method:'PATCH', headers:{ 'X-API-KEY': API_KEY, 'Content-Type':'application/json' }, body: JSON.stringify({ title: t }) }).catch(()=>{})
                      }}
                      onDescriptionChange={(d)=>{
                        fetch(`${API_BASE_URL}/storage/objects/${li.id}`, { method:'PATCH', headers:{ 'X-API-KEY': API_KEY, 'Content-Type':'application/json' }, body: JSON.stringify({ description: d }) }).catch(()=>{})
                      }}
                    />
                  </div>
                )
              })}

              {/* Coupler plus after the last car */}
              <div style={{ position:'relative' }}>
                <button
                  className="pill"
                  style={{ background:'transparent', border:'1px solid var(--ring)', borderRadius:12, color:'#fff' }}
                  onClick={()=> setAddOpen(o=>!o)}
                  title="Link another media"
                >
                  +
                </button>
                {addOpen && (
                  <div style={{ position:'absolute', bottom:'100%', left:0, marginBottom:6, background:'var(--glass)', border:'1px solid var(--ring)', borderRadius:12, backdropFilter:'blur(10px) saturate(180%)', WebkitBackdropFilter:'blur(10px) saturate(180%)', padding:8, display:'grid', gap:6, pointerEvents:'auto', zIndex:5, minWidth:180 }}>
                    {!isRecording && (
                      <>
                        <button className="pill" style={{ background:'transparent', border:'1px solid var(--ring)', color:'#fff' }} onClick={()=> mediaInputRef.current?.click()}>Add Media</button>
                        <button className="pill" style={{ background:'transparent', border:'1px solid var(--ring)', color:'#fff' }} onClick={()=> audioInputRef.current?.click()}>Upload Audio</button>
                        <button className="pill" style={{ background:'transparent', border:'1px solid var(--ring)', color:'#fff' }} onClick={startRecording}>Record Audio</button>
                      </>
                    )}
                    {isRecording && (
                      <>
                        <div style={{ display:'grid', gap:6 }}>
                          <div className="muted" style={{ color:'#fff' }}>Recording…</div>
                          <div style={{ width: '100%', height:8, background:'rgba(255,255,255,0.25)', borderRadius:6, overflow:'hidden' }}>
                            <div style={{ width: '12%', height:'100%', background:'#fff' }} />
                          </div>
                          <button className="pill" style={{ background:'crimson', border:'1px solid var(--ring)', color:'#fff' }} onClick={stopRecording}>Stop Recording</button>
                        </div>
                      </>
                    )}
                    <input ref={mediaInputRef} type="file" accept="image/*,video/*,application/pdf" onChange={onPickMedia} style={{ display:'none' }} />
                    <input ref={audioInputRef} type="file" accept="audio/*" onChange={onPickAudio} style={{ display:'none' }} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

