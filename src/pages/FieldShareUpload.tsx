import { useEffect, useMemo, useRef, useState } from 'react'
import { Configuration, StorageApi } from 'arkturian-storage-sdk'
import { subscribeToAuth, signInWithGoogle, signOutUser, firebaseEnabled } from '../lib/firebase'
// @ts-ignore types present after deps install
import { useNavigate } from 'react-router-dom'
import TextOnTread from '../components/TextOnTread'
import AnimatedShaderBackground from '../components/AnimatedShaderBackground'
import { md5File } from '../utils/md5'
import { getApiKey, authHeaders } from '../lib/apiKey'

export default function FieldShareUpload(){
  const navigate = useNavigate()
  // mode not used right now
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [generatedLink, setGeneratedLink] = useState<string>('')
  // ownerEmail unused; userEmail from Firebase used instead
  const [collectionId, setCollectionId] = useState<string>('')
  const [userEmail, setUserEmail] = useState<string>('')
  const inputRef = useRef<HTMLInputElement | null>(null)
  const dropRef = useRef<HTMLDivElement | null>(null)
  const sdkRef = useRef<StorageApi | null>(null)
  const [useShaderBg, setUseShaderBg] = useState(false)

  useEffect(()=>{
    const conf = new Configuration({ basePath: 'https://api-storage.arkturian.com' })
    sdkRef.current = new StorageApi(conf)
    if(firebaseEnabled){
      const unsub = subscribeToAuth(u=> setUserEmail(u?.email || ''))
      return ()=> unsub()
    }
    return ()=> {}
  }, [])

  useEffect(()=>{
    // Feature-detect for advanced CSS effects to enable shader background
    try{
      const ok = typeof CSS !== 'undefined'
        && CSS.supports('mix-blend-mode', 'color-dodge')
        && CSS.supports('filter', 'hue-rotate(360deg)')
        && CSS.supports('animation', 'name')
      setUseShaderBg(!!ok)
    } catch { setUseShaderBg(false) }
  }, [])

  useEffect(()=>{
    const el = dropRef.current
    if(!el) return
    const onDragOver = (e: DragEvent)=>{ e.preventDefault(); el.classList.add('active') }
    const onDragLeave = ()=> el.classList.remove('active')
    const onDrop = (e: DragEvent)=>{
      e.preventDefault()
      el.classList.remove('active')
      const list = Array.from(e.dataTransfer?.files || [])
      if(list.length){
        // If collection id missing, open modal first; don't change files state so label stays default
        if(!collectionId || !collectionId.trim()){
          setPendingFiles(list)
          setShowCollectionModal(true)
        } else {
          setFiles(list)
          void doUpload(list)
        }
      }
    }
    el.addEventListener('dragover', onDragOver as any)
    el.addEventListener('dragleave', onDragLeave as any)
    el.addEventListener('drop', onDrop as any)
    return ()=>{
      el.removeEventListener('dragover', onDragOver as any)
      el.removeEventListener('dragleave', onDragLeave as any)
      el.removeEventListener('drop', onDrop as any)
    }
  }, [])

  function openPicker(){ inputRef.current?.click() }

  // modal + toast state
  const [showCollectionModal, setShowCollectionModal] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<File[] | null>(null)
  const [toast, setToast] = useState<string>('')
  const [showAuthModal, setShowAuthModal] = useState(false)
  useEffect(()=>{ if(!toast) return; const t = window.setTimeout(()=> setToast(''), 2500); return ()=> window.clearTimeout(t) }, [toast])

  function onPick(e: React.ChangeEvent<HTMLInputElement>){
    const list = Array.from(e.target.files || []).filter(f=> f && f.size > 0)
    if(list.length){
      if(!collectionId || !collectionId.trim()){
        setPendingFiles(list)
        setShowCollectionModal(true)
      } else {
        setFiles(list)
        void doUpload(list)
      }
    }
  }

  async function doUpload(filesArg?: File[]){
    const toUpload = (filesArg && filesArg.length ? filesArg : files).filter(f=> f && f.size > 0)
    // Preconditions: require signed-in email (when Firebase enabled) and a collection id
    if(firebaseEnabled && !userEmail){ setShowAuthModal(true); return }
    if(!collectionId || !collectionId.trim()){
      setToast('Enter a Collection ID to continue.')
      return
    }
    if(!toUpload.length || uploading) return
    setUploading(true)
    try{
      const sdk = sdkRef.current
      if(!sdk) throw new Error('SDK not ready')
      // Upload sequentially for now; can parallelize later
      const uploadedIds:number[] = []
      // Compute link_id from first non-empty file
      const linkId = await md5File(toUpload[0])
      for(const f of toUpload){
        const { data } = await sdk.uploadFileStorageUploadPost({
          file: f,
          xAPIKEY: getApiKey(),
          context: undefined,
          isPublic: true,
          ownerEmail: userEmail || undefined,
          collectionId: collectionId || undefined,
          linkId: linkId,
          analyze: true
        })
        // If SDK supports link_id, we would send it in body; since current generated client only sends form fields, we can re-PATCH to set link_id
        try{
          const id = (data as any)?.id
          if(id){
            await fetch(`https://api-storage.arkturian.com/storage/objects/${id}`, { method:'PATCH', headers:{ ...authHeaders(), 'Content-Type':'application/json' }, body: JSON.stringify({ link_id: linkId }) })
          }
        } catch{}
        if((data as any)?.id){ uploadedIds.push((data as any).id as number) }
      }
      // After upload, always open ImageShare V2 starting at the first item
      let link = uploadedIds.length ? `/share/v2?current_id=${uploadedIds[0]}` : ''
      if(uploadedIds.length){ navigate(link) }
      setGeneratedLink(link)
      setSuccess(true)
    } catch(e){
      console.error(e)
      alert('Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const fileLabel = useMemo(()=> files.length ? `${files.length} file(s) selected` : 'Drop your files here', [files])

  return (
    <main role="main" style={{ position:'relative' }}>
      {/* Backgrounds: shader (if supported), plus TextOnTread fallback layered */}
      <div aria-hidden style={{ position:'fixed', inset:0, zIndex:0, pointerEvents:'none' }}>
        {useShaderBg && (
          <AnimatedShaderBackground
            variant="vivid"
            speedFactor={3}
            saturate={6}
            sepia={0}
            hueDegrees={360}
            hueDurationSec={20}
            fill="viewport"
            style={{ opacity:0.6 }}
          />
        )}
        <div style={{ position:'absolute', inset:0, display:'grid', placeItems:'center', opacity: useShaderBg ? 0.13 : 0.18 }}>
        <TextOnTread
  text="RESILIENCE"
  style={
    {
      perspective: '60rem',
      ['--front' as any]: '#0f172a',
      ['--back' as any]: '#94a3b8'
    } as React.CSSProperties
  }
/>        
</div>
      </div>
      <section className="section" aria-labelledby="fsu-title" style={{ position:'relative', zIndex:1 }}>
        <div style={{ padding:0 }}>
          <div className="hero-section" style={{ textAlign:'center', marginBottom:24 }}>
            <h1 id="fsu-title" className="h2" style={{ margin:0 }}>Share your creation like it matters.</h1>
            <p className="muted" style={{ marginTop:8 }}>Because it does.</p>
          </div>

          {!success && (
            <>
            {/* Collection above drop */}
            <div style={{ marginBottom:12,marginLeft:20 }}>
              <input
                placeholder="Collection ID"
                value={collectionId}
                onChange={e=> setCollectionId(e.target.value)}
                className="pill"
                style={{ padding:20, fontSize:18, width:'95%' }}
              />
            </div>
            <div className="upload-area" style={{ background:'transparent', borderRadius:20, padding:24, marginBottom:24 }}>
              <div
                ref={dropRef}
                className="drop-zone"
                onClick={openPicker}
                style={{ border:'2px dashed var(--ring)', borderRadius:16, padding:32, cursor:'pointer', background:'rgba(255,255,255,0.6)', textAlign:'center', backdropFilter:'blur(4px)', WebkitBackdropFilter:'blur(4px)' }}
              >
                <div className="upload-icon" style={{ fontSize:36, opacity:.6, marginBottom:10 }}>📁</div>
                <div className="upload-text" style={{ fontWeight:600 }}>{uploading ? 'Uploading…' : fileLabel}</div>
                <div className="upload-subtext muted">or tap to select</div>
                <input ref={inputRef} type="file" multiple accept="image/*,video/*" style={{ display:'none' }} onChange={onPick} />
              </div>

              {/* Mode selector hidden for now */}

              <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:12, marginTop:12, alignItems:'center' }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                  {firebaseEnabled && userEmail ? (
                    <>
                      <span className="muted" style={{ fontSize:12 }}>Signed in as</span>
                      <span className="pill" style={{ display:'inline-block' }}>{userEmail}</span>
                      <button className="pill" onClick={signOutUser}>Logout</button>
                    </>
                  ) : firebaseEnabled ? (
                    <button className="pill" onClick={signInWithGoogle}>Sign in with Google</button>
                  ) : (
                    <span className="muted" style={{ fontSize:12 }}>Auth disabled</span>
                  )}
                </div>
              </div>

              <div className="action-buttons" style={{ display:'flex', gap:12, marginTop:16 }}>
                <button className="action-btn secondary pill" onClick={()=> alert('Camera access not implemented yet')}>📷 Camera</button>
                <button className="action-btn secondary pill" onClick={()=> inputRef.current?.click()}>📱 Photos</button>
              </div>
            </div>
            </>
          )}

          {success && (
            <div className="success-section" style={{ textAlign:'center' }}>
              <div className="success-icon" style={{ fontSize:48, marginBottom:12 }}>✨</div>
              <h2 className="success-title" style={{ margin:'0 0 6px 0' }}>Ready to share</h2>
              <p className="success-subtitle muted" style={{ margin:'0 0 16px 0' }}>Your cinematic link is ready</p>
              <div className="generated-link" style={{ background:'#f8f8f8', border:'1px solid var(--ring)', borderRadius:12, padding:12, fontFamily:'var(--mono)' }}>
                {generatedLink || 'fieldshare.app/c/your-link'}
                <button className="pill" style={{ marginLeft:8 }} onClick={()=>{ if(generatedLink) navigator.clipboard.writeText(generatedLink) }}>Copy</button>
              </div>
              <div className="action-buttons" style={{ display:'flex', gap:12, justifyContent:'center' }}>
                <button className="action-btn secondary pill" onClick={()=> { if(generatedLink) window.open(generatedLink, '_blank') }}>👁️ Preview</button>
                <button className="action-btn primary pill" onClick={()=>{
                  if((navigator as any).share){ (navigator as any).share({ title:'FieldShare', url: generatedLink }) } else { if(generatedLink) navigator.clipboard.writeText(generatedLink) }
                }}>📤 Share</button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Toast */}
      {toast && (
        <div style={{ position:'fixed', top:24, left:'50%', transform:'translateX(-50%)', background:'var(--glass)', border:'1px solid var(--ring)', color:'#fff', borderRadius:12, padding:'10px 14px', backdropFilter:'blur(10px) saturate(180%)', WebkitBackdropFilter:'blur(10px) saturate(180%)', zIndex:1000 }}>{toast}</div>
      )}

      {/* Modal for collection id */}
      {showCollectionModal && (
        <div role="dialog" aria-modal="true" style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', display:'grid', placeItems:'center', zIndex:2000 }}>
          <div className="card" style={{ background:'var(--glass)', border:'1px solid var(--ring)', padding:20, borderRadius:16, width:'min(92vw, 420px)', backdropFilter:'blur(10px) saturate(180%)', WebkitBackdropFilter:'blur(10px) saturate(180%)', color:'#fff', zIndex:2001 }}>
            <h2 className="h2" style={{ marginTop:0, marginBottom:10 }}>Choose a Collection</h2>
            <p className="muted" style={{ marginTop:0 }}>Enter a collection name for your upload.</p>
            <input autoFocus placeholder="Collection ID" value={collectionId} onChange={e=> setCollectionId(e.target.value)} className="pill" style={{ padding:12, fontSize:16, width:'100%', marginTop:8 }} />
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:14 }}>
              <button className="pill" onClick={()=> { setShowCollectionModal(false); setPendingFiles(null) }}>Cancel</button>
              <button className="pill primary" onClick={()=>{ if(collectionId && collectionId.trim() && pendingFiles){ setFiles(pendingFiles); setShowCollectionModal(false); void doUpload(pendingFiles) } }}>Continue</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal for sign-in */}
      {showAuthModal && (
        <div role="dialog" aria-modal="true" style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', display:'grid', placeItems:'center', zIndex:2000 }}>
          <div className="card" style={{ background:'var(--glass)', border:'1px solid var(--ring)', padding:20, borderRadius:16, width:'min(92vw, 420px)', backdropFilter:'blur(10px) saturate(180%)', WebkitBackdropFilter:'blur(10px) saturate(180%)', color:'#fff', zIndex:2001 }}>
            <h2 className="h2" style={{ marginTop:0, marginBottom:10 }}>Sign in required</h2>
            <p className="muted" style={{ marginTop:0 }}>Please sign in with Google to continue.</p>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:14 }}>
              <button className="pill" onClick={()=> setShowAuthModal(false)}>Cancel</button>
              <button className="pill primary" onClick={async()=>{ try{ await signInWithGoogle(); setShowAuthModal(false); if(pendingFiles && (!collectionId || !collectionId.trim())){ setShowCollectionModal(true) } else if(pendingFiles){ setFiles(pendingFiles); void doUpload(pendingFiles) } } catch{} }}>Sign in</button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}


