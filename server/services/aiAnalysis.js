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
  
  // Remove common transcription prompts and artifacts
  const promptsToRemove = [
    /transcribe accurately and completely\.?\s*/gi,
    /accurately and completely\.?\s*/gi,
    /transcribe the complete audio without truncation[.\s]*/gi,
    /transcribe the cmoplete audio without tranuncation[.\s]*/gi,
    /transcribe the cmoplet audi owiotuut tuncation[.\s]*/gi,
    /include all spoken words and maintain natural speech patterns[.\s]*/gi,
    /include all spoiekn words and maintain natural speech apttern[.\s]*/gi,
    /please transcribe the complete audio[.\s]*/gi,
    /this is a business\/motivational speech[.\s]*/gi,
    /this is part \d+ of \d+ of a[.\s]*/gi,
    /maintain natural speech patterns and include all spoken words[.\s]*/gi,
    /transcription by castingwords/gi,
    /trnasciption by castingwords/gi,
    /thank you for watching[.\s]*/gi,
    /thank you for ewatching[.\s]*/gi,
    /thank you\.?\s*$/gi,
    /^transcribe[.\s]*/gi,
    /^please transcribe[.\s]*/gi,
    /business\/motivational content[.\s]*/gi,
    /audio segment \d+\/\d+[.\s]*/gi,
    /complete accurate transcription required[.\s]*/gi
  ];
  
  // Remove each prompt pattern
  for (const pattern of promptsToRemove) {
    cleanText = cleanText.replace(pattern, '');
  }
  
  // Remove repeated phrases (common in transcription errors)
  cleanText = cleanText.replace(/(.{10,}?)\s+\1+/g, '$1'); // Remove repeated phrases of 10+ chars
  
  // Clean up extra whitespace and normalize
  cleanText = cleanText
    .replace(/\s+/g, ' ')  // Multiple spaces to single space
    .replace(/\.\s*\./g, '.') // Remove double periods
    .replace(/,\s*,/g, ',') // Remove double commas
    .trim();
  
  // Remove leading/trailing punctuation artifacts
  cleanText = cleanText.replace(/^[.,;:\s]+/, '').replace(/[.,;:\s]+$/, '');
  
  // If the result is too short or seems to be just artifacts, return empty
  if (cleanText.length < 10 || 
      cleanText.toLowerCase().includes('transcribe') || 
      cleanText.toLowerCase().includes('castingwords')) {
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
    
    // Try different configurations if transcription fails or truncates
    const transcriptionConfigs = [
      {
        model: 'whisper-large-v3',
        response_format: 'text',
        language: 'en',
        temperature: 0.0
      },
      {
        model: 'whisper-large-v3',
        language: 'en',
        response_format: 'verbose_json',
        timestamp_granularities: ['word'],
        temperature: 0.0,
      },
      {
        model: 'whisper-large-v3-turbo',
        language: 'en', 
        response_format: 'text',
        temperature: 0.0
      },
      {
        model: 'whisper-large-v3',
        language: 'en',
        response_format: 'json',
        temperature: 0.1
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
    
    // More comprehensive truncation detection
    const endsAbruptly = transcriptionText.length > 10 && (
      !['.', '!', '?'].includes(lastChar) || // No sentence ending punctuation
      transcriptionText.endsWith('...') || // Explicit truncation
      /\b\w+$/.test(transcriptionText.trim()) // Ends with incomplete word
    );
    
    // Also check for very short transcriptions that might be incomplete
    const seemsIncomplete = transcriptionText.length < 50 && transcriptionText.trim().split(' ').length < 10;
    
    if (endsAbruptly || seemsIncomplete) {
      console.log('⚠️ POTENTIAL TRUNCATION DETECTED');
      console.log('⚠️ Text length:', transcriptionText.length);
      console.log('⚠️ Ends abruptly:', endsAbruptly);
      console.log('⚠️ Seems incomplete:', seemsIncomplete);
      console.log('⚠️ Last 50 characters:', JSON.stringify(transcriptionText.slice(-50)));
      
      // If truncated or incomplete, try splitting and re-transcribing 
      console.log('🔄 Attempting to re-transcribe with audio splitting...');
      try {
        const chunkedResult = await transcribeAudioInChunks(audioPath);
        
        // Only use chunked result if it's significantly longer
        if (chunkedResult.text && chunkedResult.text.length > transcriptionText.length * 1.2) {
          console.log('✅ Chunked transcription is longer, using that result');
          return chunkedResult;
        } else {
          console.log('⚠️ Chunked transcription not significantly better, using original');
        }
      } catch (chunkError) {
        console.warn('⚠️ Chunk transcription failed, returning original result:', chunkError.message);
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
 * Identify best moments in transcript for viral clips with individual analytics
 */
export async function identifyViralMoments(transcript, transcriptionData, userTier = 'guest', videoDuration = null) {
  try {
    console.log('🎯 Identifying viral moments...');
    console.log('🔍 DEBUG - User tier for viral moments:', userTier);
    
    const basePrompt = `You are an expert at identifying viral moments in video content. 
        Analyze the transcript and identify 3-5 segments with the highest viral potential.
        
        IMPORTANT: Create SHORT, FOCUSED viral moments that are 10-20 seconds long maximum.
        Use word-based timing estimation. If the transcript is ~9000 characters and video is ~520 seconds, 
        estimate roughly 17-18 characters per second. Be very precise with timestamps.
        
        Return a JSON object with a "moments" array, each moment having:
        - startTime (seconds) - Be precise and conservative
        - endTime (seconds) - Keep segments 10-20 seconds long (no more than 20 seconds!)
        - title (descriptive name)
        - viralScore (0-100)
        - category (engaging/educational/funny/emotional)
        - reasoning (why this moment is viral)
        - transcript (exact text for this segment - ONE complete sentence or thought only)`;
    
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
        content: `Transcript: "${transcript}"\n\nUser Tier: ${userTier}\n\nVideo Duration: ${videoDuration || 'unknown'} seconds\nTranscript Length: ${transcript.length} characters\n\nIdentify the best viral moments with ${userTier === 'pro' ? 'detailed individual analytics' : 'basic analysis'} for each. Return JSON object with moments array.`
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
      
      // Handle different possible response formats
      if (result && result.moments && Array.isArray(result.moments)) {
        return result.moments;
      } else if (Array.isArray(result)) {
        return result;
      } else if (result && result.viralMoments && Array.isArray(result.viralMoments)) {
        return result.viralMoments;
      } else {
        console.log('⚠️ No valid moments array found in GPT response, returning empty array');
        return [];
      }
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