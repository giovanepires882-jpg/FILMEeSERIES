import crypto from 'crypto'
import https from 'https'
import http from 'http'

function extractAttribute(line, attr) {
  const regex = new RegExp(`${attr}="([^"]+)"`, 'i')
  const match = line.match(regex)
  return match ? match[1] : null
}

function extractTitle(line) {
  const lastComma = line.lastIndexOf(',')
  if (lastComma !== -1) {
    return line.substring(lastComma + 1).trim()
  }
  return 'Sem Título'
}

// Patterns para detectar episódios de séries
const EPISODE_PATTERNS = [
  /^(.+?)\s*[-.]*\s*S(\d{1,2})\s*E(\d{1,3})/i,
  /^(.+?)\s*[-.]*\s*(\d{1,2})x(\d{1,3})/i,
  /^(.+?)\s*[-.]*\s*[Tt]emporada\s*(\d{1,2})\s*[Ee]p(?:is[oó]dio)?\s*(\d{1,3})/i,
  /^(.+?)\s*[-.]*\s*T(\d{1,2})\s*E[Pp]?\s*(\d{1,3})/i,
]

function detectEpisode(title) {
  const cleanTitle = title.trim()
  
  for (const pattern of EPISODE_PATTERNS) {
    const match = cleanTitle.match(pattern)
    if (match && match.length === 4) {
      return {
        seriesName: match[1].trim().replace(/[-_.]+$/, '').trim(),
        season: parseInt(match[2], 10),
        episode: parseInt(match[3], 10),
        episodeTitle: cleanTitle
      }
    }
  }
  
  return null
}

/**
 * Download M3U content as a stream and process line by line
 * Uses a callback to process each item as it's parsed
 */
export async function streamParseM3U(url, onItem, options = {}) {
  const { detectSeries = false, onProgress = null } = options
  
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http
    
    protocol.get(url, { timeout: 120000 }, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`))
        return
      }
      
      let buffer = ''
      let currentItem = null
      let itemCount = 0
      let bytesReceived = 0
      const contentLength = parseInt(response.headers['content-length'] || '0', 10)
      
      // Series tracking (only if detectSeries is enabled)
      const seriesMap = new Map()
      
      response.on('data', (chunk) => {
        bytesReceived += chunk.length
        buffer += chunk.toString()
        
        // Process complete lines
        let newlineIndex
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          const line = buffer.substring(0, newlineIndex).trim()
          buffer = buffer.substring(newlineIndex + 1)
          
          if (line.startsWith('#EXTINF:')) {
            const tvgId = extractAttribute(line, 'tvg-id')
            const tvgName = extractAttribute(line, 'tvg-name')
            const tvgLogo = extractAttribute(line, 'tvg-logo')
            const groupTitle = extractAttribute(line, 'group-title') || 'Outros'
            const title = extractTitle(line) || tvgName || 'Sem Título'
            
            currentItem = {
              tvgId,
              title,
              category: groupTitle,
              posterUrl: tvgLogo,
            }
          } else if (currentItem && (line.startsWith('http://') || line.startsWith('https://'))) {
            currentItem.streamUrl = line
            
            // Generate externalId
            if (currentItem.tvgId) {
              currentItem.externalId = currentItem.tvgId
            } else {
              const hash = crypto.createHash('sha256')
              hash.update(`${currentItem.title}|${currentItem.streamUrl}`)
              currentItem.externalId = hash.digest('hex').substring(0, 32)
            }
            
            if (detectSeries) {
              const episodeInfo = detectEpisode(currentItem.title)
              
              if (episodeInfo) {
                // Track series and episodes
                const seriesKey = episodeInfo.seriesName.toLowerCase()
                
                if (!seriesMap.has(seriesKey)) {
                  const seriesHash = crypto.createHash('sha256')
                  seriesHash.update(`series:${seriesKey}`)
                  
                  seriesMap.set(seriesKey, {
                    externalId: `series_${seriesHash.digest('hex').substring(0, 24)}`,
                    title: episodeInfo.seriesName,
                    posterUrl: currentItem.posterUrl,
                    category: currentItem.category,
                    type: 'series'
                  })
                }
                
                // Emit episode
                onItem({
                  ...currentItem,
                  type: 'episode',
                  seriesKey,
                  seasonNumber: episodeInfo.season,
                  episodeNumber: episodeInfo.episode,
                })
              } else {
                // Emit as movie
                onItem({
                  ...currentItem,
                  type: 'movie'
                })
              }
            } else {
              // No series detection - emit everything as movie/vod
              onItem({
                ...currentItem,
                type: 'movie'
              })
            }
            
            itemCount++
            currentItem = null
            
            // Progress callback
            if (onProgress && itemCount % 1000 === 0) {
              const progress = contentLength > 0 ? Math.round((bytesReceived / contentLength) * 100) : null
              onProgress({ itemCount, bytesReceived, progress })
            }
          }
        }
      })
      
      response.on('end', () => {
        // Emit all tracked series
        if (detectSeries) {
          for (const series of seriesMap.values()) {
            onItem(series)
          }
        }
        
        resolve({
          totalItems: itemCount,
          seriesCount: seriesMap.size,
          bytesReceived
        })
      })
      
      response.on('error', reject)
    }).on('error', reject)
  })
}

// Legacy functions for backward compatibility
export async function downloadM3U(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http
    
    protocol.get(url, { timeout: 60000 }, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`))
        return
      }
      
      let data = ''
      response.on('data', chunk => data += chunk)
      response.on('end', () => resolve(data))
      response.on('error', reject)
    }).on('error', reject)
  })
}

export function parseM3U(content) {
  const lines = content.split('\n').map(l => l.trim()).filter(l => l)
  const items = []
  
  let currentItem = null
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    
    if (line.startsWith('#EXTINF:')) {
      const tvgId = extractAttribute(line, 'tvg-id')
      const tvgName = extractAttribute(line, 'tvg-name')
      const tvgLogo = extractAttribute(line, 'tvg-logo')
      const groupTitle = extractAttribute(line, 'group-title') || 'Outros'
      const title = extractTitle(line) || tvgName || 'Sem Título'
      
      currentItem = {
        tvgId,
        title,
        category: groupTitle,
        posterUrl: tvgLogo,
      }
    } else if (currentItem && (line.startsWith('http://') || line.startsWith('https://'))) {
      currentItem.streamUrl = line
      
      if (currentItem.tvgId) {
        currentItem.externalId = currentItem.tvgId
      } else {
        const hash = crypto.createHash('sha256')
        hash.update(`${currentItem.title}|${currentItem.streamUrl}`)
        currentItem.externalId = hash.digest('hex').substring(0, 32)
      }
      
      items.push(currentItem)
      currentItem = null
    }
  }
  
  return items
}

export async function fetchAndParseM3U(url) {
  const content = await downloadM3U(url)
  return parseM3U(content)
}

// New streaming parser for classification
export async function fetchAndParseM3UWithClassification(url) {
  const movies = []
  const seriesMap = new Map()
  
  const content = await downloadM3U(url)
  const allItems = parseM3U(content)
  
  for (const item of allItems) {
    const episodeInfo = detectEpisode(item.title)
    
    if (episodeInfo) {
      const seriesKey = episodeInfo.seriesName.toLowerCase()
      
      if (!seriesMap.has(seriesKey)) {
        const hash = crypto.createHash('sha256')
        hash.update(`series:${seriesKey}`)
        
        seriesMap.set(seriesKey, {
          externalId: `series_${hash.digest('hex').substring(0, 24)}`,
          title: episodeInfo.seriesName,
          posterUrl: item.posterUrl,
          category: item.category,
          episodes: []
        })
      }
      
      const series = seriesMap.get(seriesKey)
      if (!series.posterUrl && item.posterUrl) {
        series.posterUrl = item.posterUrl
      }
      
      series.episodes.push({
        externalId: item.externalId,
        title: item.title,
        seasonNumber: episodeInfo.season,
        episodeNumber: episodeInfo.episode,
        streamUrl: item.streamUrl
      })
    } else {
      movies.push({
        externalId: item.externalId,
        title: item.title,
        category: item.category,
        posterUrl: item.posterUrl,
        streamUrl: item.streamUrl
      })
    }
  }
  
  const series = Array.from(seriesMap.values()).map(s => {
    s.episodes.sort((a, b) => {
      if (a.seasonNumber !== b.seasonNumber) return a.seasonNumber - b.seasonNumber
      return a.episodeNumber - b.episodeNumber
    })
    return s
  })
  
  return {
    movies,
    series,
    stats: {
      totalItems: allItems.length,
      moviesCount: movies.length,
      seriesCount: series.length,
      episodesCount: series.reduce((acc, s) => acc + s.episodes.length, 0)
    }
  }
}
