import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs-extra';
import ffmpeg from 'fluent-ffmpeg';
import { v4 as uuidv4 } from 'uuid';
import Groq from 'groq-sdk';
import { performCompleteAnalysis, transcribeAudio } from './services/aiAnalysis.js';
import { DatabaseService } from './services/databaseService.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Groq client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

// Middleware
app.use(cors());
app.use(express.json());

// Create directories
const uploadDir = join(__dirname, 'uploads');
const tempDir = join(__dirname, 'temp');
await fs.ensureDir(uploadDir);
await fs.ensureDir(tempDir);

// Serve uploaded files statically
app.use('/uploads', express.static(uploadDir));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['video/mp4', 'audio/mp3', 'audio/mpeg', 'video/quicktime', 'audio/wav'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only MP4, MP3, WAV files are allowed.'));
    }
  }
});

// Intelligently adjust end time to complete sentences
function adjustEndTimeForSentences(transcript, originalEndTime, maxExtension = 10) {
  if (!transcript || transcript.length < 10) {
    return originalEndTime;
  }
  
  // Look for sentence endings near the original end time
  const sentenceEnders = ['.', '!', '?', '...'];
  const words = transcript.split(' ');
  const avgWordsPerSecond = words.length / originalEndTime;
  
  // Find the approximate word index at original end time
  const endWordIndex = Math.floor(originalEndTime * avgWordsPerSecond);
  
  // Look for sentence endings within the next few words
  const searchRange = Math.min(Math.floor(avgWordsPerSecond * maxExtension), words.length - endWordIndex);
  
  for (let i = 0; i < searchRange; i++) {
    const wordIndex = endWordIndex + i;
    if (wordIndex >= words.length) break;
    
    const word = words[wordIndex];
    if (sentenceEnders.some(ender => word.endsWith(ender))) {
      // Found a sentence ending, calculate new time
      const newEndTime = originalEndTime + (i / avgWordsPerSecond);
      console.log(`📝 Extended segment by ${(newEndTime - originalEndTime).toFixed(1)}s to complete sentence`);
      return newEndTime;
    }
  }
  
  // If no sentence ending found, extend by a smaller amount to avoid cutting mid-word
  const smallExtension = Math.min(3, maxExtension);
  return originalEndTime + smallExtension;
}

// Get video duration using FFmpeg
async function getVideoDuration(videoPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        console.warn('⚠️ Could not get video duration, using fallback:', err.message);
        resolve(300); // 5 minute fallback
      } else {
        resolve(metadata.format.duration);
      }
    });
  });
}

// Extract audio segment from video using FFmpeg
async function extractAudioSegment(videoPath, startTime, endTime, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .seekInput(startTime)
      .duration(endTime - startTime)
      .audioCodec('libmp3lame')
      .audioBitrate('128k')
      .audioChannels(1)
      .audioFrequency(16000)
      .format('mp3')
      .output(outputPath)
      .on('end', () => {
        console.log(`✅ Audio segment extracted: ${outputPath}`);
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error('❌ FFmpeg error:', err);
        reject(err);
      })
      .run();
  });
}


// Routes

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'ClipGenius server is running' });
});

// Upload video file
app.post('/api/upload', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileInfo = {
      id: uuidv4(),
      filename: req.file.filename,
      originalName: req.file.originalname,
      path: req.file.path,
      size: req.file.size,
      mimetype: req.file.mimetype
    };

    // Get video duration using FFmpeg
    return new Promise((resolve) => {
      ffmpeg.ffprobe(req.file.path, (err, metadata) => {
        if (err) {
          console.error('FFprobe error:', err);
          fileInfo.duration = 300; // 5 minute fallback
        } else {
          fileInfo.duration = metadata.format.duration;
        }
        
        res.json({
          success: true,
          file: fileInfo
        });
        resolve();
      });
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed', details: error.message });
  }
});

// AI Analysis endpoint with real-time progress
app.post('/api/analyze-video', async (req, res) => {
  try {
    const { filename, userTier = 'guest' } = req.body;

    if (!filename) {
      return res.status(400).json({ error: 'Missing filename parameter' });
    }

    const videoPath = join(uploadDir, filename);
    
    // Check if video file exists
    if (!await fs.pathExists(videoPath)) {
      return res.status(404).json({ error: 'Video file not found' });
    }

    console.log(`🚀 Starting AI analysis for: ${filename} (${userTier} tier)`);

    // Set up SSE for real-time progress updates
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Progress callback for real-time updates
    const progressCallback = (progress, status) => {
      res.write(`data: ${JSON.stringify({ type: 'progress', progress, status })}\n\n`);
    };

    try {
      // Perform complete AI analysis
      const analysisResult = await performCompleteAnalysis(videoPath, userTier, progressCallback);
      
      // Send final result - compress large objects to prevent SSE issues
      const resultMessage = { type: 'complete', result: analysisResult };
      const messageStr = JSON.stringify(resultMessage);
      
      console.log(`📦 Sending analysis result (${messageStr.length} characters)`);
      
      // Send in single message (the improved client buffering should handle this)
      res.write(`data: ${messageStr}\n\n`);
      res.end();
      
      console.log('✅ AI analysis completed successfully');
      
    } catch (analysisError) {
      console.error('❌ AI analysis error:', analysisError);
      res.write(`data: ${JSON.stringify({ type: 'error', error: analysisError.message })}\n\n`);
      res.end();
    }

  } catch (error) {
    console.error('❌ Analysis endpoint error:', error);
    res.status(500).json({ error: 'Analysis failed', details: error.message });
  }
});

// Build crop filter for Pro aspect ratios and positions
function buildCropFilter(aspectRatio, cropPosition) {
  const aspectRatios = {
    '9:16': { width: 9, height: 16 },
    '16:9': { width: 16, height: 9 },
    '1:1': { width: 1, height: 1 },
    '4:5': { width: 4, height: 5 },
    '21:9': { width: 21, height: 9 },
    '3:4': { width: 3, height: 4 },
    '2:3': { width: 2, height: 3 },
    '16:10': { width: 16, height: 10 }
  };

  const targetAspect = aspectRatios[aspectRatio];
  if (!targetAspect) return null;

  const targetRatio = targetAspect.width / targetAspect.height;
  
  // Calculate crop dimensions for 1280x720 input (16:9)
  const inputWidth = 1280;
  const inputHeight = 720;
  const inputRatio = inputWidth / inputHeight;
  
  let cropWidth, cropHeight, cropX, cropY;
  
  if (targetRatio > inputRatio) {
    // Target is wider than input - crop height
    cropWidth = inputWidth;
    cropHeight = Math.floor(inputWidth / targetRatio);
    cropX = 0;
    
    // Position based on crop setting
    switch (cropPosition) {
      case 'top':
        cropY = 0;
        break;
      case 'bottom':
        cropY = inputHeight - cropHeight;
        break;
      case 'center':
      default:
        cropY = Math.floor((inputHeight - cropHeight) / 2);
        break;
    }
  } else {
    // Target is taller than input - crop width
    cropHeight = inputHeight;
    cropWidth = Math.floor(inputHeight * targetRatio);
    cropY = 0;
    
    // Position based on crop setting
    switch (cropPosition) {
      case 'left':
        cropX = 0;
        break;
      case 'right':
        cropX = inputWidth - cropWidth;
        break;
      case 'center':
      default:
        cropX = Math.floor((inputWidth - cropWidth) / 2);
        break;
    }
  }
  
  // Build ffmpeg crop filter
  return `crop=${cropWidth}:${cropHeight}:${cropX}:${cropY}`;
}

// Generate video with embedded subtitles and word-by-word highlighting
async function generateVideoWithSubtitles(videoPath, startTime, endTime, subtitles, words, outputPath, hasWatermark = false, proOptions = {}) {
  return new Promise(async (resolve, reject) => {
    // Ensure output directory exists
    const outputDir = dirname(outputPath);
    fs.ensureDirSync(outputDir);
    
    console.log(`🎬 Processing video: ${videoPath}`);
    console.log(`💾 Output: ${outputPath}`);
    console.log(`⏱️ Time: ${startTime}s - ${endTime}s`);

    if (!subtitles || subtitles.length === 0) {
      console.log('⚠️ No subtitles provided, creating video without subtitles');
      
      // Build ffmpeg command with optional watermark
      let ffmpegCommand = ffmpeg(videoPath)
        .seekInput(startTime)
        .duration(endTime - startTime)
        .videoCodec('libx264')
        .audioCodec('aac');
      
      let outputOptions = ['-preset fast', '-crf 23', '-movflags +faststart'];
      
      if (hasWatermark) {
        const watermarkFilter = `drawtext=text='Made with ClipGenius':fontsize=24:fontcolor=white@0.7:x=w-tw-20:y=h-th-20:fontfile=/System/Library/Fonts/Arial.ttf`;
        outputOptions.push('-vf', watermarkFilter);
        console.log(`💧 Adding watermark for Guest tier user (no subtitles)`);
      }
      
      ffmpegCommand
        .outputOptions(outputOptions)
        .format('mp4')
        .output(outputPath)
        .on('end', () => {
          console.log(`✅ Video generated: ${outputPath}`);
          resolve(outputPath);
        })
        .on('error', (err) => {
          console.error('❌ FFmpeg error:', err);
          reject(err);
        })
        .run();
      return;
    }

    // Create ASS file with word-by-word highlighting to match preview
    console.log(`📝 Creating ASS file with word highlighting for ${subtitles.length} subtitle segments`);
    
    let assContent = `[Script Info]
Title: Generated Subtitles with Word Highlighting
ScriptType: v4.00+
PlayResX: 1280
PlayResY: 720

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,20,&H00ffffff,&H00ffffff,&H00000000,&H80000000,-1,0,0,0,100,100,0.3,0,1,2,1,2,15,15,15,1
Style: Highlight,Arial,20,&H00ffffff,&H00ffffff,&H00000000,&H80000000,1,0,0,0,100,100,0.3,0,1,2,1,2,15,15,15,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

    // Generate word-by-word highlighting to match preview behavior
    if (words && words.length > 0) {
      // Group words into caption chunks like the preview does
      const wordsPerCaption = 6;
      for (let captionStart = 0; captionStart < words.length; captionStart += wordsPerCaption) {
        const captionWords = words.slice(captionStart, captionStart + wordsPerCaption);
        if (captionWords.length === 0) continue;
        
        // Calculate the overall timing for this caption group
        const captionGroupStart = captionWords[0].start;
        const captionGroupEnd = captionWords[captionWords.length - 1].end;
        
        // For each word in this caption group, create a subtitle line
        for (let wordIndex = 0; wordIndex < captionWords.length; wordIndex++) {
          const currentWord = captionWords[wordIndex];
          const wordStart = formatTimeToAss(currentWord.start);
          const wordEnd = formatTimeToAss(currentWord.end);
          
          // Build the caption text with current word highlighted
          let captionText = '';
          for (let i = 0; i < captionWords.length; i++) {
            const word = captionWords[i];
            if (i === wordIndex) {
              // Current word being spoken - white and slightly bigger
              captionText += `{\\c&H00ffffff&\\b1\\fs24}${word.word}{\\b0\\fs20}`;
            } else {
              // Other words in caption - white
              captionText += word.word;
            }
            if (i < captionWords.length - 1) captionText += ' ';
          }
          
          // Ensure this subtitle only shows during its caption group timeframe
          // This prevents overlap between different caption groups
          const effectiveStart = Math.max(currentWord.start, captionGroupStart);
          const effectiveEnd = Math.min(currentWord.end, captionGroupEnd);
          
          // Only add if the timing is valid
          if (effectiveStart < effectiveEnd) {
            const effectiveStartAss = formatTimeToAss(effectiveStart);
            const effectiveEndAss = formatTimeToAss(effectiveEnd);
            // Use fixed layer and positioning to ensure all subtitles appear in same location
            assContent += `Dialogue: 1,${effectiveStartAss},${effectiveEndAss},Default,,0,0,0,,{\\pos(640,600)}${captionText}\n`;
          }
        }
      }
    } else {
      // Fallback to regular subtitles without karaoke if no word timing available
      subtitles.forEach((subtitle) => {
        const startAss = formatTimeToAss(subtitle.start);
        const endAss = formatTimeToAss(subtitle.end);
        const cleanText = subtitle.text.replace(/[\r\n]+/g, ' ').trim();
        
        assContent += `Dialogue: 1,${startAss},${endAss},Default,,0,0,0,,{\\pos(640,600)}${cleanText}\n`;
      });
    }

    const assPath = join(tempDir, `subtitles-${uuidv4()}.ass`);
    
    try {
      fs.writeFileSync(assPath, assContent, 'utf8');
      console.log(`✅ ASS file with karaoke effects created: ${assPath}`);
    } catch (assError) {
      console.error('❌ ASS creation error:', assError);
      reject(assError);
      return;
    }

    // Use ASS subtitles filter for karaoke highlighting
    const isWindows = process.platform === 'win32';
    let subtitleFilter;
    
    if (isWindows) {
      const windowsAssPath = assPath.replace(/\\/g, '/').replace(/:/g, '\\:');
      subtitleFilter = `ass='${windowsAssPath}'`;
    } else {
      subtitleFilter = `ass='${assPath}'`;
    }

    console.log(`🎨 Using ASS subtitle filter with karaoke: ${subtitleFilter}`);
    
    // Pro features: Aspect ratio and crop position handling
    const { aspectRatio = '9:16', cropPosition = 'center', userTier = 'guest' } = proOptions;
    
    console.log(`🔍 Debug Pro Options - aspectRatio: ${aspectRatio}, cropPosition: ${cropPosition}, userTier: ${userTier}`);
    
    // Build video filter chain with Pro features
    let videoFilter = subtitleFilter;
    
    // Add aspect ratio scaling and cropping for Pro users
    if (userTier === 'pro' || userTier === 'developer') {
      console.log(`✅ User tier check passed: ${userTier}`);
      const cropFilter = buildCropFilter(aspectRatio, cropPosition);
      console.log(`🔍 Crop filter result: ${cropFilter}`);
      if (cropFilter) {
        videoFilter = `${cropFilter},${subtitleFilter}`;
        console.log(`🎯 Applied Pro crop filter: ${aspectRatio} ${cropPosition} -> ${cropFilter}`);
      } else {
        console.log(`❌ Crop filter is null/empty for ${aspectRatio} ${cropPosition}`);
      }
    } else {
      console.log(`❌ User tier check failed: ${userTier} (not pro or developer)`);
    }
    
    if (hasWatermark) {
      // Add watermark text overlay for Guest tier users
      const watermarkFilter = `drawtext=text='Made with ClipGenius':fontsize=24:fontcolor=white@0.7:x=w-tw-20:y=h-th-20:fontfile=/System/Library/Fonts/Arial.ttf`;
      videoFilter = `${videoFilter},${watermarkFilter}`;
      console.log(`💧 Adding watermark for Guest tier user`);
    }

    ffmpeg(videoPath)
      .seekInput(startTime)
      .duration(endTime - startTime)
      .videoCodec('libx264')
      .audioCodec('aac')
      .outputOptions([
        '-preset fast',
        '-crf 23',
        '-movflags +faststart',
        '-vf', videoFilter
      ])
      .format('mp4')
      .output(outputPath)
      .on('start', (commandLine) => {
        console.log('🚀 FFmpeg command:', commandLine);
      })
      .on('stderr', (stderrLine) => {
        console.log('FFmpeg:', stderrLine);
      })
      .on('end', async () => {
        console.log(`✅ Video with animated word highlighting generated: ${outputPath}`);
        // Clean up the ASS file
        try {
          await fs.remove(assPath);
        } catch (cleanupError) {
          console.error('Warning: Could not clean up ASS file:', cleanupError);
        }
        resolve(outputPath);
      })
      .on('error', async (err) => {
        console.error('❌ FFmpeg video generation error:', err);
        // Clean up the ASS file even on error
        try {
          await fs.remove(assPath);
        } catch (cleanupError) {
          console.error('Warning: Could not clean up ASS file:', cleanupError);
        }
        reject(err);
      })
      .run();
  });
}

// Format time for SRT format (HH:MM:SS,mmm)
function formatTimeToSrt(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds % 1) * 1000);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`;
}

// Format time for ASS format (H:MM:SS.cc)
function formatTimeToAss(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const centiseconds = Math.floor((seconds % 1) * 100);
  
  return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
}

// Generate meaningful title from transcript
function generateTitleFromTranscript(transcript) {
  if (!transcript || transcript.length < 10) {
    return 'Short Clip';
  }

  // Remove filler words and get key phrases
  const fillerWords = ['um', 'uh', 'like', 'you know', 'so', 'well', 'okay', 'right'];
  const words = transcript.toLowerCase().split(/\s+/)
    .filter(word => !fillerWords.includes(word.replace(/[.,!?]/, '')))
    .slice(0, 50); // First 50 meaningful words

  // Look for key phrases and topics
  const keyPhrases = [
    { pattern: /\b(how to|learn|tutorial|guide|tip|trick)\b/i, title: 'How-To Guide' },
    { pattern: /\b(mistake|error|wrong|avoid|don't|never)\b/i, title: 'Common Mistakes' },
    { pattern: /\b(secret|hidden|truth|reveal|expose)\b/i, title: 'Hidden Truth' },
    { pattern: /\b(money|profit|income|earn|make|rich|wealth)\b/i, title: 'Money Talk' },
    { pattern: /\b(success|achieve|win|accomplish|goal)\b/i, title: 'Success Story' },
    { pattern: /\b(story|experience|happened|remember|time)\b/i, title: 'Personal Story' },
    { pattern: /\b(problem|issue|challenge|difficult|hard)\b/i, title: 'Problem Solving' },
    { pattern: /\b(amazing|incredible|unbelievable|shocking)\b/i, title: 'Amazing Fact' },
    { pattern: /\b(think|believe|opinion|feel|perspective)\b/i, title: 'Personal Opinion' },
    { pattern: /\b(business|company|work|job|career)\b/i, title: 'Business Talk' },
    { pattern: /\b(technology|future|innovation|change)\b/i, title: 'Tech Innovation' },
    { pattern: /\b(relationship|family|friend|people)\b/i, title: 'Relationships' },
  ];

  // Check for key phrases
  for (const phrase of keyPhrases) {
    if (phrase.pattern.test(transcript)) {
      return phrase.title;
    }
  }

  // Extract first few meaningful words as title
  const meaningfulWords = words.slice(0, 4)
    .map(word => word.replace(/[.,!?]/, ''))
    .filter(word => word.length > 2);

  if (meaningfulWords.length >= 2) {
    return meaningfulWords.map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }

  // Fallback to first sentence or phrase
  const firstSentence = transcript.split(/[.!?]/)[0].trim();
  if (firstSentence.length > 5 && firstSentence.length < 50) {
    return firstSentence;
  }

  return 'Video Highlight';
}

// Apply attention-grabbing highlights to text for SRT files
function highlightAttentionWords(text) {
  let highlightedText = text.replace(/[\r\n]+/g, ' ').trim();
  
  // Words/phrases that should be highlighted for attention
  const attentionWords = [
    'FASTER', 'NEVER', 'ALWAYS', 'MUST', 'CRITICAL', 'URGENT', 'IMPORTANT', 'WARNING',
    'BREAKTHROUGH', 'REVOLUTIONARY', 'AMAZING', 'INCREDIBLE', 'SHOCKING', 'UNBELIEVABLE',
    'SECRET', 'EXPOSED', 'REVEALED', 'HIDDEN', 'TRUTH', 'LIES', 'SCAM', 'FRAUD',
    'BILLION', 'MILLION', 'THOUSANDS', 'HUNDREDS', 'PERCENT', 'MONEY', 'PROFIT',
    'FREE', 'NOW', 'TODAY', 'IMMEDIATELY', 'INSTANT', 'QUICK', 'FAST', 'RAPID',
    'GUARANTEED', 'PROVEN', 'SCIENTIFIC', 'EXPERT', 'PROFESSIONAL', 'AUTHORITY',
    'MISTAKE', 'ERROR', 'WRONG', 'FAIL', 'FAILURE', 'DISASTER', 'CATASTROPHE',
    'SUCCESS', 'WIN', 'VICTORY', 'CHAMPION', 'WINNER', 'BEST', 'TOP', 'ULTIMATE',
    'EXCLUSIVE', 'LIMITED', 'RARE', 'UNIQUE', 'SPECIAL', 'PREMIUM', 'VIP',
    'DANGEROUS', 'RISKY', 'SAFE', 'SECURE', 'PROTECTED', 'GUARANTEE'
  ];
  
  // No highlighting - return plain text (highlighting removed per user request)
  
  return highlightedText;
}

// Transcribe video segment
app.post('/api/transcribe-segment', async (req, res) => {
  try {
    console.log('🎬 Transcribe-segment request received:', req.body);
    const { filename, startTime, endTime, segmentId } = req.body;

    if (!filename || startTime === undefined || endTime === undefined) {
      console.error('❌ Missing required parameters:', { filename, startTime, endTime, segmentId });
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const videoPath = join(uploadDir, filename);
    const audioPath = join(tempDir, `segment-${segmentId}-${uuidv4()}.mp3`);

    console.log('🎬 Video path:', videoPath);
    console.log('🎬 Audio path:', audioPath);

    // Check if video file exists
    if (!await fs.pathExists(videoPath)) {
      console.error('❌ Video file not found:', videoPath);
      console.log('📁 Available files in uploads:', await fs.readdir(uploadDir).catch(() => ['Error reading directory']));
      return res.status(404).json({ 
        error: 'Video file not found - it may have been cleaned up. Please try uploading the video again.' 
      });
    }

    // Copy video to temp directory to avoid conflicts with cleanup
    const tempVideoPath = join(tempDir, `processing-${segmentId}-${filename}`);
    await fs.copy(videoPath, tempVideoPath);

    console.log(`🎬 Processing segment ${segmentId}: ${startTime}s - ${endTime}s`);

    // Get video duration to cap extraction time properly
    const videoDuration = await getVideoDuration(tempVideoPath);
    console.log(`🎬 Video duration: ${videoDuration}s`);
    
    // First, extract with extra buffer to capture complete sentences, but cap at video end
    const bufferTime = 15; // Extra seconds to capture full sentences
    const extendedEndTime = Math.min(endTime + bufferTime, videoDuration);
    console.log(`🎬 Capped extraction time from ${endTime + bufferTime}s to ${extendedEndTime}s`);
    
    console.log('🎬 Extracting audio segment...');
    // Extract audio segment with buffer using temp video path
    await extractAudioSegment(tempVideoPath, startTime, extendedEndTime, audioPath);
    
    console.log('🎬 Audio extraction completed, starting transcription...');
    // Transcribe the extended audio segment
    const transcription = await transcribeAudio(audioPath);
    
    console.log('🎬 Transcription completed:', transcription.text?.substring(0, 100) + '...');
    console.log('🔍 DEBUG - Full transcription text:', transcription.text);
    console.log('🔍 DEBUG - Transcription text length:', transcription.text?.length);
    console.log('🔍 DEBUG - Word count:', transcription.words?.length);

    // Clean up temporary files
    await fs.remove(audioPath);
    await fs.remove(tempVideoPath);

    // Adjust end time based on transcript to complete sentences
    const adjustedEndTime = adjustEndTimeForSentences(transcription.text, endTime, 10);
    const actualDuration = adjustedEndTime - startTime;
    
    console.log(`⏱️ Adjusted segment duration from ${endTime - startTime}s to ${actualDuration.toFixed(1)}s`);

    // Generate word-level timestamps for captions
    const captions = [];
    const highlightedCaptions = [];
    if (transcription.words && transcription.words.length > 0) {
      // Group words into caption chunks (3-8 words each)
      const wordsPerCaption = 6;
      for (let i = 0; i < transcription.words.length; i += wordsPerCaption) {
        const wordGroup = transcription.words.slice(i, i + wordsPerCaption);
        if (wordGroup.length > 0) {
          const captionText = wordGroup.map(w => w.word).join(' ');
          captions.push({
            start: wordGroup[0].start,
            end: wordGroup[wordGroup.length - 1].end,
            text: captionText
          });
          // Also create plain version (no highlighting)
          highlightedCaptions.push({
            start: wordGroup[0].start,
            end: wordGroup[wordGroup.length - 1].end,
            text: captionText
          });
        }
      }
    } else if (transcription.text) {
      // Fallback: create time-based captions if no word timestamps
      const words = transcription.text.split(' ');
      const duration = endTime - startTime;
      const wordsPerSecond = words.length / duration;
      const wordsPerCaption = 6;
      
      for (let i = 0; i < words.length; i += wordsPerCaption) {
        const wordGroup = words.slice(i, i + wordsPerCaption);
        const captionStart = i / wordsPerSecond;
        const captionEnd = Math.min((i + wordsPerCaption) / wordsPerSecond, duration);
        const captionText = wordGroup.join(' ');
        
        captions.push({
          start: captionStart,
          end: captionEnd,
          text: captionText
        });
        // Also create plain version (no highlighting)
        highlightedCaptions.push({
          start: captionStart,
          end: captionEnd,
          text: captionText
        });
      }
    }

    // Generate meaningful title from transcript
    const generatedTitle = generateTitleFromTranscript(transcription.text);

    console.log('🔍 DEBUG - Server response transcript:', transcription.text);
    console.log('🔍 DEBUG - Server response captions count:', captions.length);
    console.log('🔍 DEBUG - First caption:', captions[0]?.text);

    res.json({
      success: true,
      segmentId,
      transcript: transcription.text,
      title: generatedTitle,
      adjustedEndTime,
      actualDuration: actualDuration.toFixed(1),
      captions,
      highlightedCaptions,
      words: transcription.words || [], // Include word-level timestamps for karaoke highlighting
      wordCount: transcription.words ? transcription.words.length : transcription.text.split(' ').length
    });

  } catch (error) {
    console.error('Transcription error:', error);
    
    // Clean up temporary files on error
    try {
      await fs.remove(audioPath).catch(() => {});
      await fs.remove(tempVideoPath).catch(() => {});
    } catch (cleanupError) {
      console.error('Warning: Could not clean up temp files:', cleanupError);
    }
    
    res.status(500).json({ 
      error: 'Transcription failed', 
      details: error.message 
    });
  }
});

// Generate and download video with subtitles
app.post('/api/download-video', async (req, res) => {
  try {
    const { filename, startTime, endTime, subtitles, words, segmentId, userTier, hasWatermark, aspectRatio, cropPosition } = req.body;

    if (!filename || startTime === undefined || endTime === undefined) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const videoPath = join(uploadDir, filename);
    const outputPath = join(tempDir, `video-segment-${segmentId}-${uuidv4()}.mp4`);

    // Check if video file exists
    if (!await fs.pathExists(videoPath)) {
      return res.status(404).json({ error: 'Video file not found' });
    }

    console.log(`🎬 Generating video for segment ${segmentId}: ${startTime}s - ${endTime}s`);
    console.log(`📝 Using ${words ? words.length : 0} word-level timestamps for karaoke highlighting`);
    console.log(`🎯 Pro Settings - Aspect: ${aspectRatio || '9:16'}, Crop: ${cropPosition || 'center'}, Tier: ${userTier || 'guest'}`);
    if (words && words.length > 0) {
      console.log(`🎵 Sample word timing data:`, words.slice(0, 5));
    }

    // Generate video with subtitles and word-by-word highlighting
    await generateVideoWithSubtitles(videoPath, startTime, endTime, subtitles || [], words || [], outputPath, hasWatermark, {
      aspectRatio: aspectRatio || '9:16',
      cropPosition: cropPosition || 'center',
      userTier: userTier || 'guest'
    });

    // Send the video file for download
    res.download(outputPath, `segment-${segmentId}.mp4`, async (err) => {
      if (err) {
        console.error('Download error:', err);
      }
      
      // Clean up the temporary files after download
      setTimeout(async () => {
        try {
          await fs.remove(outputPath);
          console.log(`🗑️ Cleaned up temporary files`);
        } catch (cleanupError) {
          console.error('Cleanup error:', cleanupError);
        }
      }, 5000); // Wait 5 seconds before cleanup
    });

  } catch (error) {
    console.error('Download video error:', error);
    res.status(500).json({ 
      error: 'Video download failed', 
      details: error.message 
    });
  }
});

// AI-powered smart cropping analysis
app.post('/api/ai-crop-analysis', async (req, res) => {
  try {
    const { videoFile, moment, aspectRatio } = req.body;
    
    if (!videoFile || !moment) {
      return res.status(400).json({ error: 'Video file and moment data required' });
    }

    console.log(`🤖 Starting AI crop analysis for ${videoFile}...`);
    
    const videoPath = join(uploadDir, videoFile);
    
    // Check if video file exists
    if (!await fs.pathExists(videoPath)) {
      return res.status(404).json({ error: 'Video file not found' });
    }

    // Extract frame for analysis (middle of the segment)
    const midTime = moment.startTimeSeconds + ((moment.endTimeSeconds - moment.startTimeSeconds) / 2);
    const frameOutputPath = join(tempDir, `frame-${uuidv4()}.jpg`);
    
    await new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .seekInput(midTime)
        .frames(1)
        .output(frameOutputPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    // Simulate AI analysis (in a real implementation, you'd use actual computer vision APIs)
    // For now, we'll use intelligent heuristics based on common video composition rules
    const analysis = await simulateAIAnalysis(frameOutputPath, moment.transcript, aspectRatio);
    
    // Clean up frame
    await fs.remove(frameOutputPath);

    console.log(`✅ AI analysis complete: ${analysis.cropPosition} crop with ${analysis.confidence}% confidence`);
    
    res.json(analysis);
    
  } catch (error) {
    console.error('❌ AI crop analysis error:', error);
    res.status(500).json({ 
      error: 'AI analysis failed', 
      details: error.message 
    });
  }
});

// Simulate AI analysis with intelligent heuristics
async function simulateAIAnalysis(framePath, transcript, aspectRatio) {
  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Analyze transcript for content type hints
  const text = transcript.toLowerCase();
  let faces = 0;
  let subjects = 0;
  let cropPosition = 'center';
  let confidence = 75;
  
  // Detect likely face/person content
  const personWords = ['i', 'me', 'my', 'speaking', 'talking', 'presenter', 'host', 'interview'];
  const faceIndicators = personWords.filter(word => text.includes(word)).length;
  
  if (faceIndicators > 2) {
    faces = 1;
    subjects = 1;
    confidence = 85;
    
    // For vertical formats (9:16, 4:5), prefer center or slight top
    if (aspectRatio === '9:16' || aspectRatio === '4:5') {
      cropPosition = Math.random() > 0.3 ? 'center' : 'top';
    }
  }
  
  // Detect content with likely visual elements
  const visualWords = ['show', 'see', 'look', 'watch', 'display', 'screen', 'chart', 'graph'];
  const visualIndicators = visualWords.filter(word => text.includes(word)).length;
  
  if (visualIndicators > 1) {
    subjects = Math.max(subjects, 2);
    confidence = Math.max(confidence, 80);
    
    // For horizontal formats, prefer center
    if (aspectRatio === '16:9' || aspectRatio === '21:9') {
      cropPosition = 'center';
    }
  }
  
  // Detect action/movement content
  const actionWords = ['move', 'action', 'fast', 'quick', 'dynamic', 'energy'];
  const actionIndicators = actionWords.filter(word => text.includes(word)).length;
  
  if (actionIndicators > 0) {
    subjects = Math.max(subjects, 1);
    confidence = Math.max(confidence, 70);
  }
  
  // Add some randomization to simulate real AI variability
  confidence += Math.floor(Math.random() * 10) - 5; // ±5%
  confidence = Math.max(60, Math.min(95, confidence));
  
  return {
    cropPosition,
    confidence,
    faces,
    subjects,
    analysis: {
      contentType: faces > 0 ? 'person' : subjects > 0 ? 'mixed' : 'generic',
      recommendation: `Detected ${faces} face(s) and ${subjects} subject(s). Recommended ${cropPosition} crop for ${aspectRatio} format.`
    }
  };
}

// Creator Benefits API Endpoints

// Create new creator benefit
app.post('/api/creator-benefits', async (req, res) => {
  try {
    const { email, tokens, proDays, proExpiryDate, tier } = req.body;
    
    if (!email || tokens === undefined || proDays === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    console.log('🎁 Creating creator benefit:', { email, tokens, proDays });
    
    const result = await DatabaseService.createCreatorBenefit(email, tokens, proDays);
    
    if (result.error) {
      return res.status(500).json({ error: result.error });
    }
    
    res.json({ success: true, data: result.data });
  } catch (error) {
    console.error('❌ Create creator benefit error:', error);
    res.status(500).json({ error: 'Failed to create creator benefit' });
  }
});

// Get all creator benefits
app.get('/api/creator-benefits', async (req, res) => {
  try {
    console.log('📋 Fetching all creator benefits...');
    
    const result = await DatabaseService.getAllCreatorBenefits();
    
    if (result.error) {
      return res.status(500).json({ error: result.error });
    }
    
    res.json({ success: true, benefits: result.benefits || [] });
  } catch (error) {
    console.error('❌ Get all creator benefits error:', error);
    res.status(500).json({ error: 'Failed to get creator benefits' });
  }
});

// Get creator benefit by email
app.get('/api/creator-benefits/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    console.log('🔍 Fetching creator benefit for:', email);
    
    const result = await DatabaseService.getCreatorBenefitByEmail(email);
    
    if (result.error) {
      return res.status(500).json({ error: result.error });
    }
    
    res.json({ success: true, benefit: result.benefit });
  } catch (error) {
    console.error('❌ Get creator benefit error:', error);
    res.status(500).json({ error: 'Failed to get creator benefit' });
  }
});

// Add tokens to existing creator
app.put('/api/creator-benefits/:email/add-tokens', async (req, res) => {
  try {
    const { email } = req.params;
    const { tokens } = req.body;
    
    if (!tokens || isNaN(tokens) || tokens <= 0) {
      return res.status(400).json({ error: 'Valid token amount is required' });
    }
    
    console.log(`💰 Adding ${tokens} tokens to ${email}`);
    
    const result = await DatabaseService.addTokens(email, tokens);
    
    if (result.error) {
      return res.status(500).json({ error: result.error });
    }
    
    res.json({ 
      success: true, 
      message: `Added ${tokens} tokens`, 
      newTotal: result.newTotal 
    });
  } catch (error) {
    console.error('❌ Add tokens error:', error);
    res.status(500).json({ error: 'Failed to add tokens' });
  }
});

// Extend pro access for existing creator
app.put('/api/creator-benefits/:email/extend-pro', async (req, res) => {
  try {
    const { email } = req.params;
    const { days } = req.body;
    
    if (!days || isNaN(days) || days <= 0) {
      return res.status(400).json({ error: 'Valid number of days is required' });
    }
    
    console.log(`👑 Extending pro access for ${email} by ${days} days`);
    
    const result = await DatabaseService.extendProAccess(email, days);
    
    if (result.error) {
      return res.status(500).json({ error: result.error });
    }
    
    res.json({ 
      success: true, 
      message: `Pro access extended by ${days} days`, 
      newExpiryDate: result.newExpiryDate 
    });
  } catch (error) {
    console.error('❌ Extend pro access error:', error);
    res.status(500).json({ error: 'Failed to extend pro access' });
  }
});

// Mark benefits as used
app.put('/api/creator-benefits/:email/used', async (req, res) => {
  try {
    const { email } = req.params;
    const { userId } = req.body;
    
    console.log('✅ Marking benefit as used:', { email, userId });
    
    const result = await DatabaseService.markAsUsed(email, userId);
    
    if (result.error) {
      return res.status(500).json({ error: result.error });
    }
    
    res.json({ success: true, message: 'Benefits marked as used' });
  } catch (error) {
    console.error('❌ Mark as used error:', error);
    res.status(500).json({ error: 'Failed to mark benefits as used' });
  }
});

// Delete creator benefit
app.delete('/api/creator-benefits/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    console.log('🗑️ Deleting creator benefit:', email);
    
    const result = await DatabaseService.deleteCreatorBenefit(email);
    
    if (result.error) {
      return res.status(500).json({ error: result.error });
    }
    
    res.json({ success: true, message: 'Creator benefit deleted' });
  } catch (error) {
    console.error('❌ Delete creator benefit error:', error);
    res.status(500).json({ error: 'Failed to delete creator benefit' });
  }
});

// Clean up old files (run periodically)
app.post('/api/cleanup', async (req, res) => {
  try {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    // Clean uploads folder
    const uploadFiles = await fs.readdir(uploadDir);
    for (const file of uploadFiles) {
      const filePath = join(uploadDir, file);
      const stats = await fs.stat(filePath);
      if (now - stats.mtime.getTime() > maxAge) {
        await fs.remove(filePath);
        console.log(`🗑️ Cleaned up old file: ${file}`);
      }
    }

    // Clean temp folder
    const tempFiles = await fs.readdir(tempDir);
    for (const file of tempFiles) {
      const filePath = join(tempDir, file);
      await fs.remove(filePath);
    }

    res.json({ success: true, message: 'Cleanup completed' });
  } catch (error) {
    console.error('Cleanup error:', error);
    res.status(500).json({ error: 'Cleanup failed' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 ClipGenius server running on http://localhost:${PORT}`);
  console.log(`📁 Upload directory: ${uploadDir}`);
  console.log(`🔧 Temp directory: ${tempDir}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down server...');
  // Clean temp files on shutdown
  try {
    await fs.emptyDir(tempDir);
    console.log('✅ Cleaned up temp files');
  } catch (error) {
    console.error('Error cleaning up:', error);
  }
  process.exit(0);
});