'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Play } from 'lucide-react'

export default function ContinueWatching() {
  const [progress, setProgress] = useState([])

  useEffect(() => {
    loadProgress()
  }, [])

  const loadProgress = async () => {
    try {
      const res = await fetch('/api/progress')
      if (res.ok) {
        const data = await res.json()
        setProgress(data.progress)
      }
    } catch (error) {
      console.error('Error loading progress:', error)
    }
  }

  if (progress.length === 0) return null

  return (
    <div className="container mx-auto px-4 mb-8">
      <h2 className="text-2xl font-bold text-white mb-4">Continue Assistindo</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {progress.slice(0, 10).map((item) => (
          <Link
            key={item.id}
            href={`/watch/${item.vod.id}`}
            className="group relative"
          >
            <div className="relative aspect-video rounded-lg overflow-hidden bg-gray-800">
              {item.vod.posterUrl ? (
                <img
                  src={item.vod.posterUrl}
                  alt={item.vod.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-gray-500 text-sm">{item.vod.title}</span>
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                <Play className="h-12 w-12 text-white" fill="currentColor" />
              </div>
              {/* Progress Bar */}
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-600">
                <div
                  className="h-full bg-red-600"
                  style={{
                    width: `${(item.positionSeconds / item.durationSeconds) * 100}%`,
                  }}
                />
              </div>
            </div>
            <h3 className="text-white text-sm mt-2 line-clamp-1">{item.vod.title}</h3>
          </Link>
        ))}
      </div>
    </div>
  )
}