import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import VodPlayer, { type VodPlayerHandle } from '../components/VodPlayer'

type VodItem = {
  id: number
  hls_url: string
  title?: string
  description?: string
  original_filename?: string
  likes?: number
}

import { API_BASE_URL } from '../lib/apiBase'
const API_KEY = 'Inetpass1'

export default function VodTheater(){
  const navigate = useNavigate()
  const url = new URL(window.location.href)
  const collectionId = url.searchParams.get('collection_id')
  const currentIdParam = url.searchParams.get('current_id')
  const currentId = currentIdParam ? parseInt(currentIdParam, 10) : undefined
  const singleSrc = url.searchParams.get('src')
  const from = url.searchParams.get('from') || '/vod/all'

  const [playlist, setPlaylist] = useState<VodItem[]>([])
  const [index, setIndex] = useState<number>(0)
  const current = playlist[index]

  const [showUi, setShowUi] = useState<boolean>(true)
  const [muted, setMuted] = useState<boolean>(false)
  const [fit, setFit] = useState<boolean>(true)
  const [likes, setLikes] = useState<number>(0)
  const [, setLoading] = useState<boolean>(true)
  const [, setError] = useState<string | null>(null)
  const playerRef = useRef<VodPlayerHandle | null>(null)
  const uiTimerRef = useRef<number | null>(null)
  const [cur, setCur] = useState<number>(0)
  const [dur, setDur] = useState<number>(0)

  function armAutoHide(){
    if(uiTimerRef.current) window.clearTimeout(uiTimerRef.current)
    if(playerRef.current){
      uiTimerRef.current = window.setTimeout(()=> setShowUi(false), 2500)
    }
  }

  useEffect(()=>{
    const onKey = (e: KeyboardEvent)=>{
      if(e.key === 'Escape'){
        navigate(from)
      }
    }
    window.addEventListener('keydown', onKey)
    return ()=> window.removeEventListener('keydown', onKey)
  }, [navigate, from])

  useEffect(()=>{
    (async ()=>{
      try{
        setLoading(true)
        if(collectionId){
          const res = await fetch(`${API_BASE_URL}/storage/list?limit=5000&mine=false&collection_id=${collectionId}`, { headers:{ 'X-API-KEY': API_KEY } })
          if(!res.ok) throw new Error('list failed')
          const data = await res.json()
          const items: VodItem[] = (data.items as VodItem[]).filter(i => i.hls_url)
          setPlaylist(items)
          const initial = currentId ? Math.max(0, items.findIndex(v => v.id === currentId)) : 0
          setIndex(initial)
          setLikes(items[initial]?.likes ?? 0)
        } else if(currentId){
          const res = await fetch(`${API_BASE_URL}/storage/objects/${currentId}`, { headers:{ 'X-API-KEY': API_KEY } })
          if(!res.ok) throw new Error('object failed')
          const item = await res.json() as VodItem
          setPlaylist(item.hls_url ? [item] : [])
          setIndex(0)
          setLikes(item.likes ?? 0)
        } else if(singleSrc){
          setPlaylist([{ id:-1, hls_url: singleSrc, title:'Single Video' }])
          setIndex(0)
        } else {
          // No params passed: pick the latest uploaded video
          const res = await fetch(`${API_BASE_URL}/storage/list?limit=5000&mine=false`, { headers:{ 'X-API-KEY': API_KEY } })
          if(res.ok){
            const data = await res.json()
            const items: VodItem[] = (data.items as VodItem[]).filter(i => i.hls_url)
            if(items.length){
              // heuristic: newest might be last or highest id
              const latest = items.reduce((a,b)=> (Number(b.id) > Number(a.id) ? b : a), items[0])
              setPlaylist([latest])
              setIndex(0)
              setLikes(latest.likes ?? 0)
            } else {
              setError('No playable videos available.')
            }
          } else {
            setError('Failed to load videos.')
          }
        }
      } catch(e){ setError('Failed to load videos.') } finally { setLoading(false) }
    })()
  }, [collectionId, currentId, singleSrc])

  async function like(){
    if(!current || current.id < 0) return
    try{
      const res = await fetch(`${API_BASE_URL}/storage/objects/${current.id}/like`, { method:'POST', headers:{ 'X-API-KEY': API_KEY } })
      if(!res.ok) throw new Error('like failed')
      const updated = await res.json() as VodItem
      setLikes(updated.likes ?? 0)
    } catch(e){ console.error(e) }
  }

  const onPlayChange = (playing:boolean)=>{
    setShowUi(true)
    if(playing) armAutoHide()
  }
  const onTimeUpdate = (c:number, d:number)=>{
    setCur(c)
    setDur(d || 0)
  }

  const title = current?.title || current?.original_filename || '—'
  const description = current?.description || ''

  return (
    <main role="main" onMouseMove={()=>{ setShowUi(true); armAutoHide() }}>
      <section className="section section-full" aria-labelledby="vodtheater-title" style={{ padding:0 }}>
        {/* Full-bleed hero block at top (header overlaps). Pull up under header by removing body gradient gap */}
        <div style={{ position:'relative', width:'100%', height:'100vh' }}>
          {current && (
            <VodPlayer
              ref={playerRef}
              src={current.hls_url}
              autoplay
              muted={muted}
              loop={false}
              scaleMode={fit ? 'fit' : 'fill'}
              fullscreenScaleMode={fit ? 'fit' : 'fill'}
              onPlayChange={onPlayChange}
              onTimeUpdate={onTimeUpdate}
            />
          )}

          {/* Overlay */}
          <div style={{ position:'absolute', inset:0, pointerEvents:'none', opacity: showUi ? 1 : 0, transition:'opacity .25s' }}>
            {/* top-right controls */}
            <div style={{ position:'absolute', top:12, right:12, display:'flex', gap:8 }}>
              <button
                className="pill"
                style={{ pointerEvents:'auto', background:'var(--glass)', border:'1px solid var(--ring)', borderRadius:12, backdropFilter:'blur(10px) saturate(180%)', WebkitBackdropFilter:'blur(10px) saturate(180%)', color:'var(--text)' }}
                onClick={()=> setFit(v=>!v)}
              >
                {fit ? 'Fit' : 'Fill'}
              </button>
              <button
                className="pill"
                style={{ pointerEvents:'auto', background:'var(--glass)', border:'1px solid var(--ring)', borderRadius:12, backdropFilter:'blur(10px) saturate(180%)', WebkitBackdropFilter:'blur(10px) saturate(180%)', color:'var(--text)' }}
                onClick={()=> setMuted(m => !m)}
              >
                {muted ? 'Unmute' : 'Mute'}
              </button>
              <button
                className="pill"
                style={{ pointerEvents:'auto', background:'var(--glass)', border:'1px solid var(--ring)', borderRadius:12, backdropFilter:'blur(10px) saturate(180%)', WebkitBackdropFilter:'blur(10px) saturate(180%)', color:'var(--text)' }}
                onClick={()=> playerRef.current?.toggleFullscreen()}
              >
                Fullscreen
              </button>
            </div>
            {/* bottom progress */}
            <div
              style={{ position:'absolute', bottom:18, left:'2%', right:'2%', height:6, background:'rgba(255,255,255,0.3)', borderRadius:3, pointerEvents:'auto', cursor:'pointer' }}
              onClick={(e)=>{
                const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
                const ratio = (e.clientX - rect.left) / rect.width
                if(dur && playerRef.current){ playerRef.current.setCurrentTime(ratio * dur) }
              }}
            >
              <div style={{ width: `${dur ? (cur/dur)*100 : 0}%`, height:'100%', background:'var(--brand-2)', borderRadius:3 }} />
            </div>

            {/* Info & like - glass card */}
            <div style={{ position:'absolute', bottom:60, left:20, maxWidth:640, pointerEvents:'none' }}>
              <div style={{ background:'var(--glass)', border:'1px solid var(--ring)', borderRadius:12, backdropFilter:'blur(10px) saturate(180%)', WebkitBackdropFilter:'blur(10px) saturate(180%)', padding:'12px 14px', color:'var(--text)' }}>
                <div style={{ fontWeight:700, marginBottom:6 }}>{title}</div>
                {description && <div className="muted" style={{ margin:0 }}>{description}</div>}
              </div>
            </div>
            <div style={{ position:'absolute', bottom:18, right:18 }}>
              <button
                className="pill"
                style={{ pointerEvents:'auto', background:'var(--glass)', border:'1px solid var(--ring)', borderRadius:12, backdropFilter:'blur(10px) saturate(180%)', WebkitBackdropFilter:'blur(10px) saturate(180%)', color:'var(--text)' }}
                onClick={like}
              >
                ♥ {likes}
              </button>
            </div>

            {/* Prev/Next */}
            {playlist.length > 1 && (
              <>
                <button className="pill" style={{ position:'absolute', left:18, top:'50%', transform:'translateY(-50%)', pointerEvents:'auto' }} onClick={()=> setIndex(i => (i - 1 + playlist.length) % playlist.length)}>‹ Prev</button>
                <button className="pill" style={{ position:'absolute', right:18, top:'50%', transform:'translateY(-50%)', pointerEvents:'auto' }} onClick={()=> setIndex(i => (i + 1) % playlist.length)}>Next ›</button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Comments / additional content below */}
      <section className="section" aria-labelledby="vodtheater-comments">
        <div className="card">
          <h2 id="vodtheater-comments" className="h2">Comments</h2>
          <p className="muted">Coming next: threaded comments, reactions and related videos.</p>
        </div>
      </section>
    </main>
  )
}

