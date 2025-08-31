import OpenAI from 'openai';
import Groq from 'groq-sdk';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs-extra';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Configure ffmpeg path if needed (for Windows)
try {
  // Try to set ffmpeg path - this helps on Windows systems
  ffmpeg.setFfmpegPath('ffmpeg');
} catch (pathError) {
  console.warn('⚠️ Could not set ffmpeg path, using system default');
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from the server directory
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Debug: Check if API keys are loaded
console.log('🔑 OPENAI_API_KEY loaded:', !!process.env.OPENAI_API_KEY);
console.log('🔑 GROQ_API_KEY loaded:', !!process.env.GROQ_API_KEY);

// Initialize AI clients
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

/**
 * Clean up transcription text by removing prompts and artifacts
 */
function cleanTranscriptionText(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }

  let cleanText = text.trim();
  
  // Remove only clear transcription artifacts - be much more conservative
  const promptsToRemove = [
    /^transcribe accurately and completely\.?\s*/gi, // Only at start
    /^please transcribe the complete audio[.\s]*/gi, // Only at start
    /transcription by castingwords/gi, // Clear watermark
    /^transcribe[.\s]*/gi, // Only at start
    /^please transcribe[.\s]*/gi, // Only at start
    /complete accurate transcription required[.\s]*/gi // Clear instruction
  ];
  
  // Remove each prompt pattern
  for (const pattern of promptsToRemove) {
    cleanText = cleanText.replace(pattern, '');
  }
  
  // Remove repeated phrases only if they're exact duplicates (be conservative)
  cleanText = cleanText.replace(/(.{20,}?)\s+\1/g, '$1'); // Remove only exact repeated phrases of 20+ chars
  
  // Clean up extra whitespace and normalize
  cleanText = cleanText
    .replace(/\s+/g, ' ')  // Multiple spaces to single space
    .replace(/\.\s*\./g, '.') // Remove double periods
    .replace(/,\s*,/g, ',') // Remove double commas
    .trim();
  
  // Remove leading/trailing punctuation artifacts
  cleanText = cleanText.replace(/^[.,;:\s]+/, '').replace(/[.,;:\s]+$/, '');
  
  // Only return empty if it's clearly just artifacts - be very conservative
  if (cleanText.length < 5 || 
      (cleanText.length < 20 && cleanText.toLowerCase().includes('castingwords'))) {
    console.log('⚠️ Transcription appears to be mostly artifacts, returning empty');
    return '';
  }
  
  console.log('🧹 Cleaned transcription:', {
    original: text.substring(0, 100) + '...',
    cleaned: cleanText.substring(0, 100) + '...',
    originalLength: text.length,
    cleanedLength: cleanText.length
  });
  
  return cleanText;
}

/**
 * Extract audio from video file for transcription
 */
export async function extractAudioFromVideo(videoPath) {
  const audioPath = videoPath.replace(path.extname(videoPath), '_audio.wav');
  
  return new Promise((resolve, reject) => {
    console.log('🎵 Starting audio extraction from:', videoPath);
    console.log('🎵 Output audio path:', audioPath);
    
    // Add timeout to prevent hanging
    const timeout = setTimeout(() => {
      console.error('⏰ Audio extraction timeout after 180 seconds');
      reject(new Error('Audio extraction timeout - ffmpeg took too long'));
    }, 180000); // 180 second timeout (3 minutes)

    const ffmpegCommand = ffmpeg(videoPath)
      .toFormat('wav')
      .audioChannels(1)
      .audioFrequency(16000)
      .audioCodec('pcm_s16le') // Specify audio codec for better compatibility
      .output(audioPath)
      .on('start', (commandLine) => {
        console.log('🚀 ffmpeg command:', commandLine);
      })
      .on('progress', (progress) => {
        if (progress.percent) {
          console.log(`📊 Audio extraction progress: ${Math.round(progress.percent)}%`);
        }
      })
      .on('end', () => {
        clearTimeout(timeout);
        console.log('✅ Audio extraction completed successfully');
        // Verify the audio file was created and check its properties
        fs.pathExists(audioPath).then(async exists => {
          if (exists) {
            try {
              const stats = await fs.stat(audioPath);
              console.log('🎵 Extracted audio file size:', Math.round(stats.size / 1024), 'KB');
              
              // Get audio duration for verification
              ffmpeg.ffprobe(audioPath, (err, metadata) => {
                if (!err && metadata.format) {
                  console.log('🎵 Extracted audio duration:', metadata.format.duration, 'seconds');
                }
                resolve(audioPath);
              });
            } catch (statError) {
              console.warn('⚠️ Could not get audio file stats:', statError.message);
              resolve(audioPath);
            }
          } else {
            reject(new Error('Audio file was not created'));
          }
        }).catch(err => {
          reject(err);
        });
      })
      .on('error', (error) => {
        clearTimeout(timeout);
        console.error('❌ Audio extraction error:', error);
        console.error('❌ Error code:', error.code);
        console.error('❌ Error signal:', error.signal);
        
        // If video is actually audio-only, try direct copy
        if (error.message && error.message.includes('video')) {
          console.log('🔄 Retrying with audio-only processing...');
          const audioOnlyCommand = ffmpeg(videoPath)
            .toFormat('wav')
            .audioChannels(1)
            .audioFrequency(16000)
            .noVideo() // Skip video processing
            .output(audioPath)
            .on('end', () => {
              console.log('✅ Audio-only extraction completed');
              resolve(audioPath);
            })
            .on('error', (retryError) => {
              console.error('❌ Audio-only extraction also failed:', retryError);
              reject(retryError);
            });
          audioOnlyCommand.run();
        } else {
          reject(error);
        }
      });
    
    try {
      ffmpegCommand.run();
    } catch (runError) {
      clearTimeout(timeout);
      console.error('❌ Failed to start ffmpeg:', runError);
      reject(new Error(`Failed to start audio extraction: ${runError.message}`));
    }
  });
}

/**
 * Split large audio into chunks and transcribe each chunk separately
 */
async function transcribeAudioInChunks(audioPath) {
  try {
    console.log('🔄 Splitting audio into chunks for better transcription...');
    
    // Get audio duration first
    const duration = await new Promise((resolve, reject) => {
      ffmpeg.ffprobe(audioPath, (err, metadata) => {
        if (err) reject(err);
        else resolve(metadata.format.duration);
      });
    });
    
    console.log('🎵 Audio duration:', duration, 'seconds');
    
    // Split into 30-second chunks for better transcription quality
    const chunkDuration = 30;
    const numChunks = Math.ceil(duration / chunkDuration);
    const chunks = [];
    
    console.log('🔄 Creating', numChunks, 'chunks of', chunkDuration, 'seconds each');
    
    // Create temporary chunks
    for (let i = 0; i < numChunks; i++) {
      const startTime = i * chunkDuration;
      // Create unique chunk file path in temp directory
      const audioBasename = path.basename(audioPath, path.extname(audioPath));
      const audioDir = path.dirname(audioPath);
      const uniqueChunkPath = path.join(audioDir, `${audioBasename}_chunk_${i}_${Date.now()}.wav`);
      
      await new Promise((resolve, reject) => {
        ffmpeg(audioPath)
          .seekInput(startTime)
          .duration(chunkDuration)
          .audioCodec('pcm_s16le')
          .audioFrequency(16000)
          .audioChannels(1)
          .output(uniqueChunkPath)
          .on('end', resolve)
          .on('error', reject)
          .run();
      });
      
      chunks.push({ path: uniqueChunkPath, startTime, duration: Math.min(chunkDuration, duration - startTime) });
    }
    
    // Transcribe each chunk
    let fullText = '';
    let allWords = [];
    let timeOffset = 0;
    
    for (const chunk of chunks) {
      console.log('🔄 Transcribing chunk at', chunk.startTime, 'seconds...');
      
      const chunkBuffer = await fs.readFile(chunk.path);
      const chunkFile = new File([chunkBuffer], path.basename(chunk.path), {
        type: 'audio/wav'
      });
      
      const chunkTranscription = await groq.audio.transcriptions.create({
        file: chunkFile,
        model: 'whisper-large-v3',
        language: 'en',
        response_format: 'text',
        temperature: 0.0,
      });
      
      if (chunkTranscription && (typeof chunkTranscription === 'string' ? chunkTranscription : chunkTranscription.text)) {
        const chunkText = typeof chunkTranscription === 'string' ? chunkTranscription : chunkTranscription.text;
        fullText += chunkText;
        
        // Note: text format doesn't provide word timestamps, so we skip word timing for chunks
        // This is a tradeoff for getting more complete transcriptions
      }
      
      timeOffset += chunk.duration;
      
      // Clean up chunk file
      try {
        await fs.unlink(chunk.path);
      } catch (unlinkError) {
        console.warn('⚠️ Could not delete chunk file:', unlinkError.message);
      }
    }
    
    console.log('✅ Chunk transcription completed. Total text length:', fullText.length);
    
    // Clean the combined transcription text
    const cleanedFullText = cleanTranscriptionText(fullText.trim());
    
    return {
      text: cleanedFullText,
      words: allWords,
      segments: []
    };
    
  } catch (error) {
    console.error('❌ Chunk transcription error:', error);
    throw error;
  }
}

/**
 * Transcribe audio using Groq Whisper (fast and free)
 */
export async function transcribeAudio(audioPath) {
  try {
    console.log('🎯 Starting transcription with Groq Whisper...');
    console.log('🎵 Audio file path:', audioPath);
    
    // Check audio file size
    const stats = await fs.stat(audioPath);
    console.log('🎵 Audio file size:', Math.round(stats.size / 1024), 'KB');
    
    const audioBuffer = await fs.readFile(audioPath);
    const audioFile = new File([audioBuffer], path.basename(audioPath), {
      type: 'audio/wav'
    });

    console.log('🔄 Sending to Groq Whisper API...');
    let transcription;
    let retryCount = 0;
    const maxRetries = 2;
    
    // Always prioritize segment and word-level timestamps for precise timing
    const transcriptionConfigs = [
      {
        model: 'whisper-large-v3',
        language: 'en',
        response_format: 'verbose_json',
        timestamp_granularities: ['word', 'segment'],
        temperature: 0.0,
      },
      {
        model: 'whisper-large-v3',
        language: 'en',
        response_format: 'verbose_json',
        timestamp_granularities: ['segment'],
        temperature: 0.0,
      },
      {
        model: 'whisper-large-v3',
        language: 'en',
        response_format: 'json',
        temperature: 0.0
      },
      {
        model: 'whisper-large-v3',
        response_format: 'text',
        language: 'en',
        temperature: 0.0
      }
    ];
    
    for (const config of transcriptionConfigs) {
      try {
        console.log(`🔄 Attempt ${retryCount + 1}/${transcriptionConfigs.length} with config:`, Object.keys(config).join(', '));
        transcription = await groq.audio.transcriptions.create({
          file: audioFile,
          ...config
        });
        break; // Success, exit loop
      } catch (error) {
        retryCount++;
        console.warn(`⚠️ Transcription attempt ${retryCount} failed:`, error.message);
        if (retryCount >= transcriptionConfigs.length) {
          throw error; // Re-throw the last error
        }
      }
    }

    console.log('✅ Transcription completed');
    
    // Handle different response formats
    let transcriptionText, transcriptionWords, transcriptionSegments;
    if (typeof transcription === 'string') {
      // Text format response
      transcriptionText = transcription;
      transcriptionWords = [];
      transcriptionSegments = [];
    } else {
      // JSON format response
      transcriptionText = transcription.text || '';
      transcriptionWords = transcription.words || [];
      transcriptionSegments = transcription.segments || [];
    }
    
    console.log('🔍 RAW GROQ RESPONSE - Text length:', transcriptionText?.length || 0);
    console.log('🔍 RAW GROQ RESPONSE - Full text:', JSON.stringify(transcriptionText));
    console.log('🔍 RAW GROQ RESPONSE - Words count:', transcriptionWords?.length || 0);
    console.log('🔍 RAW GROQ RESPONSE - Segments count:', transcriptionSegments?.length || 0);
    
    // Check if text ends abruptly (no punctuation) or seems incomplete
    const lastChar = transcriptionText.slice(-1);
    
    // Improved truncation detection - be more conservative
    const endsAbruptly = transcriptionText.length > 20 && (
      transcriptionText.endsWith('...') || // Explicit truncation markers only
      (transcriptionText.length < 100 && !!['.', '!', '?'].includes(lastChar) === false) // Very short without punctuation
    );
    
    // Only flag as incomplete if extremely short and clearly cut off
    const seemsIncomplete = transcriptionText.length < 30;
    
    if (endsAbruptly || seemsIncomplete) {
      console.log('⚠️ POTENTIAL TRUNCATION DETECTED (being conservative)');
      console.log('⚠️ Text length:', transcriptionText.length);
      console.log('⚠️ Ends abruptly:', endsAbruptly);
      console.log('⚠️ Seems incomplete:', seemsIncomplete);
      console.log('⚠️ Last 50 characters:', JSON.stringify(transcriptionText.slice(-50)));
      
      // Only try chunked transcription for very short results
      if (transcriptionText.length < 100) {
        console.log('🔄 Attempting to re-transcribe with audio splitting...');
        try {
          const chunkedResult = await transcribeAudioInChunks(audioPath);
          
          // Only use chunked result if it's significantly longer
          if (chunkedResult.text && chunkedResult.text.length > transcriptionText.length * 1.5) {
            console.log('✅ Chunked transcription is significantly longer, using that result');
            return chunkedResult;
          } else {
            console.log('⚠️ Chunked transcription not significantly better, using original');
          }
        } catch (chunkError) {
          console.warn('⚠️ Chunk transcription failed, returning original result:', chunkError.message);
        }
      }
    }
    
    // Clean the transcription text
    const cleanedText = cleanTranscriptionText(transcriptionText);
    
    return {
      text: cleanedText,
      words: transcriptionWords,
      segments: transcriptionSegments
    };
  } catch (error) {
    console.error('❌ Transcription error:', error);
    throw error;
  }
}

/**
 * Analyze content for viral potential using OpenAI GPT
 */
export async function analyzeViralPotential(transcript, userTier = 'guest') {
  try {
    console.log('🧠 Analyzing viral potential with GPT...');
    console.log('🔍 DEBUG - User tier for viral analysis:', userTier);
    
    const systemPrompt = `You are an expert social media content analyst specializing in viral content prediction. 
    Analyze the provided transcript and return a JSON response with viral scoring and insights.

    For GUEST tier users, provide:
    - viralScore (0-100)
    - category (engaging/educational/funny/emotional)
    - reasoning (brief explanation)

    For PRO tier users, provide everything above plus:
    - detailedAnalytics (hookStrength, retentionRate, engagementPotential, sentiment, keywordDensity, paceScore, visualAppeal, soundQuality, competitorAnalysis, trendAlignment, audienceReach, platformOptimization)
    - improvements (array of 5-8 SPECIFIC, ACTIONABLE suggestions like "Add trending music from [genre]", "Include text overlay with key statistics", "Use jump cuts every 2-3 seconds for better retention", "Add captions with attention-grabbing keywords", "Create hook variations for A/B testing", etc.)
    - hashtags (array of 8-12 trending hashtags relevant to this content with engagement scores)
    - bestMoments (array of timestamp ranges with viral potential and specific reasons)
    - optimizationTips (specific advice for thumbnail, title, description, posting time, platform-specific recommendations)
    - contentStrategy (recommendations for content series, follow-up videos, and audience engagement tactics)
    - competitiveInsights (analysis of similar viral content and differentiation strategies)

    Base your analysis on:
    - Hook strength (first 3-5 seconds)
    - Content pacing and flow
    - Emotional engagement
    - Educational value
    - Entertainment factor
    - Trending topic alignment
    - Call-to-action effectiveness`;

    const userPrompt = `Analyze this transcript for viral potential:

    "${transcript}"

    User Tier: ${userTier}
    
    Return valid JSON only, no additional text.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 1500
    });

    const analysis = JSON.parse(completion.choices[0].message.content);
    console.log('✅ Viral analysis completed');
    console.log('🔍 DEBUG - Analysis result for', userTier, ':', JSON.stringify(analysis, null, 2));
    
    return analysis;
  } catch (error) {
    console.error('❌ Viral analysis error:', error);
    throw error;
  }
}

/**
 * Find precise timestamps for a text snippet using word-level or segment-level timing
 */
function findPreciseTimestamps(targetText, wordsArray, segmentsArray) {
  console.log('🔍 Finding precise timestamps for:', targetText.substring(0, 100));
  console.log('🔍 Available words count:', wordsArray?.length || 0);
  console.log('🔍 Available segments count:', segmentsArray?.length || 0);

  // Try word-level matching first
  if (wordsArray && wordsArray.length > 0) {
    const wordMatch = findWordLevelMatch(targetText, wordsArray);
    if (wordMatch) {
      return wordMatch;
    }
  }

  // Fallback to segment-level matching
  if (segmentsArray && segmentsArray.length > 0) {
    const segmentMatch = findSegmentLevelMatch(targetText, segmentsArray);
    if (segmentMatch) {
      return segmentMatch;
    }
  }

  console.warn('⚠️ No precise timing match found for text');
  return null;
}

/**
 * Find timestamps using word-level data
 */
function findWordLevelMatch(targetText, wordsArray) {
  // Clean and normalize the target text for matching
  const cleanTarget = targetText.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ');
  
  // Create word mapping with timing
  const words = wordsArray.map(w => ({
    word: w.word.toLowerCase().replace(/[^\w]/g, ''),
    start: w.start,
    end: w.end,
    original: w.word
  }));
  
  console.log('🔍 First 10 words with timing:', words.slice(0, 10).map(w => ({word: w.word, start: w.start, end: w.end})));
  
  // Find the best matching sequence
  let bestMatch = null;
  let bestScore = 0;
  
  for (let i = 0; i <= words.length - cleanTarget.length; i++) {
    const sequence = words.slice(i, i + cleanTarget.length);
    let matches = 0;
    
    for (let j = 0; j < cleanTarget.length && j < sequence.length; j++) {
      if (sequence[j].word.includes(cleanTarget[j]) || cleanTarget[j].includes(sequence[j].word)) {
        matches++;
      }
    }
    
    const score = matches / cleanTarget.length;
    if (score > bestScore && score >= 0.7) { // 70% match threshold
      bestScore = score;
      bestMatch = {
        startTime: sequence[0].start,
        endTime: sequence[sequence.length - 1].end,
        matchedWords: sequence.map(s => s.original).join(' '),
        score: score,
        method: 'word-level'
      };
    }
  }
  
  if (bestMatch) {
    console.log('✅ Found word-level timing match:', {
      startTime: bestMatch.startTime,
      endTime: bestMatch.endTime,
      score: bestMatch.score,
      matchedText: bestMatch.matchedWords.substring(0, 100)
    });
  }
  
  return bestMatch;
}

/**
 * Find timestamps using segment-level data
 */
function findSegmentLevelMatch(targetText, segmentsArray) {
  const cleanTarget = targetText.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  
  console.log('🔍 Searching segments for text match...');
  
  let bestMatch = null;
  let bestScore = 0;
  
  for (const segment of segmentsArray) {
    const segmentText = segment.text.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
    
    // Calculate similarity score
    const similarity = calculateSimilarity(cleanTarget, segmentText);
    
    if (similarity > bestScore && similarity >= 0.6) { // 60% match threshold for segments
      bestScore = similarity;
      bestMatch = {
        startTime: segment.start,
        endTime: segment.end,
        matchedWords: segment.text,
        score: similarity,
        method: 'segment-level'
      };
    }
  }
  
  if (bestMatch) {
    console.log('✅ Found segment-level timing match:', {
      startTime: bestMatch.startTime,
      endTime: bestMatch.endTime,
      score: bestMatch.score,
      matchedText: bestMatch.matchedWords.substring(0, 100)
    });
  }
  
  return bestMatch;
}

/**
 * Calculate text similarity score
 */
function calculateSimilarity(text1, text2) {
  const words1 = text1.split(' ');
  const words2 = text2.split(' ');
  
  // Check if target text is contained in segment text
  if (text2.includes(text1)) {
    return 0.95;
  }
  
  // Count matching words
  let matches = 0;
  for (const word1 of words1) {
    if (words2.some(word2 => word2.includes(word1) || word1.includes(word2))) {
      matches++;
    }
  }
  
  return matches / Math.max(words1.length, words2.length);
}

/**
 * Find text in transcript using character position and estimate timing
 */
function findTextInTranscript(targetText, fullTranscript, videoDuration) {
  if (!targetText || !fullTranscript || !videoDuration) {
    return null;
  }
  
  console.log('🔍 Searching for exact text in transcript:', targetText.substring(0, 100));
  console.log('🔍 Full transcript length:', fullTranscript.length, 'characters');
  console.log('🔍 Video duration:', videoDuration, 'seconds');
  
  // Clean both texts for comparison
  const cleanTarget = targetText.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const cleanTranscript = fullTranscript.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  
  console.log('🔍 Clean target text:', cleanTarget.substring(0, 100));
  console.log('🔍 Clean transcript sample:', cleanTranscript.substring(0, 200));
  
  // Try exact match first
  let position = cleanTranscript.indexOf(cleanTarget);
  let confidence = 1.0;
  
  if (position === -1) {
    // Try partial match by finding the best substring
    console.log('🔍 Exact match not found, trying partial match...');
    const targetWords = cleanTarget.split(' ');
    let bestMatch = { position: -1, matchedWords: 0, confidence: 0 };
    
    // Try different lengths of the target text
    for (let wordCount = Math.max(5, Math.floor(targetWords.length * 0.7)); wordCount <= targetWords.length; wordCount++) {
      for (let startWord = 0; startWord <= targetWords.length - wordCount; startWord++) {
        const partialTarget = targetWords.slice(startWord, startWord + wordCount).join(' ');
        const partialPosition = cleanTranscript.indexOf(partialTarget);
        
        if (partialPosition >= 0) {
          const partialConfidence = wordCount / targetWords.length;
          if (partialConfidence > bestMatch.confidence) {
            bestMatch = {
              position: partialPosition,
              matchedWords: wordCount,
              confidence: partialConfidence
            };
          }
        }
      }
    }
    
    if (bestMatch.position >= 0 && bestMatch.confidence >= 0.6) {
      position = bestMatch.position;
      confidence = bestMatch.confidence;
      console.log(`🔍 Found partial match with ${(confidence * 100).toFixed(1)}% confidence`);
    }
  } else {
    console.log('🔍 Found exact text match in transcript');
  }
  
  if (position >= 0) {
    // Calculate timing based on character position
    const relativePosition = position / cleanTranscript.length;
    const estimatedStartTime = Math.max(0, relativePosition * videoDuration);
    
    // Estimate segment duration based on text length
    // Rough estimate: 150 words per minute = 2.5 words per second
    const targetWordCount = cleanTarget.split(' ').length;
    const estimatedDuration = Math.max(10, Math.min(30, targetWordCount * 0.4)); // 0.4 seconds per word
    const estimatedEndTime = Math.min(videoDuration, estimatedStartTime + estimatedDuration);
    
    console.log(`📍 Text position: ${position}/${cleanTranscript.length} (${(relativePosition * 100).toFixed(1)}%)`);
    console.log(`⏰ Estimated timing: ${estimatedStartTime.toFixed(1)}s - ${estimatedEndTime.toFixed(1)}s`);
    
    return {
      startTime: estimatedStartTime,
      endTime: estimatedEndTime,
      confidence: confidence,
      method: 'text-position'
    };
  }
  
  console.warn('⚠️ Text not found in transcript');
  return null;
}

/**
 * Identify best moments in transcript for viral clips with individual analytics
 */
export async function identifyViralMoments(transcript, transcriptionData, userTier = 'guest', videoDuration = null) {
  try {
    console.log('🎯 Identifying viral moments...');
    console.log('🔍 DEBUG - User tier for viral moments:', userTier);
    console.log('🔍 Word-level timing data available:', !!transcriptionData.words?.length);
    console.log('🔍 Words count:', transcriptionData.words?.length || 0);
    
    const basePrompt = `You are an expert at identifying viral moments in video content. 
        Analyze the transcript and identify 3-5 segments with the highest viral potential.
        
        CRITICAL INSTRUCTIONS:
        - Focus on finding the EXACT TEXT QUOTES from the transcript that would make great viral clips
        - Each transcript quote should be 10-30 words long for optimal clip length
        - Find complete sentences or compelling phrases that stand alone
        - DO NOT provide timestamps - we will calculate those precisely later
        
        Return a JSON object with a "moments" array, each moment having:
        - title (descriptive name)
        - viralScore (0-100)
        - category (engaging/educational/funny/emotional)
        - reasoning (why this moment is viral)
        - transcript (EXACT text from the original transcript - must match word for word)
        
        IMPORTANT: The 'transcript' field must contain the EXACT words from the provided transcript text, with precise punctuation and capitalization. This will be used for precise timing alignment.`;
    
    const proAnalytics = userTier === 'pro' ? `
        
        For PRO tier, also include for each moment:
        - detailedAnalytics: {
          - hookStrength (0-100): How strong the opening is
          - retentionRate (0-100): How likely to keep watching
          - engagementPotential (0-100): Like/comment/share potential
          - sentiment (string): Emotional tone analysis
          - keywordDensity (0-100): Trending keyword usage
          - paceScore (0-100): Content pacing quality
          - visualAppeal (0-100): Visual engagement potential
          - soundQuality (0-100): Audio quality assessment
          - competitorAnalysis (0-100): How it compares to viral content in this niche
          - trendAlignment (0-100): Alignment with current trends
          - audienceReach (0-100): Potential audience reach
          - platformOptimization (0-100): Optimization for target platform
        }
        - improvements (array): 5-8 SPECIFIC, ACTIONABLE suggestions like:
          * "Add a stronger hook in the first 2 seconds with a question or bold statement"
          * "Include trending keywords like [specific words] to boost discoverability"
          * "Add text overlay highlighting key numbers or statistics"
          * "Use jump cuts or faster pacing in the middle section"
          * "End with a clear call-to-action asking viewers to comment their thoughts"
          * "Add trending music that matches the content mood"
          * "Create multiple hook variations for A/B testing"
          * "Include visual elements like arrows or zoom effects to maintain attention"
        - hashtags (array): 8-12 relevant hashtags for this specific moment with engagement scores
        - contentStrategy: Recommendations for follow-up content and series ideas
        - competitiveInsights: Analysis of how this compares to trending content in the niche
        - platformTips: Platform-specific optimization recommendations (TikTok vs YouTube vs Instagram)` : '';

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{
        role: 'system',
        content: basePrompt + proAnalytics + `
        
        Focus on:
        - Strong hooks and opening statements
        - Emotional peaks
        - Surprising revelations
        - Quotable moments
        - Educational insights
        - Funny/entertaining segments
        
        Analyze each moment individually for unique characteristics.`
      }, {
        role: 'user',
        content: `Full Transcript (${transcript.length} characters):\n\n"${transcript}"\n\nUser Tier: ${userTier}\n\nINSTRUCTIONS:\n1. Find the most engaging, quotable, or compelling EXACT TEXT from this transcript\n2. Each moment's transcript field must contain the EXACT words from above (copy-paste precision)\n3. Focus on complete sentences or powerful phrases that would make great standalone clips\n4. Look for hooks, emotional moments, key insights, or surprising statements\n\nReturn JSON with moments array containing ${userTier === 'pro' ? 'detailed analytics' : 'basic analysis'}.`
      }],
      response_format: { type: 'json_object' },
      temperature: 0.8,
      max_tokens: userTier === 'pro' ? 3000 : 2000
    });

    const responseContent = completion.choices[0].message.content;
    console.log('🎯 GPT viral moments response length:', responseContent?.length);
    console.log('🔍 DEBUG - Raw viral moments response for', userTier, ':', responseContent);
    
    if (!responseContent || responseContent === 'null' || responseContent.trim() === '') {
      console.log('⚠️ Empty or null response from GPT, returning empty array');
      return [];
    }
    
    try {
      const result = JSON.parse(responseContent);
      console.log('🎯 Parsed viral moments result keys:', Object.keys(result || {}));
      console.log('🔍 DEBUG - Parsed viral moments for', userTier, ':', JSON.stringify(result, null, 2));
      
      let moments = [];
      // Handle different possible response formats
      if (result && result.moments && Array.isArray(result.moments)) {
        moments = result.moments;
      } else if (Array.isArray(result)) {
        moments = result;
      } else if (result && result.viralMoments && Array.isArray(result.viralMoments)) {
        moments = result.viralMoments;
      } else {
        console.log('⚠️ No valid moments array found in GPT response, returning empty array');
        return [];
      }
      
      console.log('🔍 Processing', moments.length, 'moments for precise timing');
      
      // MULTI-LAYERED timing search with priority order for better accuracy
      const preciselyTimedMoments = moments.map((moment, index) => {
        console.log(`🔍 Processing moment ${index + 1}: "${moment.transcript?.substring(0, 50)}..."`);
        
        let finalStartTime, finalEndTime, timingMethod, confidence;
        
        if (moment.transcript) {
          // Priority 1: Try word-level timing (most accurate)
          console.log(`🔍 Trying word-level timing first...`);
          const wordMatch = findPreciseTimestamps(
            moment.transcript, 
            transcriptionData.words, 
            transcriptionData.segments
          );
          
          if (wordMatch && wordMatch.score > 0.7) {
            finalStartTime = wordMatch.startTime;
            finalEndTime = wordMatch.endTime;
            timingMethod = wordMatch.method;
            confidence = wordMatch.score;
            console.log(`✅ Using high-confidence ${wordMatch.method} timing for moment ${index + 1}: ${finalStartTime}s - ${finalEndTime}s`);
          } else {
            // Priority 2: Try improved text-based search
            console.log(`🔍 Word-level timing insufficient, trying improved text search...`);
            const textMatch = findTextInTranscript(moment.transcript, transcript, videoDuration);
            
            if (textMatch && textMatch.confidence > 0.6) {
              finalStartTime = textMatch.startTime;
              finalEndTime = textMatch.endTime;
              timingMethod = textMatch.method;
              confidence = textMatch.confidence;
              console.log(`✅ Using improved text-position timing for moment ${index + 1}: ${finalStartTime}s - ${finalEndTime}s`);
            } else if (wordMatch) {
              // Priority 3: Use word-level timing even with lower confidence
              finalStartTime = wordMatch.startTime;
              finalEndTime = wordMatch.endTime;
              timingMethod = wordMatch.method + '-lowconf';
              confidence = wordMatch.score;
              console.log(`⚠️ Using low-confidence ${wordMatch.method} timing for moment ${index + 1}: ${finalStartTime}s - ${finalEndTime}s`);
            } else {
              // Priority 4: Fallback timing
              finalStartTime = (index / moments.length) * (videoDuration || 300);
              finalEndTime = Math.min((videoDuration || 300), finalStartTime + 15);
              timingMethod = 'fallback';
              confidence = 0.2;
              console.warn(`⚠️ Using fallback timing for moment ${index + 1}: ${finalStartTime}s - ${finalEndTime}s`);
            }
          }
        } else {
          // No transcript text available
          finalStartTime = (index / moments.length) * (videoDuration || 300);
          finalEndTime = Math.min((videoDuration || 300), finalStartTime + 15);
          timingMethod = 'no-transcript-fallback';
          confidence = 0.1;
          console.warn(`⚠️ No transcript text available for moment ${index + 1}, using fallback timing`);
        }
        
        return {
          ...moment,
          startTime: finalStartTime,
          endTime: finalEndTime,
          startTimeSeconds: finalStartTime,
          endTimeSeconds: finalEndTime,
          timingMethod: timingMethod,
          timingConfidence: confidence,
          preciseTimingUsed: confidence > 0.6
        };
      });
      
      console.log('✅ Processed all moments with timing data');
      return preciselyTimedMoments;
    } catch (parseError) {
      console.error('❌ JSON parse error:', parseError.message);
      console.log('⚠️ Invalid JSON from GPT, returning empty array');
      return [];
    }
  } catch (error) {
    console.error('❌ Viral moments identification error:', error);
    throw error;
  }
}

/**
 * Complete AI analysis pipeline
 */
export async function performCompleteAnalysis(videoPath, userTier = 'guest', progressCallback = null) {
  try {
    console.log('🚀 Starting complete AI analysis...');
    console.log('📁 Video path:', videoPath);
    console.log('👤 User tier:', userTier);
    
    // Check if video file exists
    if (!await fs.pathExists(videoPath)) {
      throw new Error(`Video file not found: ${videoPath}`);
    }
    
    progressCallback?.(10, 'Initializing AI analysis...');
    
    // Step 1: Extract audio (20% progress)
    progressCallback?.(20, 'Extracting audio from video...');
    let audioPath;
    try {
      audioPath = await extractAudioFromVideo(videoPath);
      progressCallback?.(35, 'Audio extraction completed');
    } catch (audioError) {
      console.error('❌ Audio extraction failed:', audioError.message);
      throw new Error(`Audio extraction failed: ${audioError.message}`);
    }
    
    // Step 2: Transcribe audio (50% progress)
    progressCallback?.(50, 'Transcribing audio to text...');
    let transcriptionData;
    try {
      transcriptionData = await transcribeAudio(audioPath);
      progressCallback?.(60, 'Transcription completed');
    } catch (transcriptionError) {
      console.error('❌ Transcription failed:', transcriptionError.message);
      // Cleanup audio file before throwing
      await fs.remove(audioPath).catch(() => {});
      throw new Error(`Transcription failed: ${transcriptionError.message}`);
    }
    
    // Step 3: Analyze viral potential (70% progress)
    progressCallback?.(70, 'Analyzing viral potential...');
    let viralAnalysis;
    try {
      viralAnalysis = await analyzeViralPotential(transcriptionData.text, userTier);
      progressCallback?.(80, 'Viral analysis completed');
    } catch (analysisError) {
      console.error('❌ Viral analysis failed:', analysisError.message);
      // Continue with basic analysis
      viralAnalysis = {
        viralScore: 75,
        category: 'engaging',
        reasoning: 'Basic analysis due to AI service error'
      };
    }
    
    // Step 4: Identify viral moments (90% progress)
    progressCallback?.(90, 'Identifying best viral moments...');
    let viralMoments = [];
    try {
      // Get video duration for better timestamp estimation
      let videoDuration = null;
      try {
        const ffmpeg = (await import('fluent-ffmpeg')).default;
        videoDuration = await new Promise((resolve) => {
          ffmpeg.ffprobe(videoPath, (err, metadata) => {
            if (err) resolve(null);
            else resolve(metadata.format.duration);
          });
        });
      } catch (durationError) {
        console.warn('⚠️ Could not get video duration for viral moments:', durationError.message);
      }
      
      viralMoments = await identifyViralMoments(transcriptionData.text, transcriptionData, userTier, videoDuration);
      progressCallback?.(95, 'Viral moments identified');
    } catch (momentError) {
      console.error('⚠️ Viral moments identification failed, continuing with fallback:', momentError.message);
      viralMoments = []; // Fallback to empty array
    }
    
    // Cleanup temporary audio file
    try {
      await fs.remove(audioPath);
      console.log('🧹 Temporary audio file cleaned up');
    } catch (cleanupError) {
      console.warn('⚠️ Failed to cleanup audio file:', cleanupError.message);
    }
    
    progressCallback?.(100, 'Analysis complete!');
    
    console.log('✅ Complete AI analysis finished successfully');
    
    return {
      transcript: transcriptionData.text,
      words: transcriptionData.words,
      segments: transcriptionData.segments,
      viralAnalysis,
      viralMoments,
      analysisTimestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('❌ Complete analysis error:', error);
    progressCallback?.(0, `Analysis failed: ${error.message}`);
    throw error;
  }
}