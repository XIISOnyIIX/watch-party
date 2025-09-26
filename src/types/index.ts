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
  type: 'youtube' | 'local';
  url: string;
  duration?: number;
  thumbnail?: string;
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