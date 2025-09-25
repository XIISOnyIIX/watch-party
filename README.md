# Watch Party 🎬

A beautiful, real-time video streaming platform that allows you to watch YouTube videos and local files together with friends. Built with Next.js and designed for seamless deployment on Vercel.

## Features

✨ **Real-time Synchronization** - Watch videos in perfect sync with friends
🎥 **YouTube Integration** - Support for YouTube videos with automatic sync
📁 **Local File Upload** - Upload and share your own video files (up to 50MB)
💬 **Live Chat** - Chat with other viewers in real-time
👥 **Room Management** - Create private rooms and invite friends
🎨 **Beautiful UI** - Modern, responsive design with dark theme
🚀 **Vercel Ready** - Optimized for Vercel deployment with serverless functions

## Tech Stack

- **Frontend**: Next.js 15, React 18, TypeScript
- **Styling**: Tailwind CSS
- **Video**: react-youtube for YouTube integration
- **Storage**: Vercel Blob for file uploads
- **Real-time**: Server-Sent Events (SSE)
- **Deployment**: Vercel (serverless functions)

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Local Development

1. **Clone and setup**:
   ```bash
   npm install
   ```

2. **Environment Setup**:
   - Copy `.env.example` to `.env.local`
   - Get a Vercel Blob token from https://vercel.com/dashboard > Storage > Create Database > Blob
   - Add your token to `.env.local`:
     ```
     BLOB_READ_WRITE_TOKEN=your_blob_token_here
     ```

3. **Run development server**:
   ```bash
   npm run dev
   ```

4. **Open browser**: Navigate to `http://localhost:3000`

### Deployment on Vercel

1. **Connect to Vercel**:
   - Install Vercel CLI: `npm i -g vercel`
   - Run `vercel` in project directory
   - Follow the prompts to link your project

2. **Set up Blob Storage**:
   - Go to your Vercel dashboard
   - Navigate to Storage tab
   - Create a new Blob database
   - Copy the token

3. **Configure Environment Variables**:
   - In Vercel dashboard, go to your project settings
   - Add environment variable:
     - `BLOB_READ_WRITE_TOKEN`: Your blob token

4. **Deploy**:
   ```bash
   vercel --prod
   ```

Your watch party app will be live on Vercel! 🎉

## How to Use

### Creating a Room

1. Go to the homepage
2. Enter your name and room name
3. Click "Create Room"
4. Share the room link with friends

### Joining a Room

1. Get the room link from a friend, or
2. Enter the Room ID on homepage
3. Enter your name and join

### Adding Videos

**Host only:**
- **YouTube**: Paste any YouTube URL and click "Add"
- **Local Files**: Click "Choose Video File" and upload (MP4, WebM, OGG supported)

### Controls

- **Host**: Full control over playback (play, pause, seek)
- **Viewers**: Video automatically syncs with host's actions
- **Chat**: All users can chat in real-time

## API Routes

- `POST /api/rooms/[roomId]` - Room management (create, join, leave, update)
- `GET /api/rooms/[roomId]/events` - Server-sent events for real-time updates
- `POST /api/rooms/[roomId]/chat` - Send chat messages
- `POST /api/upload` - Upload video files

## Architecture

The app uses a serverless architecture perfect for Vercel:

- **Frontend**: React components with hooks for state management
- **Backend**: Next.js API routes for room management and chat
- **Real-time**: Server-Sent Events (SSE) for live synchronization
- **Storage**: Vercel Blob for video file uploads
- **State**: In-memory storage (rooms auto-cleanup after 30s when empty)

## Limitations

- Rooms are stored in memory and will reset on server restart
- File uploads limited to 50MB
- SSE connections timeout after 5 minutes of inactivity

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - feel free to use this for your own projects!

---

Built with ❤️ for watching videos together

🚀 Deploy status: Fixed syntax errors and scroll issues