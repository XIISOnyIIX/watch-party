import { createClient } from '@supabase/supabase-js'

// Debug environment variables
console.log('🔍 Environment variables check:')
console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'MISSING')
console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'MISSING')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Client for browser usage (with RLS)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Admin client for server-side operations (bypasses RLS)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Database types (you can generate these with Supabase CLI)
export interface Database {
  public: {
    Tables: {
      rooms: {
        Row: {
          id: string
          name: string
          current_video_id: string | null
          current_video_title: string | null
          current_video_type: string | null
          current_video_url: string | null
          current_video_thumbnail: string | null
          is_playing: boolean
          current_position: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          name: string
          current_video_id?: string | null
          current_video_title?: string | null
          current_video_url?: string | null
          current_video_thumbnail?: string | null
          is_playing?: boolean
          current_position?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          current_video_id?: string | null
          current_video_title?: string | null
          current_video_url?: string | null
          current_video_thumbnail?: string | null
          is_playing?: boolean
          current_position?: number
          updated_at?: string
        }
      }
      room_users: {
        Row: {
          id: string
          room_id: string
          user_id: string
          user_name: string
          is_host: boolean
          joined_at: string
          last_active: string
        }
        Insert: {
          id?: string
          room_id: string
          user_id: string
          user_name: string
          is_host?: boolean
          joined_at?: string
          last_active?: string
        }
        Update: {
          id?: string
          room_id?: string
          user_id?: string
          user_name?: string
          is_host?: boolean
          last_active?: string
        }
      }
      chat_messages: {
        Row: {
          id: string
          room_id: string
          user_id: string
          user_name: string
          message: string
          created_at: string
        }
        Insert: {
          id?: string
          room_id: string
          user_id: string
          user_name: string
          message: string
          created_at?: string
        }
        Update: {
          id?: string
          room_id?: string
          user_id?: string
          user_name?: string
          message?: string
        }
      }
    }
  }
}