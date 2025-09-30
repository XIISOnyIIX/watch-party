import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const mode = searchParams.get('mode') || 'explore' // 'explore' or 'test'

  try {
    // Import the providers package
    const {
      makeProviders,
      makeStandardFetcher,
      targets,
      getBuiltinSources
    } = await import('@movie-web/providers')

    if (mode === 'explore') {
      // Explore mode: show what's available
      console.log('[Test Providers] Exploring library...')

      const builtinSources = getBuiltinSources()
      console.log('[Test Providers] Built-in sources:', builtinSources)

      return NextResponse.json({
        message: 'Available sources',
        sources: builtinSources,
        targets: Object.keys(targets)
      })
    }

    if (mode === 'test') {
      // Test mode: try to get a stream URL
      console.log('[Test Providers] Testing stream extraction...')

      // Create providers instance
      const providersInstance = makeProviders({
        fetcher: makeStandardFetcher(fetch),
        target: targets.NATIVE // For Node.js
      })

      console.log('[Test Providers] Providers instance created')

      // Test with a known popular movie (Inception - TMDB ID: 27205)
      const tmdbId = searchParams.get('tmdbId') || '27205'
      const title = searchParams.get('title') || 'Inception'
      const year = searchParams.get('year') || '2010'

      const media = {
        type: 'movie',
        title,
        releaseYear: parseInt(year),
        tmdbId
      }

      console.log('[Test Providers] Scraping media:', media)

      const output = await providersInstance.runAll({
        media: media as any
      })

      console.log('[Test Providers] Output:', JSON.stringify(output, null, 2))

      return NextResponse.json({
        message: 'Stream extraction test',
        media,
        output
      })
    }

    return NextResponse.json({ error: 'Invalid mode. Use ?mode=explore or ?mode=test' })

  } catch (error: any) {
    console.error('[Test Providers] Error:', error)
    return NextResponse.json({
      error: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}
