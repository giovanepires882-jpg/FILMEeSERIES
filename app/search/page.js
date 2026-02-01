'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search, Film, Tv, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export default function SearchPage() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [vods, setVods] = useState([])
  const [series, setSeries] = useState([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      const res = await fetch('/api/me')
      if (!res.ok) {
        router.push('/login')
      }
    }
    checkAuth()
  }, [])

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!query.trim()) return

    setLoading(true)
    setSearched(false)
    try {
      const res = await fetch(`/api/vods?q=${encodeURIComponent(query.trim())}&limit=50`)
      if (res.ok) {
        const data = await res.json()
        setVods(data.vods || [])
        setSeries(data.series || [])
        setSearched(true)
      } else {
        toast.error('Erro ao buscar')
      }
    } catch (error) {
      toast.error('Erro ao buscar')
    } finally {
      setLoading(false)
    }
  }

  const totalResults = vods.length + series.length

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="border-b border-gray-800">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-red-600">
            VODSTREAM
          </Link>
          <Link href="/" className="text-gray-400 hover:text-white text-sm">
            ← Voltar
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold text-white mb-8">Buscar</h1>

        {/* Search Form */}
        <form onSubmit={handleSearch} className="max-w-2xl mb-12">
          <div className="flex gap-2">
            <Input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Digite o nome do filme ou série..."
              className="flex-1 bg-gray-900 text-white border-gray-700 h-12"
              autoFocus
            />
            <Button type="submit" disabled={loading} className="bg-red-600 hover:bg-red-700 h-12 px-6">
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <Search className="h-5 w-5 mr-2" />
                  Buscar
                </>
              )}
            </Button>
          </div>
          <p className="text-gray-500 text-sm mt-2">
            Dica: A busca encontra títulos que começam com o termo digitado
          </p>
        </form>

        {/* Results */}
        {searched && (
          <>
            <p className="text-gray-400 mb-6">
              {totalResults} resultado(s) encontrado(s) para "{query}"
            </p>

            {/* Series Section */}
            {series.length > 0 && (
              <div className="mb-12">
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                  <Tv className="h-6 w-6 text-red-500" />
                  Séries ({series.length})
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {series.map((item) => (
                    <Link key={item.id} href={`/series/${item.id}`} className="group">
                      <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-gray-800 transition-transform group-hover:scale-105">
                        {item.posterUrl ? (
                          <img
                            src={item.posterUrl}
                            alt={item.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Tv className="w-12 h-12 text-gray-600" />
                          </div>
                        )}
                        {/* Badge de Série */}
                        <div className="absolute top-2 left-2 bg-red-600 text-white text-xs px-2 py-1 rounded">
                          SÉRIE
                        </div>
                        {/* Badge de episódios */}
                        {item.episodeCount > 0 && (
                          <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded">
                            {item.episodeCount} ep
                          </div>
                        )}
                      </div>
                      <h3 className="text-white text-sm mt-2 line-clamp-2">{item.title}</h3>
                      {item.category?.name && (
                        <p className="text-gray-500 text-xs mt-1">{item.category.name}</p>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Movies Section */}
            {vods.length > 0 && (
              <div>
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                  <Film className="h-6 w-6 text-red-500" />
                  Filmes ({vods.length})
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {vods.map((vod) => (
                    <Link key={vod.id} href={`/title/${vod.id}`} className="group">
                      <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-gray-800 transition-transform group-hover:scale-105">
                        {vod.posterUrl ? (
                          <img
                            src={vod.posterUrl}
                            alt={vod.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Film className="w-12 h-12 text-gray-600" />
                          </div>
                        )}
                      </div>
                      <h3 className="text-white text-sm mt-2 line-clamp-2">{vod.title}</h3>
                      {vod.category?.name && (
                        <p className="text-gray-500 text-xs mt-1">{vod.category.name}</p>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* No results */}
            {totalResults === 0 && (
              <div className="text-center py-12">
                <Search className="h-16 w-16 text-gray-700 mx-auto mb-4" />
                <p className="text-gray-400 text-xl">Nenhum resultado encontrado</p>
                <p className="text-gray-600 mt-2">
                  Tente buscar por outro termo ou verifique a ortografia
                </p>
              </div>
            )}
          </>
        )}

        {/* Initial State */}
        {!searched && !loading && (
          <div className="text-center py-12">
            <Search className="h-16 w-16 text-gray-700 mx-auto mb-4" />
            <p className="text-gray-400 text-xl">Digite algo para buscar</p>
            <p className="text-gray-600 mt-2">
              Busque por filmes ou séries do nosso catálogo
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
