'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Play, ArrowLeft, Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export default function TitlePage({ params }) {
  const router = useRouter()
  const [vod, setVod] = useState(null)
  const [isFavorite, setIsFavorite] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadVod()
    checkFavorite()
  }, [params.id])

  const loadVod = async () => {
    try {
      const res = await fetch(`/api/vods/${params.id}`)
      if (res.ok) {
        const data = await res.json()
        setVod(data.vod)
      } else {
        toast.error('Conteúdo não encontrado')
        router.push('/')
      }
    } catch (error) {
      toast.error('Erro ao carregar')
    } finally {
      setLoading(false)
    }
  }

  const checkFavorite = async () => {
    try {
      const res = await fetch('/api/favorites')
      if (res.ok) {
        const data = await res.json()
        const found = data.favorites.find(f => f.vodId === params.id)
        setIsFavorite(!!found)
      }
    } catch (error) {
      console.error('Error checking favorite:', error)
    }
  }

  const toggleFavorite = async () => {
    try {
      if (isFavorite) {
        const res = await fetch(`/api/favorites/${params.id}`, { method: 'DELETE' })
        if (res.ok) {
          setIsFavorite(false)
          toast.success('Removido dos favoritos')
        }
      } else {
        const res = await fetch(`/api/favorites/${params.id}`, { method: 'POST' })
        if (res.ok) {
          setIsFavorite(true)
          toast.success('Adicionado aos favoritos')
        }
      }
    } catch (error) {
      toast.error('Erro ao atualizar favoritos')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">Carregando...</div>
      </div>
    )
  }

  if (!vod) return null

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-black to-transparent">
        <div className="container mx-auto px-4 py-4">
          <Link href="/">
            <Button variant="ghost" className="text-white">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <div className="relative h-[70vh] flex items-end">
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent z-10" />
        {vod.posterUrl && (
          <img
            src={vod.posterUrl}
            alt={vod.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        <div className="container mx-auto px-4 pb-20 relative z-20">
          <h1 className="text-5xl font-bold text-white mb-4">{vod.title}</h1>
          <div className="flex items-center gap-4 text-gray-300 mb-6">
            {vod.category && (
              <span className="px-3 py-1 bg-gray-800 rounded">{vod.category.name}</span>
            )}
          </div>
          <div className="flex gap-4">
            <Link href={`/watch/${vod.id}`}>
              <Button size="lg" className="bg-white text-black hover:bg-gray-200">
                <Play className="mr-2 h-5 w-5" fill="currentColor" />
                Assistir
              </Button>
            </Link>
            <Button
              size="lg"
              variant="outline"
              onClick={toggleFavorite}
              className="border-white text-white hover:bg-white hover:text-black"
            >
              <Heart
                className="mr-2 h-5 w-5"
                fill={isFavorite ? 'currentColor' : 'none'}
              />
              {isFavorite ? 'Nos Favoritos' : 'Adicionar aos Favoritos'}
            </Button>
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="container mx-auto px-4 py-12">
        {vod.description && (
          <div className="max-w-3xl">
            <h2 className="text-2xl font-bold text-white mb-4">Sinopse</h2>
            <p className="text-gray-300 text-lg leading-relaxed">{vod.description}</p>
          </div>
        )}
      </div>
    </div>
  )
}