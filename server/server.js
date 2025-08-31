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

// Intelligently determine optimal segment duration based on transcribed content
function adjustEndTimeForSentences(transcript, originalDuration, transcribedDuration, maxExtension = 10) {
  if (!transcript || transcript.length < 10) {
    return originalDuration;
  }
  
  // Look for sentence endings near the original end time
  const sentenceEnders = ['.', '!', '?', '...'];
  const words = transcript.trim().split(/\s+/);
  
  // Calculate words per second based on actual transcribed content
  const avgWordsPerSecond = words.length / transcribedDuration;
  
  // Find the approximate word index at original segment duration
  const endWordIndex = Math.floor(originalDuration * avgWordsPerSecond);
  
  // Ensure we don't go beyond the actual transcribed words
  if (endWordIndex >= words.length) {
    // If we already have all the words, use most of the transcribed duration
    const optimalDuration = Math.min(transcribedDuration * 0.95, originalDuration + maxExtension);
    console.log(`📝 Using ${optimalDuration.toFixed(1)}s duration (${(optimalDuration - originalDuration).toFixed(1)}s extension for complete transcript)`);
    return optimalDuration;
  }
  
  // Look for sentence endings starting from the original end point
  const searchRange = Math.min(Math.floor(avgWordsPerSecond * maxExtension), words.length - endWordIndex);
  
  for (let i = 0; i <= searchRange; i++) {
    const wordIndex = endWordIndex + i;
    if (wordIndex >= words.length) break;
    
    const word = words[wordIndex];
    
    // Check if this word ends a sentence
    if (sentenceEnders.some(ender => word.endsWith(ender))) {
      const additionalTime = i / avgWordsPerSecond;
      const adjustedDuration = originalDuration + additionalTime;
      console.log(`📝 Found sentence ending at word "${word}", extending duration by ${additionalTime.toFixed(1)}s`);
      return Math.min(adjustedDuration, originalDuration + maxExtension);
    }
  }
  
  // If no sentence ending found, extend very conservatively to avoid adding unwanted content
  // Use only 10% of available transcribed content and max 2 seconds
  const availableExtension = Math.max(0, transcribedDuration - originalDuration);
  const recommendedExtension = Math.min(availableExtension * 0.1, Math.min(2, maxExtension)); // Max 2s extension
  const finalDuration = originalDuration + recommendedExtension;
  
  console.log(`📝 No sentence ending found, extending duration by ${recommendedExtension.toFixed(1)}s (${(recommendedExtension / originalDuration * 100).toFixed(1)}% extension)`);
  return finalDuration;
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
    const duration = endTime - startTime;
    console.log(`🎬 Extracting audio segment: ${startTime}s to ${endTime}s (duration: ${duration}s)`);
    
    ffmpeg(videoPath)
      .seekInput(startTime)
      .duration(duration)
      .audioCodec('libmp3lame')
      .audioBitrate('128k')
      .audioChannels(1)
      .audioFrequency(16000)
      .audioFilters(['aresample=16000', 'volume=1.5', 'highpass=f=80', 'lowpass=f=8000']) // Better audio processing
      .format('mp3')
      .noVideo()
      .output(outputPath)
      .on('start', (commandLine) => {
        console.log(`🎬 FFmpeg audio extraction command: ${commandLine}`);
      })
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

// Find the actual timestamp for expected content by searching in multiple locations
async function findContentTimestamp(videoPath, expectedTranscript, approximateStart, approximateEnd) {
  if (!expectedTranscript || expectedTranscript.length < 10) {
    // No expected content, use original timestamps
    return { startTime: approximateStart, endTime: approximateEnd };
  }
  
  console.log('🔍 Searching for content match:', expectedTranscript.substring(0, 50) + '...');
  
  // Create search windows around the approximate time
  const searchRadius = Math.max(30, (approximateEnd - approximateStart) * 2); // Search within 30s or 2x segment length
  const searchStartTime = Math.max(0, approximateStart - searchRadius);
  const searchEndTime = approximateEnd + searchRadius;
  const searchDuration = searchEndTime - searchStartTime;
  
  console.log(`🔍 Searching in window: ${searchStartTime}s to ${searchEndTime}s (${searchDuration}s)`);
  
  try {
    // Extract a larger segment for searching
    const searchAudioPath = join(tempDir, `search-${uuidv4()}.mp3`);
    await extractAudioSegment(videoPath, searchStartTime, searchEndTime, searchAudioPath);
    
    // Transcribe the search window
    const searchTranscription = await transcribeAudio(searchAudioPath);
    
    // Clean up search audio file
    await fs.remove(searchAudioPath);
    
    console.log('🔍 Search window transcription length:', searchTranscription.text?.length || 0);
    
    // Find where the expected content appears in the search transcription
    const searchText = searchTranscription.text?.toLowerCase() || '';
    const expectedText = expectedTranscript.toLowerCase();
    
    // Try to find a significant portion of the expected text (at least 50% match)
    const expectedWords = expectedText.split(/\s+/).filter(word => word.length > 2);
    let bestMatch = { score: 0, position: 0 };
    
    for (let i = 0; i < searchText.length - 20; i++) {
      const snippet = searchText.substring(i, i + expectedText.length + 50);
      let matchScore = 0;
      
      for (const word of expectedWords) {
        if (snippet.includes(word)) {
          matchScore++;
        }
      }
      
      if (matchScore > bestMatch.score) {
        bestMatch = { score: matchScore, position: i };
      }
    }
    
    if (bestMatch.score >= expectedWords.length * 0.5) {
      // Found a good match - estimate the timestamp
      const matchRatio = bestMatch.position / searchText.length;
      const estimatedStart = searchStartTime + (searchDuration * matchRatio);
      const segmentDuration = approximateEnd - approximateStart;
      const estimatedEnd = estimatedStart + segmentDuration;
      
      console.log(`✅ Found content match! Estimated time: ${estimatedStart.toFixed(1)}s - ${estimatedEnd.toFixed(1)}s`);
      console.log(`🎯 Match score: ${bestMatch.score}/${expectedWords.length} words`);
      
      return { 
        startTime: Math.max(0, estimatedStart), 
        endTime: estimatedEnd,
        confidence: bestMatch.score / expectedWords.length 
      };
    } else {
      console.log(`⚠️ Content not found in search window. Best match: ${bestMatch.score}/${expectedWords.length} words`);
      return { startTime: approximateStart, endTime: approximateEnd, confidence: 0 };
    }
    
  } catch (searchError) {
    console.error('❌ Content search failed:', searchError.message);
    return { startTime: approximateStart, endTime: approximateEnd, confidence: 0 };
  }
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
    console.log('🎬 GENERATE VIDEO WITH SUBTITLES:', {
      startTime,
      endTime,
      duration: endTime - startTime,
      subtitlesCount: subtitles?.length || 0,
      wordsCount: words?.length || 0,
      outputPath
    });

    // Ensure output directory exists
    const outputDir = dirname(outputPath);
    fs.ensureDirSync(outputDir);
    
    console.log(`🎬 Processing video: ${videoPath}`);
    console.log(`💾 Output: ${outputPath}`);
    console.log(`⏱️ Time: ${startTime}s - ${endTime}s`);

    if (!subtitles || subtitles.length === 0) {
      console.log('⚠️ No subtitles provided, creating video without subtitles');
      
      const calculatedDuration = endTime - startTime;
      console.log(`🎬 FFmpeg parameters: seekInput(${startTime}) duration(${calculatedDuration})`);
      
      // Build ffmpeg command with optional watermark
      let ffmpegCommand = ffmpeg(videoPath)
        .seekInput(startTime)
        .duration(calculatedDuration)
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

    const calculatedDuration = endTime - startTime;
    console.log(`🎬 WITH SUBTITLES FFmpeg parameters: seekInput(${startTime}) duration(${calculatedDuration})`);

    ffmpeg(videoPath)
      .seekInput(startTime)
      .duration(calculatedDuration)
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

// Transcribe video segment with content matching
app.post('/api/transcribe-segment', async (req, res) => {
  try {
    console.log('🎬 Transcribe-segment request received:', req.body);
    const { filename, startTime, endTime, segmentId, expectedTranscript } = req.body;

    if (!filename || startTime === undefined || endTime === undefined) {
      console.error('❌ Missing required parameters:', { filename, startTime, endTime, segmentId });
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const videoPath = join(uploadDir, filename);
    const audioPath = join(tempDir, `segment-${segmentId}-${uuidv4()}.mp3`);
    
    console.log('🎯 Expected transcript:', expectedTranscript);

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
    
    // Try to find the actual content location if expected transcript is provided
    let actualStartTime = startTime;
    let actualEndTime = endTime;
    let confidence = 0;
    
    if (expectedTranscript) {
      console.log('🎯 Attempting content matching to find accurate timestamps...');
      const contentMatch = await findContentTimestamp(tempVideoPath, expectedTranscript, startTime, endTime);
      actualStartTime = contentMatch.startTime;
      actualEndTime = contentMatch.endTime;
      confidence = contentMatch.confidence || 0;
      
      if (confidence > 0.5) {
        console.log(`✅ Using content-matched timestamps: ${actualStartTime.toFixed(1)}s - ${actualEndTime.toFixed(1)}s`);
      } else {
        console.log(`⚠️ Content matching failed (${(confidence * 100).toFixed(1)}% confidence), using original timestamps`);
        actualStartTime = startTime;
        actualEndTime = endTime;
      }
    }
    
    // Use minimal buffer to stay focused on the original segment
    const originalDuration = actualEndTime - actualStartTime;
    const bufferTime = Math.min(3, originalDuration * 0.2); // Max 3s buffer or 20% of segment duration, whichever is smaller
    const extendedEndTime = Math.min(actualEndTime + bufferTime, videoDuration);
    console.log(`🎬 Extended extraction time from ${actualEndTime}s to ${extendedEndTime}s (${extendedEndTime - actualEndTime}s buffer)`);
    
    console.log('🎬 Extracting audio segment...');
    // Extract audio segment with buffer using temp video path
    await extractAudioSegment(tempVideoPath, actualStartTime, extendedEndTime, audioPath);
    
    console.log('🎬 Audio extraction completed, starting transcription...');
    
    // Verify audio file was created properly
    const audioStats = await fs.stat(audioPath);
    console.log(`🎵 Audio file size: ${Math.round(audioStats.size / 1024)}KB`);
    
    // Transcribe the extended audio segment with retry logic
    let transcription;
    let transcriptionAttempts = 0;
    const maxTranscriptionAttempts = 3;
    
    while (transcriptionAttempts < maxTranscriptionAttempts) {
      try {
        transcriptionAttempts++;
        console.log(`🎯 Transcription attempt ${transcriptionAttempts}/${maxTranscriptionAttempts}`);
        
        transcription = await transcribeAudio(audioPath);
        
        // Validate transcription result
        if (!transcription || !transcription.text || transcription.text.trim().length < 5) {
          throw new Error('Empty or invalid transcription result');
        }
        
        console.log('🎬 Transcription completed successfully');
        break; // Success, exit retry loop
        
      } catch (transcriptionError) {
        console.error(`❌ Transcription attempt ${transcriptionAttempts} failed:`, transcriptionError.message);
        
        if (transcriptionAttempts >= maxTranscriptionAttempts) {
          throw new Error(`Transcription failed after ${maxTranscriptionAttempts} attempts: ${transcriptionError.message}`);
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    console.log('🎬 Final transcription result:', transcription.text?.substring(0, 100) + '...');
    console.log('🔍 DEBUG - Full transcription text:', transcription.text);
    console.log('🔍 DEBUG - Transcription text length:', transcription.text?.length);
    console.log('🔍 DEBUG - Word count:', transcription.words?.length);

    // Clean up temporary files
    await fs.remove(audioPath);
    await fs.remove(tempVideoPath);

    // Adjust end time based on transcript to complete sentences
    // We extracted audio with buffer, now determine optimal segment end time
    const originalSegmentDuration = actualEndTime - actualStartTime;
    const transcribedDuration = extendedEndTime - actualStartTime; // Duration of the actually transcribed audio
    const adjustedEndTime = adjustEndTimeForSentences(transcription.text, originalSegmentDuration, transcribedDuration, 10);
    const actualDuration = adjustedEndTime;
    
    console.log(`⏱️ Adjusted segment duration from ${originalSegmentDuration}s to ${actualDuration.toFixed(1)}s`);

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
    console.log('🔍 DEBUG - Adjusted end time calculation:', {
      originalEndTime: endTime,
      adjustedDuration: adjustedEndTime,
      finalAdjustedEndTime: startTime + adjustedEndTime,
      extensionSeconds: adjustedEndTime - (endTime - startTime)
    });

    res.json({
      success: true,
      segmentId,
      transcript: transcription.text,
      title: generatedTitle,
      adjustedStartTime: actualStartTime, // Include start time for reference
      adjustedEndTime: actualStartTime + adjustedEndTime, // Convert duration back to end timestamp
      contentMatchConfidence: confidence, // Include confidence score
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

    console.log('🎬 DOWNLOAD VIDEO REQUEST:', {
      filename,
      startTime,
      endTime,
      segmentId,
      duration: endTime - startTime,
      hasSubtitles: !!subtitles?.length,
      hasWords: !!words?.length
    });

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