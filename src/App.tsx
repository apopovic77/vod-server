import { useEffect } from 'react'
import './portfolio.css'
import Header from './components/Header'
import SiteFooter from './components/SiteFooter'
import Landing from './pages/Landing'
import ImageEditor from './pages/ImageEditor'
import Privacy from './pages/Privacy'
import Terms from './pages/Terms'
import Impressum from './pages/Impressum'
import MotionDesignApp from './pages/MotionDesignApp'
import VodPage from './pages/VodPage'
import VodAll from './pages/VodAll'
import VodAllInfiniteCanvas from './pages/VodAllInfiniteCanvas'
import VodStrip from './pages/VodStrip'
import VodTheater from './pages/VodTheater'
import VodFusion from './pages/VodFusion'
import FieldShareUpload from './pages/FieldShareUpload'
import ShareReceive from './pages/ShareReceive'
import VideoShare from './pages/VideoShare'
import ImageShare from './pages/ImageShare'
import ImageShareV2 from './pages/ImageShareV2'
import ImageShareV3 from './pages/ImageShareV3'
import Collections from './pages/Collections'
import ShareInfo from './pages/ShareInfo'
import ShaderTest from './pages/ShaderTest'
import TreadTest from './pages/TreadTest'
import RingLoaderTest from './pages/RingLoaderTest'
// @ts-ignore types present after deps install
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'

function App(){
  useEffect(()=>{
    const yearEl = document.getElementById('y')
    if(yearEl){ yearEl.textContent = String(new Date().getFullYear()) }

    function setPageGradient(){
      const fullHeight = Math.max(
        document.body.scrollHeight,
        document.body.offsetHeight,
        document.documentElement.clientHeight,
        document.documentElement.scrollHeight,
        document.documentElement.offsetHeight
      )
      const gradient = getComputedStyle(document.documentElement).getPropertyValue('--bg')
      document.body.style.background = gradient
      document.body.style.backgroundSize = '100% ' + fullHeight + 'px'
      document.body.style.backgroundRepeat = 'no-repeat'
      document.body.style.backgroundAttachment = 'local'
    }

    const onLoad = ()=> setPageGradient()
    window.addEventListener('load', onLoad)
    window.addEventListener('resize', setPageGradient)
    const timeoutId = window.setTimeout(setPageGradient, 100)

    // Also recompute when DOM/layout changes (masonry tiles etc.)
    const ro = new ResizeObserver(() => setPageGradient())
    try { ro.observe(document.documentElement) } catch {}
    const mo = new MutationObserver(()=>{
      window.requestAnimationFrame(setPageGradient)
    })
    try { mo.observe(document.body, { childList:true, subtree:true }) } catch {}

    const ind = document.querySelector('.scroll-indicator') as HTMLElement | null
    let hidden = false
    function onScrollHide(){
      if(!hidden && window.scrollY > 80 && ind){
        ind.style.opacity = '0'
        ind.style.transition = 'opacity .4s ease'
        hidden = true
        window.removeEventListener('scroll', onScrollHide)
      }
    }
    window.addEventListener('scroll', onScrollHide, { passive:true })

    const phone = document.getElementById('parallax-phone')
    let ticking = false
    const base = { rx:10, ry:-15 }
    function clamp(v:number, min:number, max:number){ return Math.max(min, Math.min(max, v)) }
    function onParallax(){
      if(ticking) return
      ticking = true
      requestAnimationFrame(()=>{
        const y = window.scrollY || 0
        const offset = clamp(y * -0.0008, -0.6, 0.0)
        if(phone){
          ;(phone as HTMLElement).style.transform = `rotateX(${base.rx}deg) rotateY(${base.ry}deg) translateY(${offset*100}px)`
        }
        ticking = false
      })
    }
    window.addEventListener('scroll', onParallax, { passive:true })

    const anchorHandler = (e:Event)=>{
      const target = e.currentTarget as HTMLAnchorElement
      const id = target.getAttribute('href')
      if(id && id.startsWith('#') && id.length>1){
        e.preventDefault()
        document.querySelector(id)?.scrollIntoView({ behavior:'smooth', block:'start' })
      }
    }
    const anchors = Array.from(document.querySelectorAll('a[href^="#"]')) as HTMLAnchorElement[]
    anchors.forEach(a => a.addEventListener('click', anchorHandler))

    return ()=>{
      window.removeEventListener('load', onLoad)
      window.removeEventListener('resize', setPageGradient)
      window.clearTimeout(timeoutId)
      window.removeEventListener('scroll', onScrollHide)
      window.removeEventListener('scroll', onParallax)
      try { ro.disconnect() } catch {}
      try { mo.disconnect() } catch {}
      anchors.forEach(a => a.removeEventListener('click', anchorHandler))
    }
  }, [])

  return (
    <BrowserRouter>
      <InnerAppRoutes />
    </BrowserRouter>
  )
}

export default App

function InnerAppRoutes(){
  const location = useLocation()
  const isShare = location.pathname.startsWith('/share/')
  return (
    <>
      {!isShare && <Header />}
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/motion" element={<MotionDesignApp />} />
        <Route path="/vod" element={<VodPage />} />
        <Route path="/all" element={<VodAll />} />
        <Route path="/allinfinite" element={<VodAllInfiniteCanvas />} />
        <Route path="/strip" element={<VodStrip />} />
        <Route path="/theater" element={<VodTheater />} />
        <Route path="/fusion" element={<VodFusion />} />
        <Route path="/fieldshare" element={<FieldShareUpload />} />
        <Route path="/edit" element={<ImageEditor />} />
        <Route path="/edit/:id" element={<ImageEditor />} />
        <Route path="/share/receive" element={<ShareReceive />} />
        <Route path="/share/videoshare" element={<VideoShare />} />
        <Route path="/share/v1" element={<ImageShare />} />
        <Route path="/share/v2" element={<ImageShareV2 />} />
        <Route path="/share/v3" element={<ImageShareV3 />} />
        <Route path="/share/info" element={<ShareInfo />} />
        <Route path="/collections" element={<Collections />} />
        <Route path="/test/shader" element={<ShaderTest />} />
        <Route path="/test/tread" element={<TreadTest />} />
        <Route path="/test/loader" element={<RingLoaderTest />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/impressum" element={<Impressum />} />
      </Routes>
      {!isShare && <SiteFooter />}
      {!isShare && <div className="scroll-indicator" aria-hidden="true"></div>}
    </>
  )
}
