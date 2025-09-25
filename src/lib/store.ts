import { Room, User, Video, ChatMessage } from '@/types'

class RoomStore {
  private rooms = new Map<string, Room>()
  private roomCleanupTimers = new Map<string, NodeJS.Timeout>()
  private roomActivity = new Map<string, number>()

  createRoom(roomId: string, roomName: string, hostUser: User): Room {
    console.log(`[RoomStore] Creating room ${roomId} with host ${hostUser.name}`)
    const room: Room = {
      id: roomId,
      name: roomName,
      currentVideo: null,
      users: [hostUser],
      isPlaying: false,
      currentTime: 0,
      createdAt: new Date()
    }

    this.rooms.set(roomId, room)
    this.updateActivity(roomId)
    this.resetCleanupTimer(roomId)
    return room
  }

  getRoom(roomId: string): Room | null {
    const room = this.rooms.get(roomId) || null
    if (room) {
      this.updateActivity(roomId)
    }
    return room
  }

  joinRoom(roomId: string, user: User): Room | null {
    console.log(`[RoomStore] User ${user.name} joining room ${roomId}`)
    const room = this.rooms.get(roomId)
    if (!room) {
      console.log(`[RoomStore] Room ${roomId} not found for join attempt`)
      return null
    }

    // Remove user if already in room (reconnection)
    room.users = room.users.filter(u => u.id !== user.id)
    room.users.push(user)

    this.rooms.set(roomId, room)
    this.updateActivity(roomId)
    this.resetCleanupTimer(roomId)
    console.log(`[RoomStore] Room ${roomId} now has ${room.users.length} users`)
    return room
  }

  leaveRoom(roomId: string, userId: string): Room | null {
    console.log(`[RoomStore] User ${userId} leaving room ${roomId}`)
    const room = this.rooms.get(roomId)
    if (!room) {
      console.log(`[RoomStore] Room ${roomId} not found for leave attempt`)
      return null
    }

    const userCountBefore = room.users.length
    room.users = room.users.filter(u => u.id !== userId)
    console.log(`[RoomStore] Room ${roomId} users: ${userCountBefore} -> ${room.users.length}`)

    // If no users left, schedule room deletion
    if (room.users.length === 0) {
      console.log(`[RoomStore] Room ${roomId} is now empty, scheduling cleanup`)
      this.scheduleRoomCleanup(roomId)
    } else {
      // If the host left, make the first remaining user the host
      const hasHost = room.users.some(u => u.isHost)
      if (!hasHost && room.users.length > 0) {
        console.log(`[RoomStore] Making ${room.users[0].name} the new host of room ${roomId}`)
        room.users[0].isHost = true
      }
      this.updateActivity(roomId)
      this.resetCleanupTimer(roomId)
    }

    this.rooms.set(roomId, room)
    return room
  }

  updateVideo(roomId: string, video: Video | null): Room | null {
    console.log(`[RoomStore] Updating video in room ${roomId}:`, video?.title || 'null')
    const room = this.rooms.get(roomId)
    if (!room) {
      console.log(`[RoomStore] Room ${roomId} not found for video update`)
      return null
    }

    room.currentVideo = video
    room.currentTime = 0
    room.isPlaying = false

    this.rooms.set(roomId, room)
    this.updateActivity(roomId)
    this.resetCleanupTimer(roomId)
    return room
  }

  updateVideoState(roomId: string, isPlaying: boolean, currentTime: number): Room | null {
    const room = this.rooms.get(roomId)
    if (!room) {
      console.log(`[RoomStore] Room ${roomId} not found for video state update`)
      return null
    }

    room.isPlaying = isPlaying
    room.currentTime = currentTime

    this.rooms.set(roomId, room)
    this.updateActivity(roomId)
    this.resetCleanupTimer(roomId)
    return room
  }

  private scheduleRoomCleanup(roomId: string) {
    console.log(`[RoomStore] Scheduling cleanup for empty room ${roomId} in 5 minutes`)

    // Clear any existing cleanup timer
    const existingTimer = this.roomCleanupTimers.get(roomId)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    const timer = setTimeout(() => {
      const room = this.rooms.get(roomId)
      if (room && room.users.length === 0) {
        console.log(`[RoomStore] Deleting empty room ${roomId} after 5 minutes`)
        this.rooms.delete(roomId)
        this.roomCleanupTimers.delete(roomId)
        this.roomActivity.delete(roomId)
      } else {
        console.log(`[RoomStore] Room ${roomId} is no longer empty, canceling cleanup`)
        this.roomCleanupTimers.delete(roomId)
      }
    }, 300000) // Delete room after 5 minutes (300 seconds) of being empty

    this.roomCleanupTimers.set(roomId, timer)
  }

  private resetCleanupTimer(roomId: string) {
    const existingTimer = this.roomCleanupTimers.get(roomId)
    if (existingTimer) {
      console.log(`[RoomStore] Canceling cleanup timer for active room ${roomId}`)
      clearTimeout(existingTimer)
      this.roomCleanupTimers.delete(roomId)
    }
  }

  private updateActivity(roomId: string) {
    this.roomActivity.set(roomId, Date.now())
  }

  // Check if room has been recently active (within last 10 minutes)
  isRoomActive(roomId: string): boolean {
    const lastActivity = this.roomActivity.get(roomId)
    if (!lastActivity) return false
    const tenMinutesAgo = Date.now() - (10 * 60 * 1000)
    return lastActivity > tenMinutesAgo
  }

  getAllRooms(): Room[] {
    return Array.from(this.rooms.values())
  }

  // Get room statistics for debugging
  getRoomStats() {
    const stats = {
      totalRooms: this.rooms.size,
      roomsWithCleanupTimers: this.roomCleanupTimers.size,
      rooms: Array.from(this.rooms.entries()).map(([id, room]) => ({
        id,
        name: room.name,
        userCount: room.users.length,
        hasCleanupTimer: this.roomCleanupTimers.has(id),
        lastActivity: this.roomActivity.get(id),
        isActive: this.isRoomActive(id)
      }))
    }
    console.log('[RoomStore] Room statistics:', stats)
    return stats
  }
}

// Global store instance
export const roomStore = new RoomStore()

// Debug helper - log room stats every 2 minutes
if (typeof window === 'undefined') { // Only run on server
  setInterval(() => {
    roomStore.getRoomStats()
  }, 120000) // 2 minutes
}

// Chat message store (in production, you'd want to use a database)
class ChatStore {
  private messages = new Map<string, ChatMessage[]>()

  addMessage(roomId: string, message: ChatMessage): void {
    if (!this.messages.has(roomId)) {
      this.messages.set(roomId, [])
    }

    const roomMessages = this.messages.get(roomId)!
    roomMessages.push(message)

    // Keep only last 100 messages per room
    if (roomMessages.length > 100) {
      roomMessages.splice(0, roomMessages.length - 100)
    }
  }

  getMessages(roomId: string): ChatMessage[] {
    return this.messages.get(roomId) || []
  }

  clearMessages(roomId: string): void {
    this.messages.delete(roomId)
  }
}

export const chatStore = new ChatStore()