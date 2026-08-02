import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { API_BASE_URL } from '../lib/apiBase'
import { getApiKey } from '../lib/apiKey'

// Photoshop-light image editor: load a storage object, rotate (90° steps + free
// angle), flip, crop, then save by re-uploading with the SAME original_filename
// + owner_email — the storage /upload endpoint auto-detects the duplicate
// (reuse_existing) and updates the existing object's bytes in place.

const KEY = getApiKey()

type ObjMeta = {
  id: number
  original_filename: string
  owner_email?: string | null
  mime_type?: string
  title?: string | null
}

type Crop = { x: number; y: number; w: number; h: number } | null

const EDITOR_CSS = `
.imed { max-width: 1080px; margin: 0 auto; padding: 24px 20px 60px; color: #e7eef5;
  font: 14px/1.5 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
.imed-top { display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
.imed-brand { display:flex; align-items:center; gap:9px; font-size:19px; font-weight:700; letter-spacing:-.01em; }
.imed-logo { display:inline-grid; place-items:center; width:30px; height:30px; border-radius:9px;
  background:linear-gradient(135deg,#06b6d4,#3b82f6); color:#031018; font-size:15px; }
.imed-load { display:flex; gap:8px; }
.imed-grow { flex:1; }
.imed-input { width:120px; padding:9px 12px; border-radius:9px; border:1px solid #283947; background:#0d151d;
  color:#e7eef5; font-size:14px; outline:none; transition:border-color .15s, box-shadow .15s; }
.imed-input:focus { border-color:#06b6d4; box-shadow:0 0 0 3px rgba(6,182,212,.18); }
.imed-btn { padding:9px 15px; border-radius:9px; border:1px solid #2c3e4d; background:#18242f; color:#e7eef5;
  font-size:14px; font-weight:600; cursor:pointer; transition:background .14s, border-color .14s, transform .06s; }
.imed-btn:hover { background:#21303d; border-color:#3a566b; }
.imed-btn:active { transform:translateY(1px); }
.imed-save { background:linear-gradient(135deg,#06b6d4,#0891b2); border-color:transparent; color:#02141a;
  box-shadow:0 4px 14px rgba(6,182,212,.3); }
.imed-save:hover { filter:brightness(1.08); }
.imed-save:disabled { opacity:.6; cursor:default; filter:none; }
.imed-meta { display:flex; align-items:center; gap:10px; margin-top:14px; font-size:13px; color:#93a7b8; flex-wrap:wrap; }
.imed-pill { padding:3px 9px; border-radius:7px; background:#16222c; border:1px solid #283947; color:#cfe0ec;
  font-weight:600; font-variant-numeric:tabular-nums; }
.imed-fname { color:#e7eef5; font-weight:500; }
.imed-dim { color:#6f8294; }
.imed-empty { margin-top:32px; padding:54px 20px; text-align:center; border:1.5px dashed #2a3c4b;
  border-radius:16px; background:#0e1620; }
.imed-empty-ic { font-size:44px; opacity:.85; }
.imed-empty-t { margin-top:10px; font-size:17px; font-weight:600; }
.imed-empty-s { margin-top:6px; color:#8497a8; font-size:13.5px; }
.imed-empty-s code { background:#16222c; padding:2px 6px; border-radius:5px; color:#cfe0ec; }
.imed-work { margin-top:16px; }
.imed-toolbar { display:flex; align-items:center; gap:8px; flex-wrap:wrap; padding:10px 12px; background:#101a23;
  border:1px solid #20303c; border-radius:13px 13px 0 0; }
.imed-grp { display:flex; gap:6px; }
.imed-sep { width:1px; align-self:stretch; background:#243643; margin:2px 4px; }
.imed-tbtn { min-width:40px; height:40px; padding:0 11px; display:inline-grid; place-items:center; border-radius:9px;
  border:1px solid #2a3c4b; background:#172430; color:#dce8f2; font-size:18px; cursor:pointer;
  transition:background .14s, border-color .14s, transform .06s; }
.imed-tbtn.wide { font-size:14px; font-weight:600; min-width:auto; }
.imed-tbtn:hover:not(:disabled) { background:#22323f; border-color:#3a566b; }
.imed-tbtn:active:not(:disabled) { transform:translateY(1px); }
.imed-tbtn.on { background:#06b6d4; border-color:#06b6d4; color:#02141a; }
.imed-tbtn:disabled { opacity:.4; cursor:default; }
.imed-straighten { display:flex; align-items:center; gap:9px; font-size:13px; color:#a9bccc; padding:0 4px; }
.imed-straighten input[type=range] { accent-color:#06b6d4; width:130px; }
.imed-deg { min-width:34px; font-variant-numeric:tabular-nums; color:#dce8f2; font-weight:600; }
.imed-stage { display:flex; justify-content:center; align-items:center; padding:22px; background:#070d12;
  border:1px solid #20303c; border-top:none; min-height:320px;
  background-image:linear-gradient(45deg,#0b1219 25%,transparent 25%),linear-gradient(-45deg,#0b1219 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#0b1219 75%),linear-gradient(-45deg,transparent 75%,#0b1219 75%);
  background-size:22px 22px; background-position:0 0,0 11px,11px -11px,-11px 0; }
.imed-canvas { max-width:100%; touch-action:none; cursor:crosshair; border-radius:4px; box-shadow:0 8px 30px rgba(0,0,0,.5); }
.imed-hint { padding:10px 14px; background:#101a23; border:1px solid #20303c; border-top:none;
  border-radius:0 0 13px 13px; font-size:13px; color:#9fb3c4; }
.imed-hint b { color:#dce8f2; }
.imed-status { margin-top:16px; padding:11px 15px; border-radius:10px; font-size:13.5px; border:1px solid; }
.imed-status.info { background:#0f1c26; border-color:#1f3848; color:#9fcfe6; }
.imed-status.ok { background:#0d1f17; border-color:#1c4a35; color:#7fe3b0; }
.imed-status.err { background:#241218; border-color:#5a2230; color:#f3a0ad; }
`

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

  const statusKind = !status ? '' : status.startsWith('✅') ? 'ok'
    : /fehl|fehler|nicht gefunden|kein bild|konnte nicht|quaran|nichts/i.test(status) ? 'err' : 'info'

  return (
    <div className="imed">
      <style>{EDITOR_CSS}</style>

      <header className="imed-top">
        <div className="imed-brand"><span className="imed-logo">✦</span> Bild-Editor</div>
        <div className="imed-load">
          <input className="imed-input" value={idInput} onChange={(e) => setIdInput(e.target.value)}
            placeholder="Objekt-ID" inputMode="numeric"
            onKeyDown={(e) => { if (e.key === 'Enter') loadObject(idInput) }} />
          <button className="imed-btn" onClick={() => loadObject(idInput)}>Laden</button>
        </div>
        <div className="imed-grow" />
        {img && (
          <button className="imed-btn imed-save" onClick={save} disabled={busy}>
            {busy ? 'Speichere…' : '💾 Speichern'}
          </button>
        )}
      </header>

      {meta && (
        <div className="imed-meta">
          <span className="imed-pill">#{meta.id}</span>
          <span className="imed-fname">{meta.original_filename}</span>
          <span className="imed-dim">· {meta.owner_email || 'kein owner'}</span>
        </div>
      )}

      {!img && (
        <div className="imed-empty">
          <div className="imed-empty-ic">🖼️</div>
          <div className="imed-empty-t">Kein Bild geladen</div>
          <div className="imed-empty-s">Gib oben eine Storage-Objekt-ID ein und klick <b>Laden</b> — oder öffne <code>/edit/&lt;id&gt;</code> direkt.</div>
        </div>
      )}

      {img && (
        <div className="imed-work">
          <div className="imed-toolbar">
            <div className="imed-grp">
              <button className="imed-tbtn" title="90° nach links drehen" onClick={() => rotate(-90)}>↺</button>
              <button className="imed-tbtn" title="90° nach rechts drehen" onClick={() => rotate(90)}>↻</button>
            </div>
            <span className="imed-sep" />
            <div className="imed-grp">
              <button className={'imed-tbtn' + (flipH ? ' on' : '')} title="Horizontal spiegeln" onClick={() => setFlipH((v) => !v)}>⇋</button>
              <button className={'imed-tbtn' + (flipV ? ' on' : '')} title="Vertikal spiegeln" onClick={() => setFlipV((v) => !v)}>⇅</button>
            </div>
            <span className="imed-sep" />
            <label className="imed-straighten">
              <span>Begradigen</span>
              <input type="range" min={-45} max={45} value={fine} onChange={(e) => setFine(Number(e.target.value))} />
              <span className="imed-deg">{fine}°</span>
            </label>
            <span className="imed-sep" />
            <button className="imed-tbtn wide" disabled={!crop} title="Crop-Auswahl entfernen" onClick={() => setCrop(null)}>✕ Auswahl</button>
          </div>

          <div className="imed-stage">
            <canvas ref={canvasRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} className="imed-canvas" />
          </div>

          <div className="imed-hint">
            <b>✂️ Zuschneiden:</b> mit der Maus ein Rechteck aufs Bild ziehen · innen ziehen = verschieben · Ecke unten-rechts = Größe · dann <b>Speichern</b>
          </div>
        </div>
      )}

      {status && <div className={'imed-status ' + statusKind}>{status}</div>}
    </div>
  )
}
