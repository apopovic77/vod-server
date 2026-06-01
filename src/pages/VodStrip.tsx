import { useEffect, useRef, useState } from 'react'
import VodTile, { type VodItem as VodItemType } from '../components/VodTile'

type VodItem = VodItemType

import { API_BASE_URL } from '../lib/apiBase'
const API_KEY = 'Inetpass1'

export default function VodStrip(){
  const url = new URL(window.location.href)
  const heightParam = url.searchParams.get('h')
  const fixedHeight = heightParam ? parseInt(heightParam, 10) : 240 // default fixed height
  const showMeta = url.searchParams.get('meta') !== '0'

  const [items, setItems] = useState<VodItem[]>([])
  const [sizes, setSizes] = useState<Record<number, { w:number; h:number }>>({})
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // virtualize: compute visible index range
  const [scrollLeft, setScrollLeft] = useState(0)
  const [viewportWidth, setViewportWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 0)
  useEffect(()=>{
    const el = containerRef.current
    if(!el) return
    function onScroll(){ if(!el) return; setScrollLeft(el.scrollLeft) }
    function onResize(){ if(!el) return; setViewportWidth(el.clientWidth) }
    onResize()
    el.addEventListener('scroll', onScroll, { passive:true })
    const ro = new ResizeObserver(onResize)
    ro.observe(el)
    // translate vertical wheel to horizontal scroll for convenience
    function onWheel(e: WheelEvent){
      if(el && Math.abs(e.deltaY) > Math.abs(e.deltaX)){
        el.scrollLeft += e.deltaY
        e.preventDefault()
      }
    }
    el.addEventListener('wheel', onWheel, { passive:false })
    return ()=>{ el.removeEventListener('scroll', onScroll); el.removeEventListener('wheel', onWheel); ro.disconnect() }
  }, [])

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
        setError(null)
      } catch(e){ setError('Could not load video list.') } finally { setLoading(false) }
    })()
  }, [])

  function handleMeta(id:number, meta:{ width:number; height:number }){
    setSizes(prev => ({ ...prev, [id]: { w: meta.width, h: meta.height } }))
  }

  return (
    <main role="main">
      <section className="section section-full" aria-labelledby="vodstrip-title">
        <h2 id="vodstrip-title" className="h2">Video Strip</h2>
        <p className="muted" style={{ marginTop:0 }}>Height fixed = {fixedHeight}px • Width auto per aspect. Toggle meta: &meta=0</p>
        {loading && <p className="muted">Loading…</p>}
        {error && <p className="muted" style={{ color:'crimson' }}>{error}</p>}
        {!loading && !error && (
          <div className="hstrip" ref={containerRef} style={{ overflowX:'hidden', position:'relative' }}>
            {(() => {
              // Compute variable widths from fixed height and aspect ratios
              const gap = 12
              const widths = items.map(i => {
                const sz = sizes[i.id]
                const ratio = sz && sz.h ? (sz.w / sz.h) : (16/9)
                return Math.ceil(fixedHeight * ratio)
              })
              // Build left positions cumulatively
              const lefts:number[] = []
              let acc = 0
              for(let i=0;i<widths.length;i++){
                lefts.push(acc)
                acc += widths[i] + gap
              }
              const trackWidth = Math.max(0, acc - gap)
              const trackHeight = fixedHeight + (showMeta ? 40 : 0)
              return (
                <div style={{ position:'relative', width: trackWidth, height: trackHeight }}>
                  {items.map((item, index) => {
                    const w = widths[index]
                    const left = lefts[index]
                    const end = left + w
                    const perTile = Math.max(1, Math.ceil(viewportWidth / (w + gap)))
                    const buffer = Math.max(viewportWidth, perTile * (w + gap) * 2)
                    const isVisible = end >= (scrollLeft - buffer) && left <= (scrollLeft + viewportWidth + buffer)
                    if(!isVisible) return null
                    return (
                      <div key={item.id} style={{ position:'absolute', left, top:0, width:w }}>
                        <VodTile
                          item={item}
                          width={w}
                          fixedHeight={fixedHeight}
                          showMeta={showMeta}
                          cover={false}
                          autoplay={isVisible}
                          onMeta={(id, s)=> handleMeta(id, { width:s.w, height:s.h })}
                          onClick={()=>{
                            const el = containerRef.current
                            if(!el) return
                            const targetCenter = left + w/2
                            const desiredLeft = Math.max(0, targetCenter - el.clientWidth/2)
                            el.scrollTo({ left: desiredLeft, behavior:'smooth' })
                          }}
                        />
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>
        )}
      </section>
    </main>
  )
}

