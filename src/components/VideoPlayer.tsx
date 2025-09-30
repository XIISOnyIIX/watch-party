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
  const [isBuffering, setIsBuffering] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [isScrolling, setIsScrolling] = useState(false)
  const [videoError, setVideoError] = useState<string>('')
  const [retryCount, setRetryCount] = useState(0)

  const syncTimeRef = useRef<number>(0)
  const lastSyncTimeRef = useRef<number>(0)

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
             window.innerWidth < 768
    }
    setIsMobile(checkMobile())
  }, [])

  // Handle scroll events to reduce sync during scrolling on all devices
  useEffect(() => {
    let scrollTimeout: NodeJS.Timeout

    const handleScroll = () => {
      setIsScrolling(true)
      clearTimeout(scrollTimeout)
      scrollTimeout = setTimeout(() => {
        setIsScrolling(false)
      }, 200) // Stop considering as scrolling after 200ms
    }

    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', handleScroll)
      clearTimeout(scrollTimeout)
    }
  }, [])

  // Reset error state when video changes
  useEffect(() => {
    setVideoError('')
    setRetryCount(0)
    setIsBuffering(false)
  }, [video?.id])

  // Retry function for failed videos
  const retryVideoLoad = useCallback(() => {
    if (retryCount >= 3) {
      setVideoError('Video failed to load after multiple attempts. The file may not be accessible from your network.')
      return
    }

    console.log(`[VideoPlayer] Retrying video load, attempt ${retryCount + 1}`)
    setVideoError('')
    setIsBuffering(true)
    setRetryCount(prev => prev + 1)

    if (videoRef.current) {
      // Force reload by changing src
      const currentSrc = videoRef.current.src
      videoRef.current.src = ''
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.src = currentSrc
          videoRef.current.load()
        }
      }, 100)
    }
  }, [retryCount])

  // Video error handling with retry logic
  const handleVideoError = useCallback((error: any) => {
    console.error('[VideoPlayer] Video error:', error)

    const errorElement = error.target || videoRef.current
    if (errorElement) {
      const networkState = errorElement.networkState
      const errorCode = errorElement.error?.code

      let errorMessage = 'Video failed to load'

      switch (errorCode) {
        case 1: // MEDIA_ERR_ABORTED
          errorMessage = 'Video loading was aborted'
          break
        case 2: // MEDIA_ERR_NETWORK
          errorMessage = 'Network error while loading video'
          break
        case 3: // MEDIA_ERR_DECODE
          errorMessage = 'Video format not supported'
          break
        case 4: // MEDIA_ERR_SRC_NOT_SUPPORTED
          errorMessage = 'Video source not accessible'
          break
      }

      console.log(`[VideoPlayer] Video error details: networkState=${networkState}, errorCode=${errorCode}`)

      if (retryCount < 3) {
        setTimeout(retryVideoLoad, 1000) // Retry after 1 second
      } else {
        setVideoError(errorMessage)
        setIsBuffering(false)
      }
    }
  }, [retryCount, retryVideoLoad])

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

    // Mobile-specific sync frequency - less aggressive
    const syncFrequency = isMobile ? 2000 : 1000 // 2s for mobile, 1s for desktop
    if (now - lastSyncTimeRef.current < syncFrequency) return

    if (video?.type === 'youtube' && youtubeRef.current && isReady) {
      const ytCurrentTime = youtubeRef.current.getCurrentTime()
      const timeDiff = Math.abs(ytCurrentTime - currentTime)

      // Mobile-specific sync threshold - more tolerant
      const syncThreshold = isMobile ? 3 : 2 // 3s for mobile, 2s for desktop

      if (timeDiff > syncThreshold) {
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
      const video_element = videoRef.current
      const localCurrentTime = video_element.currentTime
      const timeDiff = Math.abs(localCurrentTime - currentTime)

      // Mobile-specific sync threshold - more tolerant
      const syncThreshold = isMobile ? 4 : 2 // 4s for mobile, 2s for desktop

      // Less aggressive buffering detection - only when really needed
      const isActuallyBuffering = video_element.readyState < 2 // HAVE_CURRENT_DATA
      setIsBuffering(isActuallyBuffering)

      // Don't sync if actively seeking, buffering, or scrolling
      if (video_element.seeking || (isMobile && isActuallyBuffering) || isScrolling) {
        return
      }

      if (timeDiff > syncThreshold) {
        video_element.currentTime = currentTime
      }

      // More careful play/pause handling for mobile
      if (isPlaying && video_element.paused) {
        const playPromise = video_element.play()
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.log('[VideoPlayer] Play failed:', error)
          })
        }
      } else if (!isPlaying && !video_element.paused) {
        video_element.pause()
      }

      lastSyncTimeRef.current = now
    }
  }, [video, isPlaying, currentTime, isReady, isMobile, isScrolling])

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
          <p className="text-sm mt-2">Add a YouTube URL, upload a local file, or search for movies/TV shows to get started</p>
        </div>
      </div>
    )
  }

  const youtubeVideoId = video.type === 'youtube' ? getYouTubeVideoId(video.url) : null

  return (
    <div className="aspect-video bg-black rounded-lg overflow-hidden relative" style={{ minHeight: '200px' }}>
      {video.type === 'youtube' ? (
        <div className="w-full h-full">
          <YouTube
            videoId={youtubeVideoId || ''}
            opts={youtubeOpts}
            onReady={handleYouTubeReady}
            onStateChange={handleYouTubeStateChange}
            className="w-full h-full"
            style={{ pointerEvents: isHost ? 'auto' : 'none' }}
          />
        </div>
      ) : video.type === 'movie' || video.type === 'tv' ? (
        <iframe
          src={video.url}
          className="w-full h-full border-0"
          allowFullScreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          referrerPolicy="origin"
        />
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
          onWaiting={() => setIsBuffering(true)}
          onCanPlay={() => setIsBuffering(false)}
          onLoadStart={() => setIsBuffering(true)}
          onLoadedData={() => setIsBuffering(false)}
          onError={handleVideoError}
          onStalled={() => {
            console.log('[VideoPlayer] Video stalled')
            setIsBuffering(true)
          }}
          onSuspend={() => {
            console.log('[VideoPlayer] Video suspended')
            setIsBuffering(false)
          }}
          // Mobile-specific attributes
          playsInline={true}
          preload={isMobile ? "metadata" : "auto"}
          // Prevent mobile video taking over screen and improve scroll performance
          style={{
            objectFit: 'contain',
            maxWidth: '100%',
            maxHeight: '100%',
            // Improve scroll performance on mobile
            willChange: isMobile ? 'auto' : 'transform',
            backfaceVisibility: 'hidden',
            perspective: 1000
          }}
        />
      )}

      {!isHost && (
        <div className="absolute inset-0 bg-transparent pointer-events-none" />
      )}

      {/* Buffering indicator */}
      {isBuffering && !videoError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <div className="bg-black/70 rounded-lg px-4 py-2 flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
            <span className="text-white text-sm">
              {retryCount > 0 ? `Retrying... (${retryCount}/3)` : 'Buffering...'}
            </span>
          </div>
        </div>
      )}

      {/* Video error indicator */}
      {videoError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="bg-red-900/80 rounded-lg px-6 py-4 text-center max-w-md mx-4">
            <div className="text-red-200 text-sm mb-3">{videoError}</div>
            {retryCount < 3 && (
              <button
                onClick={retryVideoLoad}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
              >
                Retry ({retryCount}/3)
              </button>
            )}
          </div>
        </div>
      )}

      <div className="absolute bottom-4 right-4 bg-black/50 text-white px-3 py-1 rounded text-sm">
        {isHost ? 'Host' : 'Viewer'} {isMobile && '📱'}
      </div>
    </div>
  )
}