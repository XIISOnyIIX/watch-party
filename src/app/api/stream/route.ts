import { NextRequest, NextResponse } from 'next/server'
import NodeCache from 'node-cache'
import { makeProviders, makeStandardFetcher, targets } from '@movie-web/providers'

// Cache extracted URLs for 2 hours to reduce API calls
const cache = new NodeCache({ stdTTL: 7200 })

// Create providers instance (reuse across requests)
let providersInstance: ReturnType<typeof makeProviders> | null = null

function getProvidersInstance() {
  if (!providersInstance) {
    providersInstance = makeProviders({
      fetcher: makeStandardFetcher(fetch),
      target: targets.NATIVE // For Node.js server-side
    })
  }
  return providersInstance
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const tmdbId = searchParams.get('tmdbId')
  const type = searchParams.get('type') // 'movie' or 'tv'
  const season = searchParams.get('season')
  const episode = searchParams.get('episode')

  if (!tmdbId || !type) {
    return NextResponse.json({
      success: false,
      error: 'Missing parameters: tmdbId and type are required'
    }, { status: 400 })
  }

  // Validate type
  if (type !== 'movie' && type !== 'tv') {
    return NextResponse.json({
      success: false,
      error: 'Invalid type: must be "movie" or "tv"'
    }, { status: 400 })
  }

  // For TV shows, validate season and episode
  if (type === 'tv' && (!season || !episode)) {
    return NextResponse.json({
      success: false,
      error: 'Missing parameters: season and episode are required for TV shows'
    }, { status: 400 })
  }

  // Check cache first
  const cacheKey = `${type}-${tmdbId}${type === 'tv' ? `-${season}-${episode}` : ''}`
  const cached = cache.get<any>(cacheKey)
  if (cached) {
    console.log(`[Stream API] Cache hit for ${cacheKey}`)
    return NextResponse.json({
      success: true,
      ...cached,
      cached: true
    })
  }

  // Construct embed URL for fallback
  const embedUrl = type === 'movie'
    ? `https://moviesapi.club/movie/${tmdbId}`
    : `https://moviesapi.club/tv/${tmdbId}-${season}-${episode}`

  console.log(`[Stream API] Extracting stream using @movie-web/providers for TMDB ID: ${tmdbId}`)

  try {
    const providers = getProvidersInstance()

    // Build media object for providers
    const media: any = {
      type: type === 'movie' ? 'movie' : 'show',
      tmdbId
    }

    // Add season/episode for TV shows
    if (type === 'tv') {
      media.season = {
        number: parseInt(season!),
        tmdbId: tmdbId // Can use same tmdbId for now
      }
      media.episode = {
        number: parseInt(episode!),
        tmdbId: tmdbId // Can use same tmdbId for now
      }
    }

    console.log('[Stream API] Media object:', JSON.stringify(media))

    // Run all providers to find a stream
    const output = await providers.runAll({ media })

    if (output && output.stream) {
      // Extract the best quality stream URL
      let streamUrl: string | null = null
      let quality = 'unknown'

      const stream = output.stream

      // Try to get the highest quality available
      if (stream.type === 'file' && stream.qualities) {
        // Try in order: 1080, 720, 480, 360, etc.
        const qualities = Object.keys(stream.qualities).sort((a, b) => parseInt(b) - parseInt(a))
        if (qualities.length > 0) {
          const bestQuality = qualities[0]
          const qualityEntry = (stream.qualities as any)[bestQuality]
          if (qualityEntry && qualityEntry.url) {
            streamUrl = qualityEntry.url
            quality = bestQuality
          }
        }
      } else if (stream.type === 'hls' && (stream as any).playlist) {
        // HLS stream
        streamUrl = (stream as any).playlist
        quality = 'HLS'
      }

      if (streamUrl) {
        const result = {
          streamUrl,
          embedUrl,
          type,
          quality,
          sourceId: output.sourceId,
          subtitles: stream.captions || [],
          cached: false
        }

        // Cache the result
        cache.set(cacheKey, result)

        console.log(`[Stream API] Successfully extracted ${quality} stream for ${cacheKey} from ${output.sourceId}`)

        return NextResponse.json({
          success: true,
          ...result
        })
      }
    }

    // If extraction failed, return fallback info
    console.log(`[Stream API] Could not extract stream for ${cacheKey}`)

    return NextResponse.json({
      success: false,
      error: 'Could not extract video URL',
      embedUrl,
      message: 'Falling back to embed player (sync not available)'
    })

  } catch (error: any) {
    console.error('[Stream API] Error:', error.message)

    return NextResponse.json({
      success: false,
      error: error.message || 'Extraction failed',
      embedUrl,
      message: 'Falling back to embed player (sync not available)'
    })
  }
}
