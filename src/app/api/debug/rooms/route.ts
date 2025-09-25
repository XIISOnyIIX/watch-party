import { NextRequest, NextResponse } from 'next/server'
import { roomStore, chatStore } from '@/lib/store'

export async function GET(request: NextRequest) {
  try {
    const stats = roomStore.getRoomStats()

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      stats
    })
  } catch (error) {
    console.error('[Debug API] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}