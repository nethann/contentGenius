# ClipGenius

A video transcription tool that extracts real speech from videos using FFmpeg and Groq Whisper API.

## Setup Instructions

### 1. Install Backend Dependencies

```bash
cd server
npm install
```

### 2. Install Frontend Dependencies  

```bash
npm install
```

### 3. Install FFmpeg

**Windows:**
- Download from https://ffmpeg.org/download.html
- Add to your PATH environment variable

**Mac:**
```bash
brew install ffmpeg
```

**Linux:**
```bash
sudo apt update
sudo apt install ffmpeg
```

### 4. Start the Backend Server

```bash
cd server
npm start
```

The server will run on http://localhost:3001

### 5. Start the Frontend

```bash
npm run dev
```

The frontend will run on http://localhost:5173

## How It Works

1. **Upload video** - Frontend uploads video to backend server
2. **Create segments** - Frontend creates 3-5 time segments (30 seconds each)
3. **Generate clips** - When you click "Generate Clip":
   - Frontend sends segment timestamps to backend
   - Backend uses FFmpeg to extract audio from that specific segment
   - Backend sends audio to Groq Whisper API for transcription
   - Backend returns transcript with word-level timestamps
   - Frontend displays real captions synced to video playback

## Features

- ✅ **Real Video Transcription** - Uses Groq Whisper API (not browser speech recognition)
- ✅ **FFmpeg Audio Extraction** - Processes actual video files
- ✅ **Word-Level Timestamps** - Captions sync perfectly with speech
- ✅ **Segment-Based Processing** - 30-second viral moments
- ✅ **Live Caption Display** - Shows captions as video plays

## API Endpoints

- `POST /api/upload` - Upload video file
- `POST /api/transcribe-segment` - Transcribe specific video segment
- `GET /health` - Health check

## Environment Variables

Backend (server/.env):
```
GROQ_API_KEY=your_groq_api_key_here
PORT=3001
```

Frontend (.env):
```
VITE_GROQ_API_KEY=your_groq_api_key_here
```

## File Structure

```
clipgenius/
├── src/
│   ├── components/
│   │   └── VideoProcessor.jsx  # React frontend
│   ├── App.jsx               
│   └── main.jsx             
├── server/
│   ├── server.js             # Express backend
│   ├── package.json         # Backend dependencies
│   └── .env                 # Backend environment
├── package.json             # Frontend dependencies
└── README.md
```

## Technical Stack

**Frontend:**
- React + Vite
- Tailwind CSS
- Video player with custom controls

**Backend:**
- Node.js + Express
- FFmpeg for audio extraction
- Groq Whisper API for transcription
- Multer for file uploads

## Contributing

Feel free to submit issues and enhancement requests!