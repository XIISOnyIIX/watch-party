'use client'

import { useState, useRef } from 'react'
import { Video } from '@/types'
import MovieSearchPanel from './MovieSearchPanel'

interface VideoControlsProps {
  onVideoAdd: (video: Video) => void
  onVideoClear: () => void
  currentVideo: Video | null
  isHost: boolean
  className?: string
}

type TabType = 'youtube' | 'upload' | 'movies'

export default function VideoControls({ onVideoAdd, onVideoClear, currentVideo, isHost, className = '' }: VideoControlsProps) {
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>('youtube')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const extractYouTubeTitle = async (videoId: string): Promise<string> => {
    try {
      // This would require YouTube API key in production
      // For demo purposes, return a generic title
      return `YouTube Video (${videoId})`
    } catch {
      return 'YouTube Video'
    }
  }

  const getYouTubeThumbnail = async (videoId: string): Promise<string> => {
    // Try different thumbnail qualities in order of preference
    const thumbnailQualities = [
      'maxresdefault.jpg',  // 1280x720
      'hqdefault.jpg',      // 480x360
      'mqdefault.jpg',      // 320x180
      'default.jpg'         // 120x90 (always exists)
    ]

    for (const quality of thumbnailQualities) {
      const url = `https://img.youtube.com/vi/${videoId}/${quality}`
      try {
        const response = await fetch(url, { method: 'HEAD' })
        if (response.ok) {
          return url
        }
      } catch (error) {
        // Continue to next quality
      }
    }

    // Fallback to default (always exists)
    return `https://img.youtube.com/vi/${videoId}/default.jpg`
  }

  const handleYouTubeAdd = async () => {
    if (!youtubeUrl || !isHost) return

    const videoId = extractVideoId(youtubeUrl)
    if (!videoId) {
      alert('Please enter a valid YouTube URL')
      return
    }

    // Auto-clear current video if it's a different type
    if (currentVideo && currentVideo.type === 'local') {
      console.log('[VideoControls] Auto-clearing local video to add YouTube video')
      onVideoClear()
      // Small delay to ensure cleanup completes
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    const title = await extractYouTubeTitle(videoId)
    const thumbnail = await getYouTubeThumbnail(videoId)

    const video: Video = {
      id: videoId,
      title,
      type: 'youtube',
      url: youtubeUrl,
      thumbnail
    }

    onVideoAdd(video)
    setYoutubeUrl('')
  }

  const extractVideoId = (url: string): string | null => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/
    const match = url.match(regExp)
    return match && match[2].length === 11 ? match[2] : null
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !isHost) return

    console.log('[VideoControls] Starting file upload:', file.name)
    setIsUploading(true)

    // Auto-clear current video if it's a different type
    if (currentVideo && currentVideo.type === 'youtube') {
      console.log('[VideoControls] Auto-clearing YouTube video to add local video')
      onVideoClear()
      // Small delay to ensure cleanup completes
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (result.success) {
        console.log('[VideoControls] Upload successful, creating video object:', result)
        const video: Video = {
          id: result.videoId,  // Use the UUID from the upload API
          title: result.filename,  // Use original filename for display
          type: 'local',
          url: result.url,
          thumbnail: undefined  // No thumbnail for local videos
        }

        console.log('[VideoControls] Adding video to room:', video)
        onVideoAdd(video)
      } else {
        console.error('[VideoControls] Upload failed:', result.error)
        alert(result.error || 'Upload failed')
      }
    } catch (error) {
      console.error('[VideoControls] Upload error:', error)
      alert('Upload failed: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  if (!isHost) {
    return (
      <div className={`bg-gray-800/50 rounded-lg p-4 ${className}`}>
        <p className="text-gray-400 text-center">Only the host can add videos</p>
      </div>
    )
  }

  return (
    <div className={`bg-gray-800/50 backdrop-blur-sm rounded-lg p-6 ${className}`}>
      <h3 className="text-lg font-semibold text-white mb-4">Add Video</h3>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('youtube')}
          className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
            activeTab === 'youtube'
              ? 'bg-red-600 text-white shadow-lg'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          YouTube
        </button>
        <button
          onClick={() => setActiveTab('upload')}
          className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
            activeTab === 'upload'
              ? 'bg-blue-600 text-white shadow-lg'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Upload
        </button>
        <button
          onClick={() => setActiveTab('movies')}
          className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
            activeTab === 'movies'
              ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Movies/TV
        </button>
      </div>

      <div className="space-y-4">
        {/* YouTube Tab */}
        {activeTab === 'youtube' && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              YouTube URL
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <button
                onClick={handleYouTubeAdd}
                disabled={!youtubeUrl}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                <span>🎥</span>
                Add
              </button>
            </div>
          </div>
        )}

        {/* Upload Tab */}
        {activeTab === 'upload' && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Upload Video File
            </label>
            <div className="relative">
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/webm,video/ogg,video/quicktime"
                onChange={handleFileUpload}
                disabled={isUploading}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="w-full px-4 py-3 bg-blue-600 border border-blue-500 rounded-lg text-white hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 font-medium"
              >
                {isUploading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Uploading...
                  </>
                ) : (
                  <>
                    <span>📁</span>
                    Choose Video File
                  </>
                )}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Supports MP4, WebM, OGG. Max 2GB.
            </p>
          </div>
        )}

        {/* Movies/TV Tab */}
        {activeTab === 'movies' && (
          <MovieSearchPanel onVideoSelect={onVideoAdd} isHost={isHost} />
        )}

        {/* Clear Video Button */}
        {currentVideo && (
          <div className="pt-4 border-t border-gray-600">
            <button
              onClick={onVideoClear}
              className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors flex items-center justify-center gap-2"
            >
              <span>✕</span>
              Clear Current Video
            </button>
          </div>
        )}
      </div>
    </div>
  )
}