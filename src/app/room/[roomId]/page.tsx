'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import VideoPlayer from '@/components/VideoPlayer'
import VideoControls from '@/components/VideoControls'
import ChatPanel from '@/components/ChatPanel'
import { useRoom } from '@/lib/useRoom'
import { Video, VideoState } from '@/types'

interface RoomPageProps {
  params: Promise<{
    roomId: string
  }>
}

export default function RoomPage({ params }: RoomPageProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const roomName = searchParams.get('name')

  const [userName, setUserName] = useState<string>('')
  const [showNameDialog, setShowNameDialog] = useState(true)
  const [tempName, setTempName] = useState('')
  const [roomId, setRoomId] = useState<string>('')
  const [isLeaving, setIsLeaving] = useState(false)

  useEffect(() => {
    params.then(p => setRoomId(p.roomId))
  }, [params])

  const {
    room,
    user,
    messages,
    isConnected,
    isHost,
    joinRoom,
    leaveRoom,
    updateVideo,
    updateVideoState,
    sendMessage
  } = useRoom({
    roomId,
    userName
  })

  // Prevent auto-scrolling caused by room state updates only (never for messages)
  useEffect(() => {
    // Save current scroll position
    const scrollY = window.scrollY

    // Only restore scroll position for room updates, not message updates
    const restoreScroll = () => {
      if (window.scrollY !== scrollY) {
        window.scrollTo(0, scrollY)
      }
    }

    // Use timeout to check after renders
    const timeoutId = setTimeout(restoreScroll, 30)

    return () => clearTimeout(timeoutId)
  }, [room]) // Only run when room updates, NOT when messages update

  useEffect(() => {
    const savedName = localStorage.getItem('userName')
    if (savedName) {
      setUserName(savedName)
      setShowNameDialog(false)
    }
  }, [])

  useEffect(() => {
    if (userName && !room && roomId && !isLeaving) {
      joinRoom(roomName || undefined)
    }
  }, [userName, room, joinRoom, roomName, roomId, isLeaving])

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!tempName.trim()) return

    setUserName(tempName.trim())
    localStorage.setItem('userName', tempName.trim())
    setShowNameDialog(false)
  }

  const handleVideoAdd = async (video: Video) => {
    await updateVideo(video)
  }

  const handleVideoStateChange = async (state: VideoState) => {
    await updateVideoState(state)
  }

  const handleLeaveRoom = async () => {
    setIsLeaving(true)
    await leaveRoom()
    router.push('/')
  }

  const copyRoomLink = () => {
    const url = `${window.location.origin}/room/${roomId}`
    navigator.clipboard.writeText(url)
    // You could add a toast notification here
  }

  if (showNameDialog) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 max-w-md w-full">
          <h2 className="text-2xl font-semibold text-white mb-6 text-center">
            Enter Your Name
          </h2>
          <form onSubmit={handleNameSubmit}>
            <input
              type="text"
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              placeholder="Your name"
              className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 mb-4"
              autoFocus
            />
            <button
              type="submit"
              disabled={!tempName.trim()}
              className="w-full py-3 px-6 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:from-purple-700 hover:to-pink-700 transition-all"
            >
              Join Room
            </button>
          </form>
        </div>
      </div>
    )
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent mx-auto mb-4"></div>
          <p>Connecting to room...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      {/* Header */}
      <div className="bg-black/20 backdrop-blur-sm border-b border-white/10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-white">{room.name}</h1>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                <span className="text-sm text-gray-300">
                  {isConnected ? 'Connected' : 'Reconnecting...'}
                </span>
                {!isConnected && (
                  <div className="text-xs text-yellow-400">
                    Check console for details
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={copyRoomLink}
                className="px-4 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors text-sm"
              >
                Copy Link
              </button>
              <button
                onClick={handleLeaveRoom}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Leave Room
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Video Section */}
          <div className="lg:col-span-3 space-y-6">
            {/* Video Player */}
            <VideoPlayer
              video={room.currentVideo}
              isPlaying={room.isPlaying}
              currentTime={room.currentTime}
              onStateChange={handleVideoStateChange}
              isHost={isHost}
            />

            {/* Current Video Info */}
            {room.currentVideo && (
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-4">
                <div className="flex items-start gap-4">
                  {room.currentVideo.thumbnail && (
                    <img
                      src={room.currentVideo.thumbnail}
                      alt={room.currentVideo.title}
                      className="w-20 h-15 object-cover rounded-lg"
                    />
                  )}
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white mb-1">
                      {room.currentVideo.title}
                    </h3>
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <span className="flex items-center gap-1">
                        {room.currentVideo.type === 'youtube' ? (
                          <>🎥 YouTube</>
                        ) : (
                          <>📁 Local File</>
                        )}
                      </span>
                      <span className="flex items-center gap-1">
                        {room.isPlaying ? '▶️ Playing' : '⏸️ Paused'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Video Controls */}
            <VideoControls
              onVideoAdd={handleVideoAdd}
              isHost={isHost}
            />
          </div>

          {/* Chat Section */}
          <div className="lg:col-span-1">
            <ChatPanel
              messages={messages}
              users={room.users}
              currentUser={user}
              onSendMessage={sendMessage}
              className="h-[600px]"
            />
          </div>
        </div>
      </div>

      {/* Room Info Footer */}
      <div className="mt-8 pb-6 text-center">
        <div className="text-sm text-gray-400">
          Room ID: <span className="font-mono bg-gray-800 px-2 py-1 rounded">{roomId}</span>
        </div>
      </div>
    </div>
  )
}