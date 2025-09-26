import { NextRequest, NextResponse } from 'next/server'
import { databaseService } from '@/lib/database'

// This route is now simplified since we use Supabase real-time subscriptions
// It mainly handles room recreation if needed and initial room state
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const resolvedParams = await params
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const roomName = searchParams.get('roomName') || 'Watch Party Room'
    const userName = searchParams.get('userName') || 'Anonymous User'

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
    }

    console.log(`[Events API] Checking room ${resolvedParams.roomId} for user ${userId}`)

    let room = await databaseService.getRoom(resolvedParams.roomId)

    // If room doesn't exist, create it
    if (!room) {
      console.log(`[Events API] Room ${resolvedParams.roomId} not found, creating it`)

      const hostUser = {
        id: userId,
        name: userName,
        isHost: true
      }

      room = await databaseService.createRoom(resolvedParams.roomId, roomName, hostUser)

      if (!room) {
        return NextResponse.json({ error: 'Failed to create room' }, { status: 500 })
      }

      console.log(`[Events API] Successfully created room ${resolvedParams.roomId}`)
    } else {
      // Room exists, just join the user if not already joined
      const userInRoom = room.users.some(u => u.id === userId)
      if (!userInRoom) {
        console.log(`[Events API] Adding user ${userId} to existing room ${resolvedParams.roomId}`)

        const joinUser = {
          id: userId,
          name: userName,
          isHost: false
        }

        room = await databaseService.joinRoom(resolvedParams.roomId, joinUser)

        if (!room) {
          return NextResponse.json({ error: 'Failed to join room' }, { status: 500 })
        }
      }
    }

    // Get messages for the room
    const messages = await databaseService.getMessages(resolvedParams.roomId)

    return NextResponse.json({
      room,
      messages,
      message: 'Room ready for Supabase real-time subscriptions'
    })

  } catch (error) {
    console.error('[Events API] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}