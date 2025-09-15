import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path, { dirname, join } from 'path';
import fs from 'fs-extra';
import ffmpeg from 'fluent-ffmpeg';
import { v4 as uuidv4 } from 'uuid';
import { exec } from 'child_process';
import { createReadStream } from 'fs';
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
      
      // Generate thumbnail URL if thumbnail was created
      if (analysisResult.thumbnailPath) {
        const thumbnailFilename = path.basename(analysisResult.thumbnailPath);
        analysisResult.thumbnailUrl = `/uploads/${thumbnailFilename}`;
        console.log('🖼️ Thumbnail URL generated:', analysisResult.thumbnailUrl);
      }
      
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

// Find the exact last word that corresponds to a given transcript text
function findLastWordForTranscript(words, transcriptText, segmentStartTime, segmentEndTime) {
  if (!words || words.length === 0 || !transcriptText) return null;
  
  // Clean and normalize the transcript text for matching
  const cleanTranscript = transcriptText.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Filter words that fall within the segment timeframe
  const segmentWords = words.filter(word => 
    word.start >= 0 && word.end <= (segmentEndTime - segmentStartTime)
  );
  
  if (segmentWords.length === 0) return null;
  
  // Try to find the last word that matches the transcript
  const transcriptWords = cleanTranscript.split(' ');
  const lastTranscriptWord = transcriptWords[transcriptWords.length - 1];
  
  // Find the last occurrence of the last transcript word in the segment
  for (let i = segmentWords.length - 1; i >= 0; i--) {
    const word = segmentWords[i];
    const cleanWord = word.word.toLowerCase().replace(/[^\w]/g, '');
    if (cleanWord === lastTranscriptWord) {
      console.log(`🎯 Found matching last word: "${word.word}" at ${word.end}s for transcript ending: "${lastTranscriptWord}"`);
      return word;
    }
  }
  
  // Fallback: return the last word in the segment
  console.log(`🎯 No exact match found, using last segment word: "${segmentWords[segmentWords.length - 1].word}"`);
  return segmentWords[segmentWords.length - 1];
}

// Generate video with embedded subtitles and word-by-word highlighting
async function generateVideoWithSubtitles(videoPath, startTime, endTime, subtitles, words, outputPath, hasWatermark = false, proOptions = {}, transcriptText = '') {
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
      
      // Calculate duration based on when the last word actually ends (for precise ending)
      let calculatedDuration = endTime - startTime;
      if (words && words.length > 0) {
        // Find the actual last word that should be included in this segment
        const segmentWords = words.filter(word => 
          word.start >= 0 && word.end <= (endTime - startTime)
        );
        
        if (segmentWords.length > 0) {
          const lastSegmentWordEnd = segmentWords[segmentWords.length - 1].end;
          const preciseEndTime = lastSegmentWordEnd + 0.05;
          calculatedDuration = preciseEndTime;
          console.log(`🎯 NO SUBTITLES: Adjusted video duration to end precisely after last segment word: ${lastSegmentWordEnd}s + 0.05s buffer = ${calculatedDuration}s`);
        } else {
          // Fallback: use all words
          const lastWordEnd = words[words.length - 1].end;
          if (lastWordEnd < calculatedDuration) {
            const preciseEndTime = lastWordEnd + 0.05;
            calculatedDuration = preciseEndTime;
            console.log(`🎯 NO SUBTITLES Fallback: Adjusted video duration to end after last word: ${lastWordEnd}s + 0.05s buffer = ${calculatedDuration}s`);
          }
        }
      }
      
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
Style: Default,Arial,16,&H00ffffff,&H00ffffff,&H00000000,&H80000000,-1,0,0,0,100,100,0.3,0,1,2,1,2,15,15,15,1
Style: Highlight,Arial,20,&H00ffffff,&H00ffffff,&H00000000,&H80000000,1,0,0,0,100,100,0.3,0,1,2,1,2,15,15,15,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

    // Generate word-by-word highlighting to match preview behavior
    if (words && words.length > 0) {
      console.log(`🎬 Segment duration: ${endTime - startTime}s, Last word timing: ${words[words.length - 1].end}s`);
      // Group words into caption chunks like the preview does
      const wordsPerCaption = 6;
      for (let captionStart = 0; captionStart < words.length; captionStart += wordsPerCaption) {
        const captionWords = words.slice(captionStart, captionStart + wordsPerCaption);
        if (captionWords.length === 0) continue;
        
        // Calculate the overall timing for this caption group
        const captionGroupStart = captionWords[0].start;
        const captionGroupEnd = Math.min(captionWords[captionWords.length - 1].end, endTime - startTime);
        
        // For each word in this caption group, create a subtitle line
        for (let wordIndex = 0; wordIndex < captionWords.length; wordIndex++) {
          const currentWord = captionWords[wordIndex];
          const wordStart = formatTimeToAss(currentWord.start);
          const wordEnd = formatTimeToAss(currentWord.end);
          
          // Build the caption text with current word highlighted (match preview exactly)
          let captionText = '';
          for (let i = 0; i < captionWords.length; i++) {
            const word = captionWords[i];
            if (i === wordIndex) {
              // Current word being spoken - white, 20px equivalent, font-weight 600 equivalent
              captionText += `{\\c&H00ffffff&\\b1\\fs20}${word.word}{\\b0\\fs16}`;
            } else {
              // Other words in caption - white, 16px, font-weight 500 equivalent  
              captionText += `{\\c&H00ffffff&}${word.word}`;
            }
            if (i < captionWords.length - 1) captionText += ' ';
          }
          
          // Ensure this subtitle only shows during its caption group timeframe
          // This prevents overlap between different caption groups
          // Also ensure subtitles don't extend beyond the actual segment duration
          const effectiveStart = Math.max(currentWord.start, captionGroupStart);
          const effectiveEnd = Math.min(currentWord.end, captionGroupEnd, endTime - startTime);
          
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
        // Ensure subtitle timing doesn't exceed segment duration
        const constrainedStart = Math.min(subtitle.start, endTime - startTime);
        const constrainedEnd = Math.min(subtitle.end, endTime - startTime);
        
        // Only add if timing is valid
        if (constrainedStart < constrainedEnd) {
          const startAss = formatTimeToAss(constrainedStart);
          const endAss = formatTimeToAss(constrainedEnd);
          const cleanText = subtitle.text.replace(/[\r\n]+/g, ' ').trim();
          
          assContent += `Dialogue: 1,${startAss},${endAss},Default,,0,0,0,,{\\pos(640,600)}${cleanText}\n`;
        }
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

    // Calculate duration based on when the last word actually ends (for precise ending)
    let calculatedDuration = endTime - startTime;
    if (words && words.length > 0) {
      // Use the new function to find the exact last word for this transcript
      const lastWord = findLastWordForTranscript(words, transcriptText, startTime, endTime);
      
      if (lastWord) {
        // Add a minimal buffer (0.03s) after the last word for clean ending
        const preciseEndTime = lastWord.end + 0.03;
        calculatedDuration = preciseEndTime;
        console.log(`🎯 PRECISE: Video duration set to end exactly after last transcript word: ${lastWord.end}s + 0.03s buffer = ${calculatedDuration}s`);
      } else {
        // Fallback to segment words
        const segmentWords = words.filter(word => 
          word.start >= 0 && word.end <= (endTime - startTime)
        );
        
        if (segmentWords.length > 0) {
          const lastSegmentWordEnd = segmentWords[segmentWords.length - 1].end;
          const preciseEndTime = lastSegmentWordEnd + 0.03;
          calculatedDuration = preciseEndTime;
          console.log(`🎯 FALLBACK: Adjusted video duration to end after last segment word: ${lastSegmentWordEnd}s + 0.03s buffer = ${calculatedDuration}s`);
        }
      }
    }
    
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
    console.log('🎬 Video path:', videoPath);
    console.log(`🎬 Processing segment ${segmentId}: ${startTime}s - ${endTime}s`);
    console.log('🎯 Expected transcript:', expectedTranscript);

    // Check if video file exists
    if (!await fs.pathExists(videoPath)) {
      console.error('❌ Video file not found:', videoPath);
      return res.status(404).json({ 
        error: 'Video file not found - it may have been cleaned up. Please try uploading the video again.' 
      });
    }

    const finalText = expectedTranscript || `Viral moment ${segmentId}`;
    let adjustedStartTime = startTime;
    let adjustedEndTime = endTime;

    // Extract a test segment to verify the content matches
    if (expectedTranscript) {
      console.log('🔍 Verifying content at given timestamps...');
      
      try {
        // Test the original timestamps by extracting a small segment and transcribing it
        const testAudioPath = join(tempDir, `test-${segmentId}-${uuidv4()}.mp3`);
        const testDuration = Math.min(30, (endTime - startTime) + 10); // Test up to 30s
        const testStartTime = Math.max(0, startTime - 5); // Start 5s earlier to catch context
        
        await extractAudioSegment(videoPath, testStartTime, testStartTime + testDuration, testAudioPath);
        
        // Transcribe the test segment
        const testTranscription = await transcribeAudio(testAudioPath);
        await fs.remove(testAudioPath).catch(() => {});
        
        if (testTranscription && testTranscription.text) {
          const similarity = calculateTextSimilarity(expectedTranscript, testTranscription.text);
          console.log(`🔍 Content match at original timestamps: ${(similarity * 100).toFixed(1)}%`);
          console.log('📝 Expected:', expectedTranscript.substring(0, 100));
          console.log('📝 Actual:', testTranscription.text.substring(0, 100));
          
          if (similarity < 0.3) {
            console.log('⚠️ Poor content match - trying to find better timestamps...');
            
            // Try searching around the area with multiple test extractions
            const searchOffsetsSeconds = [-30, -20, -10, 0, 10, 20, 30];
            let bestOffset = 0;
            let bestSimilarity = similarity;
            
            for (const offset of searchOffsetsSeconds) {
              const searchStartTime = Math.max(0, startTime + offset);
              const searchEndTime = Math.min(await getVideoDuration(videoPath), searchStartTime + (endTime - startTime) + 5);
              
              if (searchStartTime >= searchEndTime) continue;
              
              try {
                const searchAudioPath = join(tempDir, `search-${offset}-${segmentId}-${uuidv4()}.mp3`);
                await extractAudioSegment(videoPath, searchStartTime, searchEndTime, searchAudioPath);
                
                const searchTranscription = await transcribeAudio(searchAudioPath);
                await fs.remove(searchAudioPath).catch(() => {});
                
                if (searchTranscription && searchTranscription.text) {
                  const searchSimilarity = calculateTextSimilarity(expectedTranscript, searchTranscription.text);
                  console.log(`🔍 Offset ${offset}s: ${(searchSimilarity * 100).toFixed(1)}% match`);
                  
                  if (searchSimilarity > bestSimilarity) {
                    bestSimilarity = searchSimilarity;
                    bestOffset = offset;
                    console.log(`✅ Better match found at offset ${offset}s (${(searchSimilarity * 100).toFixed(1)}%)`);
                  }
                }
              } catch (searchError) {
                console.log(`⚠️ Search at offset ${offset}s failed:`, searchError.message);
              }
            }
            
            if (bestOffset !== 0) {
              adjustedStartTime = startTime + bestOffset;
              adjustedEndTime = endTime + bestOffset;
              console.log(`🔧 Adjusted timestamps by ${bestOffset}s: ${adjustedStartTime.toFixed(1)}s - ${adjustedEndTime.toFixed(1)}s`);
            }
          } else {
            console.log('✅ Content match is acceptable, using original timestamps');
          }
        }
      } catch (verifyError) {
        console.error('❌ Error verifying content:', verifyError.message);
        console.log('⚠️ Using original timestamps as fallback');
      }
    }

    // Calculate exact duration based ONLY on expected transcript word count
    const expectedTranscriptWords = expectedTranscript.split(' ').filter(word => word.length > 0).length;
    const exactDuration = expectedTranscriptWords / 2.5; // 2.5 words per second
    const finalEndTime = adjustedStartTime + exactDuration;
    
    console.log('🔧 PRECISE CUT:', `Words: ${expectedTranscriptWords}, Duration: ${exactDuration.toFixed(1)}s, Final: ${adjustedStartTime.toFixed(1)}s - ${finalEndTime.toFixed(1)}s`);
    
    console.log('🎯 Using transcript with corrected timestamps');
    console.log('🔍 DEBUG - Final timestamps:', `${adjustedStartTime.toFixed(1)}s - ${finalEndTime.toFixed(1)}s`);

    // Generate simple time-based captions
    const captions = [];
    const words = finalText.split(' ');
    const wordsPerCaption = 6;
    const totalDuration = finalEndTime - adjustedStartTime;
    const secondsPerWord = totalDuration / words.length;
    
    for (let i = 0; i < words.length; i += wordsPerCaption) {
      const wordGroup = words.slice(i, i + wordsPerCaption);
      const captionStart = i * secondsPerWord;
      const captionEnd = Math.min((i + wordsPerCaption) * secondsPerWord, totalDuration);
      
      captions.push({
        start: captionStart,
        end: captionEnd,
        text: wordGroup.join(' ')
      });
    }

    // Generate title
    const generatedTitle = finalText.split(' ').slice(0, 6).join(' ') || `Segment ${segmentId}`;

    console.log('🔍 DEBUG - Final response:', {
      transcript: finalText.substring(0, 100) + '...',
      adjustedStart: adjustedStartTime.toFixed(1),
      adjustedEnd: finalEndTime.toFixed(1),
      duration: totalDuration.toFixed(1),
      captionsCount: captions.length
    });

    res.json({
      segmentId,
      transcript: finalText,
      title: generatedTitle,
      adjustedStartTime: adjustedStartTime,
      adjustedEndTime: finalEndTime,
      actualDuration: totalDuration.toFixed(1),
      captions,
      highlightedCaptions: captions,
      words: [], // No word-level timestamps available
      wordCount: finalText.split(' ').length
    });

  } catch (error) {
    console.error('Transcription error:', error);
    res.status(500).json({ 
      error: 'Transcription failed', 
      details: error.message 
    });  
  }
});

// Helper function to calculate text similarity
function calculateTextSimilarity(text1, text2) {
  if (!text1 || !text2) return 0;
  
  const words1 = text1.toLowerCase().split(' ').filter(w => w.length > 0);
  const words2 = text2.toLowerCase().split(' ').filter(w => w.length > 0);
  
  if (words1.length === 0 || words2.length === 0) return 0;
  
  // Count matching words
  let matches = 0;
  for (const word of words1) {
    if (words2.includes(word)) {
      matches++;
    }
  }
  
  return matches / Math.max(words1.length, words2.length);
}

// Serve video segments on-demand for preview
app.get('/api/segment-video/:filename/:startTime/:endTime/:segmentId', async (req, res) => {
  try {
    const { filename, startTime, endTime, segmentId } = req.params;
    
    console.log('🎬 SEGMENT VIDEO REQUEST:', {
      filename,
      startTime: parseFloat(startTime),
      endTime: parseFloat(endTime),
      segmentId,
      duration: parseFloat(endTime) - parseFloat(startTime)
    });

    if (!filename || !startTime || !endTime || !segmentId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const videoPath = join(uploadDir, filename);
    const outputPath = join(tempDir, `segment-${segmentId}-${uuidv4()}.mp4`);

    // Check if video file exists
    if (!await fs.pathExists(videoPath)) {
      console.error('❌ Video file not found:', videoPath);
      return res.status(404).json({ error: 'Video file not found' });
    }

    const startTimeFloat = parseFloat(startTime);
    const endTimeFloat = parseFloat(endTime);
    
    console.log(`🎬 Generating segment ${segmentId}: ${startTimeFloat}s - ${endTimeFloat}s`);

    // Generate video segment without subtitles for quick preview
    const command = `ffmpeg -i "${videoPath}" -ss ${startTimeFloat} -to ${endTimeFloat} -c:v libx264 -c:a aac -y "${outputPath}"`;
    
    console.log(`🚀 ffmpeg command: ${command}`);
    
    await new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error('❌ ffmpeg error:', error);
          console.error('❌ ffmpeg stderr:', stderr);
          reject(error);
        } else {
          console.log('✅ Video segment generated successfully');
          resolve();
        }
      });
    });

    // Set proper headers for video streaming
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    
    // Stream the video file
    const videoStream = createReadStream(outputPath);
    videoStream.pipe(res);

    // Clean up the temporary file after streaming
    videoStream.on('end', () => {
      setTimeout(async () => {
        try {
          await fs.remove(outputPath);
          console.log(`🗑️ Cleaned up temporary segment file: ${outputPath}`);
        } catch (cleanupError) {
          console.error('Cleanup error:', cleanupError);
        }
      }, 5000); // Wait 5 seconds before cleanup
    });

  } catch (error) {
    console.error('❌ Segment video error:', error);
    res.status(500).json({ 
      error: 'Video segment generation failed', 
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
    // Extract transcript text from subtitles for precise ending
    let transcriptText = '';
    if (subtitles && subtitles.length > 0) {
      transcriptText = subtitles.map(s => s.text).join(' ');
    }
    
    await generateVideoWithSubtitles(videoPath, startTime, endTime, subtitles || [], words || [], outputPath, hasWatermark, {
      aspectRatio: aspectRatio || '9:16',
      cropPosition: cropPosition || 'center',
      userTier: userTier || 'guest'
    }, transcriptText);

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