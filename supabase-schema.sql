-- Watch Party Database Schema for Supabase
-- Run this SQL in your Supabase SQL Editor

-- Enable Row Level Security
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- Create rooms table
CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    current_video_id TEXT,
    current_video_title TEXT,
    current_video_url TEXT,
    current_video_thumbnail TEXT,
    is_playing BOOLEAN DEFAULT FALSE,
    current_position REAL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create room_users table (to track who's in each room)
CREATE TABLE IF NOT EXISTS room_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id TEXT REFERENCES rooms(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    is_host BOOLEAN DEFAULT FALSE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(room_id, user_id)
);

-- Create chat_messages table
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id TEXT REFERENCES rooms(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_room_users_room_id ON room_users(room_id);
CREATE INDEX IF NOT EXISTS idx_room_users_user_id ON room_users(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_room_id ON chat_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);

-- Create updated_at trigger for rooms
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_rooms_updated_at
    BEFORE UPDATE ON rooms
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create trigger to update last_active on room_users
CREATE OR REPLACE FUNCTION update_last_active()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_active = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_room_users_last_active
    BEFORE UPDATE ON room_users
    FOR EACH ROW
    EXECUTE FUNCTION update_last_active();

-- Enable Row Level Security (RLS)
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies (allow all operations for now - you can restrict later)
CREATE POLICY "Allow all operations on rooms" ON rooms FOR ALL USING (true);
CREATE POLICY "Allow all operations on room_users" ON room_users FOR ALL USING (true);
CREATE POLICY "Allow all operations on chat_messages" ON chat_messages FOR ALL USING (true);

-- Enable real-time subscriptions
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE room_users;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;