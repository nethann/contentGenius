import React, { useState, useRef } from "react";
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useUserTier } from '../contexts/UserTierContext';
import {
  Upload,
  Play,
  Scissors,
  Download,
  Clock,
  Zap,
  FileVideo,
  FileAudio,
  AlertCircle,
  Mic,
  ArrowLeft,
  LogOut,
} from "lucide-react";

const ViralClipGenerator = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { userTier, getTierLimits, canUploadVideo } = useUserTier();
  const [file, setFile] = useState(null);
  const [processing, setProcessing] = useState(false);

  const handleBackToDashboard = () => {
    navigate('/app');
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  // Client-side function to highlight attention-grabbing words (mirrors server-side logic)
  const highlightAttentionWordsClient = (text) => {
    let highlightedText = text.replace(/[\r\n]+/g, ' ').trim();
    
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
    
    // Apply darker orange highlighting to attention words
    attentionWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      highlightedText = highlightedText.replace(regex, `<span style="color: #FF6B35; font-weight: bold; text-shadow: 0 0 4px #FF6B35;">${word}</span>`);
    });
    
    // Highlight numbers and percentages
    highlightedText = highlightedText.replace(/\b\d+(\.\d+)?\s*%\b/g, '<span style="color: #FF6B35; font-weight: bold; text-shadow: 0 0 4px #FF6B35;">$&</span>');
    highlightedText = highlightedText.replace(/\b\d+x\b/gi, '<span style="color: #FF6B35; font-weight: bold; text-shadow: 0 0 4px #FF6B35;">$&</span>');
    // Fixed: Only highlight complete money amounts, not standalone $ symbols
    highlightedText = highlightedText.replace(/\$\d+(?:,\d{3})*(?:\.\d{2})?\b/g, '<span style="color: #FF6B35; font-weight: bold; text-shadow: 0 0 4px #FF6B35;">$&</span>');
    
    return highlightedText;
  };
  const [extractedMoments, setExtractedMoments] = useState([]);
  const [progress, setProgress] = useState(0);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [currentStep, setCurrentStep] = useState("");
  const [error, setError] = useState(null);
  const [generatingClips, setGeneratingClips] = useState(false);
  const [clipProgress, setClipProgress] = useState({});
  const [uploadedFileInfo, setUploadedFileInfo] = useState(null);
  const [downloadedClipsCount, setDownloadedClipsCount] = useState(0);
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);

  // API URL for backend
  const API_URL = 'http://localhost:3001/api';



  const handleFileUpload = async (event) => {
    const uploadedFile = event.target.files[0];
    if (!uploadedFile) return;

    const validTypes = [
      "video/mp4",
      "audio/mp3", 
      "audio/mpeg",
      "video/quicktime",
      "audio/wav",
    ];

    if (!validTypes.includes(uploadedFile.type)) {
      setError("Please upload an MP4 video, MP3 audio, or WAV file");
      return;
    }

    // Check video duration for tier restrictions
    const checkVideoDuration = () => {
      return new Promise((resolve) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.onloadedmetadata = () => {
          window.URL.revokeObjectURL(video.src);
          resolve(video.duration);
        };
        video.src = URL.createObjectURL(uploadedFile);
      });
    };

    try {
      const duration = await checkVideoDuration();
      const tierLimits = getTierLimits();
      
      if (!canUploadVideo(duration)) {
        setError(`Video duration (${Math.ceil(duration / 60)} minutes) exceeds your ${tierLimits.name} tier limit of ${tierLimits.maxVideoDuration / 60} minutes. Please upgrade to Pro for unlimited video length.`);
        return;
      }
    } catch (error) {
      console.warn('Could not check video duration:', error);
      // Continue with upload if duration check fails
    }

    setFile(uploadedFile);
    setExtractedMoments([]);
    setAnalysisComplete(false);
    setProgress(0);
    setError(null);
    setProcessing(true);
    setCurrentStep("Uploading file to server...");

    try {
      // Upload file to backend
      const formData = new FormData();
      formData.append('video', uploadedFile);

      const response = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();
      setUploadedFileInfo(result.file);
      
      // Auto-start analysis after upload
      setTimeout(() => {
        analyzeContent(result.file);
      }, 500);
      
    } catch (error) {
      console.error('Upload error:', error);
      setError(`Upload failed: ${error.message}`);
      setProcessing(false);
    }
  };

  const generateVideoClip = async (moment) => {
    if (!uploadedFileInfo) {
      setError("No uploaded file available");
      return;
    }

    setGeneratingClips(true);
    setClipProgress({ ...clipProgress, [moment.id]: 0 });

    try {
      setCurrentStep(`Transcribing segment ${moment.id}...`);
      setClipProgress((prev) => ({ ...prev, [moment.id]: 20 }));

      // Call backend to transcribe this segment
      const response = await fetch(`${API_URL}/transcribe-segment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          filename: uploadedFileInfo.filename,
          startTime: moment.startTimeSeconds,
          endTime: moment.endTimeSeconds,
          segmentId: moment.id
        })
      });

      setClipProgress((prev) => ({ ...prev, [moment.id]: 60 }));

      if (!response.ok) {
        throw new Error('Transcription failed');
      }

      const transcriptionResult = await response.json();
      setClipProgress((prev) => ({ ...prev, [moment.id]: 85 }));

      // Update the moment with real transcript and captions including word-level data
      const updatedMoments = extractedMoments.map((m) =>
        m.id === moment.id
          ? {
              ...m,
              title: transcriptionResult.title || m.title,
              transcript: transcriptionResult.transcript,
              endTimeSeconds: transcriptionResult.adjustedEndTime || m.endTimeSeconds,
              duration: transcriptionResult.actualDuration ? `${transcriptionResult.actualDuration}s` : m.duration,
              subtitles: transcriptionResult.captions,
              highlightedSubtitles: transcriptionResult.highlightedCaptions,
              words: transcriptionResult.words || [], // Store word-level timestamps for karaoke highlighting
              clipGenerated: true,
              transcribed: true,
              wordCount: transcriptionResult.wordCount
            }
          : m
      );
      setExtractedMoments(updatedMoments);

      setClipProgress((prev) => ({ ...prev, [moment.id]: 100 }));

      // Show the video clip modal with real transcript
      setTimeout(() => {
        showVideoClipModal(updatedMoments.find((m) => m.id === moment.id));
      }, 500);

      console.log(
        `✅ Successfully transcribed segment ${moment.id}: "${transcriptionResult.transcript.substring(0, 50)}..."`
      );
    } catch (error) {
      console.error("Transcription error:", error);
      setError(`Transcription failed: ${error.message}`);
      setClipProgress((prev) => ({ ...prev, [moment.id]: undefined }));
    } finally {
      setGeneratingClips(false);
      setTimeout(() => {
        setClipProgress((prev) => {
          const newProgress = { ...prev };
          delete newProgress[moment.id];
          return newProgress;
        });
      }, 3000);
    }
  };

  const showVideoClipModal = (moment) => {
    if (!moment.clipGenerated || !uploadedFileInfo) {
      alert("Generate clip first");
      return;
    }

    // Create modal
    const modal = document.createElement("div");
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
      background: rgba(0,0,0,0.95); z-index: 1000; display: flex; 
      align-items: center; justify-content: center; flex-direction: column;
    `;

    // Create video container
    const videoContainer = document.createElement("div");
    videoContainer.style.cssText = `
      position: relative; max-width: 90%; max-height: 80%; 
      border-radius: 12px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.8);
    `;

    // Create video element
    const video = document.createElement("video");
    video.style.cssText = "width: 800px; height: 450px; display: block;";
    video.controls = false;
    video.muted = false;
    video.currentTime = moment.startTimeSeconds || 0;

    // Set video source  
    const fileUrl = URL.createObjectURL(file);
    video.src = fileUrl;
    
    // Store current caption index
    let currentCaptionIndex = 0;

    // Create captions overlay for backend transcripts
    const captionsOverlay = document.createElement("div");
    captionsOverlay.style.cssText = `
      position: absolute; bottom: 15px; left: 15px; right: 15px;
      color: white; padding: 8px 12px; border-radius: 6px; 
      font-size: 20px; font-weight: 600; text-align: center; 
      line-height: 1.3; letter-spacing: 0.3px;
      text-shadow: 1px 1px 1px rgba(0,0,0,1), -1px -1px 1px rgba(0,0,0,1);
      opacity: 1; transition: all 0.3s ease;
      font-family: Arial, sans-serif;
      pointer-events: none;
    `;
    
    // Show transcript or captions based on what's available
    if (moment.transcribed && moment.transcript) {
      captionsOverlay.innerHTML = `
        <div style="color: white; font-size: 18px;">
          ${moment.transcript}
        </div>
      `;
    } else {
      captionsOverlay.innerHTML = `
        <div style="color: #ffa500; font-style: italic; opacity: 0.8;">
          Generate clip first to see transcript
        </div>
      `;
    }

    // Create controls
    const controls = document.createElement("div");
    controls.style.cssText = `
      margin-top: 20px; display: flex; align-items: center; gap: 15px;
      background: rgba(255,255,255,0.1); padding: 15px 25px; border-radius: 50px;
      backdrop-filter: blur(10px);
    `;

    const playBtn = document.createElement("button");
    playBtn.innerHTML = "▶";
    playBtn.style.cssText = `
      background: #8b5cf6; border: none; color: white; 
      width: 50px; height: 50px; border-radius: 50%; font-size: 18px;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      transition: background-color 0.3s ease;
    `;

    const progressBar = document.createElement("div");
    progressBar.style.cssText = `
      width: 300px; height: 6px; background: rgba(255,255,255,0.3);
      border-radius: 3px; position: relative; cursor: pointer;
    `;

    const progressFill = document.createElement("div");
    progressFill.style.cssText = `
      height: 100%; background: #8b5cf6; border-radius: 3px; width: 0%;
      transition: width 0.1s ease;
    `;
    progressBar.appendChild(progressFill);

    const timeDisplay = document.createElement("span");
    timeDisplay.style.cssText =
      "color: white; font-size: 14px; min-width: 80px;";
    timeDisplay.textContent = "0:00 / 0:00";

    // Close button (removed speech toggle button since captions are automatic)

    const downloadBtn = document.createElement("button");
    downloadBtn.innerHTML = "⬇";
    downloadBtn.style.cssText = `
      position: absolute; top: 20px; right: 80px; 
      background: rgba(0,128,0,0.8); border: none; color: white; 
      font-size: 18px; width: 45px; height: 45px; border-radius: 50%; 
      cursor: pointer; backdrop-filter: blur(10px);
      transition: background-color 0.3s ease;
    `;
    downloadBtn.title = "Download video with subtitles";

    const closeBtn = document.createElement("button");
    closeBtn.innerHTML = "✕";
    closeBtn.style.cssText = `
      position: absolute; top: 20px; right: 20px; 
      background: rgba(255,255,255,0.2); border: none; color: white; 
      font-size: 20px; width: 45px; height: 45px; border-radius: 50%; 
      cursor: pointer; backdrop-filter: blur(10px);
    `;

    // Caption display system with word-by-word animation
    const updateCaptions = () => {
      const highlightedSubtitles = moment.highlightedSubtitles || moment.subtitles;
      if (!highlightedSubtitles || highlightedSubtitles.length === 0) return;
      
      const currentTime = video.currentTime - moment.startTimeSeconds;
      const currentCaption = highlightedSubtitles.find(caption => 
        currentTime >= caption.start && currentTime <= caption.end
      );
      
      if (currentCaption) {
        // Create animated word-by-word highlighting
        const words = currentCaption.text.split(' ');
        const captionDuration = currentCaption.end - currentCaption.start;
        const timePerWord = captionDuration / words.length;
        const captionProgress = (currentTime - currentCaption.start) / captionDuration;
        const currentWordIndex = Math.floor(captionProgress * words.length);
        
        const animatedHTML = words.map((word, index) => {
          if (index < currentWordIndex) {
            // Already spoken - show in white
            return `<span style="color: white; opacity: 1;">${word}</span>`;
          } else if (index === currentWordIndex) {
            // Currently being spoken - highlight in orange
            return `<span style="color: #FF6B35; opacity: 1; text-shadow: 0 0 6px #FF6B35; font-weight: bold;">${word}</span>`;
          } else {
            // Not yet spoken - show in white
            return `<span style="color: white; opacity: 1;">${word}</span>`;
          }
        }).join(' ');
        
        captionsOverlay.innerHTML = `
          <div style="color: white; font-size: 20px; font-weight: 600; font-family: Arial, sans-serif; transition: all 0.1s ease;">
            ${animatedHTML}
          </div>
        `;
      } else if (moment.transcript) {
        // Apply highlighting to full transcript as well for when no specific caption is active
        const highlightedTranscript = highlightAttentionWordsClient(moment.transcript);
        captionsOverlay.innerHTML = `
          <div style="color: white; font-size: 18px; opacity: 0.9; font-family: Arial, sans-serif;">
            ${highlightedTranscript}
          </div>
        `;
      }
    };
    
    // Video playback logic
    let isPlaying = false;
    const segmentDuration = moment.endTimeSeconds - moment.startTimeSeconds;

    const updateProgress = () => {
      const currentRelativeTime = video.currentTime - moment.startTimeSeconds;
      const progress =
        Math.min(Math.max(currentRelativeTime / segmentDuration, 0), 1) * 100;
      progressFill.style.width = `${progress}%`;

      const minutes = Math.floor(currentRelativeTime / 60);
      const seconds = Math.floor(currentRelativeTime % 60);
      const totalMinutes = Math.floor(segmentDuration / 60);
      const totalSeconds = Math.floor(segmentDuration % 60);
      timeDisplay.textContent = `${minutes}:${seconds
        .toString()
        .padStart(2, "0")} / ${totalMinutes}:${totalSeconds
        .toString()
        .padStart(2, "0")}`;
      
      // Update captions based on current time
      updateCaptions();
    };

    // Play/pause functionality
    const togglePlay = () => {
      if (isPlaying) {
        video.pause();
        playBtn.innerHTML = "▶";
        playBtn.style.backgroundColor = "#8b5cf6";
        isPlaying = false;
      } else {
        // Ensure we start at the right time
        if (
          video.currentTime < moment.startTimeSeconds ||
          video.currentTime >= moment.endTimeSeconds
        ) {
          video.currentTime = moment.startTimeSeconds;
        }
        video.play();
        playBtn.innerHTML = "⏸";
        playBtn.style.backgroundColor = "#f59e0b";
        isPlaying = true;
      }
    };

    // Video event listeners
    video.addEventListener("timeupdate", () => {
      // Ensure we stay within the viral moment timeframe
      if (video.currentTime >= moment.endTimeSeconds) {
        video.pause();
        playBtn.innerHTML = "▶";
        playBtn.style.backgroundColor = "#8b5cf6";
        isPlaying = false;
        video.currentTime = moment.startTimeSeconds;
      }
      
      // If video goes before the start time, jump to start
      if (video.currentTime < moment.startTimeSeconds) {
        video.currentTime = moment.startTimeSeconds;
      }

      updateProgress();
    });

    video.addEventListener("play", () => {
      // Video started playing
    });

    video.addEventListener("pause", () => {
      // Video paused
    });

    video.addEventListener("ended", () => {
      // Video ended
    });

    video.addEventListener("loadedmetadata", () => {
      // Ensure video starts at the correct viral moment timestamp
      const startTime = moment.startTimeSeconds || 0;
      video.currentTime = startTime;
      updateProgress();
      console.log(`Video loaded. Set to viral moment start: ${startTime}s for "${moment.title}"`);
    });

    // Initialize video position to the exact viral moment
    const startTime = moment.startTimeSeconds || 0;
    video.currentTime = startTime;
    setTimeout(() => {
      video.currentTime = startTime;
      console.log(`Video positioned at ${startTime}s for viral moment: "${moment.title}"`);
    }, 200);

    // Progress bar click to seek
    progressBar.onclick = (e) => {
      const rect = progressBar.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickPercent = clickX / rect.width;
      const newTime = moment.startTimeSeconds + clickPercent * segmentDuration;
      video.currentTime = Math.min(
        Math.max(newTime, moment.startTimeSeconds),
        moment.endTimeSeconds - 0.1
      );
    };

    // Download video with subtitles
    const downloadVideo = async () => {
      if (!moment.subtitles || moment.subtitles.length === 0) {
        alert('No subtitles available for download');
        return;
      }

      try {
        downloadBtn.innerHTML = '⟳';
        downloadBtn.disabled = true;
        downloadBtn.style.backgroundColor = 'rgba(128,128,128,0.8)';

        const response = await fetch(`${API_URL}/download-video`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            filename: uploadedFileInfo.filename,
            startTime: moment.startTimeSeconds,
            endTime: moment.endTimeSeconds,
            subtitles: moment.subtitles,
            words: moment.words || [], // Include word-level timestamps for karaoke highlighting
            segmentId: moment.id
          })
        });

        if (!response.ok) {
          throw new Error('Download failed');
        }

        // Create a blob from the response and trigger download
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `segment-${moment.id}-with-subtitles.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log('✅ Video downloaded successfully');
      } catch (error) {
        console.error('Download error:', error);
        alert('Download failed: ' + error.message);
      } finally {
        downloadBtn.innerHTML = '⬇';
        downloadBtn.disabled = false;
        downloadBtn.style.backgroundColor = 'rgba(0,128,0,0.8)';
      }
    };

    // Event listeners
    playBtn.onclick = togglePlay;
    downloadBtn.onclick = downloadVideo;

    // Keyboard controls
    const handleKeyPress = (e) => {
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      } else if (e.code === "Escape") {
        closeBtn.click();
      }
      // Removed manual caption toggle - captions are automatic
    };

    document.addEventListener("keydown", handleKeyPress);

    // Clean up on close
    const cleanup = () => {
      document.removeEventListener("keydown", handleKeyPress);
      video.pause();
      URL.revokeObjectURL(fileUrl);
    };

    modal.onclick = (e) => {
      if (e.target === modal) {
        cleanup();
        document.body.removeChild(modal);
      }
    };

    closeBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      cleanup();
      document.body.removeChild(modal);
    };

    // Initialize captions display
    setTimeout(() => {
      if (moment.transcribed && moment.transcript) {
        console.log('📺 Modal ready with backend transcript');
      } else {
        console.log('📺 Modal ready - transcript will be generated');
      }
    }, 100);

    // Add title
    const title = document.createElement("h3");
    title.textContent = moment.title;
    title.style.cssText = `
      color: white; font-size: 24px; margin-bottom: 20px; 
      text-align: center; font-weight: bold;
    `;

    // Assemble the modal
    controls.appendChild(playBtn);
    controls.appendChild(progressBar);
    controls.appendChild(timeDisplay);

    videoContainer.appendChild(video);
    videoContainer.appendChild(captionsOverlay);
    modal.appendChild(downloadBtn);
    modal.appendChild(closeBtn);
    modal.appendChild(title);
    modal.appendChild(videoContainer);
    modal.appendChild(controls);

    document.body.appendChild(modal);
  };

  const downloadClip = async (moment) => {
    if (!moment.clipGenerated) {
      await generateVideoClip(moment);
      return;
    }

    // Show the clip modal instead of downloading
    showVideoClipModal(moment);
  };

  const downloadVideoWithSubtitles = async (moment) => {
    if (!moment.subtitles || moment.subtitles.length === 0) {
      alert('No subtitles available for download');
      return;
    }

    // Check tier restrictions for clip downloads
    const tierLimits = getTierLimits();
    if (downloadedClipsCount >= tierLimits.maxClipsPerVideo) {
      setError(`You've reached your ${tierLimits.name} tier limit of ${tierLimits.maxClipsPerVideo} clips per video. Please upgrade to Pro for unlimited clips.`);
      return;
    }

    try {
      setCurrentStep(`Generating video with subtitles for segment ${moment.id}...`);
      setProcessing(true);

      const response = await fetch(`${API_URL}/download-video`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          filename: uploadedFileInfo.filename,
          startTime: moment.startTimeSeconds,
          endTime: moment.endTimeSeconds,
          subtitles: moment.subtitles,
          words: moment.words || [], // Include word-level timestamps for karaoke highlighting
          segmentId: moment.id,
          userTier: userTier, // Add user tier for watermark logic
          hasWatermark: getTierLimits().hasWatermark
        })
      });

      if (!response.ok) {
        throw new Error('Download failed');
      }

      // Create a blob from the response and trigger download
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `segment-${moment.id}-with-subtitles.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      console.log('✅ Video downloaded successfully');
      setCurrentStep('Download completed!');
      
      // Increment downloaded clips count for tier restrictions
      setDownloadedClipsCount(prev => prev + 1);
      
      // Hide processing state after a short delay
      setTimeout(() => {
        setProcessing(false);
      }, 2000);
    } catch (error) {
      console.error('Download error:', error);
      setError(`Download failed: ${error.message}`);
      setProcessing(false);
    }
  };

  const previewClip = (moment) => {
    if (!moment.clipGenerated) {
      console.warn("Clip not generated yet, cannot preview");
      return;
    }

    // Use the new video modal for preview
    showVideoClipModal(moment);
  };

  const generateFallbackAnalysis = (fileInfo) => {
    // Generate realistic fallback analysis based on file characteristics
    const isVideo = fileInfo.type.startsWith("video");
    const isAudio =
      fileInfo.type.includes("audio") || fileInfo.type.includes("mp3");
    const durationMinutes = Math.floor(fileInfo.duration / 60);
    const tierLimits = getTierLimits();

    const moments = [];

    // Generate 3-5 moments based on file duration
    const numMoments = Math.min(
      5,
      Math.max(3, Math.floor(durationMinutes / 2))
    );

    const categories = ["funny", "educational", "emotional", "engaging"];
    const titleTemplates = {
      funny: [
        "The Brutal Truth About Comedy",
        "Why 99% Get This Wrong",
        "The Secret Nobody Talks About",
        "This Changed Everything",
      ],
      educational: [
        "The 80/20 Rule Explained",
        "What School Never Taught You",
        "The Hard Truth About Success",
        "Why Smart People Fail",
      ],
      emotional: [
        "The Price of Following Dreams",
        "What Nobody Tells You",
        "The Moment Everything Changed",
        "Why Most People Give Up",
      ],
      engaging: [
        "This Will Blow Your Mind",
        "The Uncomfortable Truth",
        "What Everyone Gets Wrong",
        "The Reality Check You Need",
      ],
    };

    const transcriptionTemplates = {
      funny: [
        "So I'm sitting there, right? And this guy walks up to me and he's like... wait, you're not gonna believe this. He goes, 'Excuse me, sir, but I think your car is on fire.' And I'm like, 'What car? I don't even own a car!' The look on his face was priceless. I mean, we're standing in a McDonald's parking lot and he's pointing at this flaming Honda, and I'm just like...",
        "Okay, so picture this - it's 3 AM, I'm in my pajamas, and I hear this weird noise coming from my kitchen. So naturally, I grab a baseball bat because, you know, better safe than sorry. I tiptoe down there, ready to face whatever burglar is in my house, and what do I find? My dishwasher. Having a complete meltdown. Like, there's soap bubbles everywhere...",
      ],
      educational: [
        "Alright, so here's something I wish someone had taught me in school - compound interest. Everyone talks about it, but nobody really explains how powerful this stuff is. Let me give you a real example. If you invest just $100 a month starting at age 25, by the time you're 65, you'll have over $300,000. But here's the crazy part - if you wait just 10 years and start at 35...",
        "So I used to think that productivity was all about working harder, longer hours, you know? Classic mistake. But then I discovered this concept called the Pareto Principle, or the 80/20 rule. Basically, 80% of your results come from 20% of your efforts. Once I figured out what that 20% was in my business, everything changed...",
      ],
      emotional: [
        "You know, I never thought I'd be sharing this story, but here we are. Three years ago, I was at the lowest point of my life. I had just lost my job, my relationship had ended, and I was living in my mom's basement at 32 years old. I remember sitting there one night, just staring at the ceiling, thinking 'How did I get here?' But sometimes rock bottom becomes the solid foundation you need to rebuild...",
        "My dad called me last week, and he said something that just... it hit me right in the chest. He said, 'Son, I'm proud of you.' Now, that might not sound like a big deal to some people, but my dad and I, we've had our issues over the years. There was a time when I thought he'd never say those words to me...",
      ],
      engaging: [
        "So I'm backstage at this conference, right? And I overhear this conversation between two of the biggest names in the industry. They're talking about this new technology that's supposedly going to change everything. And I'm thinking, 'Okay, here we go again, another overhyped trend.' But then one of them pulls out his phone and shows the other guy something, and I kid you not, the guy's face went completely white...",
        "Here's something that's been bugging me lately - everyone's talking about artificial intelligence taking over jobs, but nobody's talking about the jobs it's creating. Last month, I interviewed this woman who's making six figures as an 'AI prompt engineer.' Five years ago, that job didn't even exist. The world is changing faster than we can keep up with...",
      ],
    };

    for (let i = 0; i < numMoments; i++) {
      const category = categories[i % categories.length];
      const timeSpacing = Math.floor(fileInfo.duration / (numMoments + 1));
      const startTime = (i + 1) * timeSpacing;
      const duration = 30; // Fixed 30-second clips
      const endTime = Math.min(startTime + duration, fileInfo.duration - 5);

      const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, "0")}`;
      };

      const selectedTranscription =
        transcriptionTemplates[category][
          Math.floor(Math.random() * transcriptionTemplates[category].length)
        ];

      // Create moment with tier-appropriate analytics
      const baseViralScore = 65 + Math.floor(Math.random() * 30); // 65-95%
      
      const moment = {
        title:
          titleTemplates[category][
            Math.floor(Math.random() * titleTemplates[category].length)
          ],
        startTime: formatTime(startTime),
        endTime: formatTime(endTime),
        viralScore: baseViralScore,
        category: category,
        transcript: selectedTranscription,
        suggestedCaption: `"${selectedTranscription.slice(
          0,
          50
        )}..." Don't miss this! 🔥 #viral #${category}`,
      };

      // Add tier-specific analytics
      if (tierLimits.hasDetailedAnalytics) {
        // Pro tier - detailed analytics
        moment.reasoning = `Engaging ${category} content detected with compelling dialogue`;
        const fallbackSeed = i * 1000 + startTime; // Use index and start time as seed
        moment.detailedAnalytics = {
          hookStrength: Math.floor((Math.sin(fallbackSeed * 0.01) * 0.5 + 0.5) * 40) + 60, // 60-100%
          retentionRate: Math.floor((Math.cos(fallbackSeed * 0.013) * 0.5 + 0.5) * 30) + 70, // 70-100%
          engagementPotential: Math.floor((Math.sin(fallbackSeed * 0.017) * 0.5 + 0.5) * 25) + 75, // 75-100%
          sentiment: category === 'emotional' ? 'Emotional' : 
                    category === 'funny' ? 'Humorous' : 
                    category === 'educational' ? 'Informative' : 'Engaging',
          keywordDensity: Math.floor((Math.cos(fallbackSeed * 0.019) * 0.5 + 0.5) * 20) + 15, // 15-35%
          paceScore: Math.floor((Math.sin(fallbackSeed * 0.023) * 0.5 + 0.5) * 30) + 70, // 70-100%
          visualApeal: isVideo ? Math.floor((Math.cos(fallbackSeed * 0.029) * 0.5 + 0.5) * 25) + 75 : null,
          soundQuality: Math.floor((Math.sin(fallbackSeed * 0.031) * 0.5 + 0.5) * 20) + 80, // 80-100%
        };
        moment.improvements = [
          "Consider adding a stronger hook in the first 3 seconds",
          "Optimize pacing for better retention",
          "Add trending hashtags for discovery"
        ];
        moment.hashtags = [`#${category}`, '#viral', '#trending', '#fyp'];
      } else {
        // Guest tier - basic analytics only
        moment.reasoning = `${category.charAt(0).toUpperCase() + category.slice(1)} content detected`;
        // No detailed analytics, improvements, or hashtag suggestions
      }

      moments.push(moment);
    }

    return {
      moments: moments,
      overallEngagement: numMoments >= 4 ? "High" : "Medium",
      totalMoments: numMoments,
    };
  };

  // Extract real audio metadata and setup for transcription
  const extractAudioFromFile = async (file) => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.src = URL.createObjectURL(file);
      video.muted = true;
      
      video.onloadedmetadata = () => {
        const duration = video.duration;
        URL.revokeObjectURL(video.src);
        resolve({
          duration: duration,
          sampleRate: 44100,
          channels: 2,
          size: file.size,
          type: file.type,
        });
      };
      
      video.onerror = () => {
        resolve({
          duration: 300, // 5 minutes fallback
          sampleRate: 44100,
          channels: 2,
          size: file.size,
          type: file.type,
        });
      };
    });
  };
  
  // Extract actual transcript from video segment using simplified approach
  const extractRealTranscriptFromSegment = async (videoFile, startTime, endTime) => {
    return new Promise((resolve) => {
      console.log(`🎤 Starting speech extraction for segment ${startTime}s - ${endTime}s`);
      
      // Check if speech recognition is available
      if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
        console.warn('Speech recognition not available in this browser');
        resolve(`[Speech recognition not supported - segment ${Math.floor(startTime/60)}:${String(Math.floor(startTime%60)).padStart(2,'0')} cannot be transcribed]`);
        return;
      }

      const video = document.createElement('video');
      
      try {
        video.src = URL.createObjectURL(videoFile);
        video.crossOrigin = 'anonymous';
        video.currentTime = startTime;
        
        // For speech recognition to work, video needs to be unmuted and audible
        video.volume = 1.0; // Full volume for better recognition
        video.muted = false; // Must be unmuted for speech recognition
        video.preload = 'metadata';
        
        // Hide video element but keep it functional
        video.style.position = 'fixed';
        video.style.top = '-1000px';
        video.style.left = '-1000px';
        video.style.width = '1px';
        video.style.height = '1px';
        video.style.opacity = '0';
        document.body.appendChild(video); // Must be in DOM for audio to work
        
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        recognition.maxAlternatives = 3;
        recognition.grammars = null; // Use default grammars for better accuracy
        
        let finalTranscript = '';
        let isRecognitionActive = false;
        
        recognition.onstart = () => {
          isRecognitionActive = true;
          console.log('🎤 Speech recognition started for segment', `${startTime}s - ${endTime}s`);
        };
        
        recognition.onresult = (event) => {
          let interimTranscript = '';
          
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            
            if (event.results[i].isFinal) {
              finalTranscript += transcript + ' ';
              console.log('📝 Final transcript chunk:', transcript);
            } else {
              interimTranscript += transcript;
            }
          }
        };
        
        recognition.onerror = (event) => {
          console.log('🔴 Speech recognition error:', event.error);
          if (event.error === 'no-speech') {
            console.log('No speech detected in this segment');
          }
        };
        
        recognition.onend = () => {
          isRecognitionActive = false;
          console.log('🔚 Speech recognition ended, final transcript:', finalTranscript);
          
          const cleanedTranscript = finalTranscript.trim();
          if (cleanedTranscript && cleanedTranscript.length > 3) {
            console.log('✅ Successfully extracted speech:', cleanedTranscript);
            cleanup();
            resolve(cleanedTranscript);
          } else {
            console.log('⚠️ No speech detected, will use fallback');
            // Don't cleanup yet, let the timeout handle it
          }
        };
        
        const cleanup = () => {
          try {
            video.pause();
            if (isRecognitionActive) {
              recognition.stop();
            }
            URL.revokeObjectURL(video.src);
            if (video.parentNode) {
              video.parentNode.removeChild(video);
            }
          } catch (e) {
            console.log('Cleanup error:', e);
          }
        };
        
        video.onloadedmetadata = () => {
          video.currentTime = startTime;
        };
        
        video.onseeked = () => {
          console.log(`▶️ Starting video playback at ${startTime}s`);
          console.log('🔊 Video properties:', {
            volume: video.volume,
            muted: video.muted,
            duration: video.duration,
            currentTime: video.currentTime
          });
          
          video.play()
            .then(() => {
              console.log('✅ Video is now playing');
              // Start speech recognition after video starts playing
              setTimeout(() => {
                try {
                  console.log('🎤 Starting speech recognition...');
                  recognition.start();
                } catch (e) {
                  console.error('Recognition start error:', e);
                  cleanup();
                  resolve(`[Speech recognition failed to start for segment ${Math.floor(startTime/60)}:${String(Math.floor(startTime%60)).padStart(2,'0')}]`);
                }
              }, 1500); // Delay to ensure audio is playing
            })
            .catch(error => {
              console.error('Video play error:', error);
              cleanup();
              resolve(`[Video playback failed for transcription - segment ${Math.floor(startTime/60)}:${String(Math.floor(startTime%60)).padStart(2,'0')}]`);
            });
        };
        
        video.ontimeupdate = () => {
          if (video.currentTime >= endTime) {
            console.log(`⏹️ Reached end time ${endTime}s, stopping extraction`);
            cleanup();
            
            const cleanedTranscript = finalTranscript.trim();
            if (cleanedTranscript && cleanedTranscript.length > 3) {
              resolve(cleanedTranscript);
            } else {
              resolve(`[No clear speech detected in segment ${Math.floor(startTime/60)}:${String(Math.floor(startTime%60)).padStart(2,'0')} - ${Math.floor(endTime/60)}:${String(Math.floor(endTime%60)).padStart(2,'0')}]`);
            }
          }
        };
        
        video.onerror = (error) => {
          console.error('Video error:', error);
          cleanup();
          resolve(`[Video processing error - segment ${Math.floor(startTime/60)}:${String(Math.floor(startTime%60)).padStart(2,'0')}]`);
        };
        
        // Safety timeout - don't let this run too long
        setTimeout(() => {
          console.log('⏰ Timeout reached, stopping extraction');
          const cleanedTranscript = finalTranscript.trim();
          
          if (cleanedTranscript && cleanedTranscript.length > 3) {
            console.log('✅ Found transcript before timeout:', cleanedTranscript);
            cleanup();
            resolve(cleanedTranscript);
          } else {
            console.log('⚠️ Speech recognition timeout - trying alternate approach');
            // Try one more approach with a fresh recognition instance
            attemptAlternativeRecognition();
          }
        }, Math.min((endTime - startTime) * 1000 + 8000, 25000)); // Segment duration + 8s buffer, max 25s
        
        // Alternative recognition attempt function
        const attemptAlternativeRecognition = () => {
          console.log('🔄 Attempting alternative recognition method');
          const altRecognition = new SpeechRecognition();
          altRecognition.continuous = false; // Try single-shot mode
          altRecognition.interimResults = false;
          altRecognition.lang = 'en-US';
          
          let altTranscript = '';
          
          altRecognition.onresult = (event) => {
            if (event.results.length > 0) {
              altTranscript = event.results[0][0].transcript;
              console.log('✅ Alternative recognition found:', altTranscript);
              cleanup();
              resolve(altTranscript);
            }
          };
          
          altRecognition.onerror = altRecognition.onend = () => {
            cleanup();
            resolve(`[No speech detected in video segment ${Math.floor(startTime/60)}:${String(Math.floor(startTime%60)).padStart(2,'0')} - ${Math.floor(endTime/60)}:${String(Math.floor(endTime%60)).padStart(2,'0')}]`);
          };
          
          try {
            // Reset video position and try again
            video.currentTime = startTime;
            video.volume = 1.0;
            altRecognition.start();
          } catch (e) {
            console.error('Alternative recognition failed:', e);
            cleanup();
            resolve(`[Speech recognition failed for segment ${Math.floor(startTime/60)}:${String(Math.floor(startTime%60)).padStart(2,'0')}]`);
          }
        };
        
      } catch (error) {
        console.error('Speech extraction setup error:', error);
        if (video && video.src) {
          URL.revokeObjectURL(video.src);
        }
        resolve(`[Speech extraction failed - setup error for segment ${Math.floor(startTime/60)}:${String(Math.floor(startTime%60)).padStart(2,'0')}]`);
      }
    });
  };

  const analyzeContent = async (fileInfo) => {
    try {
      setCurrentStep("Starting AI analysis...");
      setProgress(10);

      const tierLimits = getTierLimits();
      
      console.log('🔍 Analysis starting with:', { userTier, tierLimits, hasDetailedAnalytics: tierLimits.hasDetailedAnalytics });
      
      // Start real AI analysis with fetch for SSE
      const response = await fetch(`${API_URL}/analyze-video`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: fileInfo.filename,
          userTier: userTier
        })
      });

      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.statusText}`);
      }

      // Read the stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      // Handle real-time progress updates
      let buffer = '';
      let currentDataBuffer = '';
      let isParsingLargeMessage = false;
      
      const processStream = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              // Process any remaining data in buffer
              if (currentDataBuffer.trim()) {
                try {
                  const data = JSON.parse(currentDataBuffer);
                  if (data.type === 'complete') {
                    await handleCompleteMessage(data);
                  }
                } catch (e) {
                  console.error('Error parsing final buffer:', e);
                }
              }
              break;
            }

            const chunk = decoder.decode(value);
            buffer += chunk;
            
            // Process complete lines
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep incomplete line in buffer

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const jsonStr = line.substring(6).trim();
                if (jsonStr) {
                  if (isParsingLargeMessage) {
                    // Continue building the large message
                    currentDataBuffer += jsonStr;
                    
                    // Try to parse - if successful, we have the complete message
                    try {
                      const data = JSON.parse(currentDataBuffer);
                      if (data.type === 'complete') {
                        await handleCompleteMessage(data);
                      } else if (data.type === 'progress') {
                        setProgress(data.progress);
                        setCurrentStep(data.status);
                      }
                      currentDataBuffer = '';
                      isParsingLargeMessage = false;
                    } catch (parseError) {
                      // Still incomplete, continue buffering
                      continue;
                    }
                  } else {
                    // Try to parse normally first
                    try {
                      const data = JSON.parse(jsonStr);
                      
                      if (data.type === 'progress') {
                        setProgress(data.progress);
                        setCurrentStep(data.status);
                      } else if (data.type === 'complete') {
                        await handleCompleteMessage(data);
                      }
                    } catch (parseError) {
                      // Start buffering for large message
                      currentDataBuffer = jsonStr;
                      isParsingLargeMessage = true;
                    }
                  }
                }
              }
            }
          }
        } catch (streamError) {
          console.error('Stream processing error:', streamError);
          setError('Failed to process analysis stream');
          setProcessing(false);
        }
      };

      const handleCompleteMessage = async (data) => {
        // Process AI analysis results
        console.log('🎯 Processing complete message:', data);
        console.log('🎯 User tier:', userTier);
        console.log('🎯 Tier limits:', tierLimits);
        const result = data.result;
        console.log('🎯 AI result:', result);
        console.log('🎯 Viral analysis:', result.viralAnalysis);
        console.log('🎯 Has detailed analytics:', !!result.viralAnalysis?.detailedAnalytics);
        const segments = [];
        
        if (result.viralMoments && result.viralMoments.length > 0) {
          // Use AI-identified viral moments
          result.viralMoments.forEach((moment, index) => {
            const formatTime = (seconds) => {
              const mins = Math.floor(seconds / 60);
              const secs = seconds % 60;
              return `${mins}:${secs.toString().padStart(2, "0")}`;
            };

            const segment = {
              id: index + 1,
              title: moment.title || `Viral Moment ${index + 1}`,
              startTime: formatTime(moment.startTime),
              endTime: formatTime(moment.endTime),
              startTimeSeconds: moment.startTime,
              endTimeSeconds: moment.endTime,
              duration: `${moment.endTime - moment.startTime}s`,
              viralScore: moment.viralScore || 85,
              description: moment.reasoning || `${moment.category} content with high viral potential`,
              category: moment.category || 'engaging',
              transcript: moment.transcript || "AI-generated viral moment",
              suggestedCaption: `${moment.title} 🎬`,
              thumbnail: generateThumbnail(moment.category || 'engaging'),
              clipGenerated: false,
              clipUrl: null,
              subtitles: [],
              transcribed: true,
              aiAnalyzed: true
            };

            // Add tier-specific analytics from AI
            if (tierLimits.hasDetailedAnalytics) {
              segment.reasoning = moment.reasoning || result.viralAnalysis?.reasoning || 'AI-detected viral content with high engagement potential';
              
              // Use real AI analytics for pro users (individual moment analytics take precedence)
              segment.detailedAnalytics = moment.detailedAnalytics || result.viralAnalysis?.detailedAnalytics;
              segment.improvements = moment.improvements || result.viralAnalysis?.improvements;
              segment.hashtags = moment.hashtags || result.viralAnalysis?.hashtags;
              
              // Debug logging for each moment
              console.log(`🔍 Moment ${index + 1} analytics:`, {
                hasIndividualAnalytics: !!moment.detailedAnalytics,
                hasGlobalAnalytics: !!result.viralAnalysis?.detailedAnalytics,
                finalAnalytics: segment.detailedAnalytics,
                improvements: segment.improvements,
                hashtags: segment.hashtags
              });
              
              // Only show fallback message if no AI analytics were provided
              if (!segment.detailedAnalytics && !segment.improvements && !segment.hashtags) {
                segment.noAiAnalytics = true; // Flag for UI to show "AI analysis pending" message
              }
            } else {
              // Guest tier - basic analytics only
              segment.reasoning = moment.reasoning || result.viralAnalysis?.reasoning || 'AI-detected viral content';
            }

            segments.push(segment);
          });
        } else {
          // Fallback: create segments from overall analysis
          const duration = fileInfo.duration;
          const numMoments = Math.min(5, Math.max(3, Math.floor(duration / 120)));
          
          for (let i = 0; i < numMoments; i++) {
            const startTime = Math.floor((i * duration) / numMoments);
            const endTime = Math.min(startTime + 30, duration - 5);
            
            const formatTime = (seconds) => {
              const mins = Math.floor(seconds / 60);
              const secs = seconds % 60;
              return `${mins}:${secs.toString().padStart(2, "0")}`;
            };

            segments.push({
              id: i + 1,
              title: `AI Segment ${i + 1}`,
              startTime: formatTime(startTime),
              endTime: formatTime(endTime),
              startTimeSeconds: startTime,
              endTimeSeconds: endTime,
              duration: `${endTime - startTime}s`,
              viralScore: result.viralAnalysis?.viralScore || 85,
              description: `AI-analyzed content with ${result.viralAnalysis?.viralScore || 85}% viral potential`,
              category: result.viralAnalysis?.category || 'engaging',
              transcript: "AI-transcribed segment",
              suggestedCaption: `AI Segment ${i + 1} 🎬`,
              thumbnail: generateThumbnail(result.viralAnalysis?.category || 'engaging'),
              clipGenerated: false,
              clipUrl: null,
              subtitles: [],
              transcribed: true,
              aiAnalyzed: true,
              reasoning: result.viralAnalysis?.reasoning || 'AI-detected content'
            });
          }
        }

        // Update UI with results
        console.log('🎯 About to update UI with segments:', segments);
        setProgress(100);
        setCurrentStep("AI analysis complete!");
        setExtractedMoments(segments);
        setAnalysisComplete(true);
        setProcessing(false);

        console.log(`✅ AI analysis complete: ${segments.length} viral moments identified`);
      };

      // Start processing the stream
      await processStream();

    } catch (error) {
      console.error("AI Analysis error:", error);
      setError(`AI Analysis failed: ${error.message}`);
      setProcessing(false);
      setProgress(0);
    }
  };

  const parseTime = (timeStr) => {
    const parts = timeStr.split(":").map(Number);
    return parts.length === 2 ? parts[0] * 60 + parts[1] : parts[0];
  };
  
  const calculateDuration = (start, end) => {
    try {
      const startSec = parseTime(start);
      const endSec = parseTime(end);
      const duration = endSec - startSec;
      return `${duration}s`;
    } catch {
      return "30s";
    }
  };

  const generateThumbnail = (category) => {
    const colors = {
      funny: "#f59e0b",
      shocking: "#ef4444", 
      educational: "#3b82f6",
      emotional: "#8b5cf6",
      controversial: "#f97316",
      engaging: "#10b981",
      real: "#22c55e",
      video: "#8b5cf6", // Purple for video segments
    };

    const color = colors[category] || colors.video;

    return `data:image/svg+xml;base64,${btoa(`
      <svg width="200" height="112" viewBox="0 0 200 112" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="112" fill="${color}20"/>
        <rect width="200" height="112" fill="url(#gradient)"/>
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:${color};stop-opacity:0.3" />
            <stop offset="100%" style="stop-color:${color};stop-opacity:0.1" />
          </linearGradient>
        </defs>
        <text x="100" y="56" fill="white" text-anchor="middle" dy="0.3em" font-family="sans-serif" font-size="12">${category.toUpperCase()}</text>
      </svg>
    `)}`;
  };

  return (
    <div className="content-scalar min-h-screen">
      {/* Header */}
      <header className="viral-clip-header">
        <div className="viral-clip-header-content">
          <button
            onClick={handleBackToDashboard}
            className="viral-clip-back-btn"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
          
          <div className="viral-clip-logo">
            <Zap className="w-6 h-6 text-yellow-400" />
            <span className="viral-clip-logo-text">Viral Clip Generator</span>
          </div>
          
          <div className="viral-clip-header-actions">
            <div className="tier-indicator">
              <span className={`tier-badge tier-${userTier}`}>
                {getTierLimits().name} {userTier === 'pro' ? '✨' : '🔓'}
              </span>
            </div>
            <button
              onClick={handleSignOut}
              className="viral-clip-signout-btn"
              title="Sign Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="content-scalar-container">
        {/* Header */}
        <div className="content-scalar-header">
          <h1 className="content-scalar-title">
            AI-Powered Video Analysis
          </h1>
          <p className="content-scalar-description">
            Upload your content and we'll extract viral moments with attention-grabbing subtitles
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="error-container">
            <div className="error-alert">
              <AlertCircle className="error-icon" />
              <span className="error-text">{error}</span>
            </div>
          </div>
        )}

        {/* Upload Section */}
        <div className="upload-container">
          {!file ? (
            <div
              className="upload-zone"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="upload-icon" />
              <h3 className="upload-title">
                Upload Your Content
              </h3>
              <p className="upload-subtitle">
                Drop your MP4 video, MP3 audio, or WAV file here
              </p>
              <div className="upload-file-types">
                <div className="upload-file-type">
                  <FileVideo className="upload-file-type-icon" />
                  <span>MP4 Video</span>
                </div>
                <div className="upload-file-type">
                  <FileAudio className="upload-file-type-icon" />
                  <span>MP3/WAV Audio</span>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".mp4,.mp3,.wav,audio/mpeg,video/mp4,audio/wav"
                onChange={handleFileUpload}
                className="upload-input"
              />
            </div>
          ) : (
            <div>
              {/* Processing State */}
              {processing && (
                <div className="processing-container">
                  <div className="processing-spinner"></div>
                  <h3 className="processing-title">Processing...</h3>
                  <p className="processing-status">{currentStep}</p>
                  <div className="processing-progress-bar">
                    <div
                      className="processing-progress-fill"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                  <p className="processing-percentage">{progress}% complete</p>
                </div>
              )}

              {/* Analysis Complete State */}
              {analysisComplete && extractedMoments.length > 0 && (
                <div className="analysis-complete">
                  <div className="analysis-header">
                    <h3 className="analysis-title">
                      Speech Segments Found: {extractedMoments.length}
                    </h3>
                    <button
                      onClick={() => {
                        setFile(null);
                        setExtractedMoments([]);
                        setAnalysisComplete(false);
                        setProgress(0);
                        setError(null);
                      }}
                      className="analysis-new-file"
                    >
                      Upload New File
                    </button>
                  </div>
                  
                  <div className="segments-grid">
                    {extractedMoments.map((moment) => (
                      <div key={moment.id} className="segment-card">
                        <div className="segment-header">
                          <div className="segment-info">
                            <h4 className="segment-title">
                              {moment.title}
                            </h4>
                            <p className="segment-time">
                              {moment.startTime} - {moment.endTime} ({moment.duration})
                            </p>
                            
                            {/* Viral Score Display */}
                            <div className="segment-viral-score">
                              <div className="viral-score-badge">
                                <span className="viral-score-label">Viral Score:</span>
                                <span className="viral-score-value">{moment.viralScore}%</span>
                              </div>
                              <div className="viral-score-category">{moment.category}</div>
                            </div>
                            
                            {/* Analytics Section - Tier Dependent */}
                            <div className="segment-analytics">
                              <p className="analytics-reasoning">{moment.reasoning}</p>
                              
                              {/* Pro Tier - Detailed Analytics */}
                              {moment.detailedAnalytics && (
                                <div className="detailed-analytics">
                                  <div className="analytics-grid">
                                    <div className="analytics-metric">
                                      <span className="metric-label">Hook Strength:</span>
                                      <span className="metric-value">{moment.detailedAnalytics.hookStrength}%</span>
                                    </div>
                                    <div className="analytics-metric">
                                      <span className="metric-label">Retention:</span>
                                      <span className="metric-value">{moment.detailedAnalytics.retentionRate}%</span>
                                    </div>
                                    <div className="analytics-metric">
                                      <span className="metric-label">Engagement:</span>
                                      <span className="metric-value">{moment.detailedAnalytics.engagementPotential}%</span>
                                    </div>
                                    <div className="analytics-metric">
                                      <span className="metric-label">Sentiment:</span>
                                      <span className="metric-value">{moment.detailedAnalytics.sentiment}</span>
                                    </div>
                                  </div>
                                  
                                  {moment.improvements && (
                                    <div className="improvements-section">
                                      <h5 className="improvements-title">💡 Suggestions:</h5>
                                      <ul className="improvements-list">
                                        {moment.improvements.map((improvement, idx) => (
                                          <li key={idx} className="improvement-item">{improvement}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                  
                                  {moment.hashtags && (
                                    <div className="hashtags-section">
                                      <span className="hashtags-label">📱 Suggested hashtags:</span>
                                      <div className="hashtags-list">
                                        {moment.hashtags.map((tag, idx) => (
                                          <span key={idx} className="hashtag">{tag}</span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                              
                              {/* Guest Tier Notice or AI Pending */}
                              {!moment.detailedAnalytics && !moment.noAiAnalytics && userTier === 'guest' && (
                                <div className="upgrade-notice">
                                  <p className="upgrade-text">🔒 Upgrade to Pro for detailed analytics, optimization tips, and hashtag suggestions</p>
                                </div>
                              )}
                              {moment.noAiAnalytics && userTier === 'pro' && (
                                <div className="ai-pending-notice">
                                  <p className="ai-pending-text">🤖 AI-powered detailed analytics are being generated... Please wait for the next analysis.</p>
                                </div>
                              )}
                            </div>
                            
                            <div className="segment-transcript-preview">
                              <p className="segment-transcript-label">
                                <strong>Transcript:</strong> "{moment.transcript}"
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="segment-actions">
                          <button
                            onClick={() => {
                              if (moment.clipGenerated) {
                                showVideoClipModal(moment);
                              } else {
                                generateVideoClip(moment);
                              }
                            }}
                            disabled={clipProgress[moment.id] !== undefined}
                            className="segment-action-primary"
                          >
                            {clipProgress[moment.id] !== undefined ? (
                              <span>Generating... {clipProgress[moment.id]}%</span>
                            ) : moment.clipGenerated ? (
                              <span className="flex items-center gap-1"><Play className="segment-action-icon" />View Clip</span>
                            ) : (
                              <span className="flex items-center gap-1"><Scissors className="segment-action-icon" />Generate Clip</span>
                            )}
                          </button>
                          
                          {moment.clipGenerated && moment.subtitles && moment.subtitles.length > 0 && (
                            <button
                              onClick={() => downloadVideoWithSubtitles(moment)}
                              className="segment-action-secondary"
                              title="Download video with subtitles"
                            >
                              <Download className="segment-action-icon" />
                              Download
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ViralClipGenerator;