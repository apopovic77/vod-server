import { useEffect, useMemo, useRef, useState } from 'react'
import VodPlayer from '../components/VodPlayer'
import type { VodPlayerHandle } from '../components/VodPlayer'

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

export default function VodPage(){
  const url = new URL(window.location.href)
  const collectionId = url.searchParams.get('collection_id')
  const currentId = url.searchParams.get('current_id')
  const singleSrc = url.searchParams.get('src')

  const [playlist, setPlaylist] = useState<VodItem[]>([])
  const [currentIndex, setCurrentIndex] = useState<number>(-1)
  const [showUi, setShowUi] = useState<boolean>(true)
  const [scaleMode, setScaleMode] = useState<'fit'|'fill'>('fit')
  const [muted, setMuted] = useState<boolean>(false)
  const [progress, setProgress] = useState<number>(0)
  const [duration, setDuration] = useState<number>(0)
  const [videoWH, setVideoWH] = useState<{ w:number; h:number }>({ w:16, h:9 })
  const playerRef = useRef<VodPlayerHandle | null>(null)

  const current = currentIndex >=0 ? playlist[currentIndex] : null

  useEffect(()=>{
    (async ()=>{
      try{
        if(collectionId){
          const res = await fetch(`${API_BASE_URL}/storage/list?collection_id=${collectionId}`, { headers:{ 'X-API-KEY': API_KEY } })
          if(!res.ok) throw new Error('collection load failed')
          const data = await res.json()
          const items = (data.items as VodItem[]).filter(i => i.hls_url)
          setPlaylist(items)
          if(items.length){
            const idx = currentId ? items.findIndex(v => String(v.id) === String(currentId)) : 0
            setCurrentIndex(idx >=0 ? idx : 0)
          }
        } else if(currentId){
          const res = await fetch(`${API_BASE_URL}/storage/objects/${currentId}`, { headers:{ 'X-API-KEY': API_KEY } })
          if(!res.ok) throw new Error('object load failed')
          const item = await res.json() as VodItem
          if(item.hls_url){ setPlaylist([item]); setCurrentIndex(0) }
        } else if(singleSrc){
          setPlaylist([{ id: -1, hls_url: singleSrc, title: 'Single Video' }])
          setCurrentIndex(0)
        }
      } catch(e){ console.error(e) }
    })()
  }, [collectionId, currentId, singleSrc])

  const title = useMemo(()=> current?.title || current?.original_filename || '—', [current])
  const description = useMemo(()=> current?.description || '', [current])
  const likes = current?.likes ?? 0

  function like(){
    if(!current || current.id < 0) return
    fetch(`${API_BASE_URL}/storage/objects/${current.id}/like`, { method:'POST', headers:{ 'X-API-KEY': API_KEY } })
      .then(r => r.ok ? r.json() : Promise.reject('like failed'))
      .then((it: VodItem)=>{
        setPlaylist(prev => prev.map(p => p.id === it.id ? { ...p, likes: it.likes } : p))
      })
      .catch(console.error)
  }

  const onTime = (cur:number, dur:number)=>{
    setProgress(cur)
    setDuration(dur || 0)
  }

  const percent = duration ? (progress / duration) * 100 : 0
  const aspect = videoWH.h ? (videoWH.w / videoWH.h) : (16/9)
  const padTop = `${(1 / aspect) * 100}%`

  return (
    <main role="main">
    <section className="section" style={{ paddingTop:40 }}>
      <div className="card" style={{ display:'grid', gridTemplateColumns:'1fr 280px', gap:16 }}>
        <div style={{ position:'relative', width:'100%' }}>
          <div style={{ width:'100%', paddingTop: padTop }} />
          <div style={{ position:'absolute', inset:0 }}>
            {current && (
              <VodPlayer
                ref={playerRef}
                src={current.hls_url}
                autoplay
                muted={muted}
                scaleMode={scaleMode}
                onPlayChange={()=> setShowUi(true)}
                onTimeUpdate={onTime}
                onError={(m)=> console.warn(m)}
                onMetadata={({ width, height })=> setVideoWH({ w: width, h: height })}
              />
            )}
            {/* UI overlay */}
            <div style={{ position:'absolute', inset:0, pointerEvents:'none', transition:'opacity .3s', opacity: showUi ? 1 : 0 }}>
              <button className="pill" style={{ position:'absolute', top:16, right:16, pointerEvents:'auto' }} onClick={()=> setMuted(m => !m)}>
                {muted ? '🔇' : '🔊'}
              </button>
              <button className="pill" style={{ position:'absolute', top:16, right:76, pointerEvents:'auto' }} onClick={()=> setScaleMode(m => m==='fit'?'fill':'fit')}>
                ⛶
              </button>
              <div style={{ position:'absolute', bottom:18, left:'2%', width:'96%', height:5, background:'rgba(255,255,255,0.3)', pointerEvents:'auto', borderRadius:3 }}
                onClick={(e)=>{
                  if(!playerRef.current) return
                  const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
                  const ratio = (e.clientX - rect.left) / rect.width
                  playerRef.current.setCurrentTime(ratio * duration)
                }}
              >
                <div style={{ width:`${percent}%`, height:'100%', background:'var(--brand-2)' }} />
              </div>
            </div>
          </div>
        </div>
        <div style={{ display:'grid', gap:8, alignContent:'start' }}>
          <div className="muted" style={{ fontSize:12 }}>Up next</div>
          {playlist.slice(currentIndex+1, currentIndex+4).map((v)=> (
            <button key={v.id} className="flat-card" style={{ textAlign:'left' }} onClick={()=> setCurrentIndex(playlist.findIndex(p=>p.id===v.id))}>
              <div className="flat-card-inner">
                <div className="flat-card-title" style={{ fontSize:14 }}>{v.title || v.original_filename}</div>
                <div className="flat-card-sub" style={{ fontSize:12 }}>{v.description || '—'}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Meta + nav */}
      <div className="card" style={{ marginTop:12, display:'grid', gap:8 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
          <div>
            <h3 style={{ margin:'0 0 6px 0' }}>{title}</h3>
            {description && <p className="muted" style={{ margin:0 }}>{description}</p>}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <button className="pill" onClick={()=> setCurrentIndex(i => Math.max(0, i-1))} disabled={currentIndex<=0}>‹ Prev</button>
            <button className="pill" onClick={()=> setCurrentIndex(i => Math.min(playlist.length-1, i+1))} disabled={currentIndex>=playlist.length-1}>Next ›</button>
            <button className="pill" onClick={like}>♥ {likes}</button>
          </div>
        </div>
        {playlist.length>1 && (
          <div className="flat-grid">
            {playlist.map((v, i)=> (
              <button key={v.id} className="flat-card" style={{ textAlign:'left', cursor:'pointer', borderColor: i===currentIndex? 'var(--brand-2)': 'var(--ring)'}} onClick={()=> setCurrentIndex(i)}>
                <div className="flat-card-inner">
                  <div className="flat-card-title" style={{ fontSize:14 }}>{v.title || v.original_filename}</div>
                  <div className="flat-card-sub" style={{ fontSize:12 }}>{v.description || '—'}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
    </main>
  )
}

