import crypto from 'crypto'

/**
 * Detecta se um título é de episódio e extrai informações
 * Retorna: { isSeries: boolean, seriesTitle: string, season: number, episode: number }
 */
export function detectEpisode(title) {
  const patterns = [
    // S01E02, S1E2, S01 E02
    /(.+?)\s*[\-\|]?\s*S(\d{1,2})\s*E(\d{1,2})/i,
    // 1x02, 1X02
    /(.+?)\s*[\-\|]?\s*(\d{1,2})\s*[xX]\s*(\d{1,2})/,
    // Temporada 1 Episódio 2, Temp 1 Ep 2
    /(.+?)\s*[\-\|]?\s*Temp(?:orada)?\s*(\d{1,2})\s*Ep(?:isódio|isodio)?\s*(\d{1,2})/i,
    // T01E02
    /(.+?)\s*[\-\|]?\s*T(\d{1,2})\s*E(\d{1,2})/i,
  ]

  for (const pattern of patterns) {
    const match = title.match(pattern)
    if (match) {
      let seriesTitle = match[1].trim()
      const season = parseInt(match[2])
      const episode = parseInt(match[3])

      // Limpar separadores finais
      seriesTitle = seriesTitle.replace(/[\-\|:]\s*$/g, '').trim()

      return {
        isSeries: true,
        seriesTitle,
        season,
        episode,
      }
    }
  }

  return { isSeries: false }
}

/**
 * Gera externalId para série
 */
export function generateSeriesExternalId(seriesTitle, categorySlug) {
  const hash = crypto.createHash('sha256')
  hash.update(`${seriesTitle}|${categorySlug}`)
  return hash.digest('hex').substring(0, 32)
}

/**
 * Gera externalId para episódio
 */
export function generateEpisodeExternalId(tvgId, seriesExternalId, season, episode, streamUrl) {
  if (tvgId) return tvgId
  
  const hash = crypto.createHash('sha256')
  hash.update(`${seriesExternalId}|${season}|${episode}|${streamUrl}`)
  return hash.digest('hex').substring(0, 32)
}

/**
 * Gera externalId para filme
 */
export function generateMovieExternalId(tvgId, title, streamUrl) {
  if (tvgId) return tvgId
  
  const hash = crypto.createHash('sha256')
  hash.update(`${title}|${streamUrl}`)
  return hash.digest('hex').substring(0, 32)
}
