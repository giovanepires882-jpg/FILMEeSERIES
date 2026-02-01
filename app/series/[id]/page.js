'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { Play, ChevronDown, ChevronUp, Tv, ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export default function SeriesPage() {
  const router = useRouter()
  const params = useParams()
  const seriesId = params.id
  
  const [series, setSeries] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expandedSeasons, setExpandedSeasons] = useState({})
  const [user, setUser] = useState(null)
  const [hasSubscription, setHasSubscription] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/me')
        if (!res.ok) {
          router.push('/login')
          return
        }
        const data = await res.json()
        setUser(data.user)
        setHasSubscription(data.subscription?.status === 'ACTIVE')
      } catch (error) {
        router.push('/login')
      }
    }
    checkAuth()
  }, [])

  useEffect(() => {
    const fetchSeries = async () => {
      try {
        const res = await fetch(`/api/series/${seriesId}`)
        if (res.ok) {
          const data = await res.json()
          setSeries(data.series)
          
          // Expandir a primeira temporada por padrão
          const seasons = Object.keys(data.series.seasons || {})
          if (seasons.length > 0) {
            setExpandedSeasons({ [seasons[0]]: true })
          }
        } else {
          toast.error('Série não encontrada')
          router.push('/')
        }
      } catch (error) {
        toast.error('Erro ao carregar série')
      } finally {
        setLoading(false)
      }
    }
    
    if (seriesId) {
      fetchSeries()
    }
  }, [seriesId])

  const toggleSeason = (seasonNum) => {
    setExpandedSeasons(prev => ({
      ...prev,
      [seasonNum]: !prev[seasonNum]
    }))
  }

  const handlePlayEpisode = (episodeId) => {
    if (!hasSubscription) {
      toast.error('Você precisa de uma assinatura ativa para assistir')
      router.push('/checkout')
      return
    }
    router.push(`/watch/episode/${episodeId}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="h-12 w-12 text-red-500 animate-spin" />
      </div>
    )
  }

  if (!series) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-gray-400">Série não encontrada</p>
      </div>
    )
  }

  const seasonNumbers = Object.keys(series.seasons || {}).sort((a, b) => Number(a) - Number(b))

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="border-b border-gray-800">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-red-600">
            VODSTREAM
          </Link>
          <Link href="/" className="text-gray-400 hover:text-white text-sm flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <div className="relative">
        {/* Background */}
        <div className="absolute inset-0 h-[50vh] overflow-hidden">
          {series.posterUrl ? (
            <img
              src={series.posterUrl}
              alt={series.title}
              className="w-full h-full object-cover opacity-30 blur-sm"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-b from-gray-900 to-black" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent" />
        </div>

        {/* Content */}
        <div className="relative container mx-auto px-4 pt-12 pb-8">
          <div className="flex flex-col md:flex-row gap-8">
            {/* Poster */}
            <div className="w-48 md:w-64 flex-shrink-0 mx-auto md:mx-0">
              <div className="aspect-[2/3] rounded-lg overflow-hidden bg-gray-800 shadow-2xl">
                {series.posterUrl ? (
                  <img
                    src={series.posterUrl}
                    alt={series.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Tv className="w-16 h-16 text-gray-600" />
                  </div>
                )}
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 text-center md:text-left">
              <div className="flex items-center gap-2 justify-center md:justify-start mb-2">
                <span className="bg-red-600 text-white text-xs px-2 py-1 rounded">SÉRIE</span>
                {series.category?.name && (
                  <span className="bg-gray-800 text-gray-300 text-xs px-2 py-1 rounded">
                    {series.category.name}
                  </span>
                )}
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">{series.title}</h1>
              <div className="flex items-center gap-4 text-gray-400 justify-center md:justify-start mb-6">
                <span>{series.totalSeasons} temporada(s)</span>
                <span>•</span>
                <span>{series.totalEpisodes} episódio(s)</span>
              </div>
              
              {!hasSubscription && (
                <div className="bg-yellow-900/50 border border-yellow-700 rounded-lg p-4 mb-6 max-w-md mx-auto md:mx-0">
                  <p className="text-yellow-200 text-sm">
                    Você precisa de uma assinatura ativa para assistir esta série.
                  </p>
                  <Link href="/checkout">
                    <Button className="mt-3 bg-red-600 hover:bg-red-700">
                      Assinar Agora
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Episodes Section */}
      <div className="container mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold text-white mb-6">Episódios</h2>

        {seasonNumbers.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400">Nenhum episódio disponível</p>
          </div>
        ) : (
          <div className="space-y-4">
            {seasonNumbers.map((seasonNum) => {
              const episodes = series.seasons[seasonNum] || []
              const isExpanded = expandedSeasons[seasonNum]
              
              return (
                <div key={seasonNum} className="bg-gray-900 rounded-lg overflow-hidden">
                  {/* Season Header */}
                  <button
                    onClick={() => toggleSeason(seasonNum)}
                    className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Tv className="h-5 w-5 text-red-500" />
                      <span className="text-white font-semibold text-lg">
                        Temporada {seasonNum}
                      </span>
                      <span className="text-gray-500 text-sm">
                        ({episodes.length} episódio{episodes.length !== 1 ? 's' : ''})
                      </span>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-gray-400" />
                    )}
                  </button>

                  {/* Episodes List */}
                  {isExpanded && (
                    <div className="border-t border-gray-800">
                      {episodes.map((episode, idx) => (
                        <div
                          key={episode.id}
                          className="flex items-center gap-4 px-6 py-4 hover:bg-gray-800/50 transition-colors border-b border-gray-800 last:border-b-0"
                        >
                          {/* Episode Number */}
                          <div className="w-12 h-12 flex-shrink-0 bg-gray-800 rounded flex items-center justify-center">
                            <span className="text-gray-400 font-semibold">
                              {episode.episodeNumber || idx + 1}
                            </span>
                          </div>

                          {/* Episode Info */}
                          <div className="flex-1 min-w-0">
                            <h3 className="text-white font-medium truncate">
                              {episode.title || `Episódio ${episode.episodeNumber || idx + 1}`}
                            </h3>
                            <p className="text-gray-500 text-sm">
                              T{seasonNum}:E{episode.episodeNumber || idx + 1}
                            </p>
                          </div>

                          {/* Play Button */}
                          <Button
                            onClick={() => handlePlayEpisode(episode.id)}
                            disabled={!hasSubscription}
                            className={`flex-shrink-0 ${
                              hasSubscription 
                                ? 'bg-red-600 hover:bg-red-700' 
                                : 'bg-gray-700 cursor-not-allowed'
                            }`}
                          >
                            <Play className="h-4 w-4 mr-2" />
                            Assistir
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
