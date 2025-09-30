'use client'

import { useState, useEffect } from 'react'
import { searchMulti, getTVSeasons, getPosterUrl, TMDBSearchResult, TVSeasonInfo } from '@/lib/tmdbApi'
import { Video } from '@/types'

interface MovieSearchPanelProps {
  onVideoSelect: (video: Video) => void
  isHost: boolean
}

export default function MovieSearchPanel({ onVideoSelect, isHost }: MovieSearchPanelProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<TMDBSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedType, setSelectedType] = useState<'movie' | 'tv'>('movie')
  const [selectedItem, setSelectedItem] = useState<TMDBSearchResult | null>(null)
  const [tvSeasons, setTvSeasons] = useState<TVSeasonInfo[]>([])
  const [selectedSeason, setSelectedSeason] = useState<number>(1)
  const [selectedEpisode, setSelectedEpisode] = useState<number>(1)
  const [isLoadingSeasons, setIsLoadingSeasons] = useState(false)

  // Search with debounce
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }

    const timer = setTimeout(async () => {
      setIsSearching(true)
      try {
        const results = await searchMulti(searchQuery)
        setSearchResults(results)
      } catch (error) {
        console.error('Search error:', error)
      } finally {
        setIsSearching(false)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [searchQuery])

  // Load TV seasons when item is selected
  useEffect(() => {
    if (selectedItem && selectedItem.media_type === 'tv') {
      setIsLoadingSeasons(true)
      getTVSeasons(selectedItem.id)
        .then(seasons => {
          setTvSeasons(seasons)
          if (seasons.length > 0) {
            setSelectedSeason(seasons[0].season_number)
            setSelectedEpisode(1)
          }
        })
        .finally(() => setIsLoadingSeasons(false))
    }
  }, [selectedItem])

  const handleItemClick = (item: TMDBSearchResult) => {
    setSelectedItem(item)
  }

  const handlePlayClick = (item?: TMDBSearchResult) => {
    const itemToPlay = item || selectedItem
    if (!itemToPlay) return

    const isMovie = itemToPlay.media_type === 'movie'
    const tmdbId = itemToPlay.id.toString()

    // Construct embed URL
    const embedUrl = isMovie
      ? `https://moviesapi.club/movie/${tmdbId}`
      : `https://moviesapi.club/tv/${tmdbId}-${selectedSeason}-${selectedEpisode}`

    const video: Video = {
      id: `${itemToPlay.media_type}-${tmdbId}${isMovie ? '' : `-${selectedSeason}-${selectedEpisode}`}`,
      title: isMovie
        ? `${itemToPlay.title || itemToPlay.name}${itemToPlay.release_date ? ` (${itemToPlay.release_date.split('-')[0]})` : ''}`
        : `${itemToPlay.name || itemToPlay.title} S${selectedSeason}E${selectedEpisode}`,
      type: isMovie ? 'movie' : 'tv',
      url: embedUrl,
      thumbnail: getPosterUrl(itemToPlay.poster_path),
      tmdbId,
      season: isMovie ? undefined : selectedSeason,
      episode: isMovie ? undefined : selectedEpisode,
      year: itemToPlay.release_date
        ? parseInt(itemToPlay.release_date.split('-')[0])
        : itemToPlay.first_air_date
        ? parseInt(itemToPlay.first_air_date.split('-')[0])
        : undefined
    }

    onVideoSelect(video)

    // Reset state
    setSelectedItem(null)
    setSearchQuery('')
    setSearchResults([])
  }

  const filteredResults = searchResults.filter(item => item.media_type === selectedType)

  const maxEpisodes = tvSeasons.find(s => s.season_number === selectedSeason)?.episode_count || 20

  if (!isHost) {
    return (
      <div className="bg-gray-800/50 rounded-lg p-4 text-center text-gray-400">
        Only the host can search for movies/TV shows
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Type Selector */}
      <div className="flex gap-2">
        <button
          onClick={() => setSelectedType('movie')}
          className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
            selectedType === 'movie'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/50'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Movies
        </button>
        <button
          onClick={() => setSelectedType('tv')}
          className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
            selectedType === 'tv'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/50'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          TV Shows
        </button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={`Search for ${selectedType === 'movie' ? 'movies' : 'TV shows'}...`}
          className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 pr-10"
        />
        {isSearching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
          </div>
        )}
      </div>

      {/* Selected Item Details (for TV shows) */}
      {selectedItem && selectedItem.media_type === 'tv' && (
        <div className="bg-gradient-to-br from-blue-900/50 to-purple-900/50 rounded-lg p-4 border border-blue-500/30">
          <div className="flex gap-4 mb-4">
            <img
              src={getPosterUrl(selectedItem.poster_path)}
              alt={selectedItem.name || 'TV Show'}
              className="w-20 h-30 object-cover rounded-lg"
              onError={(e) => {
                e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="80" height="120" viewBox="0 0 80 120"%3E%3Crect width="80" height="120" fill="%23374151"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%239CA3AF" font-size="30"%3E📺%3C/text%3E%3C/svg%3E'
              }}
            />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white mb-1">
                {selectedItem.name || selectedItem.title}
              </h3>
              <p className="text-sm text-gray-300 line-clamp-2">
                {selectedItem.overview || 'No description available'}
              </p>
            </div>
          </div>

          {isLoadingSeasons ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent mx-auto"></div>
              <p className="text-sm text-gray-300 mt-2">Loading seasons...</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {/* Season Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Season</label>
                <select
                  value={selectedSeason}
                  onChange={(e) => {
                    setSelectedSeason(parseInt(e.target.value))
                    setSelectedEpisode(1)
                  }}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {tvSeasons.map((season) => (
                    <option key={season.season_number} value={season.season_number}>
                      Season {season.season_number}
                    </option>
                  ))}
                </select>
              </div>

              {/* Episode Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Episode</label>
                <select
                  value={selectedEpisode}
                  onChange={(e) => setSelectedEpisode(parseInt(e.target.value))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {Array.from({ length: maxEpisodes }, (_, i) => i + 1).map((ep) => (
                    <option key={ep} value={ep}>
                      Episode {ep}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="flex gap-2 mt-4">
            <button
              onClick={() => handlePlayClick()}
              disabled={isLoadingSeasons}
              className="flex-1 py-2 px-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium shadow-lg"
            >
              Play Now
            </button>
            <button
              onClick={() => setSelectedItem(null)}
              className="py-2 px-4 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Search Results Grid */}
      {searchResults.length > 0 && !selectedItem && (
        <div className="relative">
          <style jsx>{`
            .movie-scroll::-webkit-scrollbar {
              width: 10px;
            }
            .movie-scroll::-webkit-scrollbar-track {
              background: linear-gradient(to bottom, #1a1a2e, #16213e);
              border-radius: 10px;
              margin: 4px 0;
            }
            .movie-scroll::-webkit-scrollbar-thumb {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              border-radius: 10px;
              border: 2px solid transparent;
              background-clip: padding-box;
            }
            .movie-scroll::-webkit-scrollbar-thumb:hover {
              background: linear-gradient(135deg, #764ba2 0%, #f093fb 100%);
              border: 2px solid transparent;
              background-clip: padding-box;
            }
          `}</style>
          <div
            className="movie-scroll max-h-96 overflow-y-auto overflow-x-hidden pr-3"
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: '#667eea #1a1a2e'
            }}
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pb-2">
            {filteredResults.map((item) => (
              <div
                key={`${item.media_type}-${item.id}`}
                onClick={() => {
                  if (item.media_type === 'movie') {
                    handlePlayClick(item)
                  } else {
                    handleItemClick(item)
                  }
                }}
                className="group cursor-pointer bg-gray-800 rounded-lg overflow-hidden hover:ring-2 hover:ring-purple-500 transition-all hover:shadow-lg hover:shadow-purple-500/50"
              >
                <div className="aspect-[2/3] relative">
                  <img
                    src={getPosterUrl(item.poster_path)}
                    alt={item.title || item.name || 'Poster'}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="300" viewBox="0 0 200 300"%3E%3Crect width="200" height="300" fill="%23374151"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%239CA3AF" font-size="48"%3E🎬%3C/text%3E%3C/svg%3E'
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                    <div className="text-xs text-white">
                      {item.vote_average && (
                        <div className="flex items-center gap-1 mb-1">
                          <span className="text-yellow-400">★</span>
                          {item.vote_average.toFixed(1)}
                        </div>
                      )}
                      <div className="text-gray-300">
                        {item.release_date?.split('-')[0] || item.first_air_date?.split('-')[0]}
                      </div>
                    </div>
                  </div>
                  {/* Type Badge */}
                  <div className={`absolute top-2 right-2 px-2 py-1 rounded text-xs font-medium ${
                    item.media_type === 'movie'
                      ? 'bg-purple-600 text-white'
                      : 'bg-blue-600 text-white'
                  }`}>
                    {item.media_type === 'movie' ? 'Movie' : 'TV'}
                  </div>
                </div>
                <div className="p-2">
                  <h3 className="text-sm font-medium text-white line-clamp-2 leading-tight">
                    {item.title || item.name}
                  </h3>
                </div>
              </div>
            ))}
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {searchQuery && !isSearching && filteredResults.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          <div className="text-4xl mb-2">🔍</div>
          <p>No {selectedType === 'movie' ? 'movies' : 'TV shows'} found</p>
          <p className="text-sm mt-1">Try a different search term</p>
        </div>
      )}

      {/* Instructions */}
      {!searchQuery && (
        <div className="text-center py-8 text-gray-400">
          <div className="text-5xl mb-3">
            {selectedType === 'movie' ? '🎬' : '📺'}
          </div>
          <p className="text-lg font-medium mb-1">
            Search for {selectedType === 'movie' ? 'Movies' : 'TV Shows'}
          </p>
          <p className="text-sm">
            Type a title to get started
          </p>
        </div>
      )}

    </div>
  )
}