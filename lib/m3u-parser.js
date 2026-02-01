import crypto from 'crypto'
import axios from 'axios'

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
  return 'Sem Título'
}

// Patterns para detectar episódios de séries
const EPISODE_PATTERNS = [
  // S01E02, S01 E02, S1E2
  /^(.+?)\s*[-.]*\s*S(\d{1,2})\s*E(\d{1,3})/i,
  // 1x02, 1X02, 01x02
  /^(.+?)\s*[-.]*\s*(\d{1,2})x(\d{1,3})/i,
  // Temporada 1 Episodio 2
  /^(.+?)\s*[-.]*\s*[Tt]emporada\s*(\d{1,2})\s*[Ee]p(?:is[oó]dio)?\s*(\d{1,3})/i,
  // T01 EP02, T1 E02, T1E02
  /^(.+?)\s*[-.]*\s*T(\d{1,2})\s*E[Pp]?\s*(\d{1,3})/i,
  // EP01, Ep 01, Episodio 01 (assume temporada 1)
  /^(.+?)\s*[-.]*\s*[Ee]p(?:is[oó]dio)?\s*(\d{1,3})$/i,
  // Titulo - 01, Titulo 01 (numero no final, pode ser episódio)
  /^(.+?)\s*[-.]+\s*(\d{1,3})$/,
]

/**
 * Detecta se um título é um episódio de série e extrai informações
 * @returns {null | { seriesName: string, season: number, episode: number, episodeTitle: string }}
 */
function detectEpisode(title) {
  const cleanTitle = title.trim()
  
  for (const pattern of EPISODE_PATTERNS) {
    const match = cleanTitle.match(pattern)
    if (match) {
      // Pattern com season e episode
      if (match.length === 4) {
        return {
          seriesName: match[1].trim().replace(/[-_.]+$/, '').trim(),
          season: parseInt(match[2], 10),
          episode: parseInt(match[3], 10),
          episodeTitle: cleanTitle
        }
      }
      // Pattern apenas com episode (assume temporada 1)
      if (match.length === 3) {
        return {
          seriesName: match[1].trim().replace(/[-_.]+$/, '').trim(),
          season: 1,
          episode: parseInt(match[2], 10),
          episodeTitle: cleanTitle
        }
      }
    }
  }
  
  return null
}

/**
 * Determina se um item é provavelmente um filme baseado em heurísticas
 */
function isLikelyMovie(title, category) {
  const catLower = category?.toLowerCase() || ''
  
  // Categorias que geralmente são filmes
  const movieCategories = [
    'filme', 'filmes', 'movie', 'movies', 'cinema', 
    'lançamento', 'lancamento', 'dublado', 'legendado',
    'ação', 'acao', 'aventura', 'comédia', 'comedia', 
    'drama', 'terror', 'suspense', 'romance', 'animação', 'animacao',
    '4k', 'uhd', '2024', '2025', '2023', '2022', '2021', '2020'
  ]
  
  // Se a categoria sugere filmes
  for (const mc of movieCategories) {
    if (catLower.includes(mc)) return true
  }
  
  // Se o título tem ano entre parênteses, provavelmente é filme
  if (/\(\d{4}\)/.test(title)) return true
  
  // Se tem "filme" ou "movie" no título
  if (/filme|movie/i.test(title)) return true
  
  return false
}

/**
 * Determina se um item é provavelmente uma série
 */
function isLikelySeries(title, category) {
  const catLower = category?.toLowerCase() || ''
  
  // Categorias que geralmente são séries
  const seriesCategories = [
    'série', 'series', 'serie', 'tv show', 'novela', 'novelas',
    'temporada', 'season', 'episodio', 'episode'
  ]
  
  for (const sc of seriesCategories) {
    if (catLower.includes(sc)) return true
  }
  
  return false
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

/**
 * Parse M3U e classifica itens em filmes e séries/episódios
 */
export function parseM3UWithClassification(content) {
  const allItems = parseM3U(content)
  
  const movies = []
  const seriesMap = new Map() // seriesName -> { posterUrl, category, episodes: [] }
  
  for (const item of allItems) {
    const episodeInfo = detectEpisode(item.title)
    
    if (episodeInfo && !isLikelyMovie(item.title, item.category)) {
      // É um episódio de série
      const seriesKey = episodeInfo.seriesName.toLowerCase()
      
      if (!seriesMap.has(seriesKey)) {
        seriesMap.set(seriesKey, {
          title: episodeInfo.seriesName,
          posterUrl: item.posterUrl,
          category: item.category,
          episodes: []
        })
      }
      
      const series = seriesMap.get(seriesKey)
      
      // Atualizar poster se o atual é melhor
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
      // É um filme
      movies.push({
        externalId: item.externalId,
        title: item.title,
        category: item.category,
        posterUrl: item.posterUrl,
        streamUrl: item.streamUrl
      })
    }
  }
  
  // Converter Map para Array e ordenar episódios
  const series = Array.from(seriesMap.values()).map(s => {
    // Gerar externalId para a série baseado no nome
    const hash = crypto.createHash('sha256')
    hash.update(`series:${s.title.toLowerCase()}`)
    s.externalId = `series_${hash.digest('hex').substring(0, 24)}`
    
    // Ordenar episódios
    s.episodes.sort((a, b) => {
      if (a.seasonNumber !== b.seasonNumber) {
        return a.seasonNumber - b.seasonNumber
      }
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

export async function fetchAndParseM3U(url) {
  const content = await downloadM3U(url)
  return parseM3U(content)
}

export async function fetchAndParseM3UWithClassification(url) {
  const content = await downloadM3U(url)
  return parseM3UWithClassification(content)
}
