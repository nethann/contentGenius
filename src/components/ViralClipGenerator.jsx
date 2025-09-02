import React, { useState, useRef } from "react";
import { useNavigate, useLocation } from 'react-router-dom';
import { useUser, useAuth } from '@clerk/clerk-react';
import { TokenService } from '../services/tokenService';
import { VideoLibraryService } from '../services/videoLibraryService';
import {
  Upload,
  Play,
  Scissors,
  Download,
  Clock,
  Zap,
  Settings,
  FileVideo,
  FileAudio,
  AlertCircle,
  Mic,
  ArrowLeft,
  LogOut,
  Crown,
  Lock,
  Grid3X3,
  Layers,
  Maximize2,
  MousePointer
} from "lucide-react";

const ViralClipGenerator = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoaded } = useUser();
  const { signOut } = useAuth();
  const [file, setFile] = useState(null);
  const [processing, setProcessing] = useState(false);

  // Check if we have a video passed from the dashboard
  const preloadedVideo = location.state?.video;
  
  // Video library state
  const [videoLibrary, setVideoLibrary] = useState([]);
  const [videoToLoad, setVideoToLoad] = useState(null);
  
  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [videoToDelete, setVideoToDelete] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalVideo, setModalVideo] = useState(null);
  
  // Load user's video library
  React.useEffect(() => {
    if (user?.id) {
      const videos = VideoLibraryService.getUserVideoLibrary(user.id);
      setVideoLibrary(videos.slice(0, 5)); // Show last 5 videos
    }
  }, [user?.id]);

  // Effect to handle video loading (separate from re-renders)
  React.useEffect(() => {
    console.log('🔍 useEffect triggered, videoToLoad:', !!videoToLoad, videoToLoad?.originalName);
    if (videoToLoad) {
      console.log('🎬 useEffect: Loading video from library:', videoToLoad.originalName);
      
      // Store in localStorage to survive re-renders
      const loadingData = {
        uploadedFileInfo: videoToLoad.uploadedFileInfo,
        extractedMoments: videoToLoad.extractedMoments,
        originalName: videoToLoad.originalName,
        timestamp: Date.now()
      };
      localStorage.setItem('temp_loading_video', JSON.stringify(loadingData));
      
      console.log('💾 Stored video data in localStorage for re-render protection');
      
      // Set the uploaded file info
      if (videoToLoad.uploadedFileInfo) {
        console.log('📁 useEffect: Setting uploaded file info');
        setUploadedFileInfo(videoToLoad.uploadedFileInfo);
        
        // Create a dummy file object to satisfy the !file condition
        const dummyFile = {
          name: videoToLoad.originalName,
          size: videoToLoad.uploadedFileInfo.size,
          type: 'video/mp4' // Default type
        };
        setFile(dummyFile);
        console.log('📁 Created dummy file object for rendering:', dummyFile);
      }
      
      // Set extracted moments if they exist
      if (videoToLoad.extractedMoments && videoToLoad.extractedMoments.length > 0) {
        // Apply tier limits for loaded segments
        const tierLimits = TIER_LIMITS[userTier] || TIER_LIMITS.guest;
        const limitedMoments = userTier === 'guest' ? videoToLoad.extractedMoments.slice(0, 3) : videoToLoad.extractedMoments;
        
        console.log('🎬 useEffect: Setting', videoToLoad.extractedMoments.length, 'total segments,', limitedMoments.length, 'for', userTier, 'tier');
        
        // Set state in sequence to ensure proper updates
        setError(null);
        setProcessing(false);
        setCurrentStep('');
        
        // Use setTimeout to ensure state updates properly
        setTimeout(() => {
          setExtractedMoments(limitedMoments);
          setAnalysisComplete(true);
          
          // Check if all clips are already generated from previous session
          const allClipsGenerated = limitedMoments.every(moment => moment.clipGenerated);
          if (allClipsGenerated) {
            console.log('🎉 All clips already generated from previous session!');
          }
          
          console.log('🎯 State set - analysisComplete: true, segments:', limitedMoments.length);
          
          // Check if UI renders after another brief delay
          setTimeout(() => {
            const analysisSection = document.querySelector('.analysis-complete');
            console.log('🔍 Looking for .analysis-complete element:', !!analysisSection);
            if (analysisSection) {
              analysisSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
              console.log('📜 Successfully scrolled to segments');
            } else {
              console.log('❌ Segments UI not found - checking current state again');
              console.log('Current analysisComplete:', analysisComplete);
              console.log('Current extractedMoments length:', extractedMoments.length);
            }
          }, 200);
        }, 50);
      } else {
        setAnalysisComplete(false);
        setExtractedMoments([]);
        setError(`This video "${videoToLoad.originalName}" was uploaded but never analyzed.`);
      }
      
      setProcessing(false);
      setCurrentStep('');
      
      // Don't clear file when loading from library - we need it to show analysis section
      // setFile(null); - commented out to allow analysis section to render
      
      // Clear the videoToLoad after processing
      setVideoToLoad(null);
    }
  }, [videoToLoad]);

  // Effect to restore from localStorage on mount only
  React.useEffect(() => {
    const tempData = localStorage.getItem('temp_loading_video');
    if (tempData && extractedMoments.length === 0 && !analysisComplete) {
      try {
        const data = JSON.parse(tempData);
        // Only use if less than 10 seconds old (prevents stale data)
        if (Date.now() - data.timestamp < 10000) {
          console.log('🔄 Restoring video data from localStorage on mount');
          
          if (data.uploadedFileInfo) {
            setUploadedFileInfo(data.uploadedFileInfo);
          }
          
          if (data.extractedMoments && data.extractedMoments.length > 0) {
            console.log('✅ Restoring', data.extractedMoments.length, 'segments from localStorage');
            setExtractedMoments(data.extractedMoments);
            setAnalysisComplete(true);
            setError(null);
            setProcessing(false);
            setCurrentStep('');
            console.log('🎯 State restored - should show segments UI now');
            
            // Force a scroll after state is set
            setTimeout(() => {
              const analysisSection = document.querySelector('.analysis-complete');
              if (analysisSection) {
                analysisSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                console.log('📜 Scrolled to segments section');
              } else {
                console.log('❌ Analysis section still not found after restore');
              }
            }, 500);
          }
        } else {
          // Clean up old data
          localStorage.removeItem('temp_loading_video');
        }
      } catch (error) {
        localStorage.removeItem('temp_loading_video');
      }
    }
  }, []); // Only run once on mount

  // Simple tier detection based on email or localStorage
  const getUserTier = () => {
    if (!user?.emailAddresses?.[0]?.emailAddress) return 'guest';
    
    const email = user.emailAddresses[0].emailAddress.toLowerCase();
    const adminEmails = ['nethan.nagendran@gmail.com', 'nethmarket@gmail.com'];
    
    // Check if admin email
    if (adminEmails.includes(email)) return 'developer';
    
    // Check localStorage for saved tier
    const savedTier = localStorage.getItem(`userTier_${user.id}`);
    if (savedTier) return savedTier;
    
    return 'guest';
  };

  const userTier = getUserTier();

  const getTierLimits = () => {
    switch (userTier) {
      case 'pro':
      case 'developer':
        return { 
          name: userTier === 'developer' ? 'Developer' : 'Pro',
          maxClips: -1, 
          maxVideoLength: -1,
          aspectRatios: ['9:16', '16:9', '1:1', '4:5', '21:9'],
          cropPositions: ['center', 'top', 'bottom', 'left', 'right'],
          features: ['basic_export', 'bulk_export', 'custom_positioning', 'ai_cropping'],
          hasDetailedAnalytics: true
        };
      default:
        return { 
          name: 'Guest', 
          maxClips: 3, 
          maxVideoLength: 600,
          aspectRatios: ['9:16', '16:9', '1:1', '4:5', '21:9'],
          cropPositions: ['center'],
          features: ['basic_export'],
          hasDetailedAnalytics: false
        };
    }
  };

  const canUploadVideo = () => true; // Allow all uploads, check limits during processing
  
  // Pro feature states
  const [selectedAspectRatio, setSelectedAspectRatio] = useState('9:16');
  const [selectedCropPosition, setSelectedCropPosition] = useState('center');
  const [bulkExportMode, setBulkExportMode] = useState(false);
  const [selectedBulkRatios, setSelectedBulkRatios] = useState(['9:16', '16:9', '1:1']);
  
  // Debug removed to prevent re-renders

  // Loading state
  if (!isLoaded) {
    return (
      <div className="content-scalar min-h-screen">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading Viral Clip Generator...</p>
        </div>
      </div>
    );
  }

  // Not signed in
  if (!user) {
    return (
      <div className="content-scalar min-h-screen">
        <div className="loading-container">
          <p>Please sign in to access the Viral Clip Generator</p>
          <button onClick={() => navigate('/')}>Go to Sign In</button>
        </div>
      </div>
    );
  }

  // Pro feature configurations
  const TIER_LIMITS = {
    guest: {
      maxClips: 3,
      aspectRatios: ['9:16', '16:9', '1:1', '4:5', '21:9'],
      cropPositions: ['center'],
      features: ['basic_export']
    },
    pro: {
      maxClips: Infinity,
      aspectRatios: ['9:16', '16:9', '1:1', '4:5', '21:9', '3:4', '2:3', '16:10'],
      cropPositions: ['center', 'top', 'bottom', 'left', 'right', 'custom'],
      features: ['bulk_export', 'ai_cropping', 'custom_positioning']
    },
    developer: {
      maxClips: Infinity,
      aspectRatios: ['9:16', '16:9', '1:1', '4:5', '21:9', '3:4', '2:3', '16:10'],
      cropPositions: ['center', 'top', 'bottom', 'left', 'right', 'custom'],
      features: ['bulk_export', 'ai_cropping', 'custom_positioning', 'advanced_features']
    }
  };

  const ASPECT_RATIOS = {
    '9:16': { name: 'Vertical (TikTok/Shorts)', width: 9, height: 16, icon: '📱', platforms: 'TikTok, Instagram Reels, YouTube Shorts' },
    '16:9': { name: 'Horizontal (YouTube)', width: 16, height: 9, icon: '📺', platforms: 'YouTube, Facebook, Twitter' },
    '1:1': { name: 'Square (Instagram)', width: 1, height: 1, icon: '⬜', platforms: 'Instagram Feed, Facebook, LinkedIn' },
    '4:5': { name: 'Portrait (Instagram)', width: 4, height: 5, icon: '🖼️', platforms: 'Instagram Stories, Pinterest' },
    '21:9': { name: 'Cinematic', width: 21, height: 9, icon: '🎬', platforms: 'Cinematic content, Ultra-wide' },
    '3:4': { name: 'Portrait (Facebook)', width: 3, height: 4, icon: '📄', platforms: 'Facebook Stories, Snapchat' },
    '2:3': { name: 'Portrait (Pinterest)', width: 2, height: 3, icon: '📌', platforms: 'Pinterest, Tumblr' },
    '16:10': { name: 'Widescreen', width: 16, height: 10, icon: '💻', platforms: 'Presentations, Desktop' }
  };

  const currentTierLimits = TIER_LIMITS[userTier] || TIER_LIMITS.guest;
  const hasFeature = (feature) => currentTierLimits.features.includes(feature);
  const isAspectRatioAvailable = (ratio) => currentTierLimits.aspectRatios.includes(ratio);

  // Debug logs removed to prevent infinite re-renders

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

  // Client-side function to style text (no highlighting, just white text)
  const highlightAttentionWordsClient = (text) => {
    let styledText = text.replace(/[\r\n]+/g, ' ').trim();
    
    // Return plain white text without any highlighting
    return styledText;
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

  // Function to load previous video and restore its state
  const loadPreviousVideo = (video) => {
    console.log('📼 Click handler: Setting video to load:', video.originalName);
    console.log('📼 Click handler: Current videoToLoad before set:', !!videoToLoad);
    setVideoToLoad(video);
    console.log('📼 Click handler: setVideoToLoad called');
  };

  const deleteVideoFromLibrary = (video) => {
    setVideoToDelete(video);
    setShowDeleteModal(true);
  };

  const confirmDeleteVideo = () => {
    if (videoToDelete) {
      const success = VideoLibraryService.deleteVideoFromLibrary(user?.id, videoToDelete.id);
      if (success) {
        // Refresh the video library to remove the deleted video from display
        const updatedLibrary = VideoLibraryService.getUserVideoLibrary(user?.id);
        setVideoLibrary(updatedLibrary);
        console.log('✅ Video deleted successfully:', videoToDelete.originalName);
      } else {
        alert('Failed to delete video. Please try again.');
      }
    }
    setShowDeleteModal(false);
    setVideoToDelete(null);
  };

  const cancelDeleteVideo = () => {
    setShowDeleteModal(false);
    setVideoToDelete(null);
  };



  const handleFileUpload = async (event) => {
    console.log('🚨 handleFileUpload called! This might be interfering with video loading');
    console.log('🚨 Event:', event);
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
    console.log('🚨 RESETTING STATE IN handleFileUpload - this might be the culprit!');
    
    // Only reset if user confirms or if no analysis exists
    if (extractedMoments.length > 0 && analysisComplete) {
      const userConfirms = window.confirm(
        'You have existing analysis results. Uploading a new file will clear them. Continue?'
      );
      if (!userConfirms) {
        setProcessing(false);
        return;
      }
    }
    
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
      
      // Save video to user's library
      if (user?.id) {
        VideoLibraryService.saveVideoToLibrary(user.id, {
          id: result.file.filename,
          filename: result.file.filename,
          originalName: uploadedFile.name,
          fileSize: uploadedFile.size,
          duration: await checkVideoDuration(), // We already have this function
          status: 'uploaded',
          uploadDate: new Date().toISOString()
        });
      }
      
      // Start complete processing pipeline immediately after upload
      console.log('🚀 STARTING COMPLETE PROCESSING PIPELINE...');
      setCurrentStep("Upload complete! Processing your shorts...");
      setProcessing(true);
      setTimeout(() => {
        processCompleteVideoFlow(result.file);
      }, 1000);
      
    } catch (error) {
      console.error('Upload error:', error);
      setError(`Upload failed: ${error.message}`);
      setProcessing(false);
    }
  };

  const generateVideoClip = async (moment) => {
    console.log('🎬 generateVideoClip called with:', moment);
    console.log('🎬 uploadedFileInfo:', uploadedFileInfo);
    console.log('🎬 file:', file);
    
    // Check if we have the necessary file info
    if (!uploadedFileInfo) {
      console.error('❌ No uploadedFileInfo available - file may have been cleaned up');
      setError("File not available. Please re-upload your file.");
      return;
    }
    
    const activeFileInfo = uploadedFileInfo;
    
    console.log('🎬 Using file info:', activeFileInfo);

    setGeneratingClips(true);
    setClipProgress({ ...clipProgress, [moment.id]: 0 });

    try {
      setCurrentStep(`Transcribing segment ${moment.id}...`);
      setClipProgress((prev) => ({ ...prev, [moment.id]: 20 }));

      // Call backend to transcribe this segment
      const requestPayload = {
        filename: activeFileInfo.filename,
        startTime: moment.startTimeSeconds,
        endTime: moment.endTimeSeconds,
        segmentId: moment.id,
        expectedTranscript: moment.transcript
      };
      
      console.log('🎬 Sending request to transcribe-segment:', requestPayload);
      console.log('🎬 Full URL:', `${API_URL}/transcribe-segment`);
      
      const response = await fetch(`${API_URL}/transcribe-segment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestPayload)
      });

      setClipProgress((prev) => ({ ...prev, [moment.id]: 60 }));

      if (!response.ok) {
        console.error('❌ Response not OK:', response.status, response.statusText);
        try {
          const errorText = await response.text();
          console.error('❌ Error response body:', errorText);
        } catch (e) {
          console.error('❌ Could not read error response');
        }
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

      // Add clip to video library
      if (user?.id && activeFileInfo) {
        const clipData = transcriptionResult.adjustedStartTime ? {
          startTime: transcriptionResult.adjustedStartTime,
          endTime: transcriptionResult.adjustedEndTime,
          duration: transcriptionResult.actualDuration,
          title: `Clip ${transcriptionResult.adjustedStartTime}s - ${transcriptionResult.adjustedEndTime}s`,
          aspectRatio: selectedAspectRatio,
          hasWatermark: getTierLimits().hasWatermark
        } : {
          startTime: moment.startTimeSeconds,
          endTime: moment.endTimeSeconds,
          duration: moment.duration,
          title: `Clip ${moment.startTimeSeconds}s - ${moment.endTimeSeconds}s`,
          aspectRatio: selectedAspectRatio,
          hasWatermark: getTierLimits().hasWatermark
        };
        
        VideoLibraryService.addClipToVideo(user.id, activeFileInfo.filename, clipData);
      }

      setClipProgress((prev) => ({ ...prev, [moment.id]: 100 }));

      // Show the video clip modal with real transcript
      setTimeout(() => {
        showVideoClipModal(updatedMoments.find((m) => m.id === moment.id));
      }, 500);

      console.log(
        `✅ Successfully transcribed segment ${moment.id}: "${transcriptionResult.transcript.substring(0, 50)}..."`
      );
      console.log('🔍 DEBUG - Frontend received full transcript:', transcriptionResult.transcript);
      console.log('🔍 DEBUG - Frontend transcript length:', transcriptionResult.transcript?.length);
      console.log('🔍 DEBUG - Updated moment transcript after assignment:', updatedMoments.find(m => m.id === moment.id)?.transcript);
      console.log('🔍 DEBUG - Updated moment transcript length:', updatedMoments.find(m => m.id === moment.id)?.transcript?.length);
      console.log('🔍 Transcription result captions:', transcriptionResult.captions);
      console.log('🔍 Updated moment subtitles:', updatedMoments.find(m => m.id === moment.id)?.subtitles);
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
    // Check if we have the necessary file info
    if (!moment.clipGenerated || !uploadedFileInfo) {
      alert("Generate clip first");
      return;
    }
    
    const activeFileInfo = uploadedFileInfo;

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

    // Create video element with dynamic aspect ratio
    let video = document.createElement("video");
    const aspectConfig = ASPECT_RATIOS[selectedAspectRatio] || ASPECT_RATIOS['16:9'];
    const maxWidth = Math.min(window.innerWidth * 0.8, 800);
    const maxHeight = Math.min(window.innerHeight * 0.7, 600);
    
    // Calculate video dimensions based on selected aspect ratio
    let videoWidth, videoHeight;
    const targetAspectRatio = aspectConfig.width / aspectConfig.height;
    
    if (targetAspectRatio > maxWidth / maxHeight) {
      // Width constrained
      videoWidth = maxWidth;
      videoHeight = maxWidth / targetAspectRatio;
    } else {
      // Height constrained
      videoHeight = maxHeight;
      videoWidth = maxHeight * targetAspectRatio;
    }
    
    // Apply crop positioning
    const objectPosition = {
      'center': 'center center',
      'top': 'center top', 
      'bottom': 'center bottom',
      'left': 'left center',
      'right': 'right center'
    }[selectedCropPosition] || 'center center';
    
    // Set video source from server  
    const fileUrl = `http://localhost:3001/uploads/${activeFileInfo.filename}`;
    const isAudioFile = activeFileInfo.filename.match(/\.(mp3|wav|m4a|aac|ogg)$/i);
    
    console.log('🎥 Setting video source:', fileUrl);
    console.log('🎵 Is audio file:', isAudioFile);
    
    // Style video element differently for audio files
    if (isAudioFile) {
      video.style.cssText = `
        width: ${videoWidth}px; 
        height: ${videoHeight}px; 
        display: block; 
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 8px;
        position: relative;
      `;
      
      // Create audio visualization that plays the actual audio
      const audioPlayer = document.createElement("audio");
      audioPlayer.src = fileUrl;
      audioPlayer.style.display = "none";
      
      // Add audio visualization overlay with waveform-like animation
      const audioOverlay = document.createElement("div");
      audioOverlay.style.cssText = `
        position: absolute; top: 0; left: 0; right: 0; bottom: 0;
        display: flex; align-items: center; justify-content: center; flex-direction: column;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 8px; z-index: 1; overflow: hidden;
      `;
      
      // Add animated waveform bars
      const waveformContainer = document.createElement("div");
      waveformContainer.style.cssText = `
        display: flex; align-items: center; gap: 2px; margin: 20px 0;
        height: 40px;
      `;
      
      // Create animated bars
      for (let i = 0; i < 20; i++) {
        const bar = document.createElement("div");
        bar.style.cssText = `
          width: 3px; background: rgba(255,255,255,0.6); border-radius: 2px;
          height: ${Math.random() * 30 + 5}px; transition: all 0.3s ease;
          animation: pulse ${0.5 + Math.random() * 1}s infinite alternate;
        `;
        waveformContainer.appendChild(bar);
      }
      
      audioOverlay.innerHTML = `
        <div style="text-align: center; color: white;">
          <div style="font-size: 48px; margin-bottom: 15px;">🎧</div>
          <div style="font-size: 18px; font-weight: 600;">Playing Audio</div>
          <div style="font-size: 14px; opacity: 0.8; margin-top: 5px;">${moment.title || 'Segment ' + moment.id}</div>
        </div>
      `;
      audioOverlay.appendChild(waveformContainer);
      
      // Add CSS animation for the bars
      const style = document.createElement("style");
      style.textContent = `
        @keyframes pulse {
          0% { height: 5px; opacity: 0.5; }
          100% { height: 35px; opacity: 1; }
        }
      `;
      document.head.appendChild(style);
      
      videoContainer.appendChild(audioOverlay);
      videoContainer.appendChild(audioPlayer);
      
      // Use audio player instead of video for timing
      video = audioPlayer;
    } else {
      video.style.cssText = `
        width: ${videoWidth}px; 
        height: ${videoHeight}px; 
        display: block; 
        object-fit: cover;
        object-position: ${objectPosition};
        border-radius: 8px;
      `;
    }
    video.controls = false;
    video.muted = false;
    // Don't set currentTime here - set it after metadata loads
    
    video.onerror = (e) => {
      console.error('❌ Video loading error:', e);
      console.error('❌ Video error code:', video.error);
      
      if (isAudioFile) {
        console.log('🎵 Audio file detected, this is expected behavior');
        // For audio files, we'll just show the captions overlay
      }
    };
    
    video.onloadstart = () => {
      console.log('⏳ Video loading started');
    };
    
    video.oncanplay = () => {
      console.log('✅ Video can start playing');
    };
    
    video.onloadedmetadata = () => {
      console.log('📊 Video metadata loaded');
      video.currentTime = moment.startTimeSeconds || 0;
      console.log('⏰ Set video time to:', moment.startTimeSeconds);
    };
    
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
      
      // Always show the full transcript with highlighting
      if (moment.transcript) {
        // If we have word-level timing data, use that for precise highlighting
        if (moment.words && moment.words.length > 0) {
          const words = moment.words;
          const currentWordIndex = words.findIndex(word => 
            currentTime >= word.start && currentTime <= word.end
          );
          
          const animatedHTML = words.map((wordObj, index) => {
            const word = wordObj.word || wordObj.text || '';
            if (index < currentWordIndex) {
              // Already spoken - show in white
              return `<span style="color: white; opacity: 1;">${word}</span>`;
            } else if (index === currentWordIndex) {
              // Currently being spoken - show highlighted
              return `<span style="color: #ffd700; opacity: 1; font-weight: bold;">${word}</span>`;
            } else {
              // Not yet spoken - show dimmed
              return `<span style="color: white; opacity: 0.6;">${word}</span>`;
            }
          }).join(' ');
          
          captionsOverlay.innerHTML = `
            <div style="color: white; font-size: 18px; font-weight: 500; font-family: Arial, sans-serif; transition: all 0.1s ease;">
              ${animatedHTML}
            </div>
          `;
        } else {
          // Fallback: show full transcript with attention word highlighting
          const highlightedTranscript = highlightAttentionWordsClient(moment.transcript);
          captionsOverlay.innerHTML = `
            <div style="color: white; font-size: 18px; opacity: 0.9; font-family: Arial, sans-serif;">
              ${highlightedTranscript}
            </div>
          `;
        }
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
            segmentId: moment.id,
            // Pro feature settings
            aspectRatio: selectedAspectRatio,
            cropPosition: selectedCropPosition,
            userTier: userTier
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
        a.download = `segment-${moment.id}-${selectedAspectRatio}-${selectedCropPosition}.mp4`;
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

    // AI Smart Cropping function
    const handleAISmartCrop = async () => {
      if (!hasFeature('ai_cropping')) {
        alert('AI Smart Cropping is available for Pro users only!');
        return;
      }

      try {
        downloadBtn.innerHTML = '🤖';
        downloadBtn.disabled = true;
        downloadBtn.style.backgroundColor = 'rgba(255,165,0,0.8)';

        // Call AI analysis API
        const response = await fetch(`${API_URL}/ai-crop-analysis`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            videoFile: fileInfo.filename,
            moment: moment,
            aspectRatio: selectedAspectRatio
          }),
        });

        if (!response.ok) throw new Error('AI analysis failed');

        const { cropPosition, confidence, faces, subjects } = await response.json();
        
        console.log(`🤖 AI detected ${faces} faces and ${subjects} subjects with ${confidence}% confidence`);
        
        // Update crop position with AI suggestion
        setSelectedCropPosition(cropPosition);
        
        // Show AI analysis result
        alert(`🤖 AI Analysis Complete!\n\nDetected: ${faces} faces, ${subjects} subjects\nConfidence: ${confidence}%\nRecommended: ${cropPosition} crop\n\nProceeding with optimized download...`);
        
        // Download with AI-optimized settings
        setTimeout(() => downloadVideo(), 1000);
        
      } catch (error) {
        console.warn('AI cropping failed, using current settings:', error);
        alert('AI analysis failed, proceeding with current crop settings...');
        setTimeout(() => downloadVideo(), 500);
      }
    };

    // Bulk Export function
    const handleBulkExport = async () => {
      if (!hasFeature('bulk_export') || !bulkExportMode) {
        downloadVideo();
        return;
      }

      try {
        downloadBtn.innerHTML = '📦';
        downloadBtn.disabled = true;
        downloadBtn.style.backgroundColor = 'rgba(139,92,246,0.8)';

        let successCount = 0;
        
        for (let i = 0; i < selectedBulkRatios.length; i++) {
          const ratio = selectedBulkRatios[i];
          downloadBtn.innerHTML = `📦 ${i + 1}/${selectedBulkRatios.length}`;
          
          try {
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
                words: moment.words || [],
                segmentId: moment.id,
                aspectRatio: ratio,
                cropPosition: selectedCropPosition,
                userTier: userTier
              })
            });

            if (!response.ok) throw new Error(`Download failed for ${ratio}`);

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `segment-${moment.id}-${ratio}-${selectedCropPosition}.mp4`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            successCount++;
            
            // Small delay between downloads
            await new Promise(resolve => setTimeout(resolve, 1000));
            
          } catch (error) {
            console.error(`Failed to download ${ratio}:`, error);
          }
        }
        
        alert(`📦 Bulk Export Complete!\n\nSuccessfully downloaded ${successCount}/${selectedBulkRatios.length} formats`);
        
      } catch (error) {
        console.error('Bulk export error:', error);
        alert('Bulk export failed: ' + error.message);
      } finally {
        downloadBtn.innerHTML = '⬇';
        downloadBtn.disabled = false;
        downloadBtn.style.backgroundColor = 'rgba(0,128,0,0.8)';
      }
    };

    // Determine which download function to use based on Pro settings
    const smartDownloadHandler = () => {
      if (bulkExportMode && hasFeature('bulk_export')) {
        handleBulkExport();
      } else {
        downloadVideo();
      }
    };

    // Event listeners
    playBtn.onclick = togglePlay;
    downloadBtn.onclick = smartDownloadHandler;

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
      // No need to revoke URL since we're using server URL
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

    // Add title with aspect ratio indicator
    const title = document.createElement("h3");
    title.textContent = moment.title;
    title.style.cssText = `
      color: white; font-size: 24px; margin-bottom: 10px; 
      text-align: center; font-weight: bold;
    `;

    // Add aspect ratio indicator
    const aspectIndicator = document.createElement("div");
    const indicatorConfig = ASPECT_RATIOS[selectedAspectRatio] || ASPECT_RATIOS['16:9'];
    aspectIndicator.innerHTML = `
      <div style="
        color: #8b5cf6; font-size: 14px; text-align: center; margin-bottom: 20px;
        background: rgba(139, 92, 246, 0.1); padding: 8px 16px; border-radius: 20px;
        border: 1px solid rgba(139, 92, 246, 0.3); display: inline-block;
      ">
        ${indicatorConfig.icon} ${selectedAspectRatio} • ${indicatorConfig.name}
        ${selectedCropPosition !== 'center' ? ` • ${selectedCropPosition} crop` : ''}
      </div>
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
    modal.appendChild(aspectIndicator);
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

  const downloadVideoWithSubtitles = async (moment, customAspectRatio = null) => {
    console.log('🔥🔥🔥 DOWNLOAD FUNCTION CALLED! 🔥🔥🔥');
    console.log('🔥 Moment:', moment);
    console.log('🔥 Selected aspect ratio:', customAspectRatio || selectedAspectRatio);
    console.log('🔥 Custom aspect ratio:', customAspectRatio);
    console.log('🔥 Selected crop position:', selectedCropPosition);
    console.log('🔥 User tier:', userTier);
    
    // Check if we have the necessary file info  
    if (!uploadedFileInfo) {
      console.error('❌ No uploadedFileInfo available for download');
      alert('File not available. Please re-upload your file.');
      return;
    }
    
    const activeFileInfo = uploadedFileInfo;
    console.log('🔥 Active file info:', activeFileInfo);
    
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
          filename: activeFileInfo.filename,
          startTime: moment.startTimeSeconds,
          endTime: moment.endTimeSeconds,
          subtitles: moment.subtitles,
          words: moment.words || [], // Include word-level timestamps for karaoke highlighting
          segmentId: moment.id,
          userTier: userTier, // Add user tier for watermark logic
          hasWatermark: getTierLimits().hasWatermark,
          // Pro feature parameters
          aspectRatio: customAspectRatio || selectedAspectRatio,
          cropPosition: selectedCropPosition
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
    console.log('🚀 analyzeContent called with:', fileInfo);
    console.log('🚀 User ID:', user?.id, 'User tier:', userTier);
    
    // Set the uploaded file info state immediately
    setUploadedFileInfo(fileInfo);
    
    try {
      // Check if user has tokens before starting analysis
      if (!TokenService.hasTokens(user.id, userTier)) {
        setError(`❌ Insufficient tokens. ${userTier === 'guest' ? 'Guests get 1 token total.' : `${userTier} users get ${TokenService.getTokenInfo(userTier).maxTokens} tokens.`}`);
        setProcessing(false);
        return;
      }

      // Consume a token before starting analysis
      if (!TokenService.useToken(user.id, userTier)) {
        setError("❌ Failed to consume token. Please try again.");
        setProcessing(false);
        return;
      }

      console.log(`🪙 Token consumed. Remaining tokens: ${TokenService.getCurrentTokens(user.id, userTier) === -1 ? '∞' : TokenService.getCurrentTokens(user.id, userTier)}`);

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
              console.log('📤 Stream completed');
              // Process any remaining data in buffer
              if (currentDataBuffer.trim()) {
                try {
                  const data = JSON.parse(currentDataBuffer);
                  if (data.type === 'complete') {
                    await handleCompleteMessage(data);
                  } else if (data.type === 'error') {
                    console.error('❌ Server error:', data.error);
                    setError(`Analysis failed: ${data.error}`);
                    setProcessing(false);
                    return;
                  }
                } catch (e) {
                  console.error('Error parsing final buffer:', e);
                  setError('Failed to parse analysis results');
                  setProcessing(false);
                  return;
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
                      } else if (data.type === 'error') {
                        console.error('❌ Server error during processing:', data.error);
                        setError(`Analysis failed: ${data.error}`);
                        setProcessing(false);
                        return;
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
        const tierLimits = TIER_LIMITS[userTier] || TIER_LIMITS.guest;
        const result = data.result;
        console.log('🎯 AI result:', result);
        console.log('🎯 Viral analysis:', result.viralAnalysis);
        console.log('🎯 Has detailed analytics:', !!result.viralAnalysis?.detailedAnalytics);
        console.log('🔍 FRONTEND DEBUG - Raw viral moments:', result.viralMoments);
        console.log('🔍 FRONTEND DEBUG - Number of viral moments:', result.viralMoments?.length);
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
              
              // Add new pro features
              segment.contentStrategy = moment.contentStrategy || result.viralAnalysis?.contentStrategy?.recommendations || result.viralAnalysis?.contentStrategy;
              segment.platformTips = moment.platformTips || result.viralAnalysis?.platformTips;
              segment.competitiveInsights = moment.competitiveInsights || result.viralAnalysis?.competitiveInsights?.analysis || result.viralAnalysis?.competitiveInsights;
              
              // Debug logging for each moment
              console.log(`🔍 Moment ${index + 1} analytics:`, {
                hasIndividualAnalytics: !!moment.detailedAnalytics,
                hasGlobalAnalytics: !!result.viralAnalysis?.detailedAnalytics,
                finalAnalytics: segment.detailedAnalytics,
                improvements: segment.improvements,
                hashtags: segment.hashtags,
                rawMoment: moment
              });
              
              console.log(`🔍 Final segment ${index + 1}:`, segment);
              
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

        // Apply tier limits for segments
        const limitedSegments = userTier === 'guest' ? segments.slice(0, 3) : segments;
        
        // Update UI with results
        console.log('🎯 About to update UI with segments:', segments.length, 'total segments');
        console.log('🎯 Limited segments for', userTier, 'tier:', limitedSegments.length, 'segments');
        console.log('🎯 Analysis response:', response);
        console.log('🎯 Current user:', user?.id);
        console.log('🎯 Uploaded file info:', uploadedFileInfo);
        
        setProgress(100);
        setCurrentStep("AI analysis complete!");
        setExtractedMoments(limitedSegments);
        setAnalysisComplete(true);
        setProcessing(false);

        // Save the complete analysis to video library
        if (user?.id && fileInfo) {
          console.log('🔄 Saving analysis for video:', fileInfo.filename);
          console.log('📊 Analysis data being saved:', {
            extractedMoments: segments.length,
            hasFileInfo: !!fileInfo,
            hasUploadedFileInfo: !!uploadedFileInfo,
            userId: user.id
          });
          
          const savedVideo = VideoLibraryService.saveVideoAnalysis(user.id, fileInfo.filename, {
            extractedMoments: limitedSegments,
            analysis: response, // Save the full analysis response
            uploadedFileInfo: fileInfo, // Use fileInfo instead of uploadedFileInfo
            thumbnail: limitedSegments.length > 0 ? limitedSegments[0].thumbnail : null // Use first segment's thumbnail
          });
          
          console.log('💾 Video saved result:', savedVideo);
          
          // Refresh video library with a delay to ensure localStorage update completed
          setTimeout(() => {
            const updatedVideos = VideoLibraryService.getUserVideoLibrary(user.id);
            console.log('📚 Updated video library:', updatedVideos.length, 'videos');
            console.log('📚 Video statuses:', updatedVideos.map(v => ({ name: v.originalName, status: v.status, moments: v.extractedMoments?.length || 0 })));
            setVideoLibrary(updatedVideos.slice(0, 5));
          }, 100);
        }

        console.log(`✅ AI analysis complete: ${segments.length} viral moments identified`);
        
        // Auto-start preview generation for all viral moments
        console.log('🚀 AUTO-STARTING preview generation for all viral moments...');
        setTimeout(() => {
          autoGeneratePreviews(limitedSegments, fileInfo);
        }, 1500); // Give UI time to render the segments first
      };

      console.log('🔄 About to start processStream...');
      // Start processing the stream
      await processStream();
      console.log('✅ processStream completed successfully');

    } catch (error) {
      console.error("AI Analysis error:", error);
      setError(`AI Analysis failed: ${error.message}`);
      setProcessing(false);
      setProgress(0);
    }
  };

  // Complete processing pipeline - analyze, generate previews, and create final videos
  const processCompleteVideoFlow = async (fileInfo) => {
    try {
      console.log('🚀 Starting complete video processing pipeline...');
      setUploadedFileInfo(fileInfo);
      setCurrentStep("Analyzing your content...");
      setProgress(10);

      // Step 1: Run AI analysis to get viral moments using SSE stream
      console.log('📊 Step 1: Running AI analysis...');
      const analysisResponse = await fetch(`${API_URL}/analyze-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: fileInfo.filename,
          userTier: userTier,
          hasDetailedAnalytics: getTierLimits().hasDetailedAnalytics
        })
      });

      if (!analysisResponse.ok) {
        throw new Error('Analysis failed');
      }

      setCurrentStep("Processing AI analysis results...");
      setProgress(30);

      // Handle SSE stream to get the final result
      const reader = analysisResponse.body.getReader();
      let buffer = '';
      let result = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += new TextDecoder().decode(value);
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.trim().startsWith('data: ')) {
            try {
              const jsonStr = line.slice(6); // Remove 'data: ' prefix
              const data = JSON.parse(jsonStr);
              
              if (data.type === 'progress') {
                setProgress(Math.min(data.progress || 30, 45)); // Cap at 45% for this step
              } else if (data.type === 'complete') {
                result = data;
                break;
              }
            } catch (e) {
              // Skip malformed JSON
            }
          }
        }

        if (result) break;
      }

      if (!result || !result.result || !result.result.viralMoments) {
        console.error('❌ Invalid analysis result structure:', result);
        throw new Error('No analysis result received');
      }

      const analysisResult = result.result;
      console.log('📊 Analysis complete:', analysisResult);

      // Extract video summary if available
      const videoSummary = analysisResult.summary || analysisResult.videoSummary || null;
      if (videoSummary) {
        console.log('📝 Video summary received:', videoSummary);
      }

      const segments = analysisResult.viralMoments || [];
      
      console.log('🔍 DEBUG - Found segments:', segments.length, 'segments');
      console.log('🔍 DEBUG - First segment:', segments[0]);
      
      // Process segments to ensure proper timing properties
      const processedSegments = segments.map((moment, index) => ({
        ...moment,
        id: moment.id || `moment_${index + 1}`,
        startTimeSeconds: moment.startTime || moment.startTimeSeconds || 0,
        endTimeSeconds: moment.endTime || moment.endTimeSeconds || 30,
        subtitles: moment.subtitles || [],
        thumbnail: moment.thumbnail || `https://picsum.photos/400/300?random=${index + 1}`
      }));
      
      console.log('🔍 DEBUG - Processed segments:', processedSegments.length, 'segments');
      console.log('🔍 DEBUG - First processed segment timing:', {
        startTimeSeconds: processedSegments[0]?.startTimeSeconds,
        endTimeSeconds: processedSegments[0]?.endTimeSeconds
      });
      
      const limitedSegments = userTier === 'guest' ? processedSegments.slice(0, 3) : processedSegments;

      if (!limitedSegments.length) {
        throw new Error('No viral moments found in your content');
      }

      console.log(`✅ Found ${limitedSegments.length} viral moments`);
      setCurrentStep(`Generating ${limitedSegments.length} video shorts...`);

      // Step 2: Generate final video clips with subtitles for all moments
      console.log('🎬 Step 2: Generating final video clips...');
      const processedMoments = [];
      
      for (let i = 0; i < limitedSegments.length; i++) {
        const moment = limitedSegments[i];
        console.log(`🎯 Processing short ${i + 1}/${limitedSegments.length}: "${moment.title}"`);
        console.log(`🔍 DEBUG - Moment object:`, moment);
        console.log(`🔍 DEBUG - Moment keys:`, Object.keys(moment));
        console.log(`🔍 DEBUG - Start time:`, moment.startTimeSeconds || moment.startTime);
        console.log(`🔍 DEBUG - End time:`, moment.endTimeSeconds || moment.endTime);
        setCurrentStep(`Processing short ${i + 1}/${limitedSegments.length}: ${moment.title}`);
        setProgress(50 + (i / limitedSegments.length) * 40);

        try {
          // Use the precise transcript data already available from analysis
          // No need to make additional API calls since analysis already provides accurate timing
          console.log(`✅ Processing clip ${i + 1} with precise analysis data: "${moment.title}"`);
          
          processedMoments.push({
            ...moment,
            videoUrl: `/api/download-video`, // Real download happens on demand
            subtitles: moment.subtitles || [],
            transcript: moment.transcript, // This is already the precise segment transcript from analysis
            processing: false,
            processed: true,
            clipGenerated: true,
            transcribed: true, // Using precise analysis data
            // Timing metadata from analysis
            startTimeSeconds: moment.startTimeSeconds,
            endTimeSeconds: moment.endTimeSeconds,
            duration: moment.duration || `${Math.round(moment.endTimeSeconds - moment.startTimeSeconds)}s`,
            timingMethod: 'word-level-analysis',
            timingConfidence: 100 // High confidence since it comes from analysis
          });
          console.log(`✅ Short ${i + 1} processed using precise analysis data`);
        } catch (error) {
          console.error(`❌ Error processing short ${i + 1}:`, error);
          console.error(`❌ Error details:`, {
            message: error.message,
            stack: error.stack,
            moment: moment
          });
          processedMoments.push({
            ...moment,
            processing: false,
            processed: false,
            error: error.message
          });
        }
      }

      // Step 3: All processing complete - show final results
      console.log('🎉 All shorts processing complete!');
      setCurrentStep("All shorts ready!");
      setProgress(100);
      setExtractedMoments(processedMoments);
      setAnalysisComplete(true);
      setProcessing(false);

      // Save to video library
      if (user?.id) {
        VideoLibraryService.saveVideoAnalysis(user.id, fileInfo.filename, {
          extractedMoments: processedMoments,
          uploadedFileInfo: fileInfo,
          thumbnail: processedMoments[0]?.thumbnail || null,
          videoSummary: videoSummary
        });
      }

    } catch (error) {
      console.error('❌ Complete processing failed:', error);
      setError(`Processing failed: ${error.message}`);
      setProcessing(false);
      setProgress(0);
    }
  };

  // Auto-generate previews for all viral moments
  const autoGeneratePreviews = async (moments, fileInfo) => {
    if (!moments || moments.length === 0) {
      console.log('❌ No moments to generate previews for');
      return;
    }

    console.log(`🎬 Starting auto-preview generation for ${moments.length} viral moments...`);
    
    // Generate previews for all moments in parallel
    const previewPromises = moments.map(async (moment, index) => {
      try {
        console.log(`🎯 Generating preview for moment ${index + 1}: "${moment.title}"`);
        
        const requestPayload = {
          filename: fileInfo.filename,
          startTime: moment.startTimeSeconds,
          endTime: moment.endTimeSeconds,
          segmentId: moment.id,
          expectedTranscript: moment.transcript
        };

        const response = await fetch(`${API_URL}/transcribe-segment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestPayload)
        });

        if (response.ok) {
          const transcriptionResult = await response.json();
          console.log(`✅ Preview generated for moment ${index + 1}`);
          
          // Update the moment with preview data
          return {
            ...moment,
            transcript: transcriptionResult.transcript || moment.transcript,
            endTimeSeconds: transcriptionResult.adjustedEndTime || moment.endTimeSeconds,
            duration: transcriptionResult.actualDuration ? `${transcriptionResult.actualDuration}s` : moment.duration,
            subtitles: transcriptionResult.captions || [],
            highlightedSubtitles: transcriptionResult.highlightedCaptions || [],
            timingMethod: transcriptionResult.timingMethod,
            timingConfidence: transcriptionResult.timingConfidence,
            previewGenerated: true
          };
        } else {
          console.log(`⚠️ Preview generation failed for moment ${index + 1}`);
          return moment;
        }
      } catch (error) {
        console.error(`❌ Error generating preview for moment ${index + 1}:`, error);
        return moment;
      }
    });

    try {
      const updatedMoments = await Promise.all(previewPromises);
      
      // Update the state with previews
      setExtractedMoments(updatedMoments);
      console.log('🎉 All viral moment previews generated successfully!');
      
      // Update localStorage
      const videoDataToStore = {
        uploadedFileInfo: uploadedFileInfo,
        extractedMoments: updatedMoments,
        analysisComplete: true,
        timestamp: Date.now()
      };
      localStorage.setItem('videoData', JSON.stringify(videoDataToStore));
      
      // Auto-generate actual video clips for all moments
      console.log('🚀 AUTO-STARTING video clip generation for all moments...');
      setCurrentStep("Generating video clips for all moments...");
      
      console.log('🔍 Using fileInfo for video generation:', fileInfo);
      
      if (!fileInfo) {
        console.error('❌ No fileInfo available for video generation');
        return;
      }
      
      // Track completion of all video generations
      let completedClips = 0;
      const totalClips = updatedMoments.length;
      
      setTimeout(() => {
        updatedMoments.forEach((moment, index) => {
          setTimeout(async () => {
            console.log(`🎬 Auto-generating video clip for moment ${index + 1}: "${moment.title}"`);
            
            try {
              // Direct video generation API call instead of generateVideoClip function
              console.log('🎬 Making direct API call for video generation');
              const response = await fetch(`${API_URL}/download-video`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  filename: fileInfo.filename,
                  startTime: moment.startTimeSeconds,
                  endTime: moment.endTimeSeconds,
                  subtitles: moment.subtitles || [],
                  words: moment.words || [],
                  segmentId: moment.id,
                  expectedTranscript: moment.transcript,
                  aspectRatio: '9:16',
                  hasWatermark: false
                })
              });

              if (response.ok) {
                const result = await response.json();
                console.log(`✅ Video clip generated for moment ${index + 1}`);
                
                // Update the moment to mark it as generated
                const updatedMoments = [...extractedMoments];
                const momentIndex = updatedMoments.findIndex(m => m.id === moment.id);
                if (momentIndex !== -1) {
                  updatedMoments[momentIndex] = {
                    ...updatedMoments[momentIndex],
                    clipGenerated: true,
                    clipUrl: result.fileUrl || result.downloadUrl
                  };
                  setExtractedMoments(updatedMoments);
                }
              } else {
                console.error(`❌ Failed to generate video for moment ${index + 1}:`, response.status, response.statusText);
                const errorText = await response.text();
                console.error('Error details:', errorText);
              }
              
              completedClips++;
              console.log(`✅ Completed ${completedClips}/${totalClips} video clips`);
              
              // Check if all clips are done
              if (completedClips === totalClips) {
                console.log('🎉 ALL PROCESSING COMPLETE! Ready to show final shorts page');
                setCurrentStep("All shorts ready! Loading final page...");
                setTimeout(() => {
                      }, 1000);
              }
            } catch (error) {
              console.error(`❌ Error generating clip ${index + 1}:`, error);
              // Still count as completed to avoid hanging
              completedClips++;
              if (completedClips === totalClips) {
                  }
            }
          }, index * 2000); // Stagger by 2 seconds to avoid overwhelming the server
        });
      }, 1000);
      
    } catch (error) {
      console.error('❌ Error in auto-preview generation:', error);
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
              {/* Processing State - Terminal Style - Show while processing */}
              {processing && (
                <div className="terminal-container">
                  <div className="terminal-header">
                    <div className="terminal-buttons">
                      <div className="terminal-button terminal-close"></div>
                      <div className="terminal-button terminal-minimize"></div>
                      <div className="terminal-button terminal-maximize"></div>
                    </div>
                    <div className="terminal-title">🤖 AI Content Analyzer v2.1</div>
                  </div>
                  <div className="terminal-body">
                    <div className="terminal-line">
                      <span className="terminal-prompt">user@clipgenius:~$</span> 
                      <span className="terminal-command">ai-analyze-video --mode=viral --tier=pro</span>
                    </div>
                    <div className="terminal-line">
                      <span className="terminal-info">[INFO]</span> Initializing AI analysis engine...
                    </div>
                    <div className="terminal-line">
                      <span className="terminal-success">[OK]</span> Neural network loaded successfully
                    </div>
                    <div className="terminal-line">
                      <span className="terminal-success">[OK]</span> Speech recognition engine ready
                    </div>
                    <div className="terminal-line terminal-current">
                      <span className="terminal-warning">[PROC]</span> 
                      <span className="terminal-current-text">{currentStep}</span>
                      <span className="terminal-cursor">_</span>
                    </div>
                    <div className="terminal-progress-container">
                      <div className="terminal-progress-bar">
                        <div className="terminal-progress-fill" style={{ width: `${progress}%` }}></div>
                      </div>
                      <span className="terminal-percentage">[{progress}%]</span>
                    </div>
                    {progress > 20 && (
                      <div className="terminal-line">
                        <span className="terminal-success">[✓]</span> Audio extraction completed
                      </div>
                    )}
                    {progress > 50 && (
                      <div className="terminal-line">
                        <span className="terminal-success">[✓]</span> Speech transcription completed
                      </div>
                    )}
                    {progress > 70 && (
                      <div className="terminal-line">
                        <span className="terminal-success">[✓]</span> Viral potential analysis completed
                      </div>
                    )}
                    {progress > 90 && (
                      <div className="terminal-line">
                        <span className="terminal-success">[✓]</span> Viral moments identified
                      </div>
                    )}
                    {false && (
                      <>
                        <div className="terminal-line">
                          <span className="terminal-success">[✓]</span> Generating transcript previews...
                        </div>
                        <div className="terminal-line">
                          <span className="terminal-warning">[PROC]</span> Creating video clips for all moments...
                        </div>
                        <div className="terminal-line">
                          <span className="terminal-info">[INFO]</span> This may take a few minutes...
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Final Shorts Page - Show when processing complete and analysis done */}
              {!processing && analysisComplete && extractedMoments.length > 0 ? (
                <div className="analysis-complete">
                  <div className="analysis-header">
                    <h3 className="analysis-title">
                      🎬 Your Viral Shorts Are Ready! ({extractedMoments.length} clips)
                    </h3>
                    <button
                      onClick={() => {
                        setFile(null);
                        setExtractedMoments([]);
                        setAnalysisComplete(false);
                        setProcessing(false);
                        setProgress(0);
                        setError(null);
                      }}
                      className="analysis-new-file-prominent"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      🚀 Upload New Video
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
                                  
                                  {moment.hashtags && (
                                    <div className="hashtags-section">
                                      <span className="hashtags-label">📱 Trending hashtags:</span>
                                      <div className="hashtags-list">
                                        {moment.hashtags.map((tag, idx) => {
                                          // Handle the actual server format: {hashtag: "text", engagementScore: number}
                                          let hashtagText = '';
                                          let engagementScore = '';
                                          
                                          if (typeof tag === 'object' && tag.hashtag) {
                                            // Server format: {hashtag: "#EntrepreneurMindset", engagementScore: 85}
                                            hashtagText = tag.hashtag;
                                            engagementScore = tag.engagementScore ? `${tag.engagementScore}%` : '';
                                          } else if (typeof tag === 'object') {
                                            // Fallback for other object formats
                                            const key = Object.keys(tag)[0];
                                            hashtagText = key;
                                            engagementScore = tag[key] ? `${tag[key]}%` : '';
                                          } else if (typeof tag === 'string') {
                                            // Simple string format
                                            hashtagText = tag;
                                          }
                                          
                                          return (
                                            <span 
                                              key={idx} 
                                              className="hashtag enhanced"
                                              onClick={() => {
                                                navigator.clipboard?.writeText(hashtagText);
                                                // Show quick feedback
                                                const element = document.getElementById(`hashtag-${idx}`);
                                                if (element) {
                                                  const originalText = element.textContent;
                                                  element.textContent = 'Copied!';
                                                  element.style.background = '#10b981';
                                                  setTimeout(() => {
                                                    element.textContent = originalText;
                                                    element.style.background = '';
                                                  }, 1000);
                                                }
                                              }}
                                              id={`hashtag-${idx}`}
                                              title="Click to copy hashtag"
                                              style={{ 
                                                position: 'relative',
                                                cursor: 'pointer',
                                                transition: 'background-color 0.3s ease'
                                              }}
                                            >
                                              {hashtagText}
                                            </span>
                                          );
                                        })}
                                      </div>
                                      <button 
                                        className="copy-all-hashtags"
                                        id={`copy-all-btn-${moment.id}`}
                                        onClick={() => {
                                          const hashtagTexts = moment.hashtags.map(tag => {
                                            if (typeof tag === 'object' && tag.hashtag) {
                                              return tag.hashtag;
                                            } else if (typeof tag === 'object') {
                                              return Object.keys(tag)[0];
                                            }
                                            return tag;
                                          }).filter(Boolean); // Remove any empty values
                                          
                                          navigator.clipboard?.writeText(hashtagTexts.join(' '));
                                          
                                          // Show feedback
                                          const button = document.getElementById(`copy-all-btn-${moment.id}`);
                                          if (button) {
                                            const originalText = button.textContent;
                                            button.textContent = '✅ Copied!';
                                            button.style.background = '#10b981';
                                            button.style.color = 'white';
                                            button.style.borderColor = '#10b981';
                                            setTimeout(() => {
                                              button.textContent = originalText;
                                              button.style.background = 'transparent';
                                              button.style.color = '#8b5cf6';
                                              button.style.borderColor = '#8b5cf6';
                                            }, 2000);
                                          }
                                        }}
                                        style={{
                                          marginTop: '8px',
                                          padding: '6px 12px',
                                          borderRadius: '6px',
                                          border: '1px solid #8b5cf6',
                                          background: 'transparent',
                                          color: '#8b5cf6',
                                          fontSize: '12px',
                                          cursor: 'pointer',
                                          transition: 'all 0.3s ease'
                                        }}
                                      >
                                        📋 Copy All
                                      </button>
                                    </div>
                                  )}
                                  
                                  
                                  {/* Platform Tips Section */}
                                  {moment.platformTips && (
                                    <div className="platform-tips-section" style={{
                                      marginTop: '12px',
                                      padding: '12px',
                                      background: '#1e40af20',
                                      borderRadius: '8px',
                                      border: '1px solid #3b82f6'
                                    }}>
                                      <h5 style={{ 
                                        color: '#60a5fa', 
                                        fontSize: '14px', 
                                        fontWeight: '600', 
                                        marginBottom: '8px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                      }}>
                                        📱 Platform Optimization
                                      </h5>
                                      <p style={{ 
                                        color: '#dbeafe', 
                                        fontSize: '13px', 
                                        lineHeight: '1.4',
                                        margin: 0
                                      }}>
                                        {moment.platformTips}
                                      </p>
                                    </div>
                                  )}
                                  
                                </div>
                              )}
                              
                              {/* Guest Tier Notice or AI Pending */}
                              {!moment.detailedAnalytics && !moment.noAiAnalytics && userTier === 'guest' && (
                                <div className="upgrade-notice" style={{
                                  marginTop: '16px',
                                  padding: '16px',
                                  background: 'linear-gradient(135deg, #7c3aed20 0%, #8b5cf620 100%)',
                                  borderRadius: '12px',
                                  border: '2px solid #8b5cf6'
                                }}>
                                  <div style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: '12px',
                                    marginBottom: '12px'
                                  }}>
                                    <div style={{
                                      background: '#8b5cf6',
                                      borderRadius: '50%',
                                      width: '32px',
                                      height: '32px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: '16px'
                                    }}>
                                      ✨
                                    </div>
                                    <div>
                                      <h5 style={{ 
                                        color: '#c4b5fd', 
                                        fontSize: '16px', 
                                        fontWeight: '600', 
                                        margin: 0 
                                      }}>
                                        Unlock Pro AI Analytics
                                      </h5>
                                      <p style={{ 
                                        color: '#a5b4fc', 
                                        fontSize: '14px', 
                                        margin: 0 
                                      }}>
                                        Get advanced insights to boost your viral potential
                                      </p>
                                    </div>
                                  </div>
                                  <div style={{ display: 'grid', gap: '8px', fontSize: '13px' }}>
                                    <div style={{ color: '#e9d5ff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <span>🎯</span> Advanced viral scoring with 8+ detailed metrics
                                    </div>
                                    <div style={{ color: '#e9d5ff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <span>🔥</span> Trend alignment & competitor analysis insights
                                    </div>
                                    <div style={{ color: '#e9d5ff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <span>📱</span> 8-12 trending hashtags curated by AI
                                    </div>
                                    <div style={{ color: '#e9d5ff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <span>🚀</span> Platform-specific optimization recommendations
                                    </div>
                                  </div>
                                </div>
                              )}
                              {moment.noAiAnalytics && userTier === 'pro' && (
                                <div className="ai-pending-notice">
                                  <p className="ai-pending-text">🤖 AI-powered detailed analytics are being generated... Please wait for the next analysis.</p>
                                </div>
                              )}
                            </div>
                            
                          </div>
                        </div>
                        
                        <div className="segment-actions">
                          {/* Auto-processing status display */}
                          {clipProgress[moment.id] !== undefined ? (
                            <div className="auto-processing-status">
                              <span>🎬 Auto-generating... {clipProgress[moment.id]}%</span>
                            </div>
                          ) : moment.clipGenerated ? (
                            <div className="viral-short-player" style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              width: '100%',
                              gap: '16px'
                            }}>
                              {/* Vertical Short-Style Video Player */}
                              <div style={{
                                position: 'relative',
                                width: '280px',
                                height: '500px',
                                borderRadius: '16px',
                                overflow: 'hidden',
                                backgroundColor: '#000',
                                boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                                border: '2px solid #333'
                              }}>
                                <video
                                  key={`${moment.id}-short`}
                                  controls
                                  autoPlay
                                  loop
                                  muted
                                  playsInline
                                  style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                    display: 'block'
                                  }}
                                  onLoadedData={() => {
                                    console.log(`✅ Short video loaded for moment ${moment.id}`);
                                  }}
                                  onError={(e) => {
                                    console.error(`❌ Video error for moment ${moment.id}:`, e);
                                  }}
                                  onClick={(e) => {
                                    // Toggle play/pause on click like TikTok
                                    const video = e.target;
                                    if (video.paused) {
                                      video.play();
                                    } else {
                                      video.pause();
                                    }
                                  }}
                                >
                                  <source 
                                    src={`http://localhost:3001/api/segment-video/${uploadedFileInfo?.filename}/${moment.startTimeSeconds}/${moment.endTimeSeconds}/${moment.id}?t=${Date.now()}`} 
                                    type="video/mp4" 
                                  />
                                  Your browser does not support the video tag.
                                </video>
                                
                                {/* Overlay for interaction hint */}
                                <div style={{
                                  position: 'absolute',
                                  bottom: '20px',
                                  left: '20px',
                                  right: '20px',
                                  color: 'white',
                                  fontSize: '14px',
                                  textAlign: 'center',
                                  background: 'rgba(0,0,0,0.5)',
                                  padding: '8px 12px',
                                  borderRadius: '20px',
                                  opacity: 0.8
                                }}>
                                  Tap to play/pause • {moment.duration}
                                </div>
                              </div>

                              {/* Download Options Below Video */}
                              {moment.transcript && (
                                <div style={{ 
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '12px',
                                  width: '280px',
                                  alignItems: 'stretch'
                                }}>
                                  {/* Format Selector */}
                                  <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    fontSize: '14px',
                                    color: '#ccc'
                                  }}>
                                    <span>🎬</span>
                                    <span>Choose format:</span>
                                  </div>
                                  
                                  <select
                                    id={`aspect-select-${moment.id}`}
                                    style={{
                                      padding: '12px 16px',
                                      borderRadius: '12px',
                                      border: '2px solid #333',
                                      background: '#1a1a1a',
                                      color: 'white',
                                      fontSize: '14px',
                                      cursor: 'pointer',
                                      outline: 'none',
                                      transition: 'border-color 0.2s ease'
                                    }}
                                    defaultValue="9:16"
                                    onFocus={(e) => e.target.style.borderColor = '#0ea5e9'}
                                    onBlur={(e) => e.target.style.borderColor = '#333'}
                                  >
                                    <option value="9:16">📱 TikTok/Instagram Reels (9:16)</option>
                                    <option value="16:9">📺 YouTube (16:9)</option>
                                    <option value="1:1">⏹️ Instagram Post (1:1)</option>
                                    <option value="4:5">📄 Instagram Stories (4:5)</option>
                                    <option value="21:9">🎬 Cinematic (21:9)</option>
                                  </select>

                                  {/* Download Button */}
                                  <button
                                    onClick={(e) => {
                                      const selectElement = document.getElementById(`aspect-select-${moment.id}`);
                                      const selectedRatio = selectElement.value;
                                      console.log('📥 Downloading with aspect ratio:', selectedRatio);
                                      downloadVideoWithSubtitles(moment, selectedRatio);
                                    }}
                                    style={{
                                      padding: '12px 24px',
                                      borderRadius: '12px',
                                      border: 'none',
                                      background: 'linear-gradient(45deg, #0ea5e9, #3b82f6)',
                                      color: 'white',
                                      fontSize: '14px',
                                      fontWeight: '600',
                                      cursor: 'pointer',
                                      transition: 'all 0.2s ease',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      gap: '8px'
                                    }}
                                    onMouseOver={(e) => {
                                      e.target.style.transform = 'translateY(-2px)';
                                      e.target.style.boxShadow = '0 8px 25px rgba(14, 165, 233, 0.3)';
                                    }}
                                    onMouseOut={(e) => {
                                      e.target.style.transform = 'translateY(0)';
                                      e.target.style.boxShadow = 'none';
                                    }}
                                  >
                                    ⬇️ Download Short
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="auto-processing-status">
                              <span>🚀 Processing automatically...</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Video Library Section */}
        {!processing && (
          <div className="video-library-section">
            <h3 className="library-title">Recent Videos</h3>
            <p className="library-notice">
              📝 Videos are automatically deleted after 5 days to save storage space
            </p>
            
            {videoLibrary.length > 0 ? (
              <>
                <div className="library-videos-grid">
                  {videoLibrary.map((video) => (
                    <div 
                      key={video.id} 
                      className="library-video-card"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('🖱️ Video card clicked, calling loadPreviousVideo');
                        console.log('🖱️ Current location:', window.location.href);
                        loadPreviousVideo(video);
                        // Prevent any navigation
                        return false;
                      }}
                    >
                      <div className="library-video-thumbnail">
                        {video.thumbnail ? (
                          <img src={video.thumbnail} alt={video.originalName} />
                        ) : (
                          <div className="library-video-placeholder">
                            <FileVideo className="w-8 h-8" />
                          </div>
                        )}
                        <div className="library-video-duration">
                          {VideoLibraryService.formatDuration(video.duration)}
                        </div>
                        {video.extractedMoments && video.extractedMoments.length > 0 && (
                          <div className="library-video-badge">
                            {video.extractedMoments.length} segments
                          </div>
                        )}
                      </div>
                      <div className="library-video-info">
                        <h4 className="library-video-title" title={video.originalName}>
                          {video.originalName}
                        </h4>
                        <div className="library-video-meta">
                          <span className="upload-date">
                            {new Date(video.uploadDate).toLocaleDateString()}
                          </span>
                          <span className="file-size">
                            {VideoLibraryService.formatFileSize(video.fileSize)}
                          </span>
                        </div>
                        <div className="library-video-status-row">
                          {video.status === 'analyzed' ? (
                            <div className="library-video-status analyzed">
                              ✨ Analyzed
                            </div>
                          ) : video.status === 'uploaded' ? (
                            <div className="library-video-status uploaded">
                              📤 Uploaded Only
                            </div>
                          ) : null}
                          
                          <button
                            className="library-video-delete"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              
                              // Add jello animation
                              const button = e.currentTarget;
                              button.classList.add('jello');
                              
                              // Remove animation class after animation completes
                              setTimeout(() => {
                                button.classList.remove('jello');
                              }, 600);
                              
                              // Show modal immediately
                              deleteVideoFromLibrary(video);
                            }}
                            title="Delete this video"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="library-subtitle">Click on a video to load its analysis results</p>
              </>
            ) : (
              <div className="library-empty-state">
                <FileVideo className="w-16 h-16 opacity-50" />
                <h4>No History</h4>
                <p>Upload and analyze videos to see them here</p>
              </div>
            )}
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className="delete-modal-overlay" onClick={cancelDeleteVideo}>
            <div className="delete-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="delete-modal-header">
                <h3>🗑️ Delete Video</h3>
              </div>
              
              <div className="delete-modal-body">
                <p>Are you sure you want to delete this video?</p>
                <div className="delete-modal-video-info">
                  <strong>{videoToDelete?.originalName}</strong>
                </div>
                <p className="delete-modal-warning">
                  ⚠️ This action cannot be undone.
                </p>
              </div>
              
              <div className="delete-modal-actions">
                <button 
                  className="delete-modal-cancel"
                  onClick={cancelDeleteVideo}
                >
                  Cancel
                </button>
                <button 
                  className="delete-modal-confirm"
                  onClick={confirmDeleteVideo}
                >
                  🗑️ Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ViralClipGenerator;// Force React reload
