import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { API_BASE_URL } from '../lib/apiBase'

// Photoshop-light image editor: load a storage object, rotate (90° steps + free
// angle), flip, crop, then save by re-uploading with the SAME original_filename
// + owner_email — the storage /upload endpoint auto-detects the duplicate
// (reuse_existing) and updates the existing object's bytes in place.

const KEY = 'Inetpass1'

type ObjMeta = {
  id: number
  original_filename: string
  owner_email?: string | null
  mime_type?: string
  title?: string | null
}

type Crop = { x: number; y: number; w: number; h: number } | null

export default function ImageEditor() {
  const { id: routeId } = useParams()
  const [params] = useSearchParams()
  const initialId = routeId || params.get('id') || ''

  const [idInput, setIdInput] = useState(initialId)
  const [meta, setMeta] = useState<ObjMeta | null>(null)
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [status, setStatus] = useState<string>('')
  const [busy, setBusy] = useState(false)

  // edit state
  const [rot, setRot] = useState(0)            // 90° steps: 0,90,180,270
  const [fine, setFine] = useState(0)          // free angle -45..45
  const [flipH, setFlipH] = useState(false)
  const [flipV, setFlipV] = useState(false)
  const [crop, setCrop] = useState<Crop>(null) // in display-canvas coords

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drag = useRef<{ mode: string; sx: number; sy: number; orig: Crop } | null>(null)

  const loadObject = useCallback(async (oid: string) => {
    if (!oid) return
    setStatus('Lade…'); setMeta(null); setImg(null); setCrop(null)
    setRot(0); setFine(0); setFlipH(false); setFlipV(false)
    try {
      const r = await fetch(`${API_BASE_URL}/storage/objects/${oid}`, { headers: { 'X-API-KEY': KEY } })
      if (!r.ok) { setStatus(`Objekt ${oid} nicht gefunden (HTTP ${r.status})`); return }
      const m: ObjMeta = await r.json()
      if (!(m.mime_type || '').startsWith('image/')) { setStatus(`Objekt ${oid} ist kein Bild (${m.mime_type})`); return }
      setMeta(m)
      // fetch bytes as blob → object URL (avoids canvas CORS taint, carries the key)
      const ir = await fetch(`${API_BASE_URL}/storage/media/${oid}?variant=full&_=${Date.now()}`, { headers: { 'X-API-KEY': KEY } })
      if (!ir.ok) {
        const hint = ir.status === 451 ? ' (Quarantäne/AI-Safety)' : ''
        setStatus(`Bild laden fehlgeschlagen: HTTP ${ir.status}${hint}`); return
      }
      const blob = await ir.blob()
      if (!blob.type.startsWith('image/')) { setStatus(`Antwort ist kein Bild (${blob.type || 'unbekannt'}, ${blob.size} B)`); return }
      const url = URL.createObjectURL(blob)
      const im = new Image()
      im.onload = () => { setImg(im); setStatus(`Geladen: ${m.original_filename} (${im.naturalWidth}×${im.naturalHeight})`); URL.revokeObjectURL(url) }
      im.onerror = () => setStatus('Bild konnte nicht dekodiert werden (Format vom Browser nicht unterstützt, z.B. HEIC)')
      im.src = url
    } catch (e: any) { setStatus('Fehler: ' + (e?.message || e)) }
  }, [])

  useEffect(() => { if (initialId) loadObject(initialId) }, [initialId, loadObject])

  // ---- render preview ----
  useEffect(() => {
    const cv = canvasRef.current; if (!cv || !img) return
    const angle = (rot + fine) * Math.PI / 180
    // bounding box of rotated image
    const iw = img.naturalWidth, ih = img.naturalHeight
    const cos = Math.abs(Math.cos(angle)), sin = Math.abs(Math.sin(angle))
    const bw = iw * cos + ih * sin, bh = iw * sin + ih * cos
    // fit into max display
    const MAX = 760
    const scale = Math.min(1, MAX / Math.max(bw, bh))
    cv.width = Math.round(bw * scale); cv.height = Math.round(bh * scale)
    const ctx = cv.getContext('2d')!
    ctx.save()
    ctx.clearRect(0, 0, cv.width, cv.height)
    ctx.translate(cv.width / 2, cv.height / 2)
    ctx.rotate(angle)
    ctx.scale(flipH ? -scale : scale, flipV ? -scale : scale)
    ctx.drawImage(img, -iw / 2, -ih / 2)
    ctx.restore()
    // crop overlay
    if (crop) {
      ctx.save()
      ctx.fillStyle = 'rgba(0,0,0,0.45)'
      // dim outside crop
      ctx.fillRect(0, 0, cv.width, crop.y)
      ctx.fillRect(0, crop.y + crop.h, cv.width, cv.height - crop.y - crop.h)
      ctx.fillRect(0, crop.y, crop.x, crop.h)
      ctx.fillRect(crop.x + crop.w, crop.y, cv.width - crop.x - crop.w, crop.h)
      ctx.strokeStyle = '#06B6D4'; ctx.lineWidth = 2
      ctx.strokeRect(crop.x, crop.y, crop.w, crop.h)
      // corner handles
      ctx.fillStyle = '#06B6D4'
      for (const [hx, hy] of [[crop.x, crop.y], [crop.x + crop.w, crop.y], [crop.x, crop.y + crop.h], [crop.x + crop.w, crop.y + crop.h]])
        ctx.fillRect(hx - 5, hy - 5, 10, 10)
      ctx.restore()
    }
  }, [img, rot, fine, flipH, flipV, crop])

  // ---- crop interaction ----
  function pos(e: React.PointerEvent) {
    const cv = canvasRef.current!; const r = cv.getBoundingClientRect()
    return { x: (e.clientX - r.left) * cv.width / r.width, y: (e.clientY - r.top) * cv.height / r.height }
  }
  function onDown(e: React.PointerEvent) {
    if (!img) return
    const p = pos(e)
    canvasRef.current!.setPointerCapture(e.pointerId)
    if (crop) {
      const near = (x: number, y: number) => Math.abs(p.x - x) < 12 && Math.abs(p.y - y) < 12
      if (near(crop.x + crop.w, crop.y + crop.h)) { drag.current = { mode: 'resize', sx: p.x, sy: p.y, orig: crop }; return }
      if (p.x > crop.x && p.x < crop.x + crop.w && p.y > crop.y && p.y < crop.y + crop.h) { drag.current = { mode: 'move', sx: p.x, sy: p.y, orig: crop }; return }
    }
    drag.current = { mode: 'new', sx: p.x, sy: p.y, orig: null }
    setCrop({ x: p.x, y: p.y, w: 0, h: 0 })
  }
  function onMove(e: React.PointerEvent) {
    if (!drag.current) return
    const p = pos(e); const d = drag.current; const cv = canvasRef.current!
    if (d.mode === 'new') {
      setCrop({ x: Math.min(d.sx, p.x), y: Math.min(d.sy, p.y), w: Math.abs(p.x - d.sx), h: Math.abs(p.y - d.sy) })
    } else if (d.mode === 'move' && d.orig) {
      const nx = Math.max(0, Math.min(cv.width - d.orig.w, d.orig.x + (p.x - d.sx)))
      const ny = Math.max(0, Math.min(cv.height - d.orig.h, d.orig.y + (p.y - d.sy)))
      setCrop({ ...d.orig, x: nx, y: ny })
    } else if (d.mode === 'resize' && d.orig) {
      setCrop({ x: d.orig.x, y: d.orig.y, w: Math.max(10, p.x - d.orig.x), h: Math.max(10, p.y - d.orig.y) })
    }
  }
  function onUp() { drag.current = null }

  function rotate(delta: number) { setRot((r) => ((r + delta) % 360 + 360) % 360) }

  // ---- export edited image to a full-res canvas, honouring rot+fine+flip+crop ----
  function renderOutput(): HTMLCanvasElement | null {
    if (!img) return null
    const angle = (rot + fine) * Math.PI / 180
    const iw = img.naturalWidth, ih = img.naturalHeight
    const cos = Math.abs(Math.cos(angle)), sin = Math.abs(Math.sin(angle))
    const bw = Math.round(iw * cos + ih * sin), bh = Math.round(iw * sin + ih * cos)
    const full = document.createElement('canvas')
    full.width = bw; full.height = bh
    const ctx = full.getContext('2d')!
    ctx.translate(bw / 2, bh / 2)
    ctx.rotate(angle)
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1)
    ctx.drawImage(img, -iw / 2, -ih / 2)
    if (!crop || crop.w < 5 || crop.h < 5) return full
    // map crop (display coords) → full-res coords
    const cv = canvasRef.current!
    const sx = bw / cv.width, sy = bh / cv.height
    const out = document.createElement('canvas')
    out.width = Math.round(crop.w * sx); out.height = Math.round(crop.h * sy)
    out.getContext('2d')!.drawImage(full, Math.round(crop.x * sx), Math.round(crop.y * sy), out.width, out.height, 0, 0, out.width, out.height)
    return out
  }

  async function save() {
    if (!img || !meta) return
    setBusy(true); setStatus('Speichere…')
    try {
      const out = renderOutput(); if (!out) { setStatus('Nichts zu speichern'); setBusy(false); return }
      const isPng = (meta.mime_type || '').includes('png')
      const blob: Blob = await new Promise((res) => out.toBlob((b) => res(b!), isPng ? 'image/png' : 'image/jpeg', 0.95))
      // Replace THIS object's bytes in place (targets the exact id, preserves
      // GPS/title/collection/all DB metadata — no fragile filename+owner match,
      // no duplicate object). The canvas export has no EXIF, but the stored
      // lat/lon etc. survive because the server doesn't re-extract on replace.
      const fd = new FormData()
      fd.append('file', blob, meta.original_filename)
      const r = await fetch(`${API_BASE_URL}/storage/objects/${meta.id}/replace-image`, { method: 'POST', headers: { 'X-API-KEY': KEY }, body: fd })
      if (!r.ok) { setStatus(`Speichern fehlgeschlagen (HTTP ${r.status}): ${(await r.text()).slice(0, 200)}`); setBusy(false); return }
      const saved = await r.json()
      setStatus(`✅ Gespeichert → Objekt ${saved.id} in place aktualisiert (${out.width}×${out.height}, GPS/Metadaten erhalten).`)
      // reload (cache-busted) to reflect the new bytes
      setTimeout(() => loadObject(String(meta.id)), 600)
    } catch (e: any) { setStatus('Fehler: ' + (e?.message || e)) }
    setBusy(false)
  }

  return (
    <div style={{ padding: 20, color: 'var(--text, #e8eef2)', maxWidth: 1000, margin: '0 auto' }}>
      <h2 style={{ margin: '0 0 12px' }}>Bild-Editor</h2>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={idInput} onChange={(e) => setIdInput(e.target.value)} placeholder="Storage-Objekt-ID"
          style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #2a3a44', background: '#0e1620', color: '#e8eef2', width: 180 }} />
        <button onClick={() => loadObject(idInput)} style={btn}>Laden</button>
        {meta && <span style={{ opacity: 0.8, fontSize: 13 }}>#{meta.id} · {meta.original_filename} · {meta.owner_email || 'kein owner'}</span>}
      </div>

      {img && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <button onClick={() => rotate(-90)} style={btn}>⟲ 90° links</button>
          <button onClick={() => rotate(90)} style={btn}>⟳ 90° rechts</button>
          <button onClick={() => setFlipH((v) => !v)} style={btn}>⇋ Spiegeln H</button>
          <button onClick={() => setFlipV((v) => !v)} style={btn}>⇅ Spiegeln V</button>
          <button onClick={() => setCrop(null)} style={btn} disabled={!crop}>✕ Auswahl aufheben</button>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            Fein {fine}°
            <input type="range" min={-45} max={45} value={fine} onChange={(e) => setFine(Number(e.target.value))} />
          </label>
          <button onClick={save} disabled={busy} style={{ ...btn, background: '#06B6D4', color: '#04141a', fontWeight: 700 }}>
            {busy ? 'Speichere…' : '💾 Speichern (überschreibt Original)'}
          </button>
        </div>
      )}

      {img && (
        <div style={{ background: '#0a1118', borderRadius: 10, padding: 10, display: 'inline-block' }}>
          <canvas ref={canvasRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}
            style={{ maxWidth: '100%', touchAction: 'none', cursor: 'crosshair', borderRadius: 6 }} />
          <div style={{ fontSize: 13, marginTop: 8, padding: '6px 10px', background: '#13202b', borderRadius: 6, border: '1px solid #2a3a44' }}>
            ✂️ <b>Zum Zuschneiden:</b> mit der Maus ein Rechteck aufs Bild ziehen · innen ziehen = verschieben · Ecke unten-rechts = Größe ändern · dann <b>💾 Speichern</b>
          </div>
        </div>
      )}

      <div style={{ marginTop: 12, minHeight: 20, fontSize: 14, opacity: 0.9 }}>{status}</div>
    </div>
  )
}

const btn: React.CSSProperties = { padding: '8px 12px', borderRadius: 8, border: '1px solid #2a3a44', background: '#13202b', color: '#e8eef2', cursor: 'pointer', fontSize: 14 }
