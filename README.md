# Content Scalar

AI-powered viral moment detection - Upload your content and our AI will intelligently analyze patterns to find engaging clips.

## Features

- **AI-Powered Analysis**: Uses Claude AI to analyze video and audio content for viral moments
- **Multiple File Formats**: Supports MP4 video, MP3 and WAV audio files
- **Viral Score**: Each detected moment gets a viral potential score
- **Clip Generation**: Generate video clips with embedded subtitles and captions
- **Preview Functionality**: Preview generated clips before downloading
- **Fallback Mode**: Works offline with demo data if API key is not configured

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure API Key (Optional)
Create a `.env` file in the root directory:
```env
VITE_ANTHROPIC_API_KEY=your-anthropic-api-key-here
```

**To get an Anthropic API key:**
1. Visit [Anthropic Console](https://console.anthropic.com/account/keys)
2. Sign up or log in to your account  
3. Create a new API key
4. Copy the key to your `.env` file

**Note:** The app works without an API key using fallback demo analysis.

### 3. Run the Development Server
```bash
npm run dev
```

### 4. Build for Production
```bash
npm run build
```

## How It Works

1. **Upload**: Drag and drop or select an MP4, MP3, or WAV file
2. **Analysis**: The AI analyzes your content to identify viral moments based on:
   - Emotional peaks and reactions
   - Quotable moments and insights
   - Comedic timing and funny segments
   - Educational value and key takeaways
3. **Results**: View detected moments with viral scores, timestamps, and descriptions
4. **Generate Clips**: Create downloadable clips with subtitles and social media captions
5. **Preview**: Watch generated clips before downloading

## Technical Stack

- **React** with Vite for fast development
- **Tailwind CSS** for styling
- **Anthropic Claude AI** for content analysis
- **Canvas API** for video frame generation
- **Lucide React** for icons

## File Structure

```
content-scalar/
├── src/
│   ├── components/
│   │   └── ContentScalar.jsx  # Main application component
│   ├── App.jsx               # App wrapper
│   └── main.jsx             # Entry point
├── public/
├── .env                     # Environment variables (create this)
├── package.json
└── README.md
```

## API Integration

The app uses the Anthropic Claude API for intelligent content analysis. If no API key is provided, it falls back to demo data generation based on file characteristics.

**API Features Used:**
- Content pattern analysis
- Viral moment detection
- Subtitle generation
- Caption suggestions

## Contributing

Feel free to submit issues and enhancement requests!
