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

    console.log('Initializing player with URL:', streamUrl)

    // Verificar se é HLS ou MP4 direto
    if (streamUrl.includes('.m3u8')) {
      // HLS stream
      console.log('Detected HLS stream')
      if (Hls.isSupported()) {
        const hls = new Hls({
          debug: false,
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 90,
        })
        hls.loadSource(streamUrl)
        hls.attachMedia(video)
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          console.log('HLS manifest parsed, ready to play')
        })
        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error('HLS error:', data)
          if (data.fatal) {
            toast.error('Erro ao carregar vídeo')
          }
        })
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS support (Safari)
        console.log('Using native HLS support')
        video.src = streamUrl
      } else {
        console.error('HLS not supported')
        toast.error('Seu navegador não suporta este formato de vídeo')
      }
    } else {
      // MP4 direto ou outro formato
      console.log('Direct video stream (MP4 or other)')
      video.src = streamUrl
      video.load()
    }

    // Error handling
    video.addEventListener('error', (e) => {
      console.error('Video error:', e, video.error)
      if (video.error) {
        const errorMessages = {
          1: 'Erro ao carregar vídeo: Operação abortada',
          2: 'Erro de rede ao carregar vídeo',
          3: 'Erro ao decodificar vídeo',
          4: 'Formato de vídeo não suportado',
        }
        toast.error(errorMessages[video.error.code] || 'Erro ao reproduzir vídeo')
      }
    })

    video.addEventListener('loadstart', () => {
      console.log('Video loading started')
      setVideoLoading(true)
    })

    video.addEventListener('loadedmetadata', () => {
      console.log('Video metadata loaded')
    })

    video.addEventListener('canplay', () => {
      console.log('Video can play')
      setVideoLoading(false)
    })

    video.addEventListener('playing', () => {
      setVideoLoading(false)
      setPlaying(true)
    })

    video.addEventListener('waiting', () => {
      setVideoLoading(true)
    })

    // Start progress tracking
    progressInterval.current = setInterval(() => {
      if (video.currentTime > 0 && video.duration > 0) {
        saveProgress(Math.floor(video.currentTime), Math.floor(video.duration))
      }
    }, 10000) // Save every 10 seconds

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
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-white text-lg">Carregando vídeo...</span>
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