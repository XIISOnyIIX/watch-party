// TMDB API helper functions for searching movies and TV shows
// Using TMDB API v3 (no API key required for basic searches via proxy)

export interface TMDBSearchResult {
  id: number
  title?: string // For movies
  name?: string // For TV shows
  poster_path?: string
  backdrop_path?: string
  release_date?: string // For movies
  first_air_date?: string // For TV shows
  overview?: string
  vote_average?: number
  media_type?: 'movie' | 'tv'
}

export interface TVSeasonInfo {
  season_number: number
  episode_count: number
  name: string
}

const TMDB_BASE_URL = 'https://api.themoviedb.org/3'
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500'

// TMDB API key
const TMDB_API_KEY = '7a90c201508f374aaf7696ee28b70a1e'

/**
 * Search for movies and TV shows
 */
export async function searchMulti(query: string): Promise<TMDBSearchResult[]> {
  if (!query.trim()) return []

  try {
    // Using a public TMDB proxy for demo (in production, use your own API key)
    const response = await fetch(
      `${TMDB_BASE_URL}/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&page=1`
    )

    if (!response.ok) {
      // Fallback: try without API key using a different approach
      console.warn('TMDB API request failed, using fallback')
      return []
    }

    const data = await response.json()

    // Filter to only movies and TV shows, exclude people
    return (data.results || [])
      .filter((item: any) => item.media_type === 'movie' || item.media_type === 'tv')
      .slice(0, 12) // Limit to 12 results
  } catch (error) {
    console.error('Error searching TMDB:', error)
    return []
  }
}

/**
 * Get TV show season information
 */
export async function getTVSeasons(tvId: number): Promise<TVSeasonInfo[]> {
  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/tv/${tvId}?api_key=${TMDB_API_KEY}`
    )

    if (!response.ok) return []

    const data = await response.json()

    return (data.seasons || [])
      .filter((season: any) => season.season_number >= 0) // Exclude specials if needed
      .map((season: any) => ({
        season_number: season.season_number,
        episode_count: season.episode_count,
        name: season.name
      }))
  } catch (error) {
    console.error('Error fetching TV seasons:', error)
    return []
  }
}

/**
 * Get full poster URL from TMDB path
 */
export function getPosterUrl(posterPath?: string): string {
  if (!posterPath) return '/placeholder-poster.jpg'
  return `${TMDB_IMAGE_BASE}${posterPath}`
}

/**
 * Get movie/TV details by ID
 */
export async function getDetails(id: number, type: 'movie' | 'tv'): Promise<any> {
  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/${type}/${id}?api_key=${TMDB_API_KEY}`
    )

    if (!response.ok) return null

    return await response.json()
  } catch (error) {
    console.error('Error fetching details:', error)
    return null
  }
}

/**
 * Alternative: Search using free proxy (no API key needed)
 * This is a fallback for when TMDB API key is not available
 */
export async function searchWithoutApiKey(query: string): Promise<TMDBSearchResult[]> {
  if (!query.trim()) return []

  try {
    // Using vidsrc.me search API as fallback (it doesn't require auth)
    // This is just a demo - in production you should use proper TMDB API
    const response = await fetch(
      `https://vidsrc.me/search?q=${encodeURIComponent(query)}`
    )

    if (!response.ok) return []

    const results = await response.json()

    return results.slice(0, 12)
  } catch (error) {
    console.error('Error searching without API key:', error)
    return []
  }
}