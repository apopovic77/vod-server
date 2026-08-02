import { useEffect, useMemo, useRef, useState } from 'react'
// @ts-ignore types present after deps install
import { useSearchParams, Link } from 'react-router-dom'
import VodPlayer, { type VodPlayerHandle } from '../components/VodPlayer'

// Minimal item model compatible with storage
type VodItem = {
  id: number
  hls_url?: string
  file_url?: string
  title?: string
  description?: string
  original_filename?: string
}

import { API_BASE_URL } from '../lib/apiBase'
import { getApiKey } from '../lib/apiKey'
const API_KEY = getApiKey()

export default function ShareReceive(){
  const [params] = useSearchParams()
  const currentIdParam = params.get('current_id')
  const currentId = currentIdParam ? parseInt(currentIdParam, 10) : undefined
  const [item, setItem] = useState<VodItem | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const playerRef = useRef<VodPlayerHandle | null>(null)
  const [muted, setMuted] = useState<boolean>(false)
  const [fit, setFit] = useState<boolean>(true)
  const [cur, setCur] = useState<number>(0)
  const [dur, setDur] = useState<number>(0)

  useEffect(()=>{
    (async ()=>{
      try{
        if(!currentId){ setError('Missing current_id'); return }
        const res = await fetch(`${API_BASE_URL}/storage/objects/${currentId}`, { headers:{ 'X-API-KEY': API_KEY } })
        if(!res.ok) throw new Error('load failed')
        const it = await res.json() as VodItem
        setItem(it)
      } catch(e){ setError('Could not load shared item.') } finally { setLoading(false) }
    })()
  }, [currentId])

  const title = useMemo(()=> item?.title || item?.original_filename || '—', [item])

  if(loading){
    return (
      <main role="main">
        <section className="section">
          <p className="muted">Loading…</p>
        </section>
      </main>
    )
  }
  if(error || !item){
    return (
      <main role="main">
        <section className="section">
          <p className="muted" style={{ color:'crimson' }}>{error || 'Not found'}</p>
          <Link className="pill" to="/fieldshare">Back</Link>
        </section>
      </main>
    )
  }

  const isVideo = !!item.hls_url

  return (
    <main role="main">
      <section className="section section-full" aria-labelledby="share-title">
        <div className="card" style={{ padding:24 }}>
          <h2 id="share-title" className="h2" style={{ marginTop:0 }}>{title}</h2>
          {isVideo ? (
            <div style={{ position:'relative', width:'100%', height:'60vh', marginTop:12 }}>
              <VodPlayer
                ref={playerRef}
                src={item.hls_url!}
                autoplay
                muted={muted}
                loop={false}
                scaleMode={fit ? 'fit' : 'fill'}
                fullscreenScaleMode={fit ? 'fit' : 'fill'}
                onTimeUpdate={(c,d)=>{ setCur(c); setDur(d||0) }}
              />
              <div style={{ position:'absolute', inset:0, pointerEvents:'none' }}>
                <div style={{ position:'absolute', top:12, right:12, display:'flex', gap:8 }}>
                  <button className="pill" style={{ pointerEvents:'auto' }} onClick={()=> setFit(f=>!f)}>{fit ? 'Fit' : 'Fill'}</button>
                  <button className="pill" style={{ pointerEvents:'auto' }} onClick={()=> setMuted(m=>!m)}>{muted ? 'Unmute' : 'Mute'}</button>
                </div>
                <div style={{ position:'absolute', bottom:18, left:'2%', right:'2%', height:6, background:'rgba(0,0,0,0.2)', borderRadius:3 }}
                  onClick={(e)=>{
                    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
                    const ratio = (e.clientX - rect.left) / rect.width
                    if(dur && playerRef.current){ playerRef.current.setCurrentTime(ratio * dur) }
                  }}
                >
                  <div style={{ width: `${dur ? (cur/dur)*100 : 0}%`, height:'100%', background:'var(--brand-2)', borderRadius:3 }} />
                </div>
              </div>
            </div>
          ) : (
            <div className="card" style={{ marginTop:12 }}>
              <div className="muted">Preview coming soon for this file type.</div>
            </div>
          )}

          <div className="card" style={{ marginTop:12, display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
            {item.file_url && (
              <a className="pill" href={item.file_url} download>⬇ Download Original</a>
            )}
            <Link className="pill" to="/fieldshare">Back</Link>
          </div>
        </div>
      </section>
    </main>
  )
}