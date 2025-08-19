import React, { useState, useRef } from "react";
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
} from "lucide-react";

const ContentScalar = () => {
  const [file, setFile] = useState(null);
  const [processing, setProcessing] = useState(false);

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
    
    // Apply red highlighting to attention words
    attentionWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      highlightedText = highlightedText.replace(regex, `<span style="color: red; font-weight: bold;">${word}</span>`);
    });
    
    // Highlight numbers and percentages
    highlightedText = highlightedText.replace(/\b\d+(\.\d+)?\s*%\b/g, '<span style="color: red; font-weight: bold;">$&</span>');
    highlightedText = highlightedText.replace(/\b\d+x\b/gi, '<span style="color: red; font-weight: bold;">$&</span>');
    // Fixed: Only highlight complete money amounts, not standalone $ symbols
    highlightedText = highlightedText.replace(/\$\d+(?:,\d{3})*(?:\.\d{2})?\b/g, '<span style="color: red; font-weight: bold;">$&</span>');
    
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

      // Update the moment with real transcript and captions
      const updatedMoments = extractedMoments.map((m) =>
        m.id === moment.id
          ? {
              ...m,
              transcript: transcriptionResult.transcript,
              subtitles: transcriptionResult.captions,
              highlightedSubtitles: transcriptionResult.highlightedCaptions,
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
      text-shadow: 2px 2px 4px rgba(0,0,0,0.8), -1px -1px 2px rgba(0,0,0,0.8);
      opacity: 1; transition: all 0.3s ease;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
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

    // Caption display system for backend transcripts
    const updateCaptions = () => {
      const highlightedSubtitles = moment.highlightedSubtitles || moment.subtitles;
      if (!highlightedSubtitles || highlightedSubtitles.length === 0) return;
      
      const currentTime = video.currentTime - moment.startTimeSeconds;
      const currentCaption = highlightedSubtitles.find(caption => 
        currentTime >= caption.start && currentTime <= caption.end
      );
      
      if (currentCaption) {
        captionsOverlay.innerHTML = `
          <div style="color: white; font-size: 20px; font-weight: bold;">
            ${currentCaption.text}
          </div>
        `;
      } else if (moment.transcript) {
        // Apply highlighting to full transcript as well for when no specific caption is active
        const highlightedTranscript = highlightAttentionWordsClient(moment.transcript);
        captionsOverlay.innerHTML = `
          <div style="color: white; font-size: 18px; opacity: 0.9;">
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
      setCurrentStep('Download completed!');
      
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

      moments.push({
        title:
          titleTemplates[category][
            Math.floor(Math.random() * titleTemplates[category].length)
          ],
        startTime: formatTime(startTime),
        endTime: formatTime(endTime),
        viralScore: 65 + Math.floor(Math.random() * 30), // 65-95%
        reasoning: `Engaging ${category} content detected with compelling dialogue`,
        category: category,
        transcript: selectedTranscription,
        suggestedCaption: `"${selectedTranscription.slice(
          0,
          50
        )}..." Don't miss this! 🔥 #viral #${category}`,
      });
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
      setCurrentStep("Creating video segments...");
      setProgress(30);

      // Generate time segments based on duration
      const duration = fileInfo.duration;
      const numMoments = Math.min(5, Math.max(3, Math.floor(duration / 120)));
      const segments = [];
      
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
          title: `Video Segment ${i + 1}`,
          startTime: formatTime(startTime),
          endTime: formatTime(endTime),
          startTimeSeconds: startTime,
          endTimeSeconds: endTime,
          duration: `${endTime - startTime}s`,
          viralScore: 85,
          description: "Click to generate transcript",
          category: "video",
          transcript: "Click 'Generate Clip' to transcribe this segment",
          suggestedCaption: `Video segment ${i + 1} 🎬`,
          thumbnail: generateThumbnail("video"),
          clipGenerated: false,
          clipUrl: null,
          subtitles: [],
          transcribed: false
        });
        
        setProgress(30 + (i + 1) * (60 / numMoments));
      }

      setProgress(100);
      setCurrentStep("Ready to transcribe!");
      setExtractedMoments(segments);
      setAnalysisComplete(true);
      setProcessing(false);

      console.log(`✅ Created ${segments.length} video segments`);

    } catch (error) {
      console.error("Analysis error:", error);
      setError(`Analysis failed: ${error.message}`);
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Zap className="w-8 h-8 text-yellow-400" />
            <h1 className="text-4xl font-bold text-white">Content Scalar</h1>
          </div>
          <p className="text-gray-300 text-lg max-w-2xl mx-auto">
            Real speech extraction - Upload your content and we'll extract the actual spoken words
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="max-w-4xl mx-auto mb-6">
            <div className="bg-red-900/30 border border-red-500 rounded-lg p-4 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <span className="text-red-200">{error}</span>
            </div>
          </div>
        )}

        {/* Upload Section */}
        <div className="max-w-4xl mx-auto">
          {!file ? (
            <div
              className="border-2 border-dashed border-gray-600 rounded-lg p-12 text-center bg-gray-800/30 hover:bg-gray-800/50 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">
                Upload Your Content
              </h3>
              <p className="text-gray-400 mb-4">
                Drop your MP4 video, MP3 audio, or WAV file here
              </p>
              <div className="flex items-center justify-center gap-4 text-sm text-gray-500">
                <div className="flex items-center gap-1">
                  <FileVideo className="w-4 h-4" />
                  <span>MP4 Video</span>
                </div>
                <div className="flex items-center gap-1">
                  <FileAudio className="w-4 h-4" />
                  <span>MP3/WAV Audio</span>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".mp4,.mp3,.wav,audio/mpeg,video/mp4,audio/wav"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          ) : (
            <div>
              {/* Processing State */}
              {processing && (
                <div className="bg-gray-800/30 rounded-lg p-8 text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400 mx-auto mb-4"></div>
                  <h3 className="text-xl font-semibold text-white mb-2">Processing...</h3>
                  <p className="text-gray-300 mb-4">{currentStep}</p>
                  <div className="w-full bg-gray-700 rounded-full h-2 mb-4">
                    <div
                      className="bg-yellow-400 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                  <p className="text-gray-400">{progress}% complete</p>
                </div>
              )}

              {/* Analysis Complete State */}
              {analysisComplete && extractedMoments.length > 0 && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-2xl font-bold text-white">
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
                      className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                    >
                      Upload New File
                    </button>
                  </div>
                  
                  <div className="grid gap-4">
                    {extractedMoments.map((moment) => (
                      <div
                        key={moment.id}
                        className="bg-gray-800/50 rounded-lg p-6 border border-gray-700"
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex-1">
                            <h4 className="text-lg font-semibold text-white mb-2">
                              Segment #{moment.id}
                            </h4>
                            <p className="text-gray-300 text-sm mb-2">
                              {moment.startTime} - {moment.endTime} ({moment.duration})
                            </p>
                            <div className="bg-yellow-400/10 border border-yellow-400/30 rounded-lg p-3 mb-3">
                              <p className="text-yellow-200 text-sm">
                                <strong>Transcript:</strong> "{moment.transcript}"
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex gap-3">
                          <button
                            onClick={() => {
                              if (moment.clipGenerated) {
                                showVideoClipModal(moment);
                              } else {
                                generateVideoClip(moment);
                              }
                            }}
                            disabled={clipProgress[moment.id] !== undefined}
                            className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
                          >
                            {clipProgress[moment.id] !== undefined ? (
                              <span>Generating... {clipProgress[moment.id]}%</span>
                            ) : moment.clipGenerated ? (
                              <span className="flex items-center gap-1"><Play className="w-4 h-4" />View Clip</span>
                            ) : (
                              <span className="flex items-center gap-1"><Scissors className="w-4 h-4" />Generate Clip</span>
                            )}
                          </button>
                          
                          {moment.clipGenerated && moment.subtitles && moment.subtitles.length > 0 && (
                            <button
                              onClick={() => downloadVideoWithSubtitles(moment)}
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
                              title="Download video with subtitles"
                            >
                              <Download className="w-4 h-4" />
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

export default ContentScalar;