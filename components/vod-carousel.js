'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function VodCarousel({ categoryId, categoryName, categorySlug }) {
  const [vods, setVods] = useState([])
  const [scrollPosition, setScrollPosition] = useState(0)

  useEffect(() => {
    loadVods()
  }, [categorySlug])

  const loadVods = async () => {
    try {
      const res = await fetch(`/api/vods?category=${categorySlug}&limit=20`)
      if (res.ok) {
        const data = await res.json()
        setVods(data.vods)
      }
    } catch (error) {
      console.error('Error loading VODs:', error)
    }
  }

  const scroll = (direction) => {
    const container = document.getElementById(`carousel-${categoryId}`)
    if (container) {
      const scrollAmount = container.offsetWidth * 0.8
      const newPosition = direction === 'left'
        ? scrollPosition - scrollAmount
        : scrollPosition + scrollAmount
      
      container.scrollTo({ left: newPosition, behavior: 'smooth' })
      setScrollPosition(newPosition)
    }
  }

  if (vods.length === 0) return null

  return (
    <div className="container mx-auto px-4 mb-8">
      <h2 className="text-2xl font-bold text-white mb-4">{categoryName}</h2>
      <div className="relative group">
        <Button
          variant="ghost"
          size="icon"
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-black/50 text-white opacity-0 group-hover:opacity-100 transition"
          onClick={() => scroll('left')}
        >
          <ChevronLeft className="h-8 w-8" />
        </Button>

        <div
          id={`carousel-${categoryId}`}
          className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {vods.map((vod) => (
            <Link
              key={vod.id}
              href={`/title/${vod.id}`}
              className="flex-none w-48 md:w-64 group/card"
            >
              <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-gray-800 transition-transform group-hover/card:scale-105">
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
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-0 group-hover/card:opacity-100 transition">
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <h3 className="text-white font-semibold line-clamp-2">{vod.title}</h3>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-black/50 text-white opacity-0 group-hover:opacity-100 transition"
          onClick={() => scroll('right')}
        >
          <ChevronRight className="h-8 w-8" />
        </Button>
      </div>
    </div>
  )
}