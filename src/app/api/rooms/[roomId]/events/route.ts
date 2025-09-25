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
      const sendEvent = (data: any) => {
        const message = `data: ${JSON.stringify(data)}\n\n`
        controller.enqueue(encoder.encode(message))
      }

      // Send initial room state
      sendEvent({
        type: 'room-state',
        room: room,
        messages: chatStore.getMessages(resolvedParams.roomId)
      })

      // Set up polling for updates
      const interval = setInterval(() => {
        const currentRoom = roomStore.getRoom(resolvedParams.roomId)
        if (!currentRoom) {
          sendEvent({ type: 'room-closed' })
          controller.close()
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
      }

      // Handle client disconnect
      request.signal.addEventListener('abort', cleanup)

      // Clean up after 5 minutes of inactivity
      setTimeout(() => {
        cleanup()
        controller.close()
      }, 300000)
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