export interface Room {
  id: string;
  name: string;
  creatorId: string;
  currentVideo: Video | null;
  users: User[];
  isPlaying: boolean;
  currentTime: number;
  createdAt: Date;
}

export interface Video {
  id: string;
  title: string;
  type: 'youtube' | 'local' | 'movie' | 'tv';
  url: string; // Direct stream URL if extraction succeeds, otherwise embed URL
  duration?: number;
  thumbnail?: string;
  // Movie/TV specific fields
  tmdbId?: string;
  imdbId?: string;
  season?: number;
  episode?: number;
  year?: number;
  embedUrl?: string; // Fallback embed URL
  isStreaming?: boolean; // True if using direct stream (synced), false if using embed (not synced)
}

export interface User {
  id: string;
  name: string;
  isHost: boolean;
}

export interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  message: string;
  timestamp: Date;
}

export interface VideoState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
}