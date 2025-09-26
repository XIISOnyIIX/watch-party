'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Room, User, Video, ChatMessage, VideoState } from '@/types'
import { v4 as uuidv4 } from 'uuid'
import { supabase } from '@/lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

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
  promoteUser: (targetUserId: string) => Promise<void>
  demoteUser: (targetUserId: string) => Promise<void>
}

export function useRoom({ roomId, userName }: UseRoomProps): UseRoomReturn {
  const [room, setRoom] = useState<Room | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [user, setUser] = useState<User | null>(null)

  const userIdRef = useRef<string>()
  const channelRef = useRef<RealtimeChannel | null>(null)

  // Initialize user ID
  if (!userIdRef.current) {
    userIdRef.current = uuidv4()
  }

  const userId = userIdRef.current

  const isHost = user?.isHost || false

  // Helper function to refetch room data
  const refetchRoomData = useCallback(async () => {
    try {
      const response = await fetch(`/api/rooms/${roomId}`)
      if (response.ok) {
        const data = await response.json()
        setRoom(data.room)
        const currentUser = data.room?.users?.find((u: User) => u.id === userId)
        if (currentUser) {
          setUser(currentUser)
        }
      } else if (response.status === 404) {
        // Room was deleted (host left), clear local state
        console.log('[useRoom] Room was deleted, clearing state')
        setRoom(null)
        setUser(null)
        setIsConnected(false)
        // Stop polling will be handled by the cleanup effect
        if (channelRef.current) {
          channelRef.current.unsubscribe()
          channelRef.current = null
        }
      }
    } catch (error) {
      console.error('[useRoom] Error refetching room:', error)
    }
  }, [roomId, userId])

  // Helper function to refetch messages
  const refetchMessages = useCallback(async () => {
    try {
      const response = await fetch(`/api/rooms/${roomId}/chat`)
      if (response.ok) {
        const data = await response.json()
        setMessages(data.messages)
      }
    } catch (error) {
      console.error('[useRoom] Error refetching messages:', error)
    }
  }, [roomId])

  // Polling fallback for when real-time doesn't work
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) return

    console.log('[useRoom] Starting polling fallback')
    pollingIntervalRef.current = setInterval(() => {
      refetchRoomData()
      refetchMessages()
    }, 3000) // Poll every 3 seconds
  }, [refetchRoomData, refetchMessages])

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
      console.log('[useRoom] Stopped polling')
    }
  }, [])

  const connectToRoom = useCallback(async () => {
    if (!userId || !roomId || channelRef.current) return

    console.log(`[useRoom] Connecting to room ${roomId} as user ${userId}`)

    // First, initialize room via API (handles creation if needed)
    try {
      const params = new URLSearchParams({
        userId,
        userName: userName || 'Anonymous User',
        roomName: room?.name || 'Watch Party Room'
      })

      const response = await fetch(`/api/rooms/${roomId}/events?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        console.log(`[useRoom] Room ${roomId} initialized`)
        setRoom(data.room)
        setMessages(data.messages || [])

        // Update user reference
        const currentUser = data.room?.users?.find((u: User) => u.id === userId)
        if (currentUser) {
          setUser(currentUser)
        }
      }
    } catch (error) {
      console.error('[useRoom] Error initializing room:', error)
    }

    // Try to set up Supabase real-time subscription (with fallback to polling)
    const channel = supabase.channel(`room-${roomId}`, {
      config: {
        broadcast: { self: false },
        presence: { key: userId }
      }
    })

    // Simplified single subscription for all changes
    channel
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'rooms',
        filter: `id=eq.${roomId}`
      }, (payload) => {
        console.log('[useRoom] Room data changed, refetching...')
        refetchRoomData()
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'room_users',
        filter: `room_id=eq.${roomId}`
      }, (payload) => {
        console.log('[useRoom] Room users changed, refetching...')
        refetchRoomData()
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `room_id=eq.${roomId}`
      }, (payload) => {
        console.log('[useRoom] New message, refetching...')
        refetchMessages()
      })

    // Subscribe with timeout handling
    const subscribeTimeout = setTimeout(() => {
      console.log('[useRoom] Real-time subscription timed out, falling back to polling')
      setIsConnected(true) // Set connected even if real-time fails
      startPolling()
    }, 5000) // 5 second timeout

    channel.subscribe((status) => {
      console.log(`[useRoom] Subscription status for room ${roomId}:`, status)
      if (status === 'SUBSCRIBED') {
        clearTimeout(subscribeTimeout)
        setIsConnected(true)
        console.log('[useRoom] Real-time connection successful')
      } else if (status === 'CLOSED' || status === 'TIMED_OUT') {
        clearTimeout(subscribeTimeout)
        console.log('[useRoom] Real-time connection failed, falling back to polling')
        setIsConnected(true) // Still set connected for polling fallback
        startPolling()
      }
    })

    channelRef.current = channel
  }, [roomId, userId, userName, room?.name, refetchRoomData, refetchMessages, startPolling])

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

        // Better error handling for mobile users
        if (response.status === 409) {
          throw new Error('You are already in this room. Please refresh the page.')
        } else if (response.status >= 500) {
          throw new Error('Server error. Please try again in a moment.')
        } else if (response.status === 404) {
          throw new Error('Room not found. Please check the room link.')
        } else {
          throw new Error(`Failed to ${action} room. Please try again.`)
        }
      }
    } catch (error) {
      console.error(`[useRoom] Error ${roomName ? 'creating' : 'joining'} room:`, error)
    }
  }, [roomId, userName, userId, connectToRoom])

  const leaveRoom = useCallback(async () => {
    try {
      // Stop polling
      stopPolling()

      // Unsubscribe from real-time
      if (channelRef.current) {
        channelRef.current.unsubscribe()
        channelRef.current = null
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
  }, [roomId, userId, stopPolling])

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

  const promoteUser = useCallback(async (targetUserId: string) => {
    if (!isHost || !roomId || !user) {
      console.warn('[useRoom] Cannot promote user: not host or missing data')
      return
    }

    try {
      console.log(`[useRoom] Promoting user ${targetUserId} in room ${roomId}`)
      const response = await fetch(`/api/rooms/${roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'promoteUser',
          user: { id: user.id },
          targetUserId
        })
      })

      if (!response.ok) {
        const errorData = await response.text()
        console.error(`[useRoom] Failed to promote user:`, response.status, errorData)
      } else {
        console.log(`[useRoom] User ${targetUserId} promoted successfully`)
      }
    } catch (error) {
      console.error('[useRoom] Error promoting user:', error)
    }
  }, [roomId, isHost, user])

  const demoteUser = useCallback(async (targetUserId: string) => {
    if (!isHost || !roomId || !user) {
      console.warn('[useRoom] Cannot demote user: not host or missing data')
      return
    }

    try {
      console.log(`[useRoom] Demoting user ${targetUserId} in room ${roomId}`)
      const response = await fetch(`/api/rooms/${roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'demoteUser',
          user: { id: user.id },
          targetUserId
        })
      })

      if (!response.ok) {
        const errorData = await response.text()
        console.error(`[useRoom] Failed to demote user:`, response.status, errorData)
      } else {
        console.log(`[useRoom] User ${targetUserId} demoted successfully`)
      }
    } catch (error) {
      console.error('[useRoom] Error demoting user:', error)
    }
  }, [roomId, isHost, user])

  // Periodic cleanup for inactive rooms/users
  useEffect(() => {
    const runCleanup = async () => {
      try {
        await fetch('/api/cleanup', { method: 'POST' })
      } catch (error) {
        console.log('[useRoom] Cleanup failed (non-critical):', error)
      }
    }

    // Run cleanup every 10 minutes
    const cleanupInterval = setInterval(runCleanup, 10 * 60 * 1000)

    return () => {
      clearInterval(cleanupInterval)
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling()
      if (channelRef.current) {
        channelRef.current.unsubscribe()
      }
    }
  }, [stopPolling])

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
    sendMessage,
    promoteUser,
    demoteUser
  }
}