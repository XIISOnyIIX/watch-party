import { NextRequest, NextResponse } from 'next/server'
import NodeCache from 'node-cache'
import puppeteer from 'puppeteer'

// Cache extracted URLs for 2 hours to reduce API calls
const cache = new NodeCache({ stdTTL: 7200 })

// Browser instance (reuse for performance)
let browserInstance: any = null

async function getBrowser() {
  if (!browserInstance) {
    browserInstance = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    })
  }
  return browserInstance
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

  // Construct embed URL
  const embedUrl = type === 'movie'
    ? `https://moviesapi.club/movie/${tmdbId}`
    : `https://moviesapi.club/tv/${tmdbId}-${season}-${episode}`

  console.log(`[Stream API] Extracting stream using Puppeteer for: ${embedUrl}`)

  let page: any = null

  try {
    const browser = await getBrowser()
    page = await browser.newPage()

    // Intercept network requests to capture video URLs
    const videoUrls: string[] = []

    await page.setRequestInterception(true)
    page.on('request', (req: any) => {
      req.continue()
    })

    page.on('response', async (response: any) => {
      const url = response.url()
      const contentType = response.headers()['content-type'] || ''

      // Capture video URLs (mp4, m3u8, etc.)
      if (
        url.includes('.mp4') ||
        url.includes('.m3u8') ||
        contentType.includes('video') ||
        contentType.includes('mpegurl')
      ) {
        console.log(`[Stream API] Captured video URL: ${url}`)
        videoUrls.push(url)
      }
    })

    // Navigate to embed page
    await page.goto(embedUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000
    })

    // Wait a bit for video to load
    await page.waitForTimeout(3000)

    // Try to extract video src from page
    const videoSrc = await page.evaluate(() => {
      const video = document.querySelector('video') as HTMLVideoElement | null
      if (video && video.src) {
        return video.src
      }

      // Check for source elements
      const source = document.querySelector('video source') as HTMLSourceElement | null
      if (source && source.src) {
        return source.src
      }

      return null
    })

    await page.close()
    page = null

    // Use extracted video src or captured URL
    const streamUrl = videoSrc || (videoUrls.length > 0 ? videoUrls[0] : null)

    if (streamUrl && streamUrl !== 'about:blank') {
      const result = {
        streamUrl,
        embedUrl,
        type,
        quality: 'auto',
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
    console.log(`[Stream API] Could not extract stream for ${cacheKey}`)

    return NextResponse.json({
      success: false,
      error: 'Could not extract video URL',
      embedUrl,
      message: 'Falling back to embed player (sync not available)'
    })

  } catch (error: any) {
    console.error('[Stream API] Error:', error.message)

    // Close page if still open
    if (page) {
      try {
        await page.close()
      } catch (e) {
        // Ignore close errors
      }
    }

    return NextResponse.json({
      success: false,
      error: error.message || 'Extraction failed',
      embedUrl,
      message: 'Falling back to embed player (sync not available)'
    })
  }
}
