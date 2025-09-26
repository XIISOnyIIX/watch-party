import { NextRequest, NextResponse } from 'next/server'
import { databaseService } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    const rooms = await databaseService.getAllRooms()

    const stats = {
      totalRooms: rooms.length,
      rooms: rooms.map(room => ({
        id: room.id,
        name: room.name,
        userCount: room.users.length,
        hasVideo: !!room.currentVideo,
        isPlaying: room.isPlaying,
        createdAt: room.createdAt
      }))
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      stats
    })
  } catch (error) {
    console.error('[Debug API] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}