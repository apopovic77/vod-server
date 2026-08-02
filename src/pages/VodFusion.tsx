import { useEffect, useRef, useState } from 'react'
import TheaterUnit, { type VodItem as VodItemType } from '../components/TheaterUnit'
import { type VodPlayerHandle } from '../components/VodPlayer'

type VodItem = VodItemType

import { API_BASE_URL } from '../lib/apiBase'
import { getApiKey } from '../lib/apiKey'
const API_KEY = getApiKey()

export default function VodFusion(){
  const [items, setItems] = useState<VodItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [activeId, setActiveId] = useState<number | null>(null)
  const playerRef = useRef<VodPlayerHandle | null>(null)
  const [muted, setMuted] = useState<boolean>(false)
  const [fit, setFit] = useState<boolean>(true)
  const [cur, setCur] = useState<number>(0)
  const [dur, setDur] = useState<number>(0)
  const tileRefs = useRef<Record<number, HTMLDivElement | null>>({})
  const videoRefs = useRef<Record<number, HTMLDivElement | null>>({})
  const [placeholderHeights, setPlaceholderHeights] = useState<Record<number, number>>({})
  const [morphWrapperStyle, setMorphWrapperStyle] = useState<React.CSSProperties | null>(null)
  const [videoStyle, setVideoStyle] = useState<React.CSSProperties | null>(null)
  const rectCache = useRef<Record<number, { w:number; h:number }> >({})

  useEffect(()=>{
    (async ()=>{
      try{
        setLoading(true)
        const res = await fetch(`${API_BASE_URL}/storage/list?limit=5000&mine=false`, { headers:{ 'X-API-KEY': API_KEY } })
        if(!res.ok) throw new Error('list failed')
        const data = await res.json()
        // Filter to only images and videos
        const filtered: VodItem[] = (data.items as VodItem[]).filter(item => {
          const mime = item.mime_type || ''
          return mime.startsWith('image/') || mime.startsWith('video/')
        })
        setItems(filtered)
      } catch(e){ setError('Could not load videos.') } finally { setLoading(false) }
    })()
  }, [])

  // Inline theater overlay (no route change)
  useEffect(()=>{
    const onKey = (e: KeyboardEvent)=>{
      if(e.key === 'Escape') setActiveId(null)
    }
    window.addEventListener('keydown', onKey)
    return ()=> window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(()=>{
    if(activeId === null){
      setMorphWrapperStyle(null)
      setVideoStyle(null)
      return
    }
    const host = tileRefs.current[activeId]
    const videoEl = videoRefs.current[activeId]
    if(!host || !videoEl) return
    const rect = host.getBoundingClientRect()
    setPlaceholderHeights(h => ({ ...h, [activeId]: rect.height }))
    const scaleX = window.innerWidth / rect.width
    const scaleY = window.innerHeight / rect.height
    rectCache.current[activeId] = { w: rect.width, h: rect.height }
    setMorphWrapperStyle({ position:'fixed', left:0, top:0, width:'100vw', height:'100vh', zIndex:60, pointerEvents:'none' })
    // start at tile position/size (top-left origin)
    setVideoStyle({ pointerEvents:'auto', transformOrigin: 'top left', transform: `translate(${rect.left}px, ${rect.top}px) scale(1, 1)`, transition: 'transform .45s cubic-bezier(.2,.8,.2,1)' })
    // animate to full viewport
    requestAnimationFrame(()=>{
      setVideoStyle(s => s ? { ...s, transform: `translate(0px, 0px) scale(${scaleX}, ${scaleY})` } : s)
    })
  }, [activeId])

  return (
    <main role="main">
      <section className="section" aria-labelledby="fusion-title">
        <h2 id="fusion-title" className="h2">All Videos</h2>
        {loading && <p className="muted">Loading…</p>}
        {error && <p className="muted" style={{ color:'crimson' }}>{error}</p>}
        {!loading && !error && (
          <div className="masonry" style={{ position:'relative' }}>
            {items.map((item) => {
              const isActive = activeId === item.id
              const ph = placeholderHeights[item.id]
              return (
                <div key={item.id} className="masonry-item" ref={(el)=>{ tileRefs.current[item.id] = el }}>
                  {isActive && ph ? <div style={{ height: ph }} /> : null}
                  <div onDoubleClick={()=> setActiveId(item.id)}>
                    <div ref={(el)=>{ videoRefs.current[item.id] = el }} style={isActive && morphWrapperStyle ? morphWrapperStyle : undefined}>
                      <div style={isActive && videoStyle ? videoStyle : undefined}>
                        <TheaterUnit
                          item={item}
                          mode={isActive ? 'theater' : 'mini'}
                          playerRef={isActive ? playerRef : undefined}
                          muted={isActive ? muted : undefined}
                          scaleMode={isActive ? (fit ? 'fit' : 'fill') : undefined}
                          fullscreenScaleMode={isActive ? (fit ? 'fit' : 'fill') : undefined}
                          onTimeUpdate={isActive ? ((c,d)=>{ setCur(c); setDur(d||0) }) : undefined}
                          onPlayChange={isActive ? (()=>{}) : undefined}
                          miniContainerRef={(el)=>{ videoRefs.current[item.id] = el }}
                          onMeta={()=>{}}
                          miniStyle={isActive ? { width: (rectCache.current[item.id]?.w || 0) + 'px', height: (rectCache.current[item.id]?.h || 0) + 'px' } : undefined}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
            {activeId !== null && (
              <>
                {/* dim background */}
                <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:55 }} onClick={()=> setActiveId(null)} />
                {/* theater overlay controls anchored to the morphing card */}
                <div style={{ position:'fixed', top:12, right:12, zIndex:65, display:'flex', gap:8 }}>
                  <button className="pill" style={{ background:'var(--glass)', border:'1px solid var(--ring)', borderRadius:12, backdropFilter:'blur(10px) saturate(180%)', WebkitBackdropFilter:'blur(10px) saturate(180%)', color:'var(--text)' }} onClick={()=> setFit(f=>!f)}>{fit ? 'Fit' : 'Fill'}</button>
                  <button className="pill" style={{ background:'var(--glass)', border:'1px solid var(--ring)', borderRadius:12, backdropFilter:'blur(10px) saturate(180%)', WebkitBackdropFilter:'blur(10px) saturate(180%)', color:'var(--text)' }} onClick={()=> setMuted(m=>!m)}>{muted ? 'Unmute' : 'Mute'}</button>
                  <button className="pill" style={{ background:'var(--glass)', border:'1px solid var(--ring)', borderRadius:12, backdropFilter:'blur(10px) saturate(180%)', WebkitBackdropFilter:'blur(10px) saturate(180%)', color:'var(--text)' }} onClick={()=> setActiveId(null)}>Close</button>
                </div>
                <div style={{ position:'fixed', bottom:18, left:'2%', right:'2%', height:6, background:'rgba(255,255,255,0.3)', borderRadius:3, zIndex:65 }}
                  onClick={(e)=>{
                    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
                    const ratio = (e.clientX - rect.left) / rect.width
                    if(dur && playerRef.current){ playerRef.current.setCurrentTime(ratio * dur) }
                  }}
                >
                  <div style={{ width: `${dur ? (cur/dur)*100 : 0}%`, height:'100%', background:'var(--brand-2)', borderRadius:3 }} />
                </div>
              </>
            )}
          </div>
        )}
      </section>
    </main>
  )
}

