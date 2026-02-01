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
  // Título vem após a última vírgula
  const lastComma = line.lastIndexOf(',')
  if (lastComma !== -1) {
    return line.substring(lastComma + 1).trim()
  }
  return 'Sem Título'
}

export async function downloadM3U(url) {
  try {
    const response = await axios.get(url, {
      timeout: 30000,
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
      // Parse metadata
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
      // URL do stream
      currentItem.streamUrl = line
      
      // Generate externalId
      if (currentItem.tvgId) {
        currentItem.externalId = currentItem.tvgId
      } else {
        // Hash title + URL
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