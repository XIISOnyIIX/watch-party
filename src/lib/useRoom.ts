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
    if (!userId || !roomId || eventSourceRef.current) return

    console.log(`[useRoom] Connecting to room ${roomId} as user ${userId}`)
    // Include room name and user name to help with room recreation if needed
    const params = new URLSearchParams({
      userId,
      userName: userName || 'Anonymous User',
      roomName: room?.name || 'Watch Party Room'
    })
    const eventSource = new EventSource(
      `/api/rooms/${roomId}/events?${params.toString()}`
    )

    eventSource.onopen = () => {
      console.log(`[useRoom] SSE connection opened for room ${roomId}`)
      setIsConnected(true)
    }

    eventSource.onmessage = (event) => {
      try {
        // Skip heartbeat events
        if (event.type === 'heartbeat') {
          console.log(`[useRoom] Heartbeat received for room ${roomId}`)
          return
        }

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
            console.log(`[useRoom] Room ${roomId} was closed`)
            setRoom(null)
            setIsConnected(false)
            eventSource.close()
            break
        }
      } catch (error) {
        console.error('[useRoom] Error parsing SSE data:', error)
      }
    }

    eventSource.onerror = (error) => {
      console.log(`[useRoom] SSE connection error for room ${roomId}:`, error)
      setIsConnected(false)
      eventSource.close()
      eventSourceRef.current = null

      // Attempt reconnection with exponential backoff
      let retryCount = 0
      const maxRetries = 5
      const baseDelay = 2000 // Start with 2 seconds

      const attemptReconnect = () => {
        if (retryCount >= maxRetries) {
          console.log(`[useRoom] Max reconnection attempts reached for room ${roomId}`)
          console.log(`[useRoom] Final status: Room may need to be recreated manually`)
          return
        }

        retryCount++
        const delay = Math.min(baseDelay * Math.pow(2, retryCount - 1), 30000) // Max 30 seconds

        console.log(`[useRoom] Reconnection attempt ${retryCount}/${maxRetries} in ${delay}ms for room ${roomId}`)

        setTimeout(() => {
          if (!eventSourceRef.current && roomId && userId) {
            console.log(`[useRoom] Attempting reconnection ${retryCount}/${maxRetries} for room ${roomId}`)

            // Before reconnecting, check if room still exists
            fetch(`/api/rooms/${roomId}`)
              .then(response => {
                if (!response.ok) {
                  console.log(`[useRoom] Room ${roomId} no longer exists (${response.status}), may need manual recreation`)
                }
                // Connect anyway - SSE endpoint has room recreation logic
                connectToRoom()
              })
              .catch(() => {
                console.log(`[useRoom] Failed to check room status, proceeding with reconnection`)
                connectToRoom()
              })
          } else {
            console.log(`[useRoom] Skipping reconnection - connection may already exist or missing parameters`)
          }
        }, delay)
      }

      attemptReconnect()
    }

    eventSourceRef.current = eventSource
  }, [roomId, userId])

  const joinRoom = useCallback(async (roomName?: string) => {
    if (!roomId || !userName) {
      console.error('[useRoom] Cannot join room: missing roomId or userName')
      return
    }

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

      console.log(`[useRoom] ${action === 'create' ? 'Creating' : 'Joining'} room ${roomId} as ${userName}`)

      const response = await fetch(`/api/rooms/${roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (response.ok) {
        const data = await response.json()
        console.log(`[useRoom] Successfully ${action === 'create' ? 'created' : 'joined'} room ${roomId}`)
        setRoom(data.room)

        const currentUser = data.room.users.find((u: User) => u.id === userId)
        if (currentUser) {
          setUser(currentUser)
        }

        // Add a small delay to avoid race condition with serverless functions
        console.log(`[useRoom] Waiting 1 second before connecting to SSE to avoid race condition`)
        setTimeout(() => {
          connectToRoom()
        }, 1000) // 1 second delay
      } else {
        const errorData = await response.text()
        console.error(`[useRoom] Failed to ${action} room ${roomId}:`, response.status, errorData)
        throw new Error(`Failed to ${action} room: ${response.status}`)
      }
    } catch (error) {
      console.error(`[useRoom] Error ${roomName ? 'creating' : 'joining'} room:`, error)
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
    if (!isHost || !roomId) {
      console.warn('[useRoom] Cannot update video: not host or no roomId')
      return
    }

    try {
      console.log(`[useRoom] Updating video in room ${roomId}:`, video?.title || 'null')
      const response = await fetch(`/api/rooms/${roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateVideo',
          video
        })
      })

      if (!response.ok) {
        const errorData = await response.text()
        console.error(`[useRoom] Failed to update video:`, response.status, errorData)
        throw new Error(`Failed to update video: ${response.status}`)
      }

      console.log(`[useRoom] Video updated successfully in room ${roomId}`)
    } catch (error) {
      console.error('[useRoom] Error updating video:', error)
    }
  }, [roomId, isHost])

  const updateVideoState = useCallback(async (state: VideoState) => {
    if (!isHost || !roomId) return

    try {
      const response = await fetch(`/api/rooms/${roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateState',
          isPlaying: state.isPlaying,
          currentTime: state.currentTime
        })
      })

      if (!response.ok) {
        const errorData = await response.text()
        console.error(`[useRoom] Failed to update video state:`, response.status, errorData)
        // Don't throw here as video state updates are frequent
      }
    } catch (error) {
      console.error('[useRoom] Error updating video state:', error)
    }
  }, [roomId, isHost])

  const sendMessage = useCallback(async (message: string) => {
    if (!user || !roomId) return

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