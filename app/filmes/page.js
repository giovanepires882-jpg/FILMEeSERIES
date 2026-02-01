'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Film, Search, Loader2, ChevronDown, User, Menu, X, Tv, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export default function FilmesPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [vods, setVods] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    checkAuth()
    loadCategories()
  }, [])

  useEffect(() => {
    loadVods(true)
  }, [selectedCategory])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/me')
      if (res.ok) {
        const data = await res.json()
        setUser(data.user)
      }
    } catch (error) {
      // Ignora - usuário pode navegar sem login
    }
  }

  const loadCategories = async () => {
    try {
      const res = await fetch('/api/categories')
      if (res.ok) {
        const data = await res.json()
        setCategories(data.categories)
      }
    } catch (error) {
      console.error('Error loading categories:', error)
    }
  }

  const loadVods = async (reset = false) => {
    if (reset) {
      setPage(1)
      setLoading(true)
    } else {
      setLoadingMore(true)
    }

    try {
      const currentPage = reset ? 1 : page
      let url = `/api/vods?page=${currentPage}&limit=30`
      
      if (selectedCategory !== 'all') {
        url += `&category=${selectedCategory}`
      }
      
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        if (reset) {
          setVods(data.vods)
        } else {
          setVods(prev => [...prev, ...data.vods])
        }
        setHasMore(data.pagination.page < data.pagination.totalPages)
        if (!reset) {
          setPage(currentPage + 1)
        }
      }
    } catch (error) {
      console.error('Error loading VODs:', error)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadVods(true)
      return
    }
    
    setLoading(true)
    try {
      const res = await fetch(`/api/vods?q=${encodeURIComponent(searchQuery)}&limit=50`)
      if (res.ok) {
        const data = await res.json()
        setVods(data.vods || [])
        setHasMore(false)
      }
    } catch (error) {
      console.error('Error searching:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    setUser(null)
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/95 border-b border-gray-800">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="text-2xl font-bold text-red-600">
              VODSTREAM
            </Link>
            <nav className="hidden md:flex gap-6">
              <Link href="/" className="text-gray-400 hover:text-white transition">
                Início
              </Link>
              <Link href="/filmes" className="text-white font-semibold flex items-center gap-1">
                <Film className="h-4 w-4" />
                Filmes
              </Link>
              <Link href="/series" className="text-gray-400 hover:text-white transition flex items-center gap-1">
                <Tv className="h-4 w-4" />
                Séries
              </Link>
              <Link href="/search" className="text-gray-400 hover:text-white transition flex items-center gap-1">
                <Search className="h-4 w-4" />
                Buscar
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            {user ? (
              <>
                <Link href="/account">
                  <Button variant="ghost" size="icon" className="text-white">
                    <User className="h-5 w-5" />
                  </Button>
                </Link>
              </>
            ) : (
              <Link href="/login">
                <Button variant="default" size="sm" className="bg-red-600 hover:bg-red-700">
                  Entrar
                </Button>
              </Link>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="text-white md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-black/95 border-t border-gray-800">
            <nav className="container mx-auto px-4 py-4 flex flex-col gap-4">
              <Link href="/" className="text-gray-400">Início</Link>
              <Link href="/filmes" className="text-white font-semibold flex items-center gap-2">
                <Film className="h-4 w-4" /> Filmes
              </Link>
              <Link href="/series" className="text-gray-400 flex items-center gap-2">
                <Tv className="h-4 w-4" /> Séries
              </Link>
              <Link href="/search" className="text-gray-400">Buscar</Link>
              {user ? (
                <>
                  <Link href="/account" className="text-gray-400">Minha Conta</Link>
                  <button onClick={handleLogout} className="text-left text-red-500">Sair</button>
                </>
              ) : (
                <Link href="/login" className="text-red-500">Entrar</Link>
              )}
            </nav>
          </div>
        )}
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Page Title */}
        <div className="flex items-center gap-3 mb-8">
          <Film className="h-8 w-8 text-red-500" />
          <h1 className="text-4xl font-bold text-white">Filmes</h1>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="flex-1 flex gap-2">
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Buscar filmes..."
              className="bg-gray-900 text-white border-gray-700"
            />
            <Button onClick={handleSearch} className="bg-red-600 hover:bg-red-700">
              <Search className="h-4 w-4" />
            </Button>
          </div>
          
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-full md:w-[250px] bg-gray-900 text-white border-gray-700">
              <SelectValue placeholder="Todas as categorias" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.slug}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-20">
            <Loader2 className="h-12 w-12 text-red-500 animate-spin" />
          </div>
        )}

        {/* VODs Grid */}
        {!loading && (
          <>
            <p className="text-gray-400 mb-6">{vods.length} filme(s) encontrado(s)</p>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
              {vods.map((vod) => (
                <Link key={vod.id} href={`/title/${vod.id}`} className="group">
                  <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-gray-800 transition-transform group-hover:scale-105">
                    {vod.posterUrl ? (
                      <img
                        src={vod.posterUrl}
                        alt={vod.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
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

            {/* Load More */}
            {hasMore && !searchQuery && (
              <div className="flex justify-center mt-8">
                <Button
                  onClick={() => loadVods(false)}
                  disabled={loadingMore}
                  variant="outline"
                  className="border-gray-700 text-white"
                >
                  {loadingMore ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <ChevronDown className="h-4 w-4 mr-2" />
                  )}
                  Carregar mais
                </Button>
              </div>
            )}

            {/* Empty State */}
            {vods.length === 0 && (
              <div className="text-center py-20">
                <Film className="h-16 w-16 text-gray-700 mx-auto mb-4" />
                <p className="text-gray-400 text-xl">Nenhum filme encontrado</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
