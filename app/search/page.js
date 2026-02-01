'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export default function SearchPage() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [vods, setVods] = useState([])
  const [loading, setLoading] = useState(false)

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
    try {
      const res = await fetch(`/api/vods?q=${encodeURIComponent(query)}&limit=50`)
      if (res.ok) {
        const data = await res.json()
        setVods(data.vods)
      } else {
        toast.error('Erro ao buscar')
      }
    } catch (error) {
      toast.error('Erro ao buscar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="border-b border-gray-800">
        <div className="container mx-auto px-4 py-4">
          <Link href="/" className="text-2xl font-bold text-red-600">
            VODSTREAM
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
              placeholder="Digite o nome do conteúdo..."
              className="flex-1 bg-gray-900 text-white border-gray-700"
            />
            <Button type="submit" disabled={loading} className="bg-red-600 hover:bg-red-700">
              <Search className="h-4 w-4 mr-2" />
              {loading ? 'Buscando...' : 'Buscar'}
            </Button>
          </div>
        </form>

        {/* Results */}
        {vods.length > 0 && (
          <div>
            <p className="text-gray-400 mb-6">{vods.length} resultado(s) encontrado(s)</p>
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
                        <span className="text-gray-500 text-sm text-center px-4">{vod.title}</span>
                      </div>
                    )}
                  </div>
                  <h3 className="text-white text-sm mt-2 line-clamp-2">{vod.title}</h3>
                </Link>
              ))}
            </div>
          </div>
        )}

        {!loading && query && vods.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-400">Nenhum resultado encontrado para &quot;{query}&quot;</p>
          </div>
        )}
      </div>
    </div>
  )
}