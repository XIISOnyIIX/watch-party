'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import YouTube, { YouTubeProps } from 'react-youtube'
import { Video, VideoState } from '@/types'

interface VideoPlayerProps {
  video: Video | null
  isPlaying: boolean
  currentTime: number
  onStateChange?: (state: VideoState) => void
  onReady?: () => void
  isHost?: boolean
}

export default function VideoPlayer({
  video,
  isPlaying,
  currentTime,
  onStateChange,
  onReady,
  isHost = false
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const youtubeRef = useRef<any>(null)
  const [isReady, setIsReady] = useState(false)
  const [localCurrentTime, setLocalCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  const syncTimeRef = useRef<number>(0)
  const lastSyncTimeRef = useRef<number>(0)

  const getYouTubeVideoId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/
    const match = url.match(regExp)
    return match && match[2].length === 11 ? match[2] : null
  }

  const handleYouTubeReady: YouTubeProps['onReady'] = (event) => {
    youtubeRef.current = event.target
    setIsReady(true)

    // Prevent auto-focus that causes scroll jumps
    if (event.target.getIframe) {
      const iframe = event.target.getIframe()
      if (iframe) {
        iframe.style.outline = 'none'
        iframe.tabIndex = -1
      }
    }

    onReady?.()
  }

  const handleYouTubeStateChange: YouTubeProps['onStateChange'] = (event) => {
    if (!isHost) return

    const player = event.target
    const playerState = event.data
    const currentTime = player.getCurrentTime()
    const duration = player.getDuration()

    setLocalCurrentTime(currentTime)
    setDuration(duration)

    onStateChange?.({
      isPlaying: playerState === 1, // YT.PlayerState.PLAYING
      currentTime,
      duration
    })
  }

  const handleLocalVideoTimeUpdate = () => {
    if (!videoRef.current || !isHost) return

    const current = videoRef.current.currentTime
    const dur = videoRef.current.duration

    setLocalCurrentTime(current)
    setDuration(dur)

    onStateChange?.({
      isPlaying: !videoRef.current.paused,
      currentTime: current,
      duration: dur
    })
  }

  const handleLocalVideoPlay = () => {
    if (!isHost) return
    handleLocalVideoTimeUpdate()
  }

  const handleLocalVideoPause = () => {
    if (!isHost) return
    handleLocalVideoTimeUpdate()
  }

  const syncVideo = useCallback(() => {
    const now = Date.now()
    if (now - lastSyncTimeRef.current < 1000) return // Limit sync frequency

    if (video?.type === 'youtube' && youtubeRef.current && isReady) {
      const ytCurrentTime = youtubeRef.current.getCurrentTime()
      const timeDiff = Math.abs(ytCurrentTime - currentTime)

      if (timeDiff > 2) { // Sync if difference > 2 seconds
        youtubeRef.current.seekTo(currentTime, true)
      }

      const playerState = youtubeRef.current.getPlayerState()
      const shouldBePlaying = isPlaying
      const isCurrentlyPlaying = playerState === 1

      if (shouldBePlaying && !isCurrentlyPlaying) {
        youtubeRef.current.playVideo()
      } else if (!shouldBePlaying && isCurrentlyPlaying) {
        youtubeRef.current.pauseVideo()
      }

      lastSyncTimeRef.current = now
    } else if (video?.type === 'local' && videoRef.current) {
      const localCurrentTime = videoRef.current.currentTime
      const timeDiff = Math.abs(localCurrentTime - currentTime)

      if (timeDiff > 2) { // Sync if difference > 2 seconds
        videoRef.current.currentTime = currentTime
      }

      if (isPlaying && videoRef.current.paused) {
        videoRef.current.play()
      } else if (!isPlaying && !videoRef.current.paused) {
        videoRef.current.pause()
      }

      lastSyncTimeRef.current = now
    }
  }, [video, isPlaying, currentTime, isReady])

  // Sync video state when receiving updates from other users
  useEffect(() => {
    if (!isHost && video) {
      syncVideo()
    }
  }, [isPlaying, currentTime, syncVideo, isHost, video])

  const youtubeOpts: YouTubeProps['opts'] = {
    height: '100%',
    width: '100%',
    playerVars: {
      autoplay: 0,
      controls: isHost ? 1 : 0,
      disablekb: isHost ? 0 : 1,
      modestbranding: 1,
      rel: 0,
      iv_load_policy: 3, // Disable annotations
      fs: 0, // Disable fullscreen
    },
  }

  if (!video) {
    return (
      <div className="aspect-video bg-gray-900 rounded-lg flex items-center justify-center">
        <div className="text-center text-gray-400">
          <div className="text-6xl mb-4">🎬</div>
          <p className="text-xl">No video selected</p>
          <p className="text-sm mt-2">Add a YouTube URL or upload a local file to get started</p>
        </div>
      </div>
    )
  }

  return (
    <div className="aspect-video bg-black rounded-lg overflow-hidden relative" style={{ minHeight: '200px' }}>
      {video.type === 'youtube' ? (
        <div className="w-full h-full">
          <YouTube
            videoId={getYouTubeVideoId(video.url) || ''}
            opts={youtubeOpts}
            onReady={handleYouTubeReady}
            onStateChange={handleYouTubeStateChange}
            className="w-full h-full"
            style={{ pointerEvents: isHost ? 'auto' : 'none' }}
          />
        </div>
      ) : (
        <video
          ref={videoRef}
          src={video.url}
          className="w-full h-full"
          controls={isHost}
          onTimeUpdate={handleLocalVideoTimeUpdate}
          onPlay={handleLocalVideoPlay}
          onPause={handleLocalVideoPause}
          onLoadedMetadata={() => {
            setIsReady(true)
            onReady?.()
          }}
        />
      )}

      {!isHost && (
        <div className="absolute inset-0 bg-transparent pointer-events-none" />
      )}

      <div className="absolute bottom-4 right-4 bg-black/50 text-white px-3 py-1 rounded text-sm">
        {isHost ? 'Host' : 'Viewer'}
      </div>
    </div>
  )
}