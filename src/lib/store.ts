import { Room, User, Video, ChatMessage } from '@/types'

class RoomStore {
  private rooms = new Map<string, Room>()
  private roomCleanupTimers = new Map<string, NodeJS.Timeout>()

  createRoom(roomId: string, roomName: string, hostUser: User): Room {
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
    this.resetCleanupTimer(roomId)
    return room
  }

  getRoom(roomId: string): Room | null {
    return this.rooms.get(roomId) || null
  }

  joinRoom(roomId: string, user: User): Room | null {
    const room = this.rooms.get(roomId)
    if (!room) return null

    // Remove user if already in room (reconnection)
    room.users = room.users.filter(u => u.id !== user.id)
    room.users.push(user)

    this.rooms.set(roomId, room)
    this.resetCleanupTimer(roomId)
    return room
  }

  leaveRoom(roomId: string, userId: string): Room | null {
    const room = this.rooms.get(roomId)
    if (!room) return null

    room.users = room.users.filter(u => u.id !== userId)

    // If no users left, schedule room deletion
    if (room.users.length === 0) {
      this.scheduleRoomCleanup(roomId)
    } else {
      // If the host left, make the first remaining user the host
      const hasHost = room.users.some(u => u.isHost)
      if (!hasHost && room.users.length > 0) {
        room.users[0].isHost = true
      }
      this.resetCleanupTimer(roomId)
    }

    this.rooms.set(roomId, room)
    return room
  }

  updateVideo(roomId: string, video: Video | null): Room | null {
    const room = this.rooms.get(roomId)
    if (!room) return null

    room.currentVideo = video
    room.currentTime = 0
    room.isPlaying = false

    this.rooms.set(roomId, room)
    this.resetCleanupTimer(roomId)
    return room
  }

  updateVideoState(roomId: string, isPlaying: boolean, currentTime: number): Room | null {
    const room = this.rooms.get(roomId)
    if (!room) return null

    room.isPlaying = isPlaying
    room.currentTime = currentTime

    this.rooms.set(roomId, room)
    this.resetCleanupTimer(roomId)
    return room
  }

  private scheduleRoomCleanup(roomId: string) {
    const timer = setTimeout(() => {
      this.rooms.delete(roomId)
      this.roomCleanupTimers.delete(roomId)
    }, 30000) // Delete room after 30 seconds of being empty

    this.roomCleanupTimers.set(roomId, timer)
  }

  private resetCleanupTimer(roomId: string) {
    const existingTimer = this.roomCleanupTimers.get(roomId)
    if (existingTimer) {
      clearTimeout(existingTimer)
      this.roomCleanupTimers.delete(roomId)
    }
  }

  getAllRooms(): Room[] {
    return Array.from(this.rooms.values())
  }
}

// Global store instance
export const roomStore = new RoomStore()

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