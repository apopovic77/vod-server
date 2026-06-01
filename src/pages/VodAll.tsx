import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TheaterUnit, { type VodItem as VodItemType } from '../components/TheaterUnit'

type VodItem = VodItemType & { created_at?: string; file_size_bytes?: number }
type Collection = { id: string; name: string; item_count: number }

import { API_BASE_URL } from '../lib/apiBase'
const API_KEY = 'Inetpass1'

type MediaFilter = 'all' | 'image' | 'video'
type SortOption = 'newest' | 'oldest'

function useColumnCount(){
  const [cols, setCols] = useState(() => calcCols())
  function calcCols(){
    const w = typeof window !== 'undefined' ? window.innerWidth : 1200
    if(w >= 2400) return 8
    if(w >= 2000) return 7
    if(w >= 1600) return 6
    if(w >= 1200) return 5
    if(w >= 900) return 4
    if(w >= 600) return 3
    return 2
  }
  useLayoutEffect(()=>{
    const onResize = ()=> setCols(calcCols())
    window.addEventListener('resize', onResize)
    return ()=> window.removeEventListener('resize', onResize)
  }, [])
  return cols
}

export default function VodAll(){
  const [items, setItems] = useState<VodItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [filter, setFilter] = useState<MediaFilter>('all')
  const [sort, setSort] = useState<SortOption>('newest')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [collections, setCollections] = useState<Collection[]>([])
  const [activeCollections, setActiveCollections] = useState<Set<string> | null>(null) // null = not yet initialized
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)
  const [ctxSearch, setCtxSearch] = useState('')
  const [assigning, setAssigning] = useState(false)
  const ctxRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const colCount = useColumnCount()

  useEffect(()=>{
    (async ()=>{
      try{
        setLoading(true)
        const res = await fetch(`${API_BASE_URL}/storage/list?limit=5000&mine=false`, { headers:{ 'X-API-KEY': API_KEY } })
        if(!res.ok) throw new Error('list failed')
        const data = await res.json()
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

  // Fetch collections
  useEffect(()=>{
    (async ()=>{
      try{
        const res = await fetch(`${API_BASE_URL}/admin/collections?user_email=apopovic.aut@gmail.com`, { headers:{ 'X-API-KEY': API_KEY } })
        if(res.ok){
          const data: Collection[] = await res.json()
          setCollections(data.sort((a,b) => a.name.localeCompare(b.name)))
        }
      } catch(e){ console.error('Failed to load collections', e) }
    })()
  }, [])

  // Derive which collections are actually used by items
  const usedCollections = useMemo(() => {
    const usedIds = new Set(items.map(i => i.collection_id).filter(Boolean) as string[])
    return collections.filter(c => usedIds.has(c.id))
  }, [items, collections])

  const hasUncollected = useMemo(() => items.some(i => !i.collection_id), [items])

  // Initialize activeCollections once data is loaded (all active by default)
  useEffect(() => {
    if (activeCollections !== null || items.length === 0) return
    const all = new Set(usedCollections.map(c => c.id))
    if (hasUncollected) all.add('__none__')
    setActiveCollections(all)
  }, [usedCollections, hasUncollected, items, activeCollections])

  const toggleCollection = useCallback((id: string) => {
    setActiveCollections(prev => {
      if (!prev) return prev
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // Close context menu on click outside
  useEffect(()=>{
    if(!ctxMenu) return
    const handler = (e: MouseEvent)=>{
      if(ctxRef.current && !ctxRef.current.contains(e.target as Node)){
        setCtxMenu(null)
        setCtxSearch('')
      }
    }
    document.addEventListener('mousedown', handler)
    return ()=> document.removeEventListener('mousedown', handler)
  }, [ctxMenu])

  // Close context menu on Escape
  useEffect(()=>{
    if(!ctxMenu) return
    const handler = (e: KeyboardEvent)=>{
      if(e.key === 'Escape'){ setCtxMenu(null); setCtxSearch('') }
    }
    document.addEventListener('keydown', handler)
    return ()=> document.removeEventListener('keydown', handler)
  }, [ctxMenu])

  const toggleSelect = useCallback((id: number, e: React.MouseEvent)=>{
    e.stopPropagation()
    setSelected(prev => {
      const next = new Set(prev)
      if(next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleContextMenu = useCallback((e: React.MouseEvent)=>{
    if(selected.size === 0) return
    e.preventDefault()
    setCtxMenu({ x: e.clientX, y: e.clientY })
    setCtxSearch('')
  }, [selected])

  const assignToCollection = useCallback(async (collectionId: string)=>{
    if(selected.size === 0) return
    setAssigning(true)
    const ids = Array.from(selected)
    try{
      await Promise.all(ids.map(id =>
        fetch(`${API_BASE_URL}/storage/objects/${id}`, {
          method: 'PATCH',
          headers: { 'X-API-KEY': API_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ collection_id: collectionId })
        })
      ))
      // Update local state
      setItems(prev => prev.map(item =>
        selected.has(item.id) ? { ...item, collection_id: collectionId } : item
      ))
      setSelected(new Set())
    } catch(e){
      console.error('Failed to assign collection', e)
    } finally {
      setAssigning(false)
      setCtxMenu(null)
      setCtxSearch('')
    }
  }, [selected])

  const removeFromCollection = useCallback(async ()=>{
    if(selected.size === 0) return
    setAssigning(true)
    const ids = Array.from(selected)
    try{
      await Promise.all(ids.map(id =>
        fetch(`${API_BASE_URL}/storage/objects/${id}`, {
          method: 'PATCH',
          headers: { 'X-API-KEY': API_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ collection_id: null })
        })
      ))
      setItems(prev => prev.map(item =>
        selected.has(item.id) ? { ...item, collection_id: null } : item
      ))
      setSelected(new Set())
    } catch(e){
      console.error('Failed to remove collection', e)
    } finally {
      setAssigning(false)
      setCtxMenu(null)
      setCtxSearch('')
    }
  }, [selected])

  const filtered = useMemo(() => {
    let result = items
    if(filter === 'image') result = result.filter(i => i.mime_type?.startsWith('image/'))
    if(filter === 'video') result = result.filter(i => i.mime_type?.startsWith('video/'))
    if(activeCollections !== null){
      result = result.filter(i => {
        if(!i.collection_id) return activeCollections.has('__none__')
        return activeCollections.has(i.collection_id)
      })
    }
    if(search.trim()){
      const q = search.toLowerCase()
      result = result.filter(i =>
        (i.title || '').toLowerCase().includes(q) ||
        (i.original_filename || '').toLowerCase().includes(q) ||
        (i.description || '').toLowerCase().includes(q) ||
        String(i.id).includes(q)
      )
    }
    result = [...result].sort((a, b) => {
      const da = a.created_at || ''
      const db = b.created_at || ''
      if(sort === 'newest') return da > db ? -1 : da < db ? 1 : b.id - a.id
      return da < db ? -1 : da > db ? 1 : a.id - b.id
    })
    return result
  }, [items, filter, sort, search, activeCollections])

  const imageCount = items.filter(i => i.mime_type?.startsWith('image/')).length
  const videoCount = items.filter(i => i.mime_type?.startsWith('video/')).length

  const filteredCollections = ctxSearch
    ? collections.filter(c => c.name.toLowerCase().includes(ctxSearch.toLowerCase()))
    : collections

  return (
    <main role="main" onContextMenu={handleContextMenu}>
      <section className="section section-full" aria-labelledby="vodall-title">
        <div className="vodall-header">
          <h2 id="vodall-title" className="h2" style={{ margin: 0 }}>All Media</h2>
          {!loading && !error && (
            <span className="vodall-count">{filtered.length} items</span>
          )}
          {selected.size > 0 && (
            <span className="vodall-selection-info">
              {selected.size} selected
              <button className="vodall-clear-btn" onClick={() => setSelected(new Set())}>Clear</button>
            </span>
          )}
        </div>

        {!loading && !error && items.length > 0 && (
          <div className="vodall-toolbar">
            <div className="vodall-filters">
              <button className={`vodall-filter-btn${filter === 'all' ? ' active' : ''}`} onClick={() => setFilter('all')}>
                All ({items.length})
              </button>
              <button className={`vodall-filter-btn${filter === 'image' ? ' active' : ''}`} onClick={() => setFilter('image')}>
                Images ({imageCount})
              </button>
              <button className={`vodall-filter-btn${filter === 'video' ? ' active' : ''}`} onClick={() => setFilter('video')}>
                Videos ({videoCount})
              </button>
            </div>
            <div className="vodall-controls">
              <input
                className="vodall-search"
                type="text"
                placeholder="Search..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <select className="vodall-sort" value={sort} onChange={e => setSort(e.target.value as SortOption)}>
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </div>
          </div>
        )}

        {!loading && !error && activeCollections !== null && usedCollections.length > 0 && (
          <div className="vodall-collection-filters">
            {hasUncollected && (
              <button
                className={`vodall-collection-chip${activeCollections.has('__none__') ? ' active' : ''}`}
                onClick={() => toggleCollection('__none__')}
              >
                Ohne Kollektion
              </button>
            )}
            {usedCollections.map(c => (
              <button
                key={c.id}
                className={`vodall-collection-chip${activeCollections.has(c.id) ? ' active' : ''}`}
                onClick={() => toggleCollection(c.id)}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

        {loading && <p className="muted">Loading…</p>}
        {error && <p className="muted" style={{ color:'crimson' }}>{error}</p>}
        {!loading && !error && (
          <div className="masonry-cols" style={{ columnCount: colCount }}>
            {Array.from({ length: colCount }, (_, colIdx) => (
              <div key={colIdx} className="masonry-col">
                {filtered.filter((_, i) => i % colCount === colIdx).map(item => (
                  <div
                    key={item.id}
                    className={`masonry-item${selected.has(item.id) ? ' selected' : ''}`}
                    onClick={(e) => toggleSelect(item.id, e)}
                  >
                    <TheaterUnit item={item} mode="mini" onDoubleClick={()=> navigate(`/vod/theater?current_id=${item.id}&from=/vod/all`)} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Context menu */}
      {ctxMenu && (
        <div
          ref={ctxRef}
          className="vodall-ctx"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
        >
          <div className="vodall-ctx-header">
            Assign {selected.size} item{selected.size > 1 ? 's' : ''} to collection
          </div>
          <input
            className="vodall-ctx-search"
            type="text"
            placeholder="Filter collections..."
            value={ctxSearch}
            onChange={e => setCtxSearch(e.target.value)}
            autoFocus
          />
          <div className="vodall-ctx-list">
            {filteredCollections.map(c => (
              <button
                key={c.id}
                className="vodall-ctx-item"
                onClick={() => assignToCollection(c.id)}
                disabled={assigning}
              >
                <span className="vodall-ctx-name">{c.name}</span>
                <span className="vodall-ctx-count">{c.item_count}</span>
              </button>
            ))}
            {filteredCollections.length === 0 && (
              <div className="vodall-ctx-empty">No collections found</div>
            )}
          </div>
          <button
            className="vodall-ctx-item vodall-ctx-remove"
            onClick={removeFromCollection}
            disabled={assigning}
          >
            Remove from collection
          </button>
        </div>
      )}
    </main>
  )
}
