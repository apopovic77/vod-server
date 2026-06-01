import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TheaterUnit, { type VodItem as VodItemType } from '../components/TheaterUnit'

type VodItem = VodItemType

import { API_BASE_URL } from '../lib/apiBase'
const API_KEY = 'Inetpass1'

// Uses shared component from components/VodTile

export default function VodAll(){
  const [items, setItems] = useState<VodItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const navigate = useNavigate()

  useEffect(()=>{
    (async ()=>{
      try{
        setLoading(true)
        const res = await fetch(`${API_BASE_URL}/storage/list?mine=false`, { headers:{ 'X-API-KEY': API_KEY } })
        if(!res.ok) throw new Error('list failed')
        const data = await res.json()
        // Filter to only images and videos
        const allItems: VodItem[] = (data.items as VodItem[]).filter(item => {
          const mime = item.mime_type || ''
          return mime.startsWith('image/') || mime.startsWith('video/')
        })
        setItems(allItems)
        setError(null)
      } catch(e){
        console.error(e)
        setError('Could not load media list.')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return (
    <main role="main">
      <section className="section" aria-labelledby="vodall-title">
        <h2 id="vodall-title" className="h2">All Media</h2>
        {loading && <p className="muted">Loading…</p>}
        {error && <p className="muted" style={{ color:'crimson' }}>{error}</p>}
        {!loading && !error && (
          <div className="masonry">
            {items.map(item => (
              <div key={item.id} className="masonry-item">
                <TheaterUnit item={item} mode="mini" onDoubleClick={()=> navigate(`/vod/theater?current_id=${item.id}&from=/vod/all`)} />
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

