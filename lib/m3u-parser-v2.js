import crypto from 'crypto'
import axios from 'axios'
import { detectEpisode, generateSeriesExternalId, generateEpisodeExternalId, generateMovieExternalId } from './episode-detector.js'

function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

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
  return null
}

function detectContainerType(url) {
  const ext = url.split('.').pop().split('?')[0].toLowerCase()
  if (ext === 'm3u8' || ext === 'm3u') return 'HLS'
  if (ext === 'mp4') return 'MP4'
  if (ext === 'mkv') return 'MKV'
  if (ext === 'avi') return 'AVI'
  if (ext === 'mov') return 'MOV'
  return 'UNKNOWN'
}

export async function downloadM3U(url) {
  try {
    const response = await axios.get(url, {
      timeout: 60000,
      maxRedirects: 5,
    })
    return response.data
  } catch (error) {
    console.error('Failed to download M3U:', error.message)
    throw new Error('Failed to download playlist')
  }
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
      currentItem.containerType = detectContainerType(line)
      
      // Detectar se é episódio
      const detection = detectEpisode(currentItem.title)
      
      if (detection.isSeries) {
        currentItem.contentType = 'EPISODE'
        currentItem.seriesTitle = detection.seriesTitle
        currentItem.seasonNumber = detection.season
        currentItem.episodeNumber = detection.episode
      } else {
        currentItem.contentType = 'MOVIE'
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

export { slugify, generateSeriesExternalId, generateEpisodeExternalId, generateMovieExternalId }
