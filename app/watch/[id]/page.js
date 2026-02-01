'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Pause, Play, Volume2, VolumeX, Maximize } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import Hls from 'hls.js'

export default function WatchPage({ params }) {
  const router = useRouter()
  const videoRef = useRef(null)
  const [vod, setVod] = useState(null)
  const [streamUrl, setStreamUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [videoLoading, setVideoLoading] = useState(true)
  const progressInterval = useRef(null)

  useEffect(() => {
    checkSubscriptionAndLoad()
    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current)
      }
    }
  }, [params.id])

  const checkSubscriptionAndLoad = async () => {
    try {
      // Check subscription
      const meRes = await fetch('/api/me')
      if (!meRes.ok) {
        router.push('/login')
        return
      }

      const meData = await meRes.json()
      if (!meData.subscription?.isActive) {
        toast.error('Assinatura inativa. Ative sua assinatura para assistir.')
        router.push('/account')
        return
      }

      // Load VOD
      const vodRes = await fetch(`/api/vods/${params.id}`)
      if (vodRes.ok) {
        const vodData = await vodRes.json()
        setVod(vodData.vod)
      }

      // Get stream URL
      const streamRes = await fetch(`/api/stream/${params.id}`)
      if (streamRes.ok) {
        const streamData = await streamRes.json()
        setStreamUrl(streamData.url)
      } else {
        toast.error('Erro ao carregar stream')
        router.push('/')
      }
    } catch (error) {
      toast.error('Erro ao carregar')
      router.push('/')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (streamUrl && videoRef.current) {
      initPlayer()
    }
  }, [streamUrl])

  const initPlayer = () => {
    const video = videoRef.current
    if (!video) return

    console.log('🎬 Initializing player with URL:', streamUrl)

    // Detectar formato do arquivo
    const fileExtension = streamUrl.split('.').pop().split('?')[0].toLowerCase()
    console.log('📹 File extension:', fileExtension)

    // Limpar event listeners antigos
    video.removeEventListener('error', handleVideoError)
    video.removeEventListener('loadedmetadata', handleLoadedMetadata)
    video.removeEventListener('canplay', handleCanPlay)
    video.removeEventListener('playing', handlePlaying)
    video.removeEventListener('waiting', handleWaiting)

    // Função de erro
    function handleVideoError(e) {
      console.error('❌ Video error:', video.error)
      
      if (video.error && video.error.code === 4) {
        // Formato não suportado - tentar forçar com diferentes tipos MIME
        console.log('⚠️ Format not supported, trying alternative approaches...')
        
        // Tentar diferentes tipos MIME
        const mimeTypes = [
          'video/mp4',
          'video/x-matroska',
          'video/webm',
          'application/x-mpegURL',
          ''
        ]
        
        let triedCount = 0
        const tryNextMime = () => {
          if (triedCount < mimeTypes.length) {
            const mime = mimeTypes[triedCount]
            console.log(`🔄 Trying with MIME type: ${mime || 'auto'}`)
            
            video.src = ''
            video.load()
            
            if (mime) {
              video.type = mime
            }
            video.src = streamUrl
            video.load()
            
            triedCount++
          } else {
            // Todas tentativas falharam
            console.error('❌ All playback attempts failed')
            toast.error('Este vídeo não pode ser reproduzido no seu navegador. Tente outro navegador (Chrome recomendado) ou escolha outro vídeo.')
            setVideoLoading(false)
          }
        }
        
        // Tentar primeira alternativa
        setTimeout(tryNextMime, 1000)
      } else {
        const errorMessages = {
          1: 'Carregamento abortado',
          2: 'Erro de rede',
          3: 'Erro ao decodificar',
          4: 'Formato não suportado',
        }
        toast.error(errorMessages[video.error?.code] || 'Erro ao reproduzir')
      }
    }

    function handleLoadedMetadata() {
      console.log('✅ Video metadata loaded')
    }

    function handleCanPlay() {
      console.log('✅ Video can play')
      setVideoLoading(false)
      // Tentar autoplay
      video.play().catch(e => {
        console.log('⚠️ Autoplay prevented:', e)
        setVideoLoading(false)
      })
    }

    function handlePlaying() {
      setVideoLoading(false)
      setPlaying(true)
    }

    function handleWaiting() {
      setVideoLoading(true)
    }

    // Adicionar listeners
    video.addEventListener('error', handleVideoError)
    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    video.addEventListener('canplay', handleCanPlay)
    video.addEventListener('playing', handlePlaying)
    video.addEventListener('waiting', handleWaiting)

    // Configurar vídeo
    setVideoLoading(true)
    
    // Para HLS usar hls.js
    if (fileExtension === 'm3u8' || fileExtension === 'm3u') {
      if (Hls.isSupported()) {
        console.log('📡 Using HLS.js')
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 90,
        })
        hls.loadSource(streamUrl)
        hls.attachMedia(video)
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          console.log('✅ HLS manifest parsed')
          video.play().catch(e => console.log('Autoplay prevented'))
        })
        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            console.error('❌ Fatal HLS error:', data)
            toast.error('Erro ao carregar stream')
          }
        })
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        console.log('🍎 Using native HLS')
        video.src = streamUrl
        video.load()
      }
    } else {
      // Para outros formatos, tentar direto
      console.log('🎥 Using direct playback')
      
      // Limpar source antigo
      video.src = ''
      video.load()
      
      // Definir novo source
      video.src = streamUrl
      
      // Para MKV, adicionar type explícito
      if (fileExtension === 'mkv') {
        video.type = 'video/x-matroska'
      } else if (fileExtension === 'mp4') {
        video.type = 'video/mp4'
      }
      
      video.load()
    }

    // Progress tracking
    progressInterval.current = setInterval(() => {
      if (video.currentTime > 0 && video.duration > 0) {
        saveProgress(Math.floor(video.currentTime), Math.floor(video.duration))
      }
    }, 10000)

    video.addEventListener('timeupdate', () => {
      setCurrentTime(video.currentTime)
      setDuration(video.duration)
    })
  }

  const saveProgress = async (positionSeconds, durationSeconds) => {
    try {
      await fetch(`/api/progress/${params.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positionSeconds, durationSeconds }),
      })
    } catch (error) {
      console.error('Error saving progress:', error)
    }
  }

  const togglePlay = () => {
    const video = videoRef.current
    if (!video) return

    if (video.paused) {
      video.play()
      setPlaying(true)
    } else {
      video.pause()
      setPlaying(false)
    }
  }

  const toggleMute = () => {
    const video = videoRef.current
    if (!video) return

    video.muted = !video.muted
    setMuted(video.muted)
  }

  const toggleFullscreen = () => {
    const video = videoRef.current
    if (!video) return

    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      video.requestFullscreen()
    }
  }

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">Carregando...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Back Button */}
      <div className="absolute top-4 left-4 z-50">
        <Link href="/">
          <Button variant="ghost" className="text-white bg-black/50">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        </Link>
      </div>

      {/* Video Player */}
      <div className="relative w-full h-screen bg-black">
        <video
          ref={videoRef}
          className="w-full h-full"
          onClick={togglePlay}
          controls={false}
          autoPlay
          playsInline
        />

        {/* Loading Spinner */}
        {videoLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-white text-lg">Carregando vídeo...</span>
              <span className="text-gray-400 text-sm">Se demorar muito, pode ser formato incompatível</span>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={togglePlay} className="text-white">
              {playing ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" fill="currentColor" />}
            </Button>

            <Button variant="ghost" size="icon" onClick={toggleMute} className="text-white">
              {muted ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
            </Button>

            <div className="flex-1 flex items-center gap-2">
              <span className="text-white text-sm">{formatTime(currentTime)}</span>
              <div className="flex-1 h-1 bg-gray-600 rounded">
                <div
                  className="h-full bg-red-600 rounded"
                  style={{ width: `${(currentTime / duration) * 100}%` }}
                />
              </div>
              <span className="text-white text-sm">{formatTime(duration)}</span>
            </div>

            <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="text-white">
              <Maximize className="h-6 w-6" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}