import { NextRequest, NextResponse } from 'next/server'
import { roomStore } from '@/lib/store'
import { User } from '@/types'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const resolvedParams = await params
    console.log(`[Room API GET] Fetching room ${resolvedParams.roomId}`)
    const room = roomStore.getRoom(resolvedParams.roomId)

    if (!room) {
      console.log(`[Room API GET] Room ${resolvedParams.roomId} not found`)
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    console.log(`[Room API GET] Room ${resolvedParams.roomId} found with ${room.users.length} users`)
    return NextResponse.json({ room })
  } catch (error) {
    console.error('[Room API GET] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const resolvedParams = await params
    const body = await request.json()
    const { action, user, video, isPlaying, currentTime, roomName } = body
    console.log(`[Room API POST] Action: ${action} for room ${resolvedParams.roomId}`, { userId: user?.id, userName: user?.name })

    switch (action) {
      case 'create': {
        console.log(`[Room API] Creating room ${resolvedParams.roomId} with name "${roomName}" for host ${user.name}`)
        const hostUser: User = {
          id: user.id,
          name: user.name,
          isHost: true
        }
        const room = roomStore.createRoom(resolvedParams.roomId, roomName, hostUser)
        console.log(`[Room API] Room ${resolvedParams.roomId} created successfully`)
        return NextResponse.json({ room })
      }

      case 'join': {
        console.log(`[Room API] User ${user.name} joining room ${resolvedParams.roomId}`)
        const joinUser: User = {
          id: user.id,
          name: user.name,
          isHost: false
        }
        const room = roomStore.joinRoom(resolvedParams.roomId, joinUser)
        if (!room) {
          console.log(`[Room API] Failed to join room ${resolvedParams.roomId} - room not found`)
          return NextResponse.json({ error: 'Room not found' }, { status: 404 })
        }
        console.log(`[Room API] User ${user.name} joined room ${resolvedParams.roomId} successfully`)
        return NextResponse.json({ room })
      }

      case 'leave': {
        console.log(`[Room API] User ${user.id} leaving room ${resolvedParams.roomId}`)
        const room = roomStore.leaveRoom(resolvedParams.roomId, user.id)
        if (!room) {
          console.log(`[Room API] Failed to leave room ${resolvedParams.roomId} - room not found`)
          return NextResponse.json({ error: 'Room not found' }, { status: 404 })
        }
        console.log(`[Room API] User ${user.id} left room ${resolvedParams.roomId} successfully`)
        return NextResponse.json({ room })
      }

      case 'updateVideo': {
        console.log(`[Room API] Updating video in room ${resolvedParams.roomId}:`, video?.title || 'null')
        const room = roomStore.updateVideo(resolvedParams.roomId, video)
        if (!room) {
          console.log(`[Room API] Failed to update video in room ${resolvedParams.roomId} - room not found`)
          return NextResponse.json({ error: 'Room not found' }, { status: 404 })
        }
        console.log(`[Room API] Video updated successfully in room ${resolvedParams.roomId}`)
        return NextResponse.json({ room })
      }

      case 'updateState': {
        const room = roomStore.updateVideoState(resolvedParams.roomId, isPlaying, currentTime)
        if (!room) {
          console.log(`[Room API] Failed to update video state in room ${resolvedParams.roomId} - room not found`)
          return NextResponse.json({ error: 'Room not found' }, { status: 404 })
        }
        return NextResponse.json({ room })
      }

      default:
        console.log(`[Room API] Invalid action: ${action} for room ${resolvedParams.roomId}`)
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('[Room API POST] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}