'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Pause, Play, Volume2, VolumeX, Maximize, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import Hls from 'hls.js'

export default function WatchEpisodePage() {
  const router = useRouter()
  const params = useParams()
  const episodeId = params.id
  
  const videoRef = useRef(null)
  const [episode, setEpisode] = useState(null)
  const [streamUrl, setStreamUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [videoLoading, setVideoLoading] = useState(true)

  useEffect(() => {
    checkSubscriptionAndLoad()
  }, [episodeId])

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

      // Get stream URL
      const streamRes = await fetch(`/api/episode/${episodeId}/stream`)
      if (streamRes.ok) {
        const streamData = await streamRes.json()
        setStreamUrl(streamData.url)
        setEpisode({ title: streamData.title })
      } else {
        const error = await streamRes.json()
        toast.error(error.error || 'Erro ao carregar episódio')
        router.back()
      }
    } catch (error) {
      toast.error('Erro ao carregar')
      router.back()
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

    console.log('🎬 Initializing episode player with URL:', streamUrl)

    // Detectar formato do arquivo
    const fileExtension = streamUrl.split('.').pop().split('?')[0].toLowerCase()
    console.log('📹 File extension:', fileExtension)

    // Limpar event listeners antigos
    video.removeEventListener('error', handleVideoError)
    video.removeEventListener('canplay', handleCanPlay)
    video.removeEventListener('playing', handlePlaying)
    video.removeEventListener('waiting', handleWaiting)

    function handleVideoError(e) {
      console.error('❌ Video error:', video.error)
      const errorMessages = {
        1: 'Carregamento abortado',
        2: 'Erro de rede',
        3: 'Erro ao decodificar',
        4: 'Formato não suportado',
      }
      toast.error(errorMessages[video.error?.code] || 'Erro ao reproduzir')
      setVideoLoading(false)
    }

    function handleCanPlay() {
      console.log('✅ Video can play')
      setVideoLoading(false)
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
      video.src = streamUrl
      
      if (fileExtension === 'mkv') {
        video.type = 'video/x-matroska'
      } else if (fileExtension === 'mp4') {
        video.type = 'video/mp4'
      }
      
      video.load()
    }

    video.addEventListener('timeupdate', () => {
      setCurrentTime(video.currentTime)
      setDuration(video.duration)
    })
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
        <Loader2 className="h-12 w-12 text-red-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Back Button */}
      <div className="absolute top-4 left-4 z-50">
        <Button 
          variant="ghost" 
          className="text-white bg-black/50"
          onClick={() => router.back()}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
      </div>

      {/* Episode Title */}
      {episode?.title && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50">
          <span className="text-white bg-black/50 px-4 py-2 rounded-lg">
            {episode.title}
          </span>
        </div>
      )}

      {/* Video Player */}
      <div className="relative w-full h-screen bg-black">
        <video
          ref={videoRef}
          className="w-full h-full"
          onClick={togglePlay}
          controls={false}
          autoPlay
          playsInline
          preload="auto"
          crossOrigin="anonymous"
        />

        {/* Loading Spinner */}
        {videoLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-20">
            <div className="flex flex-col items-center gap-4 max-w-md px-4">
              <Loader2 className="h-16 w-16 text-red-500 animate-spin" />
              <span className="text-white text-lg text-center">Carregando episódio...</span>
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
