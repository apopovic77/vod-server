import { useEffect, useMemo, useRef, useState } from 'react'
import VodPlayer from '../components/VodPlayer'
import type { VodPlayerHandle } from '../components/VodPlayer'

type VodItem = {
  id: number
  hls_url?: string | null
  file_url?: string | null
  thumbnail_url?: string
  mime_type?: string
  title?: string
  description?: string
  original_filename?: string
  likes?: number
}

import { API_BASE_URL, thumbUrl } from '../lib/apiBase'
const API_KEY = 'Inetpass1'

function thumb(item: VodItem){
  // Always the canonical jpg thumbnail — never the server's PNG variant and
  // never file_url (the full-size original). See thumbUrl() for why.
  return thumbUrl(item as any)
}

function fullSrc(item: VodItem){
  return item.file_url || `${API_BASE_URL}/storage/media/${item.id}`
}

function label(item: VodItem){
  return item.title || item.original_filename?.replace(/\.[^.]+$/, '') || `#${item.id}`
}

function isVideo(item: VodItem){
  return !!item.hls_url || item.mime_type?.startsWith('video/')
}

function isImage(item: VodItem){
  return item.mime_type?.startsWith('image/')
}

function isAudio(item: VodItem){
  return item.mime_type?.startsWith('audio/')
}

type MediaFilter = 'all' | 'image' | 'video' | 'audio'

export default function VodPage(){
  const url = new URL(window.location.href)
  const collectionId = url.searchParams.get('collection_id')
  const currentId = url.searchParams.get('current_id')
  const singleSrc = url.searchParams.get('src')

  const [allItems, setAllItems] = useState<VodItem[]>([])
  const [currentIndex, setCurrentIndex] = useState<number>(-1)
  const [scaleMode, setScaleMode] = useState<'fit'|'fill'>('fit')
  const [muted, setMuted] = useState<boolean>(false)
  const [progress, setProgress] = useState<number>(0)
  const [duration, setDuration] = useState<number>(0)
  const [videoWH, setVideoWH] = useState<{ w:number; h:number }>({ w:16, h:9 })
  const [filter, setFilter] = useState<MediaFilter>('all')
  const playerRef = useRef<VodPlayerHandle | null>(null)

  // Filter items
  const playlist = useMemo(() => {
    if(filter === 'all') return allItems
    if(filter === 'video') return allItems.filter(isVideo)
    if(filter === 'audio') return allItems.filter(isAudio)
    return allItems.filter(isImage)
  }, [allItems, filter])

  const current = currentIndex >=0 && currentIndex < playlist.length ? playlist[currentIndex] : null
  const currentIsVideo = current ? isVideo(current) : false

  useEffect(()=>{
    (async ()=>{
      try{
        if(collectionId){
          const res = await fetch(`${API_BASE_URL}/storage/list?limit=5000&mine=false&collection_id=${collectionId}`, { headers:{ 'X-API-KEY': API_KEY } })
          if(!res.ok) throw new Error('collection load failed')
          const data = await res.json()
          const items = (data.items as VodItem[]).filter(i => {
            const m = i.mime_type || ''
            return m.startsWith('image/') || m.startsWith('video/') || m.startsWith('audio/')
          })
          setAllItems(items)
          if(items.length){
            const idx = currentId ? items.findIndex(v => String(v.id) === String(currentId)) : 0
            setCurrentIndex(idx >=0 ? idx : 0)
          }
        } else if(currentId){
          const res = await fetch(`${API_BASE_URL}/storage/objects/${currentId}`, { headers:{ 'X-API-KEY': API_KEY } })
          if(!res.ok) throw new Error('object load failed')
          const item = await res.json() as VodItem
          setAllItems([item]); setCurrentIndex(0)
        } else if(singleSrc){
          setAllItems([{ id: -1, hls_url: singleSrc, title: 'Single Video', mime_type: 'video/mp4' }])
          setCurrentIndex(0)
        } else {
          const res = await fetch(`${API_BASE_URL}/storage/list?limit=5000&mine=false`, { headers:{ 'X-API-KEY': API_KEY } })
          if(!res.ok) throw new Error('list failed')
          const data = await res.json()
          const items = (data.items as VodItem[]).filter((i: VodItem) => {
            const m = i.mime_type || ''
            return m.startsWith('image/') || m.startsWith('video/') || m.startsWith('audio/')
          })
          if(items.length){
            setAllItems(items)
            setCurrentIndex(0)
          }
        }
      } catch(e){ console.error(e) }
    })()
  }, [collectionId, currentId, singleSrc])

  const title = useMemo(()=> label(current || {} as VodItem), [current])
  const description = useMemo(()=> current?.description || '', [current])
  const likes = current?.likes ?? 0

  function like(){
    if(!current || current.id < 0) return
    fetch(`${API_BASE_URL}/storage/objects/${current.id}/like`, { method:'POST', headers:{ 'X-API-KEY': API_KEY } })
      .then(r => r.ok ? r.json() : Promise.reject('like failed'))
      .then((it: VodItem)=>{
        setAllItems(prev => prev.map(p => p.id === it.id ? { ...p, likes: it.likes } : p))
      })
      .catch(console.error)
  }

  const onTime = (cur:number, dur:number)=>{
    setProgress(cur)
    setDuration(dur || 0)
  }

  // Auto-play when switching to a video
  const prevIndexRef = useRef(currentIndex)
  useEffect(() => {
    if (currentIndex >= 0 && prevIndexRef.current !== currentIndex) {
      if(currentIsVideo){
        const t = setTimeout(() => playerRef.current?.play(), 150)
        prevIndexRef.current = currentIndex
        return () => clearTimeout(t)
      }
    }
    prevIndexRef.current = currentIndex
  }, [currentIndex, currentIsVideo])

  const percent = duration ? (progress / duration) * 100 : 0
  const aspect = videoWH.h ? (videoWH.w / videoWH.h) : (16/9)
  const isPortrait = aspect < 1
  const maxH = '75vh'
  const padTop = isPortrait ? undefined : `${(1 / aspect) * 100}%`

  const upNext = playlist.slice(currentIndex+1, currentIndex+6)
  const imageCount = allItems.filter(isImage).length
  const videoCount = allItems.filter(isVideo).length
  const audioCount = allItems.filter(isAudio).length

  // Reset index when filter changes
  useEffect(() => {
    if(playlist.length > 0) setCurrentIndex(0)
    else setCurrentIndex(-1)
  }, [filter])

  return (
    <main role="main">
    <section className="section" style={{ paddingTop:40 }}>

      {/* Filter bar */}
      {allItems.length > 0 && (
        <div className="vodall-toolbar" style={{ marginBottom: 20 }}>
          <div className="vodall-filters">
            <button className={`vodall-filter-btn${filter === 'all' ? ' active' : ''}`} onClick={() => setFilter('all')}>
              All ({allItems.length})
            </button>
            <button className={`vodall-filter-btn${filter === 'image' ? ' active' : ''}`} onClick={() => setFilter('image')}>
              Images ({imageCount})
            </button>
            <button className={`vodall-filter-btn${filter === 'video' ? ' active' : ''}`} onClick={() => setFilter('video')}>
              Videos ({videoCount})
            </button>
            {audioCount > 0 && (
              <button className={`vodall-filter-btn${filter === 'audio' ? ' active' : ''}`} onClick={() => setFilter('audio')}>
                Audio ({audioCount})
              </button>
            )}
          </div>
        </div>
      )}

      {/* Viewer + Sidebar */}
      <div className="vod-player-layout">
        <div className="vod-player-main">
          <div style={{ position:'relative', width:'100%', background:'#000', borderRadius:'var(--radius-md)', overflow:'hidden', ...(currentIsVideo && isPortrait ? { height: maxH } : !currentIsVideo ? { maxHeight: maxH } : {}) }}>
            {currentIsVideo && !isPortrait && <div style={{ width:'100%', paddingTop: padTop }} />}
            {current && currentIsVideo && (
              <div style={{ position:'absolute', inset:0 }}>
                <VodPlayer
                  ref={playerRef}
                  src={current.hls_url || current.file_url || ''}
                  autoplay
                  muted={muted}
                  scaleMode={scaleMode}
                  onPlayChange={()=>{}}
                  onTimeUpdate={onTime}
                  onError={(m)=> console.warn(m)}
                  onMetadata={({ width, height })=> setVideoWH({ w: width, h: height })}
                />
                {/* Video controls overlay */}
                <div style={{ position:'absolute', inset:0, pointerEvents:'none' }}>
                  <button className="pill" style={{ position:'absolute', top:12, right:12, pointerEvents:'auto' }} onClick={()=> setMuted(m => !m)}>
                    {muted ? '🔇' : '🔊'}
                  </button>
                  <button className="pill" style={{ position:'absolute', top:12, right:68, pointerEvents:'auto' }} onClick={()=> setScaleMode(m => m==='fit'?'fill':'fit')}>
                    ⛶
                  </button>
                  <div style={{ position:'absolute', bottom:0, left:0, width:'100%', height:4, background:'rgba(255,255,255,0.2)', pointerEvents:'auto', cursor:'pointer' }}
                    onClick={(e)=>{
                      if(!playerRef.current) return
                      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
                      const ratio = (e.clientX - rect.left) / rect.width
                      playerRef.current.setCurrentTime(ratio * duration)
                    }}
                  >
                    <div style={{ width:`${percent}%`, height:'100%', background:'var(--brand-2)', transition:'width .1s linear' }} />
                  </div>
                </div>
              </div>
            )}
            {current && !currentIsVideo && !isAudio(current) && (
              <img
                src={fullSrc(current)}
                alt={label(current)}
                style={{ width:'100%', height:'100%', objectFit:'contain', display:'block' }}
              />
            )}
            {current && !currentIsVideo && !isAudio(current) && (
              <a
                href={`/edit/${current.id}`}
                className="pill"
                title="Bild bearbeiten — Rotate / Crop / Spiegeln"
                style={{ position:'absolute', top:12, right:12, pointerEvents:'auto', textDecoration:'none' }}
              >
                ✏️ Bearbeiten
              </a>
            )}
            {current && isAudio(current) && (
              <div className="vod-audio-viewer">
                <div className="vod-audio-icon">♫</div>
                <div className="vod-audio-title">{label(current)}</div>
                <audio
                  key={current.id}
                  controls
                  autoPlay
                  src={fullSrc(current)}
                  style={{ width:'100%', maxWidth:480 }}
                />
              </div>
            )}
          </div>

          {/* Title bar */}
          <div className="vod-meta-bar">
            <div style={{ flex:1, minWidth:0 }}>
              <h3 className="vod-meta-title">{title}</h3>
              {current && current.id >= 0 && (
                <span
                  onClick={()=> navigator.clipboard?.writeText(String(current.id))}
                  title="Storage-ID — klicken zum Kopieren"
                  style={{ display:'inline-block', marginTop:4, padding:'2px 9px', borderRadius:6,
                    background:'rgba(255,255,255,.08)', border:'1px solid var(--ring,#2a3a44)',
                    fontFamily:'monospace', fontSize:12, color:'var(--muted)', cursor:'pointer' }}>
                  Storage-ID: {current.id}
                </span>
              )}
              {description && <p className="vod-meta-desc" style={{ marginTop:6 }}>{description}</p>}
            </div>
            <div className="vod-meta-actions">
              <button className="pill" onClick={()=> setCurrentIndex(i => Math.max(0, i-1))} disabled={currentIndex<=0}>‹ Prev</button>
              <button className="pill" onClick={()=> setCurrentIndex(i => Math.min(playlist.length-1, i+1))} disabled={currentIndex>=playlist.length-1}>Next ›</button>
              <button className="pill" onClick={like}>♥ {likes}</button>
              {current && current.id >= 0 && (
                <a className="pill" target="_blank" rel="noopener"
                   href={`https://${window.location.hostname.replace(/^vod\./, 'admin.')}/storage2.php?id=${current.id}`}
                   title="Dieses Objekt im Admin-Panel öffnen">⚙ Im Admin öffnen</a>
              )}
            </div>
          </div>
        </div>

        {/* Up Next sidebar */}
        {upNext.length > 0 && (
          <div className="vod-sidebar">
            <div className="vod-sidebar-label">Up next</div>
            {upNext.map((v) => (
              <button key={v.id} className="vod-sidebar-item" onClick={()=> setCurrentIndex(playlist.findIndex(p=>p.id===v.id))}>
                <img className="vod-sidebar-thumb" src={thumb(v)} alt="" loading="lazy" />
                <div style={{ display:'flex', flexDirection:'column', gap:2, minWidth:0 }}>
                  <span className="vod-sidebar-title">{label(v)}</span>
                  <span style={{ fontSize:11, color:'var(--muted)', fontFamily:'monospace' }}>#{v.id} · {isVideo(v) ? 'Video' : isAudio(v) ? 'Audio' : 'Image'}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Full grid */}
      {playlist.length > 1 && (
        <div style={{ marginTop:24 }}>
          <div className="vod-grid">
            {playlist.map((v, i) => (
              <button key={v.id} className={`vod-grid-item${i === currentIndex ? ' active' : ''}`} onClick={()=> setCurrentIndex(i)}>
                <div className="vod-grid-thumb-wrap">
                  <img className="vod-grid-thumb" src={thumb(v)} alt="" loading="lazy" />
                  {i === currentIndex && <div className="vod-grid-playing">Viewing</div>}
                  {isVideo(v) && i !== currentIndex && <div className="vod-grid-badge">▶</div>}
                  {isAudio(v) && i !== currentIndex && <div className="vod-grid-badge">♫</div>}
                </div>
                <span className="vod-grid-title">{label(v)}</span>
                <span style={{ fontSize:11, color:'var(--muted)', fontFamily:'monospace' }}>#{v.id}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
    </main>
  )
}
