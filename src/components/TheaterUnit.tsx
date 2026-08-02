import { useState } from 'react'
import { thumbUrl } from '../lib/apiBase'
import VodPlayer, { type VodPlayerHandle } from './VodPlayer'

export type VodItem = {
  id: number
  hls_url?: string | null
  file_url?: string | null
  title?: string
  description?: string
  original_filename?: string
  thumbnail_url?: string
  mime_type?: string
  width?: number
  height?: number
  link_id?: string | null
  collection_id?: string | null
  created_at?: string
  context?: string | null
}

type Props = {
  item: VodItem
  mode: 'mini' | 'theater'
  width?: number
  fixedHeight?: number
  showMeta?: boolean
  autoplay?: boolean
  cover?: boolean
  onDoubleClick?: () => void
  onMeta?: (id:number, size:{ w:number; h:number }) => void
  // Theater controls
  playerRef?: React.Ref<VodPlayerHandle>
  muted?: boolean
  scaleMode?: 'fit' | 'fill'
  fullscreenScaleMode?: 'fit' | 'fill'
  onTimeUpdate?: (current:number, duration:number) => void
  onPlayChange?: (playing:boolean) => void
  miniContainerRef?: (el: HTMLDivElement | null) => void
  miniStyle?: React.CSSProperties
}

export default function TheaterUnit({ item, mode, width, fixedHeight, showMeta = true, autoplay = true, cover = false, onDoubleClick, onMeta, playerRef, muted, scaleMode, fullscreenScaleMode, onTimeUpdate, onPlayChange, miniContainerRef, miniStyle }: Props){
  // Use API width/height if available, otherwise default to 16:9
  const [wh, setWh] = useState<{ w:number; h:number }>({ w: item.width || 16, h: item.height || 9 })
  const ratio = wh.h ? wh.w / wh.h : 16/9
  const autoHeight = width ? Math.ceil(width / ratio) : undefined
  const playerHeight = fixedHeight ?? autoHeight
  const title = item.title || item.original_filename || '—'

  // Check if item is a video (has hls_url or is video mime type)
  const isVideo = !!item.hls_url || item.mime_type?.startsWith('video/')
  const isImage = item.mime_type?.startsWith('image/')
  const isAudio = item.mime_type?.startsWith('audio/')
  const mediaSrc = item.hls_url || item.file_url
  const thumbnailSrc = thumbUrl(item as any)

  if(mode === 'theater'){
    if(!isVideo || !mediaSrc){
      // Non-video: show thumbnail/image (transparent background)
      return (
        <div style={{ position:'relative', width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center' }} onDoubleClick={onDoubleClick}>
          {thumbnailSrc ? (
            <img src={thumbnailSrc} alt={title} style={{ maxWidth:'100%', maxHeight:'100%', objectFit:'contain' }} />
          ) : (
            <div style={{ color:'var(--muted)', fontSize:48 }}>{isAudio ? '🎵' : '📄'}</div>
          )}
        </div>
      )
    }
    return (
      <div style={{ position:'relative', width:'100%', height:'100%' }} onDoubleClick={onDoubleClick}>
        <VodPlayer
          ref={playerRef as any}
          src={mediaSrc}
          autoplay={autoplay}
          muted={!!muted}
          loop={false}
          scaleMode={scaleMode ?? (cover ? 'fill' : 'fit')}
          fullscreenScaleMode={fullscreenScaleMode ?? scaleMode}
          onTimeUpdate={onTimeUpdate}
          onPlayChange={onPlayChange}
          onMetadata={({ width, height })=> { setWh({ w: width, h: height }); onMeta?.(item.id, { w: width, h: height }) }}
        />
      </div>
    )
  }

  // mini mode – styled like current VodTile in masonry layout
  // For non-video items, show thumbnail/image instead of player
  const renderMedia = () => {
    if(!isVideo || !mediaSrc){
      // Non-video: show thumbnail (transparent background)
      return (
        <div style={{ width:'100%', height: playerHeight || 200, display:'flex', alignItems:'center', justifyContent:'center', borderRadius:8, overflow:'hidden' }}>
          {thumbnailSrc ? (
            <img src={thumbnailSrc} alt={title} style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:8 }} loading="lazy" />
          ) : (
            <div style={{ color:'var(--muted)', fontSize:32 }}>{isAudio ? '🎵' : isImage ? '🖼️' : '📄'}</div>
          )}
        </div>
      )
    }
    return (
      <VodPlayer
        src={mediaSrc}
        autoplay={autoplay}
        muted
        loop
        scaleMode={cover ? 'fill' : 'fit'}
        disableDoubleClickFullscreen={!!onDoubleClick}
        onMetadata={({ width, height })=> { setWh({ w: width, h: height }); onMeta?.(item.id, { w: width, h: height }) }}
      />
    )
  }

  const content = (
    <>
      {width ? (
        <div ref={miniContainerRef || undefined} style={{ width:'100%', height: playerHeight, ...(miniStyle || {}) }} onDoubleClick={onDoubleClick}>
          {renderMedia()}
        </div>
      ) : isImage ? (
        // For images in masonry: let image flow naturally without aspect-ratio container
        <div ref={miniContainerRef || undefined} style={{ ...(miniStyle || {}) }} onDoubleClick={onDoubleClick}>
          {thumbnailSrc ? (
            <img src={thumbnailSrc} alt={title} style={{ width:'100%', height:'auto', borderRadius:8, display:'block' }} loading="lazy" />
          ) : (
            <div style={{ width:'100%', height:200, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--muted)', fontSize:32 }}>🖼️</div>
          )}
        </div>
      ) : (
        // For videos: use aspect-ratio container
        <div style={{ position:'relative', width:'100%' }} onDoubleClick={onDoubleClick}>
          <div style={{ width:'100%', paddingTop: `${(1/ratio)*100}%` }} />
          <div ref={miniContainerRef || undefined} style={{ position:'absolute', inset:0, ...(miniStyle || {}) }}>
            {renderMedia()}
          </div>
        </div>
      )}
      {showMeta && (
        <div style={{ marginTop:8 }}>
          <div className="flat-card-title" style={{ fontSize:14 }}>{title}</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:'4px 8px', alignItems:'center', marginTop:2 }}>
            <a href={`/share/v3?current_id=${item.id}`} style={{ fontSize:11, color:'var(--muted)', textDecoration:'none' }} onClick={(e)=> e.stopPropagation()}>
              #{item.id}
            </a>
            {item.collection_id && (
              <span style={{ fontSize:11, color:'var(--brand-2)', background:'var(--ring)', padding:'1px 6px', borderRadius:6 }}>{item.collection_id}</span>
            )}
            {item.link_id && (
              <span style={{ fontSize:11, color:'var(--muted)' }}>link: {item.link_id}</span>
            )}
          </div>
          {item.created_at && (
            <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>
              {new Date(item.created_at).toLocaleDateString('de-AT', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })}
            </div>
          )}
          {item.description && <div className="flat-card-sub" style={{ fontSize:12, marginTop:2 }}>{item.description}</div>}
        </div>
      )}
    </>
  )

  if(width){
    const outerHeight = (playerHeight || 0) + (showMeta ? 40 : 0) + 24
    return (
      <article className="flat-card hitem" style={{ width, height: outerHeight, overflow:'hidden' }}>
        <div className="flat-card-inner" style={{ padding:12, display:'flex', flexDirection:'column', justifyContent:'flex-end', height:'100%' }}>
          {content}
        </div>
      </article>
    )
  }

  return (
    <article className="flat-card" style={{ overflow:'hidden' }}>
      <div className="flat-card-inner" style={{ padding:12 }}>
        {content}
      </div>
    </article>
  )
}

