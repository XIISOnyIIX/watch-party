'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { v4 as uuidv4 } from 'uuid'

export default function HomePage() {
  const [roomName, setRoomName] = useState('')
  const [userName, setUserName] = useState('')
  const [joinRoomId, setJoinRoomId] = useState('')
  const router = useRouter()

  const createRoom = () => {
    if (!roomName || !userName) return
    const roomId = uuidv4()
    localStorage.setItem('userName', userName)
    router.push(`/room/${roomId}?name=${encodeURIComponent(roomName)}`)
  }

  const joinRoom = () => {
    if (!joinRoomId || !userName) return
    localStorage.setItem('userName', userName)
    router.push(`/room/${joinRoomId}`)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-6xl font-bold text-white mb-4">
            Watch Party
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Watch YouTube videos and local files together with friends in perfect sync
          </p>
        </div>

        <div className="max-w-md mx-auto space-y-8">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20">
            <h2 className="text-2xl font-semibold text-white mb-6">Create Room</h2>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Your name"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <input
                type="text"
                placeholder="Room name"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <button
                onClick={createRoom}
                disabled={!roomName || !userName}
                className="w-full py-3 px-6 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:from-purple-700 hover:to-pink-700 transition-all"
              >
                Create Room
              </button>
            </div>
          </div>

          <div className="text-center">
            <span className="text-gray-400">or</span>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20">
            <h2 className="text-2xl font-semibold text-white mb-6">Join Room</h2>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Your name"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <input
                type="text"
                placeholder="Room ID"
                value={joinRoomId}
                onChange={(e) => setJoinRoomId(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <button
                onClick={joinRoom}
                disabled={!joinRoomId || !userName}
                className="w-full py-3 px-6 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:from-blue-700 hover:to-cyan-700 transition-all"
              >
                Join Room
              </button>
            </div>
          </div>
        </div>

        <div className="mt-16 text-center">
          <div className="inline-flex items-center space-x-8 text-gray-300">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span>YouTube Support</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span>Local Files</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span>Real-time Sync</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}