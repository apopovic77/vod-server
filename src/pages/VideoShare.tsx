import { useEffect, useMemo, useRef, useState } from 'react'
// @ts-ignore types present after deps install
import { useSearchParams } from 'react-router-dom'
import VodPlayer, { type VodPlayerHandle } from '../components/VodPlayer'

type VodItem = {
  id: number
  hls_url?: string
  file_url?: string
  title?: string
  description?: string
  original_filename?: string
  likes?: number
}

import { API_BASE_URL } from '../lib/apiBase'
const API_KEY = 'Inetpass1'

export default function VideoShare(){
  const [params] = useSearchParams()
  const currentIdParam = params.get('current_id')
  const currentId = currentIdParam ? parseInt(currentIdParam, 10) : undefined
  const [item, setItem] = useState<VodItem | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [muted, setMuted] = useState<boolean>(false)
  const [fit, setFit] = useState<boolean>(true)
  const [likes, setLikes] = useState<number>(0)
  const [cur, setCur] = useState<number>(0)
  const [dur, setDur] = useState<number>(0)
  const playerRef = useRef<VodPlayerHandle | null>(null)
  const [showUi, setShowUi] = useState<boolean>(true)
  const uiTimerRef = useRef<number | null>(null)

  useEffect(()=>{
    (async ()=>{
      try{
        if(!currentId){ setError('Missing current_id'); return }
        const res = await fetch(`${API_BASE_URL}/storage/objects/${currentId}`, { headers:{ 'X-API-KEY': API_KEY } })
        if(!res.ok) throw new Error('load failed')
        const it = await res.json() as VodItem
        setItem(it)
        setLikes(it.likes ?? 0)
      } catch(e){ setError('Could not load video.') } finally { setLoading(false) }
    })()
  }, [currentId])

  // Periodic metadata refresh to catch late AI title/description updates
  useEffect(()=>{
    if(!currentId) return
    let attempts = 0
    const iv = window.setInterval(async ()=>{
      attempts += 1
      try{
        const res = await fetch(`${API_BASE_URL}/storage/objects/${currentId}`, { headers:{ 'X-API-KEY': API_KEY } })
        if(!res.ok) return
        const it = await res.json() as VodItem
        setItem(prev => {
          if(!prev) return it
          const changed = (it.title && it.title !== prev.title) || (it.description && it.description !== prev.description)
          return changed ? { ...prev, title: it.title ?? prev.title, description: it.description ?? prev.description } : prev
        })
      } catch {}
      if(attempts >= 6){ window.clearInterval(iv) } // ~30s if 5s interval
    }, 5000)
    return ()=> window.clearInterval(iv)
  }, [currentId])

  async function like(){
    if(!item || item.id < 0) return
    try{
      const res = await fetch(`${API_BASE_URL}/storage/objects/${item.id}/like`, { method:'POST', headers:{ 'X-API-KEY': API_KEY } })
      if(!res.ok) throw new Error('like failed')
      const updated = await res.json() as VodItem
      setLikes(updated.likes ?? 0)
    } catch(e){ console.error(e) }
  }

  const title = useMemo(()=> item?.title || item?.original_filename || '—', [item])
  const description = useMemo(()=> item?.description || '', [item])

  if(loading){ return <main role="main"><section className="section"><p className="muted">Loading…</p></section></main> }
  if(error || !item || !item.hls_url){ return <main role="main"><section className="section"><p className="muted" style={{ color:'crimson' }}>{error || 'Not found'}</p></section></main> }

  return (
    <main role="main" onMouseMove={()=>{ setShowUi(true); if(uiTimerRef.current) window.clearTimeout(uiTimerRef.current); uiTimerRef.current = window.setTimeout(()=> setShowUi(false), 2500) as unknown as number }}>
      <section className="section section-full" aria-labelledby="videoshare-title" style={{ padding:0 }}>
        <div style={{ position:'relative', width:'100%', height:'100vh' }}>
          <VodPlayer
            ref={playerRef}
            src={item.hls_url}
            autoplay
            muted={muted}
            loop={false}
            scaleMode={fit ? 'fit' : 'fill'}
            fullscreenScaleMode={fit ? 'fit' : 'fill'}
            onTimeUpdate={(c,d)=>{ setCur(c); setDur(d||0) }}
          />

          {/* Overlay UI (no boxes) */}
          <div style={{ position:'absolute', inset:0, pointerEvents:'none', opacity: showUi ? 1 : 0, transition:'opacity .25s' }}>
            {/* top-right controls */}
            <div style={{ position:'absolute', top:12, right:12, display:'flex', gap:8 }}>
              <button
                className="pill"
                style={{ pointerEvents:'auto', background:'var(--glass)', border:'1px solid var(--ring)', borderRadius:12, backdropFilter:'blur(10px) saturate(180%)', WebkitBackdropFilter:'blur(10px) saturate(180%)', color:'var(--text)' }}
                onClick={()=> setFit(f=>!f)}
              >
                {fit ? 'Fit' : 'Fill'}
              </button>
              <button
                className="pill"
                style={{ pointerEvents:'auto', background:'var(--glass)', border:'1px solid var(--ring)', borderRadius:12, backdropFilter:'blur(10px) saturate(180%)', WebkitBackdropFilter:'blur(10px) saturate(180%)', color:'var(--text)' }}
                onClick={()=> setMuted(m=>!m)}
              >
                {muted ? 'Unmute' : 'Mute'}
              </button>
              <a
                className="pill"
                style={{ pointerEvents:'auto', background:'var(--glass)', border:'1px solid var(--ring)', borderRadius:12, backdropFilter:'blur(10px) saturate(180%)', WebkitBackdropFilter:'blur(10px) saturate(180%)', color:'var(--text)' }}
                href={item.file_url || '#'}
                download
              >
                ⬇ Download
              </a>
            </div>
            {/* bottom progress */}
            <div style={{ position:'absolute', bottom:18, left:'2%', right:'2%', height:6, background:'rgba(255,255,255,0.3)', borderRadius:3, pointerEvents:'auto', cursor:'pointer' }}
              onClick={(e)=>{
                const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
                const ratio = (e.clientX - rect.left) / rect.width
                if(dur && playerRef.current){ playerRef.current.setCurrentTime(ratio * dur) }
              }}
            >
              <div style={{ width: `${dur ? (cur/dur)*100 : 0}%`, height:'100%', background:'var(--brand-2)', borderRadius:3 }} />
            </div>
            {/* bottom-left meta with margin */}
            <div style={{ position:'absolute', bottom:60, left:'15%', maxWidth:640, pointerEvents:'none' }}>
              <div style={{ background:'var(--glass)', border:'1px solid var(--ring)', borderRadius:12, backdropFilter:'blur(10px) saturate(180%)', WebkitBackdropFilter:'blur(10px) saturate(180%)', padding:'12px 14px', color:'var(--text)' }}>
                <div style={{ fontWeight:700, marginBottom:6 }}>{title}</div>
                {description && <div className="muted" style={{ margin:0 }}>{description}</div>}
              </div>
            </div>
            {/* bottom-right like */}
            <div style={{ position:'absolute', bottom:18, right:18 }}>
              <button
                className="pill"
                style={{ pointerEvents:'auto', background:'var(--glass)', border:'1px solid var(--ring)', borderRadius:12, backdropFilter:'blur(10px) saturate(180%)', WebkitBackdropFilter:'blur(10px) saturate(180%)', color:'var(--text)' }}
                onClick={like}
              >
                ♥ {likes}
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

