'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Room, User, Video, ChatMessage, VideoState } from '@/types'
import { v4 as uuidv4 } from 'uuid'

interface UseRoomProps {
  roomId: string
  userName: string
}

interface UseRoomReturn {
  room: Room | null
  user: User | null
  messages: ChatMessage[]
  isConnected: boolean
  isHost: boolean
  joinRoom: (roomName?: string) => Promise<void>
  leaveRoom: () => Promise<void>
  updateVideo: (video: Video | null) => Promise<void>
  updateVideoState: (state: VideoState) => Promise<void>
  sendMessage: (message: string) => Promise<void>
}

export function useRoom({ roomId, userName }: UseRoomProps): UseRoomReturn {
  const [room, setRoom] = useState<Room | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [user, setUser] = useState<User | null>(null)

  const userIdRef = useRef<string>()
  const eventSourceRef = useRef<EventSource | null>(null)

  // Initialize user ID
  if (!userIdRef.current) {
    userIdRef.current = uuidv4()
  }

  const userId = userIdRef.current

  const isHost = user?.isHost || false

  const connectToRoom = useCallback(() => {
    if (!userId || eventSourceRef.current) return

    const eventSource = new EventSource(
      `/api/rooms/${roomId}/events?userId=${userId}`
    )

    eventSource.onopen = () => {
      setIsConnected(true)
    }

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)

        switch (data.type) {
          case 'room-state':
            setRoom(data.room)
            setMessages(data.messages || [])

            // Update user reference
            const currentUser = data.room?.users?.find((u: User) => u.id === userId)
            if (currentUser) {
              setUser(currentUser)
            }
            break

          case 'room-closed':
            setRoom(null)
            setIsConnected(false)
            eventSource.close()
            break
        }
      } catch (error) {
        console.error('Error parsing SSE data:', error)
      }
    }

    eventSource.onerror = () => {
      setIsConnected(false)
      eventSource.close()
      eventSourceRef.current = null

      // Attempt reconnection after 3 seconds
      setTimeout(() => {
        if (!eventSourceRef.current) {
          connectToRoom()
        }
      }, 3000)
    }

    eventSourceRef.current = eventSource
  }, [roomId, userId])

  const joinRoom = useCallback(async (roomName?: string) => {
    try {
      const userObj: User = {
        id: userId,
        name: userName,
        isHost: false
      }

      const action = roomName ? 'create' : 'join'
      const body = roomName
        ? { action, user: { ...userObj, isHost: true }, roomName }
        : { action, user: userObj }

      const response = await fetch(`/api/rooms/${roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (response.ok) {
        const data = await response.json()
        setRoom(data.room)

        const currentUser = data.room.users.find((u: User) => u.id === userId)
        if (currentUser) {
          setUser(currentUser)
        }

        connectToRoom()
      } else {
        throw new Error('Failed to join room')
      }
    } catch (error) {
      console.error('Error joining room:', error)
    }
  }, [roomId, userName, userId, connectToRoom])

  const leaveRoom = useCallback(async () => {
    try {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }

      await fetch(`/api/rooms/${roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'leave',
          user: { id: userId }
        })
      })

      setRoom(null)
      setUser(null)
      setIsConnected(false)
    } catch (error) {
      console.error('Error leaving room:', error)
    }
  }, [roomId, userId])

  const updateVideo = useCallback(async (video: Video | null) => {
    if (!isHost) return

    try {
      await fetch(`/api/rooms/${roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateVideo',
          video
        })
      })
    } catch (error) {
      console.error('Error updating video:', error)
    }
  }, [roomId, isHost])

  const updateVideoState = useCallback(async (state: VideoState) => {
    if (!isHost) return

    try {
      await fetch(`/api/rooms/${roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateState',
          isPlaying: state.isPlaying,
          currentTime: state.currentTime
        })
      })
    } catch (error) {
      console.error('Error updating video state:', error)
    }
  }, [roomId, isHost])

  const sendMessage = useCallback(async (message: string) => {
    if (!user) return

    try {
      await fetch(`/api/rooms/${roomId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          username: user.name,
          message
        })
      })
    } catch (error) {
      console.error('Error sending message:', error)
    }
  }, [roomId, user])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
    }
  }, [])

  return {
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
  }
}