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
    return new Response('Room not found', { status: 404 })
  }

  // Server-sent events setup
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      let isClosed = false

      const sendEvent = (data: any) => {
        if (isClosed) return
        try {
          const message = `data: ${JSON.stringify(data)}\n\n`
          controller.enqueue(encoder.encode(message))
        } catch (error) {
          console.log('SSE send error:', error)
          isClosed = true
        }
      }

      const closeController = () => {
        if (isClosed) return
        isClosed = true
        try {
          controller.close()
        } catch (error) {
          console.log('Controller already closed')
        }
      }

      // Send initial room state
      sendEvent({
        type: 'room-state',
        room: room,
        messages: chatStore.getMessages(resolvedParams.roomId)
      })

      // Set up polling for updates
      const interval = setInterval(() => {
        if (isClosed) {
          clearInterval(interval)
          return
        }

        const currentRoom = roomStore.getRoom(resolvedParams.roomId)
        if (!currentRoom) {
          sendEvent({ type: 'room-closed' })
          closeController()
          clearInterval(interval)
          return
        }

        sendEvent({
          type: 'room-state',
          room: currentRoom,
          messages: chatStore.getMessages(resolvedParams.roomId)
        })
      }, 2000) // Poll every 2 seconds

      // Clean up on close
      const cleanup = () => {
        clearInterval(interval)
        // Remove user from room if they disconnect
        roomStore.leaveRoom(resolvedParams.roomId, userId)
        closeController()
      }

      // Handle client disconnect
      request.signal.addEventListener('abort', cleanup)

      // Clean up after 30 minutes instead of 5
      setTimeout(() => {
        cleanup()
      }, 1800000) // 30 minutes
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