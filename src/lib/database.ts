import { supabaseAdmin } from './supabase'
import { Room, User, Video, ChatMessage } from '@/types'
import { del } from '@vercel/blob'

export class DatabaseService {
  private getClient() {
    if (!supabaseAdmin) {
      throw new Error('Supabase admin client not available - missing SUPABASE_SERVICE_ROLE_KEY')
    }
    return supabaseAdmin
  }

  private async cleanupBlobFile(url: string): Promise<void> {
    try {
      // Only delete files from our blob storage, not external URLs
      if (url && url.includes('blob.vercel-storage.com')) {
        console.log(`[DatabaseService] Cleaning up blob file: ${url}`)
        await del(url)
        console.log(`[DatabaseService] Successfully deleted blob file: ${url}`)
      }
    } catch (error) {
      console.error('[DatabaseService] Error cleaning up blob file:', error)
      // Don't throw - cleanup failures shouldn't break the main operation
    }
  }
  // Room operations
  async createRoom(roomId: string, roomName: string, hostUser: User): Promise<Room | null> {
    try {
      console.log(`[DatabaseService] Creating room ${roomId} with host ${hostUser.name}`)

      // Insert room
      const { data: roomData, error: roomError } = await this.getClient()
        .from('rooms')
        .insert({
          id: roomId,
          name: roomName,
          is_playing: false,
          current_position: 0
        })
        .select()
        .single()

      if (roomError) {
        console.error('[DatabaseService] Error creating room:', roomError)
        return null
      }

      // Insert host user
      const { error: userError } = await this.getClient()
        .from('room_users')
        .insert({
          room_id: roomId,
          user_id: hostUser.id,
          user_name: hostUser.name,
          is_host: true
        })

      if (userError) {
        console.error('[DatabaseService] Error adding host user:', userError)
        // Try to clean up the room
        await this.getClient().from('rooms').delete().eq('id', roomId)
        return null
      }

      return this.formatRoom(roomData, [hostUser])
    } catch (error) {
      console.error('[DatabaseService] Error in createRoom:', error)
      return null
    }
  }

  async getRoom(roomId: string): Promise<Room | null> {
    try {
      const { data: roomData, error: roomError } = await this.getClient()
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .single()

      if (roomError || !roomData) {
        return null
      }

      const { data: usersData, error: usersError } = await this.getClient()
        .from('room_users')
        .select('*')
        .eq('room_id', roomId)

      if (usersError) {
        console.error('[DatabaseService] Error fetching users:', usersError)
        return null
      }

      const users: User[] = usersData.map(user => ({
        id: user.user_id,
        name: user.user_name,
        isHost: user.is_host
      }))

      return this.formatRoom(roomData, users)
    } catch (error) {
      console.error('[DatabaseService] Error in getRoom:', error)
      return null
    }
  }

  async joinRoom(roomId: string, user: User): Promise<Room | null> {
    try {
      console.log(`[DatabaseService] User ${user.name} joining room ${roomId}`)

      // First check if room exists
      const existingRoom = await this.getRoom(roomId)
      if (!existingRoom) {
        console.log(`[DatabaseService] Room ${roomId} not found`)
        return null
      }

      // Upsert user (handles reconnections)
      const { error: userError } = await this.getClient()
        .from('room_users')
        .upsert({
          room_id: roomId,
          user_id: user.id,
          user_name: user.name,
          is_host: user.isHost
        }, {
          onConflict: 'room_id,user_id'
        })

      if (userError) {
        console.error('[DatabaseService] Error adding user to room:', userError)
        return null
      }

      // Update room activity
      await this.getClient()
        .from('rooms')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', roomId)

      return this.getRoom(roomId)
    } catch (error) {
      console.error('[DatabaseService] Error in joinRoom:', error)
      return null
    }
  }

  async leaveRoom(roomId: string, userId: string): Promise<Room | null> {
    try {
      console.log(`[DatabaseService] User ${userId} leaving room ${roomId}`)

      // Remove user from room
      const { error: deleteError } = await this.getClient()
        .from('room_users')
        .delete()
        .eq('room_id', roomId)
        .eq('user_id', userId)

      if (deleteError) {
        console.error('[DatabaseService] Error removing user from room:', deleteError)
        return null
      }

      // Check if any users are left
      const { data: remainingUsers, error: usersError } = await this.getClient()
        .from('room_users')
        .select('*')
        .eq('room_id', roomId)

      if (usersError) {
        console.error('[DatabaseService] Error checking remaining users:', usersError)
        return null
      }

      if (remainingUsers.length === 0) {
        // No users left, delete the room and clean up any blob files
        console.log(`[DatabaseService] Room ${roomId} is now empty, deleting`)

        // Get room data to clean up video files before deletion
        const roomToDelete = await this.getRoom(roomId)
        if (roomToDelete?.currentVideo?.url && roomToDelete.currentVideo.type === 'local') {
          await this.cleanupBlobFile(roomToDelete.currentVideo.url)
        }

        await this.getClient().from('rooms').delete().eq('id', roomId)
        return null
      } else {
        // If the host left, make the first remaining user the host
        const hasHost = remainingUsers.some(u => u.is_host)
        if (!hasHost) {
          console.log(`[DatabaseService] Making ${remainingUsers[0].user_name} the new host of room ${roomId}`)
          await this.getClient()
            .from('room_users')
            .update({ is_host: true })
            .eq('id', remainingUsers[0].id)
        }

        return this.getRoom(roomId)
      }
    } catch (error) {
      console.error('[DatabaseService] Error in leaveRoom:', error)
      return null
    }
  }

  async updateVideo(roomId: string, video: Video | null): Promise<Room | null> {
    try {
      console.log(`[DatabaseService] Updating video in room ${roomId}:`, video?.title || 'null')

      // Get current video to clean up old blob files
      const currentRoom = await this.getRoom(roomId)
      if (currentRoom?.currentVideo?.url && currentRoom.currentVideo.type === 'local') {
        await this.cleanupBlobFile(currentRoom.currentVideo.url)
      }

      const updateData = video
        ? {
            current_video_id: video.id,
            current_video_title: video.title,
            current_video_type: video.type,
            current_video_url: video.url,
            current_video_thumbnail: video.thumbnail,
            current_position: 0,
            is_playing: false
          }
        : {
            current_video_id: null,
            current_video_title: null,
            current_video_type: null,
            current_video_url: null,
            current_video_thumbnail: null,
            current_position: 0,
            is_playing: false
          }

      const { error } = await this.getClient()
        .from('rooms')
        .update(updateData)
        .eq('id', roomId)

      if (error) {
        console.error('[DatabaseService] Error updating video:', error)
        return null
      }

      return this.getRoom(roomId)
    } catch (error) {
      console.error('[DatabaseService] Error in updateVideo:', error)
      return null
    }
  }

  async updateVideoState(roomId: string, isPlaying: boolean, currentTime: number): Promise<Room | null> {
    try {
      const { error } = await this.getClient()
        .from('rooms')
        .update({
          is_playing: isPlaying,
          current_position: currentTime
        })
        .eq('id', roomId)

      if (error) {
        console.error('[DatabaseService] Error updating video state:', error)
        return null
      }

      return this.getRoom(roomId)
    } catch (error) {
      console.error('[DatabaseService] Error in updateVideoState:', error)
      return null
    }
  }

  // Chat operations
  async addMessage(roomId: string, message: ChatMessage): Promise<void> {
    try {
      const { error } = await this.getClient()
        .from('chat_messages')
        .insert({
          room_id: roomId,
          user_id: message.userId,
          user_name: message.username,
          message: message.message
        })

      if (error) {
        console.error('[DatabaseService] Error adding message:', error)
      }
    } catch (error) {
      console.error('[DatabaseService] Error in addMessage:', error)
    }
  }

  async getMessages(roomId: string, limit: number = 100): Promise<ChatMessage[]> {
    try {
      const { data, error } = await this.getClient()
        .from('chat_messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) {
        console.error('[DatabaseService] Error fetching messages:', error)
        return []
      }

      return data.reverse().map(msg => ({
        id: msg.id,
        userId: msg.user_id,
        username: msg.user_name,
        message: msg.message,
        timestamp: new Date(msg.created_at)
      }))
    } catch (error) {
      console.error('[DatabaseService] Error in getMessages:', error)
      return []
    }
  }

  async getAllRooms(): Promise<Room[]> {
    try {
      const { data: roomsData, error: roomsError } = await this.getClient()
        .from('rooms')
        .select('*')

      if (roomsError) {
        console.error('[DatabaseService] Error fetching all rooms:', roomsError)
        return []
      }

      const rooms: Room[] = []
      for (const roomData of roomsData) {
        const { data: usersData, error: usersError } = await this.getClient()
          .from('room_users')
          .select('*')
          .eq('room_id', roomData.id)

        if (usersError) {
          console.error('[DatabaseService] Error fetching users for room:', roomData.id, usersError)
          continue
        }

        const users: User[] = usersData.map(user => ({
          id: user.user_id,
          name: user.user_name,
          isHost: user.is_host
        }))

        rooms.push(this.formatRoom(roomData, users))
      }

      return rooms
    } catch (error) {
      console.error('[DatabaseService] Error in getAllRooms:', error)
      return []
    }
  }

  private formatRoom(roomData: any, users: User[]): Room {
    const currentVideo = roomData.current_video_id
      ? {
          id: roomData.current_video_id,
          title: roomData.current_video_title,
          type: roomData.current_video_type as 'youtube' | 'local',
          url: roomData.current_video_url,
          thumbnail: roomData.current_video_thumbnail
        }
      : null

    return {
      id: roomData.id,
      name: roomData.name,
      currentVideo,
      users,
      isPlaying: roomData.is_playing,
      currentTime: roomData.current_position,
      createdAt: new Date(roomData.created_at)
    }
  }
}

export const databaseService = new DatabaseService()