import { useEffect, useMemo, useRef, useState } from 'react'
import LoadingSlider from '../components/LoadingSlider'
import { useNavigate } from 'react-router-dom'
import type { VodItem as VodItemType } from '../components/TheaterUnit'

type VodItem = VodItemType

import { API_BASE_URL } from '../lib/apiBase'
const API_KEY = 'Inetpass1'

type Cell = { col: number; row: number; width: number; height: number; left: number; top: number; itemIndex: number }

export default function VodAll(){
  const [items, setItems] = useState<VodItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [visibleCells, setVisibleCells] = useState<Cell[]>([])
  const [expanded, setExpanded] = useState<{ id: string; item: VodItem; fromRect: DOMRect; width: number; height: number } | null>(null)
  const [title, setTitle] = useState<string>('')

  const navigate = useNavigate()

  // Layout settings (tweakable)
  const settingsRef = useRef({
    baseWidth: 400,
    smallHeight: 330,
    largeHeight: 500,
    itemGap: 65,
    columns: 4,
    buffer: 3, // how many viewports around to render
    expandedScale: 0.4, // viewport width percentage
    overlayOpacity: 0.9,
    zoomDurationMs: 600
  })

  const rootRef = useRef<HTMLDivElement|null>(null)
  const canvasRef = useRef<HTMLDivElement|null>(null)
  const overlayRef = useRef<HTMLDivElement|null>(null)

  // Drag state (refs avoid rerenders on each frame)
  const isDraggingRef = useRef(false)
  const canDragRef = useRef(true)
  const startXRef = useRef(0)
  const startYRef = useRef(0)
  const targetXRef = useRef(0)
  const targetYRef = useRef(0)
  const currentXRef = useRef(0)
  const currentYRef = useRef(0)
  const lastUpdateRef = useRef(0)
  const lastXRef = useRef(0)
  const lastYRef = useRef(0)
  const mouseMovedRef = useRef(false)

  const sizes = useMemo(()=>[
    { width: settingsRef.current.baseWidth, height: settingsRef.current.smallHeight },
    { width: settingsRef.current.baseWidth, height: settingsRef.current.largeHeight }
  ], [])

  const cellW = settingsRef.current.baseWidth + settingsRef.current.itemGap
  const cellH = Math.max(settingsRef.current.smallHeight, settingsRef.current.largeHeight) + settingsRef.current.itemGap

  useEffect(()=>{
    ;(async ()=>{
      try{
        setLoading(true)
        const res = await fetch(`${API_BASE_URL}/storage/list?mine=false`, { headers:{ 'X-API-KEY': API_KEY } })
        if(!res.ok) throw new Error('list failed')
        const data = await res.json()
        // Filter to only images and videos
        const filtered: VodItem[] = (data.items as VodItem[]).filter(item => {
          const mime = item.mime_type || ''
          return mime.startsWith('image/') || mime.startsWith('video/')
        })
        setItems(filtered)
        setError(null)
      } catch(e){
        console.error(e)
        setError('Could not load video list.')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  // Compute visible cells around current translation
  function updateVisible(){
    const root = rootRef.current
    const canvas = canvasRef.current
    if(!root || !canvas || items.length === 0) return

    const buffer = settingsRef.current.buffer
    const vw = window.innerWidth
    const vh = window.innerHeight
    const cx = currentXRef.current
    const cy = currentYRef.current

    const startCol = Math.floor((-(cx) - vw * buffer) / cellW)
    const endCol = Math.ceil((-(cx) + vw * (1 + buffer)) / cellW)
    const startRow = Math.floor((-(cy) - vh * buffer) / cellH)
    const endRow = Math.ceil((-(cy) + vh * (1 + buffer)) / cellH)

    const cols = settingsRef.current.columns
    const next: Cell[] = []
    for(let row=startRow; row<=endRow; row++){
      for(let col=startCol; col<=endCol; col++){
        const sizeIndex = Math.abs((row * cols + col) % sizes.length)
        const sz = sizes[sizeIndex]
        const left = col * cellW
        const top = row * cellH
        const itemIndex = Math.abs((row * cols + col) % items.length)
        next.push({ col, row, width: sz.width, height: sz.height, left, top, itemIndex })
      }
    }
    setVisibleCells(next)
  }

  // RAF animation loop for smooth dragging and virtualization cadence
  useEffect(()=>{
    let raf = 0
    const animate = ()=>{
      const canvas = canvasRef.current
      if(canvas && canDragRef.current){
        // easing
        const ease = 0.075
        currentXRef.current += (targetXRef.current - currentXRef.current) * ease
        currentYRef.current += (targetYRef.current - currentYRef.current) * ease
        canvas.style.transform = `translate3d(${currentXRef.current}px, ${currentYRef.current}px, 0)`

        const now = performance.now()
        const dx = currentXRef.current - lastXRef.current
        const dy = currentYRef.current - lastYRef.current
        const dist = Math.hypot(dx, dy)
        if(dist > 100 || now - lastUpdateRef.current > 120){
          lastXRef.current = currentXRef.current
          lastYRef.current = currentYRef.current
          lastUpdateRef.current = now
          updateVisible()
        }
      }
      raf = requestAnimationFrame(animate)
    }
    raf = requestAnimationFrame(animate)
    return ()=> cancelAnimationFrame(raf)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length])

  // Event handlers
  useEffect(()=>{
    const root = rootRef.current
    if(!root) return

    const onMouseDown = (e: MouseEvent)=>{
      if(!canDragRef.current) return
      isDraggingRef.current = true
      mouseMovedRef.current = false
      startXRef.current = e.clientX
      startYRef.current = e.clientY
      root.style.cursor = 'grabbing'
    }
    const onMouseMove = (e: MouseEvent)=>{
      if(!isDraggingRef.current || !canDragRef.current) return
      const dx = e.clientX - startXRef.current
      const dy = e.clientY - startYRef.current
      if(Math.abs(dx) > 5 || Math.abs(dy) > 5) mouseMovedRef.current = true
      targetXRef.current += dx
      targetYRef.current += dy
      startXRef.current = e.clientX
      startYRef.current = e.clientY
    }
    const onMouseUp = ()=>{
      if(!isDraggingRef.current) return
      isDraggingRef.current = false
      if(canDragRef.current) root.style.cursor = 'grab'
    }
    const onTouchStart = (e: TouchEvent)=>{
      if(!canDragRef.current) return
      isDraggingRef.current = true
      mouseMovedRef.current = false
      startXRef.current = e.touches[0].clientX
      startYRef.current = e.touches[0].clientY
    }
    const onTouchMove = (e: TouchEvent)=>{
      if(!isDraggingRef.current || !canDragRef.current) return
      const dx = e.touches[0].clientX - startXRef.current
      const dy = e.touches[0].clientY - startYRef.current
      if(Math.abs(dx) > 5 || Math.abs(dy) > 5) mouseMovedRef.current = true
      targetXRef.current += dx
      targetYRef.current += dy
      startXRef.current = e.touches[0].clientX
      startYRef.current = e.touches[0].clientY
    }
    const onTouchEnd = ()=>{
      isDraggingRef.current = false
    }
    root.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    root.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('touchend', onTouchEnd)

    const onResize = ()=> updateVisible()
    window.addEventListener('resize', onResize)
    return ()=>{
      root.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      root.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('resize', onResize)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length])

  function onTileClick(cell: Cell){
    if(mouseMovedRef.current) return
    const id = `cell-${cell.col}-${cell.row}`
    const el = document.getElementById(id)
    if(!el) return
    const rect = el.getBoundingClientRect()
    const item = items[cell.itemIndex]
    setTitle(item.title || item.original_filename || '')
    // Disable dragging while expanded
    canDragRef.current = false
    setExpanded({ id, item, fromRect: rect, width: cell.width, height: cell.height })
  }

  function closeExpanded(){
    // Re-enable dragging
    canDragRef.current = true
    setExpanded(null)
  }

  useEffect(()=>{
    // initial populate
    updateVisible()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length])

  return (
    <main role="main">
      <div className="vod-canvas-root" ref={rootRef} aria-busy={loading}>
        {/* Scoped styles */}
        <style>{`
          .vod-canvas-root{ position:relative; width:100vw; height:100vh; overflow:hidden; background:#000; color:#fff; cursor:grab; }
          .vod-canvas-root .noise-overlay{ position:fixed; inset:0; pointer-events:none; z-index:2; background:transparent url('http://assets.iceable.com/img/noise-transparent.png') repeat 0 0; background-size:300px 300px; opacity:.35; }
          .vod-canvas-root .header, .vod-canvas-root .footer{ position:absolute; left:0; width:100vw; padding:1.5rem; z-index:5; display:grid; grid-template-columns:repeat(12, 1fr); column-gap:1rem; }
          .vod-canvas-root .header{ top:0; }
          .vod-canvas-root .footer{ bottom:0; }
          .vod-canvas-root .nav-section{ grid-column:1 / span 3; }
          .vod-canvas-root .values-section{ grid-column:5 / span 2; }
          .vod-canvas-root .location-section{ grid-column:7 / span 2; }
          .vod-canvas-root .contact-section{ grid-column:9 / span 2; }
          .vod-canvas-root .social-section{ grid-column:11 / span 2; text-align:right; }
          .vod-canvas-root .coordinates-section{ grid-column:1 / span 3; font-family:monospace; }
          .vod-canvas-root .links-section{ grid-column:5 / span 4; text-align:center; display:flex; justify-content:center; align-items:center; gap:1rem; }
          .vod-canvas-root .info-section{ grid-column:9 / span 4; text-align:right; }
          .vod-canvas-root a{ color:#fff; text-decoration:none; font-weight:700; font-size:14px }
          .vod-canvas-root h3{ font-size:14px; margin-bottom:1rem; font-weight:600 }
          .vod-canvas-root ul{ list-style:none }
          .vod-canvas-root p{ font-size:14px; font-weight:600 }
          .vod-canvas-root .container{ position:relative; width:100%; height:100%; }
          .vod-canvas-root .canvas{ position:absolute; inset:auto; will-change:transform; z-index:1 }
          .vod-canvas-root .item{ position:absolute; overflow:hidden; background:#000; border-radius:0px; cursor:pointer }
          .vod-canvas-root .item .img-wrap{ width:100%; height:100%; overflow:hidden; position:relative }
          .vod-canvas-root .item img{ width:100%; height:100%; object-fit:cover; transition:transform .25s ease }
          .vod-canvas-root .item:hover img{ transform:scale(1.05) }
          .vod-canvas-root .item .caption{ position:absolute; left:0; bottom:0; width:100%; padding:10px; z-index:2 }
          .vod-canvas-root .item .name{ font-size:12px; text-transform:uppercase; letter-spacing:-.03em; margin-bottom:2px }
          .vod-canvas-root .item .num{ font-size:10px; color:#888; font-family:monospace }
          .vod-canvas-root .overlay{ position:fixed; inset:0; background:#000; opacity:0; pointer-events:none; transition:opacity .6s ease; z-index:3 }
          .vod-canvas-root .overlay.active{ opacity:.9; pointer-events:auto }
          .vod-canvas-root .expanded{ position:fixed; z-index:4; background:#000; overflow:hidden; border-radius:0px; transition: all .6s cubic-bezier(.9,0,.1,1) }
          .vod-canvas-root .expanded img{ width:100%; height:100%; object-fit:cover }
          .vod-canvas-root .project-title{ position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); z-index:6; pointer-events:none; width:100%; text-align:center }
          .vod-canvas-root .project-title p{ font-size:36px; letter-spacing:-.03em; text-transform:uppercase }
        `}</style>

        {/* Header */}
        <div className="header" role="banner">
          <div className="nav-section">
            <div className="logo-container">
              <div className="logo-circles">
                <div className="circle circle-1" />
                <div className="circle circle-2" />
              </div>
            </div>
          </div>
          <div className="values-section">
            <h3>+Menu</h3>
            <ul>
              <li><a href="#">Clarity</a></li>
              <li><a href="#">Simplicity</a></li>
              <li><a href="#">Creativity</a></li>
              <li><a href="#">Authenticity</a></li>
              <li><a href="#">Connect</a></li>
            </ul>
          </div>
          <div className="location-section">
            <h3>+Location</h3>
            <p>6357 Selma Ave</p>
            <p>Los Angeles</p>
            <p>CA 90028</p>
          </div>
          <div className="contact-section">
            <h3>+Get In Touch</h3>
            <p>(310) 456-7890</p>
            <p><a href="mailto:hi@filip.fyi">hi@filip.fyi</a></p>
          </div>
          <div className="social-section">
            <h3>+Social</h3>
            <ul>
              <li><a href="https://instagram.com/filipz__">Instagram</a></li>
              <li><a href="https://x.com/filipz">X / Twitter</a></li>
              <li><a href="https://linkedin.com/in/filipzrnzevic">LinkedIn</a></li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="footer" role="contentinfo">
          <div className="coordinates-section"><p>34.0522° N, 118.2437° W</p></div>
          <div className="links-section"><p>Press <span className="key-hint">H</span> to toggle panel</p></div>
          <div className="info-section"><p>Est. 2025 • Summer Days</p></div>
        </div>

        {/* Noise overlay */}
        <div className="noise-overlay" aria-hidden="true" />

        {/* Canvas */}
        <div className="container">
          <div className="canvas" ref={canvasRef} aria-live="polite" aria-label="Draggable VOD grid">
            {visibleCells.map(cell => {
              const item = items[cell.itemIndex]
              const title = item?.title || item?.original_filename || '—'
              const num = `#${String(cell.itemIndex + 1).padStart(5, '0')}`
              const thumb = item?.thumbnail_url || ''
              const id = `cell-${cell.col}-${cell.row}`
              return (
                <div
                  id={id}
                  key={id}
                  className="item"
                  style={{ width: cell.width, height: cell.height, left: cell.left, top: cell.top }}
                  onClick={()=> onTileClick(cell)}
                  onDoubleClick={()=> navigate(`/vod/theater?current_id=${item.id}&from=/vod/all`) }
                >
                  <div className="img-wrap">
                    {thumb ? <img src={thumb} alt={title} /> : <div style={{width:'100%',height:'100%',background:'#111'}} />}
                  </div>
                  <div className="caption">
                    <div className="name">{title}</div>
                    <div className="num">{num}</div>
                  </div>
                </div>
              )
            })}
          </div>
          <div ref={overlayRef} className={`overlay ${expanded ? 'active' : ''}`} onClick={closeExpanded} />
        </div>

        {/* Center title when expanded */}
        {expanded && (
          <div className="project-title" aria-live="assertive"><p>{title}</p></div>
        )}

        {/* Expanded item */}
        {expanded && (()=>{
          const vw = window.innerWidth
          const targetW = Math.max(200, Math.floor(vw * settingsRef.current.expandedScale))
          const aspect = expanded.height / expanded.width
          const targetH = Math.floor(targetW * aspect)
          // compute from/to
          const from = expanded.fromRect
          const fromX = from.left + from.width/2 - window.innerWidth/2
          const fromY = from.top + from.height/2 - window.innerHeight/2
          const style: React.CSSProperties = {
            width: from.width,
            height: from.height,
            transform: `translate(${fromX}px, ${fromY}px)`
          }
          const toStyle: React.CSSProperties = {
            width: targetW,
            height: targetH,
            transform: `translate(0px, 0px)`
          }
          return (
            <Expander
              src={expanded.item.thumbnail_url || ''}
              fromStyle={style}
              toStyle={toStyle}
              durationMs={settingsRef.current.zoomDurationMs}
            />
          )
        })()}

        {/* Status */}
        {loading && (
          <div style={{ position:'absolute', inset:0, display:'grid', placeItems:'center', zIndex:7 }}>
            <LoadingSlider label="Loading" />
          </div>
        )}
        {error && <div style={{ position:'absolute', top:10, left:10, zIndex:7, color:'crimson' }}>{error}</div>}
      </div>
    </main>
  )
}

function Expander({ src, fromStyle, toStyle, durationMs }:{ src:string; fromStyle:React.CSSProperties; toStyle:React.CSSProperties; durationMs:number }){
  const elRef = useRef<HTMLDivElement|null>(null)
  const [style, setStyle] = useState<React.CSSProperties>(fromStyle)

  useEffect(()=>{
    // animate in
    const t = setTimeout(()=>{ setStyle(toStyle) }, 15)
    return ()=> clearTimeout(t)
  }, [])

  return (
    <div ref={elRef} className="expanded" style={{ ...style, transitionDuration: `${durationMs}ms` }}>
      {src ? <img src={src} alt="Selected" /> : <div style={{width:'100%',height:'100%',background:'#111'}} />}
    </div>
  )
}
