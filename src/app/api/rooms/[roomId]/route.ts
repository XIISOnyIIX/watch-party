import { NextRequest, NextResponse } from 'next/server'
import { roomStore } from '@/lib/store'
import { User } from '@/types'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const resolvedParams = await params
  const room = roomStore.getRoom(resolvedParams.roomId)

  if (!room) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404 })
  }

  return NextResponse.json({ room })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const resolvedParams = await params
    const body = await request.json()
    const { action, user, video, isPlaying, currentTime, roomName } = body

    switch (action) {
      case 'create': {
        const hostUser: User = {
          id: user.id,
          name: user.name,
          isHost: true
        }
        const room = roomStore.createRoom(resolvedParams.roomId, roomName, hostUser)
        return NextResponse.json({ room })
      }

      case 'join': {
        const joinUser: User = {
          id: user.id,
          name: user.name,
          isHost: false
        }
        const room = roomStore.joinRoom(resolvedParams.roomId, joinUser)
        if (!room) {
          return NextResponse.json({ error: 'Room not found' }, { status: 404 })
        }
        return NextResponse.json({ room })
      }

      case 'leave': {
        const room = roomStore.leaveRoom(resolvedParams.roomId, user.id)
        if (!room) {
          return NextResponse.json({ error: 'Room not found' }, { status: 404 })
        }
        return NextResponse.json({ room })
      }

      case 'updateVideo': {
        const room = roomStore.updateVideo(resolvedParams.roomId, video)
        if (!room) {
          return NextResponse.json({ error: 'Room not found' }, { status: 404 })
        }
        return NextResponse.json({ room })
      }

      case 'updateState': {
        const room = roomStore.updateVideoState(resolvedParams.roomId, isPlaying, currentTime)
        if (!room) {
          return NextResponse.json({ error: 'Room not found' }, { status: 404 })
        }
        return NextResponse.json({ room })
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Room API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}