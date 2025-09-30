import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import * as cheerio from 'cheerio'
import NodeCache from 'node-cache'

// Cache extracted URLs for 2 hours to reduce API calls
const cache = new NodeCache({ stdTTL: 7200 })

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

  // Construct embed URL
  const embedUrl = type === 'movie'
    ? `https://moviesapi.club/movie/${tmdbId}`
    : `https://moviesapi.club/tv/${tmdbId}-${season}-${episode}`

  console.log(`[Stream API] Extracting stream from: ${embedUrl}`)

  try {
    // Fetch the embed page
    const response = await axios.get(embedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': 'https://moviesapi.club/'
      },
      timeout: 10000 // 10 second timeout
    })

    const $ = cheerio.load(response.data)

    let videoUrl: string | null = null
    let subtitles: any[] = []

    // Method 1: Look for direct video source tags
    const videoSource = $('video source').attr('src')
    if (videoSource) {
      console.log(`[Stream API] Found video source tag: ${videoSource}`)
      videoUrl = videoSource
    }

    // Method 2: Look for m3u8 URLs in script tags (HLS streams)
    if (!videoUrl) {
      const scripts = $('script').toArray()
      for (const script of scripts) {
        const scriptContent = $(script).html() || ''

        // Look for m3u8 URLs
        const m3u8Match = scriptContent.match(/https?:\/\/[^"'`\s]+\.m3u8[^"'`\s]*/i)
        if (m3u8Match) {
          console.log(`[Stream API] Found m3u8 URL in script: ${m3u8Match[0]}`)
          videoUrl = m3u8Match[0]
          break
        }

        // Look for mp4 URLs
        if (!videoUrl) {
          const mp4Match = scriptContent.match(/https?:\/\/[^"'`\s]+\.mp4[^"'`\s]*/i)
          if (mp4Match) {
            console.log(`[Stream API] Found mp4 URL in script: ${mp4Match[0]}`)
            videoUrl = mp4Match[0]
            break
          }
        }
      }
    }

    // Method 3: Look for iframe with video player
    if (!videoUrl) {
      const iframe = $('iframe').first()
      const iframeSrc = iframe.attr('src')

      if (iframeSrc && !iframeSrc.includes('about:blank')) {
        console.log(`[Stream API] Found iframe: ${iframeSrc}`)

        // Try to fetch iframe content
        try {
          const fullIframeUrl = iframeSrc.startsWith('http') ? iframeSrc : `https:${iframeSrc}`
          const iframeResponse = await axios.get(fullIframeUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Referer': embedUrl
            },
            timeout: 10000
          })

          const $iframe = cheerio.load(iframeResponse.data)

          // Try to find video in iframe
          const iframeVideoSource = $iframe('video source').attr('src')
          if (iframeVideoSource) {
            console.log(`[Stream API] Found video in iframe: ${iframeVideoSource}`)
            videoUrl = iframeVideoSource
          }

          // Look for m3u8 in iframe scripts
          if (!videoUrl) {
            const iframeScripts = $iframe('script').toArray()
            for (const script of iframeScripts) {
              const scriptContent = $iframe(script).html() || ''
              const m3u8Match = scriptContent.match(/https?:\/\/[^"'`\s]+\.m3u8[^"'`\s]*/i)
              if (m3u8Match) {
                console.log(`[Stream API] Found m3u8 in iframe script: ${m3u8Match[0]}`)
                videoUrl = m3u8Match[0]
                break
              }
            }
          }
        } catch (iframeError) {
          console.log(`[Stream API] Could not fetch iframe content:`, iframeError)
        }
      }
    }

    // If we found a video URL, cache and return it
    if (videoUrl) {
      const result = {
        streamUrl: videoUrl,
        embedUrl,
        type,
        subtitles,
        cached: false
      }

      // Cache the result
      cache.set(cacheKey, result)

      console.log(`[Stream API] Successfully extracted stream for ${cacheKey}`)

      return NextResponse.json({
        success: true,
        ...result
      })
    }

    // If extraction failed, return fallback info
    console.log(`[Stream API] Could not extract stream from ${embedUrl}`)

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
