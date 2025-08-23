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
 * Extract audio from video file for transcription
 */
export async function extractAudioFromVideo(videoPath) {
  const audioPath = videoPath.replace(path.extname(videoPath), '_audio.wav');
  
  return new Promise((resolve, reject) => {
    console.log('🎵 Starting audio extraction from:', videoPath);
    console.log('🎵 Output audio path:', audioPath);
    
    // Add timeout to prevent hanging
    const timeout = setTimeout(() => {
      console.error('⏰ Audio extraction timeout after 60 seconds');
      reject(new Error('Audio extraction timeout - ffmpeg took too long'));
    }, 60000); // 60 second timeout

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
        // Verify the audio file was created
        fs.pathExists(audioPath).then(exists => {
          if (exists) {
            resolve(audioPath);
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
 * Transcribe audio using Groq Whisper (fast and free)
 */
export async function transcribeAudio(audioPath) {
  try {
    console.log('🎯 Starting transcription with Groq Whisper...');
    
    const audioBuffer = await fs.readFile(audioPath);
    const audioFile = new File([audioBuffer], path.basename(audioPath), {
      type: 'audio/wav'
    });

    const transcription = await groq.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-large-v3',
      language: 'en',
      response_format: 'verbose_json',
      timestamp_granularities: ['word']
    });

    console.log('✅ Transcription completed');
    return {
      text: transcription.text,
      words: transcription.words || [],
      segments: transcription.segments || []
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
export async function identifyViralMoments(transcript, transcriptionData, userTier = 'guest') {
  try {
    console.log('🎯 Identifying viral moments...');
    console.log('🔍 DEBUG - User tier for viral moments:', userTier);
    
    const basePrompt = `You are an expert at identifying viral moments in video content. 
        Analyze the transcript and identify 3-5 segments with the highest viral potential.
        
        Return a JSON object with a "moments" array, each moment having:
        - startTime (seconds)
        - endTime (seconds) 
        - title (descriptive name)
        - viralScore (0-100)
        - category (engaging/educational/funny/emotional)
        - reasoning (why this moment is viral)
        - transcript (exact text for this segment)`;
    
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
        content: `Transcript: "${transcript}"\n\nUser Tier: ${userTier}\n\nIdentify the best viral moments with ${userTier === 'pro' ? 'detailed individual analytics' : 'basic analysis'} for each. Return JSON object with moments array.`
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
      viralMoments = await identifyViralMoments(transcriptionData.text, transcriptionData, userTier);
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