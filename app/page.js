'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Play, Info, LogOut, User, Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import VodCarousel from '@/components/vod-carousel'
import ContinueWatching from '@/components/continue-watching'

export default function HomePage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [subscription, setSubscription] = useState(null)
  const [categories, setCategories] = useState([])
  const [heroVod, setHeroVod] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    checkAuth()
    loadData()
  }, [])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/me')
      if (res.ok) {
        const data = await res.json()
        setUser(data.user)
        setSubscription(data.subscription)
      } else {
        router.push('/login')
      }
    } catch (error) {
      router.push('/login')
    }
  }

  const loadData = async () => {
    try {
      const [categoriesRes, vodsRes] = await Promise.all([
        fetch('/api/categories'),
        fetch('/api/vods?limit=1'),
      ])

      if (categoriesRes.ok) {
        const data = await categoriesRes.json()
        // Limitar a 15 categorias para melhorar velocidade
        setCategories(data.categories.slice(0, 15))
      }

      if (vodsRes.ok) {
        const data = await vodsRes.json()
        if (data.vods.length > 0) {
          setHeroVod(data.vods[0])
        }
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/login')
    } catch (error) {
      toast.error('Erro ao sair')
    }
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
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-black to-transparent">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="text-2xl font-bold text-red-600">
              VODSTREAM
            </Link>
            <nav className="hidden md:flex gap-6">
              <Link href="/" className="text-white hover:text-gray-300 transition">
                Início
              </Link>
              <Link href="/search" className="text-white hover:text-gray-300 transition">
                Buscar
              </Link>
              {subscription?.isActive && (
                <span className="text-green-500 text-sm">
                  ✓ Assinatura Ativa
                </span>
              )}
              {!subscription?.isActive && (
                <Link href="/account" className="text-yellow-500 text-sm hover:text-yellow-400">
                  ⚠ Ativar Assinatura
                </Link>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            {user?.role === 'ADMIN' && (
              <Link href="/admin">
                <Button variant="outline" size="sm" className="hidden md:flex">
                  Admin
                </Button>
              </Link>
            )}
            <Link href="/account">
              <Button variant="ghost" size="icon" className="text-white">
                <User className="h-5 w-5" />
              </Button>
            </Link>
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
              <Link href="/" className="text-white hover:text-gray-300">
                Início
              </Link>
              <Link href="/search" className="text-white hover:text-gray-300">
                Buscar
              </Link>
              <Link href="/account" className="text-white hover:text-gray-300">
                Minha Conta
              </Link>
              {user?.role === 'ADMIN' && (
                <Link href="/admin" className="text-white hover:text-gray-300">
                  Admin
                </Link>
              )}
              <button onClick={handleLogout} className="text-left text-red-500 hover:text-red-400">
                Sair
              </button>
            </nav>
          </div>
        )}
      </header>

      {/* Hero Section */}
      {heroVod && (
        <div className="relative h-[80vh] flex items-center">
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/50 to-transparent z-10" />
          {heroVod.posterUrl && (
            <img
              src={heroVod.posterUrl}
              alt={heroVod.title}
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          <div className="container mx-auto px-4 relative z-20 max-w-2xl">
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-4">
              {heroVod.title}
            </h1>
            {heroVod.description && (
              <p className="text-lg text-gray-200 mb-8 line-clamp-3">
                {heroVod.description}
              </p>
            )}
            <div className="flex gap-4">
              <Link href={`/watch/${heroVod.id}`}>
                <Button size="lg" className="bg-white text-black hover:bg-gray-200">
                  <Play className="mr-2 h-5 w-5" fill="currentColor" />
                  Assistir
                </Button>
              </Link>
              <Link href={`/title/${heroVod.id}`}>
                <Button size="lg" variant="secondary" className="bg-gray-500/50 text-white hover:bg-gray-500/70">
                  <Info className="mr-2 h-5 w-5" />
                  Mais informações
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Continue Watching */}
      <div className="relative z-20 -mt-32 md:-mt-40">
        <ContinueWatching />
      </div>

      {/* Categories Carousels */}
      <div className="relative z-20 space-y-8 pb-20">
        {categories.map((category) => (
          <VodCarousel
            key={category.id}
            categoryId={category.id}
            categoryName={category.name}
            categorySlug={category.slug}
          />
        ))}
      </div>

      {/* Footer */}
      <footer className="bg-black border-t border-gray-800 py-8">
        <div className="container mx-auto px-4 text-center text-gray-500">
          <p>&copy; 2025 VOD Streaming. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  )
}