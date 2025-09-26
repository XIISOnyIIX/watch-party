import { NextRequest, NextResponse } from 'next/server'
import { databaseService } from '@/lib/database'

export async function POST(request: NextRequest) {
  try {
    console.log('[Cleanup API] Starting cleanup process')

    // Get all rooms
    const rooms = await databaseService.getAllRooms()
    console.log(`[Cleanup API] Found ${rooms.length} rooms to check`)

    const cleanupResults = {
      inactiveUsersRemoved: 0,
      emptyRoomsDeleted: 0,
      blobFilesDeleted: 0
    }

    // Check each room for inactive users (inactive > 30 minutes)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000)

    for (const room of rooms) {
      const roomId = room.id
      console.log(`[Cleanup API] Checking room ${roomId}`)

      // Get all users in this room with their last_active timestamps
      // We need to access the supabase client directly for this cleanup operation
      const { supabaseAdmin } = await import('@/lib/supabase')
      if (!supabaseAdmin) {
        console.error('[Cleanup API] No admin client available')
        continue
      }

      const { data: roomUsers, error } = await supabaseAdmin
        .from('room_users')
        .select('*')
        .eq('room_id', roomId)

      if (error) {
        console.error(`[Cleanup API] Error fetching users for room ${roomId}:`, error)
        continue
      }

      // Remove inactive users
      const inactiveUsers = roomUsers?.filter(user =>
        new Date(user.last_active) < thirtyMinutesAgo
      ) || []

      for (const user of inactiveUsers) {
        console.log(`[Cleanup API] Removing inactive user ${user.user_name} from room ${roomId}`)

        const result = await databaseService.leaveRoom(roomId, user.user_id)
        cleanupResults.inactiveUsersRemoved++

        // If room was deleted (no users left), count it
        if (!result) {
          cleanupResults.emptyRoomsDeleted++
          cleanupResults.blobFilesDeleted++ // Assume one blob file per room
          break // Room deleted, move to next room
        }
      }
    }

    console.log('[Cleanup API] Cleanup completed:', cleanupResults)

    return NextResponse.json({
      success: true,
      results: cleanupResults,
      message: `Cleanup completed: ${cleanupResults.inactiveUsersRemoved} inactive users removed, ${cleanupResults.emptyRoomsDeleted} empty rooms deleted`
    })

  } catch (error) {
    console.error('[Cleanup API] Error during cleanup:', error)
    return NextResponse.json(
      { error: 'Cleanup failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// Allow GET requests to manually trigger cleanup
export async function GET(request: NextRequest) {
  return POST(request)
}