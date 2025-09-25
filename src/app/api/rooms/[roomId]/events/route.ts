import { NextRequest } from 'next/server'
import { roomStore, chatStore } from '@/lib/store'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const resolvedParams = await params
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  const lastUpdate = searchParams.get('lastUpdate')

  if (!userId) {
    return new Response('Missing userId', { status: 400 })
  }

  const room = roomStore.getRoom(resolvedParams.roomId)
  if (!room) {
    console.log(`[SSE] Room ${resolvedParams.roomId} not found for user ${userId}`)
    return new Response('Room not found', { status: 404 })
  }

  console.log(`[SSE] Starting SSE connection for user ${userId} in room ${resolvedParams.roomId}`)

  // Server-sent events setup
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      let isClosed = false

      let lastSentData = ''
      const sendEvent = (data: any, force = false) => {
        if (isClosed) return
        try {
          const dataString = JSON.stringify(data)
          // Only send if data changed or forced (reduces redundant updates)
          if (force || dataString !== lastSentData) {
            const message = `data: ${dataString}\n\n`
            controller.enqueue(encoder.encode(message))
            lastSentData = dataString
          }
        } catch (error) {
          console.log('[SSE] Send error:', error)
          isClosed = true
          closeController()
        }
      }

      // Send heartbeat to maintain connection
      const sendHeartbeat = () => {
        if (isClosed) return
        try {
          const heartbeat = `event: heartbeat\ndata: ${Date.now()}\n\n`
          controller.enqueue(encoder.encode(heartbeat))
        } catch (error) {
          console.log('[SSE] Heartbeat error:', error)
        }
      }

      const closeController = () => {
        if (isClosed) return
        console.log(`[SSE] Closing connection for user ${userId} in room ${resolvedParams.roomId}`)
        isClosed = true
        try {
          controller.close()
        } catch (error) {
          console.log('[SSE] Controller already closed:', error)
        }
      }

      // Send initial room state
      sendEvent({
        type: 'room-state',
        room: room,
        messages: chatStore.getMessages(resolvedParams.roomId)
      }, true) // Force send initial state

      // Set up polling for updates (reduced frequency for stability)
      const updateInterval = setInterval(() => {
        if (isClosed) {
          clearInterval(updateInterval)
          clearInterval(heartbeatInterval)
          return
        }

        const currentRoom = roomStore.getRoom(resolvedParams.roomId)
        if (!currentRoom) {
          console.log(`[SSE] Room ${resolvedParams.roomId} no longer exists, closing connection`)
          sendEvent({ type: 'room-closed' }, true)
          closeController()
          clearInterval(updateInterval)
          clearInterval(heartbeatInterval)
          return
        }

        // Check if user is still in room
        const userStillInRoom = currentRoom.users.some(u => u.id === userId)
        if (!userStillInRoom) {
          console.log(`[SSE] User ${userId} no longer in room ${resolvedParams.roomId}, closing connection`)
          closeController()
          clearInterval(updateInterval)
          clearInterval(heartbeatInterval)
          return
        }

        sendEvent({
          type: 'room-state',
          room: currentRoom,
          messages: chatStore.getMessages(resolvedParams.roomId)
        })
      }, 5000) // Poll every 5 seconds (reduced from 2 seconds for stability)

      // Send heartbeat every 30 seconds
      const heartbeatInterval = setInterval(() => {
        if (!isClosed) {
          sendHeartbeat()
        } else {
          clearInterval(heartbeatInterval)
        }
      }, 30000)

      // Clean up on close
      let timeoutId: NodeJS.Timeout

      const cleanup = () => {
        console.log(`[SSE] Cleaning up connection for user ${userId} in room ${resolvedParams.roomId}`)
        clearInterval(updateInterval)
        clearInterval(heartbeatInterval)
        if (timeoutId) {
          clearTimeout(timeoutId)
        }
        // Remove user from room if they disconnect
        const leftRoom = roomStore.leaveRoom(resolvedParams.roomId, userId)
        if (leftRoom) {
          console.log(`[SSE] User ${userId} removed from room ${resolvedParams.roomId} on disconnect`)
        }
        closeController()
      }

      // Handle client disconnect
      request.signal.addEventListener('abort', cleanup)

      // Clean up after 60 minutes (increased from 30 minutes)
      timeoutId = setTimeout(() => {
        console.log(`[SSE] Connection timeout for user ${userId} in room ${resolvedParams.roomId}`)
        cleanup()
      }, 3600000) // 60 minutes
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}