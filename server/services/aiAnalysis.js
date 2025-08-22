import OpenAI from 'openai';
import Groq from 'groq-sdk';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs-extra';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

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
    ffmpeg(videoPath)
      .toFormat('wav')
      .audioChannels(1)
      .audioFrequency(16000)
      .output(audioPath)
      .on('end', () => {
        console.log('✅ Audio extraction completed');
        resolve(audioPath);
      })
      .on('error', (error) => {
        console.error('❌ Audio extraction error:', error);
        reject(error);
      })
      .run();
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
    
    const systemPrompt = `You are an expert social media content analyst specializing in viral content prediction. 
    Analyze the provided transcript and return a JSON response with viral scoring and insights.

    For GUEST tier users, provide:
    - viralScore (0-100)
    - category (engaging/educational/funny/emotional)
    - reasoning (brief explanation)

    For PRO tier users, provide everything above plus:
    - detailedAnalytics (hookStrength, retentionRate, engagementPotential, sentiment, keywordDensity, paceScore, visualAppeal, soundQuality)
    - improvements (array of 3-5 specific suggestions)
    - hashtags (array of relevant hashtags)
    - bestMoments (array of timestamp ranges with viral potential)

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
        }
        - improvements (array): 3-4 specific suggestions for this moment
        - hashtags (array): 4-6 relevant hashtags for this specific moment` : '';

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
    
    if (!responseContent || responseContent === 'null' || responseContent.trim() === '') {
      console.log('⚠️ Empty or null response from GPT, returning empty array');
      return [];
    }
    
    try {
      const result = JSON.parse(responseContent);
      console.log('🎯 Parsed viral moments result keys:', Object.keys(result || {}));
      
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
    
    // Step 1: Extract audio (20% progress)
    progressCallback?.(20, 'Extracting audio from video...');
    const audioPath = await extractAudioFromVideo(videoPath);
    
    // Step 2: Transcribe audio (50% progress)
    progressCallback?.(50, 'Transcribing audio to text...');
    const transcriptionData = await transcribeAudio(audioPath);
    
    // Step 3: Analyze viral potential (70% progress)
    progressCallback?.(70, 'Analyzing viral potential...');
    const viralAnalysis = await analyzeViralPotential(transcriptionData.text, userTier);
    
    // Step 4: Identify viral moments (90% progress)
    progressCallback?.(90, 'Identifying best viral moments...');
    let viralMoments = [];
    try {
      viralMoments = await identifyViralMoments(transcriptionData.text, transcriptionData, userTier);
    } catch (momentError) {
      console.error('⚠️ Viral moments identification failed, continuing with fallback:', momentError.message);
      viralMoments = []; // Fallback to empty array
    }
    
    // Cleanup temporary audio file
    await fs.remove(audioPath);
    
    progressCallback?.(100, 'Analysis complete!');
    
    console.log('✅ Complete AI analysis finished');
    
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
    throw error;
  }
}