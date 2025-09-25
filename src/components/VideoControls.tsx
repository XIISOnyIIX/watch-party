'use client'

import { useState, useRef } from 'react'
import { Video } from '@/types'

interface VideoControlsProps {
  onVideoAdd: (video: Video) => void
  isHost: boolean
  className?: string
}

export default function VideoControls({ onVideoAdd, isHost, className = '' }: VideoControlsProps) {
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [isUploading, setIsUploading] = useState(false)
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

  const handleYouTubeAdd = async () => {
    if (!youtubeUrl || !isHost) return

    const videoId = extractVideoId(youtubeUrl)
    if (!videoId) {
      alert('Please enter a valid YouTube URL')
      return
    }

    const title = await extractYouTubeTitle(videoId)
    const video: Video = {
      id: videoId,
      title,
      type: 'youtube',
      url: youtubeUrl,
      thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
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

    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (result.success) {
        const video: Video = {
          id: result.filename,
          title: file.name,
          type: 'local',
          url: result.url
        }

        onVideoAdd(video)
      } else {
        alert(result.error || 'Upload failed')
      }
    } catch (error) {
      console.error('Upload error:', error)
      alert('Upload failed')
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

      <div className="space-y-4">
        {/* YouTube URL Input */}
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
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Add
            </button>
          </div>
        </div>

        <div className="flex items-center">
          <div className="flex-1 h-px bg-gray-600"></div>
          <span className="px-3 text-gray-400 text-sm">or</span>
          <div className="flex-1 h-px bg-gray-600"></div>
        </div>

        {/* File Upload */}
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
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-gray-300 hover:bg-gray-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {isUploading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-transparent"></div>
                  Uploading...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Choose Video File
                </>
              )}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Supports MP4, WebM, OGG. Max 50MB.
          </p>
        </div>
      </div>
    </div>
  )
}