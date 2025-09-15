import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { VideoLibraryService } from '../services/videoLibraryService';
import { ClerkDatabaseService } from '../services/clerkDatabaseService';
import {
  ArrowLeft,
  Clock,
  Eye,
  Play,
  FileVideo,
  X,
  Pause,
  Volume2,
  Lock,
  Crown
} from 'lucide-react';

const VideoSegmentsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useUser();
  const videoData = location.state?.videoData;
  const [selectedSegment, setSelectedSegment] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSubtitle, setCurrentSubtitle] = useState('');
  const [currentTime, setCurrentTime] = useState(0);
  
  // Get user tier
  const userTier = user ? ClerkDatabaseService.getUserTier(user) : 'guest';
  const isGuestTier = userTier === 'guest';
  
  // Limit segments for guest users
  const maxSegmentsForGuest = 3;
  const allSegments = videoData?.extractedMoments || [];
  const visibleSegments = isGuestTier ? allSegments.slice(0, maxSegmentsForGuest) : allSegments;
  const lockedSegments = isGuestTier ? allSegments.slice(maxSegmentsForGuest) : [];

  // Convert time string (e.g., "2:30") to seconds
  const timeStringToSeconds = (timeString) => {
    if (typeof timeString === 'number') {
      return timeString; // Already in seconds
    }
    if (typeof timeString !== 'string') {
      return 0;
    }
    
    // Handle formats like "2:30", "1:23:45", or just "125" (seconds)
    const parts = timeString.split(':').map(part => parseInt(part, 10));
    
    if (parts.length === 1) {
      return parts[0] || 0; // Just seconds
    } else if (parts.length === 2) {
      return (parts[0] * 60) + (parts[1] || 0); // MM:SS
    } else if (parts.length === 3) {
      return (parts[0] * 3600) + (parts[1] * 60) + (parts[2] || 0); // HH:MM:SS
    }
    
    return 0;
  };

  // Format seconds to time string
  const secondsToTimeString = (seconds) => {
    if (typeof seconds !== 'number') return '0:00';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // Redirect if no video data
  if (!videoData) {
    React.useEffect(() => {
      navigate('/app/viral-clips');
    }, [navigate]);
    return null;
  }

  const previewSegment = (segment) => {
    console.log('🔍 SUBTITLE DEBUG: Preview segment clicked:', segment);
    console.log('🔍 SUBTITLE DEBUG: Video data:', videoData);
    console.log('🔍 SUBTITLE DEBUG: Segment words available:', !!segment.words);
    console.log('🔍 SUBTITLE DEBUG: Segment words length:', segment.words?.length || 0);
    console.log('🔍 SUBTITLE DEBUG: First few words:', segment.words?.slice(0, 5));
    console.log('🔍 SUBTITLE DEBUG: Uploaded file info:', videoData.uploadedFileInfo);
    console.log('🔍 SUBTITLE DEBUG: Video filename:', videoData.uploadedFileInfo?.filename || videoData.filename);
    setSelectedSegment(segment);
    setIsPlaying(false);
  };

  const closePreview = () => {
    setSelectedSegment(null);
    setIsPlaying(false);
    setCurrentSubtitle('');
    setCurrentTime(0);
  };

  const togglePlay = () => {
    const video = document.getElementById('segment-video');
    if (video) {
      if (isPlaying) {
        video.pause();
      } else {
        video.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  // Generate real-time subtitles from word-level timing data
  const generateSubtitle = (currentTime, segmentWords, segmentStartTime) => {
    if (!segmentWords || segmentWords.length === 0) {
      console.log('🔍 SUBTITLE DEBUG: No words available for subtitles');
      return '';
    }

    console.log(`🔍 SUBTITLE DEBUG: videoTime=${currentTime.toFixed(2)}s, segmentStartTime=${segmentStartTime.toFixed(2)}s`);
    
    // Find words that should be displayed at current time
    const activeWords = [];
    const lookAheadTime = 2.0; // Show more words ahead for 5-second clips
    const lookBehindTime = 0.5; // Keep words visible longer
    
    // Convert word timestamps to be relative to the clip start time
    // The words have original video timestamps, we need to subtract segmentStartTime
    console.log(`🔍 SUBTITLE DEBUG: Converting ${segmentWords.length} word timestamps...`);
    
    for (const wordObj of segmentWords) {
      const originalWordStart = wordObj.start || 0;
      const originalWordEnd = wordObj.end || originalWordStart + 0.5;
      
      // Convert from original video time to clip time by subtracting segment start
      const clipWordStart = originalWordStart - segmentStartTime;
      const clipWordEnd = originalWordEnd - segmentStartTime;
      
      console.log(`🔍 SUBTITLE DEBUG: Word "${wordObj.word}": original(${originalWordStart.toFixed(2)}s-${originalWordEnd.toFixed(2)}s) -> clip(${clipWordStart.toFixed(2)}s-${clipWordEnd.toFixed(2)}s)`);
      
      // Include words that are currently being spoken or about to be spoken in the clip timeline
      if (clipWordStart <= currentTime + lookAheadTime && clipWordEnd >= currentTime - lookBehindTime && clipWordStart >= -0.5) {
        activeWords.push({
          word: wordObj.word,
          clipStart: clipWordStart,
          clipEnd: clipWordEnd
        });
        console.log(`🔍 SUBTITLE DEBUG: ✅ Active word: "${wordObj.word}" (clip time: ${clipWordStart.toFixed(2)}s-${clipWordEnd.toFixed(2)}s)`);
      }
    }
    
    if (activeWords.length === 0) {
      console.log('🔍 SUBTITLE DEBUG: No active words found for current time');
      return '';
    }
    
    // Sort by timing and take words that should be showing now
    activeWords.sort((a, b) => a.clipStart - b.clipStart);
    
    // For short clips, show 3-6 words at a time for better readability
    const maxWords = 6;
    const displayWords = activeWords.slice(0, maxWords).map(w => w.word);
    
    const subtitle = displayWords.join(' ').replace(/[^\w\s'-]/g, ''); // Clean punctuation for readability
    console.log(`🔍 SUBTITLE DEBUG: Generated subtitle (${displayWords.length} words): "${subtitle}"`);
    return subtitle;
  };

  const pageStyles = {
    container: {
      minHeight: '100vh',
      backgroundColor: '#0f172a',
      color: '#fff'
    },
    header: {
      backgroundColor: '#1e293b',
      borderBottom: '1px solid #334155',
      padding: '20px 0'
    },
    headerContent: {
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '0 20px',
      display: 'flex',
      alignItems: 'center',
      gap: '16px'
    },
    backButton: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 16px',
      backgroundColor: 'transparent',
      border: '1px solid #475569',
      borderRadius: '8px',
      color: '#e2e8f0',
      cursor: 'pointer',
      fontSize: '14px',
      transition: 'all 0.2s ease'
    },
    title: {
      fontSize: '24px',
      fontWeight: '600',
      margin: 0,
      flex: 1
    },
    subtitle: {
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      fontSize: '14px',
      color: '#94a3b8',
      marginTop: '8px'
    },
    content: {
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '40px 20px'
    },
    stats: {
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      marginBottom: '32px',
      padding: '20px',
      backgroundColor: '#1e293b',
      borderRadius: '12px',
      border: '1px solid #334155'
    },
    segmentsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
      gap: '20px'
    },
    segmentCard: {
      backgroundColor: '#1e293b',
      borderRadius: '12px',
      padding: '24px',
      border: '1px solid #334155',
      transition: 'all 0.2s ease'
    },
    segmentHeader: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: '16px',
      flexWrap: 'wrap',
      gap: '12px'
    },
    categoryBadge: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      padding: '6px 12px',
      borderRadius: '8px',
      fontSize: '12px',
      fontWeight: '600',
      color: 'white'
    },
    segmentTime: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      fontSize: '12px',
      color: '#94a3b8'
    },
    viralScore: {
      backgroundColor: '#065f46',
      color: '#10b981',
      padding: '4px 8px',
      borderRadius: '6px',
      fontWeight: '600',
      fontSize: '12px'
    },
    segmentTitle: {
      color: '#fff',
      fontSize: '18px',
      fontWeight: '600',
      margin: '0 0 12px 0',
      lineHeight: '1.3'
    },
    segmentDescription: {
      color: '#d1d5db',
      fontSize: '14px',
      lineHeight: '1.5',
      margin: '0 0 16px 0'
    },
    transcript: {
      backgroundColor: '#0f172a',
      padding: '16px',
      borderRadius: '8px',
      border: '1px solid #334155',
      marginBottom: '20px'
    },
    transcriptLabel: {
      color: '#e2e8f0',
      fontSize: '13px',
      fontWeight: '500',
      marginBottom: '8px'
    },
    transcriptText: {
      color: '#cbd5e1',
      fontSize: '13px',
      fontStyle: 'italic',
      lineHeight: '1.4',
      margin: 0
    },
    actionButton: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '12px 20px',
      backgroundColor: '#8b5cf6',
      color: 'white',
      border: 'none',
      borderRadius: '8px',
      fontSize: '14px',
      fontWeight: '500',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      width: '100%',
      justifyContent: 'center'
    },
    emptyState: {
      textAlign: 'center',
      padding: '80px 20px',
      color: '#94a3b8'
    },
    emptyIcon: {
      margin: '0 auto 20px auto',
      opacity: 0.5
    },
    emptyTitle: {
      color: '#fff',
      fontSize: '20px',
      margin: '0 0 12px 0'
    },
    emptyDescription: {
      fontSize: '14px',
      margin: 0
    },
    videoPlayerOverlay: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      backdropFilter: 'blur(8px)'
    },
    videoPlayerContainer: {
      position: 'relative',
      width: '90vw',
      maxWidth: '800px',
      backgroundColor: '#1e293b',
      borderRadius: '12px',
      overflow: 'hidden',
      border: '1px solid #334155'
    },
    videoPlayerHeader: {
      padding: '16px 20px',
      borderBottom: '1px solid #334155',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: '#111827'
    },
    videoPlayerTitle: {
      color: '#fff',
      fontSize: '16px',
      fontWeight: '600',
      margin: 0
    },
    closeButton: {
      background: 'none',
      border: 'none',
      color: '#9ca3af',
      cursor: 'pointer',
      padding: '8px',
      borderRadius: '6px',
      transition: 'all 0.2s ease'
    },
    videoWrapper: {
      position: 'relative',
      backgroundColor: '#000'
    },
    video: {
      width: '100%',
      height: 'auto',
      display: 'block'
    },
    videoControls: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      background: 'linear-gradient(transparent, rgba(0, 0, 0, 0.7))',
      padding: '20px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px'
    },
    playButton: {
      background: '#8b5cf6',
      border: 'none',
      borderRadius: '50%',
      width: '40px',
      height: '40px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'white',
      cursor: 'pointer',
      transition: 'all 0.2s ease'
    },
    timeDisplay: {
      color: 'white',
      fontSize: '14px',
      fontFamily: 'monospace'
    },
    lockedSegmentCard: {
      backgroundColor: '#1e293b',
      borderRadius: '12px',
      padding: '24px',
      border: '1px solid #334155',
      opacity: 0.6,
      position: 'relative',
      overflow: 'hidden'
    },
    lockedOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.8)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '12px',
      backdropFilter: 'blur(2px)'
    },
    lockIcon: {
      color: '#fbbf24',
      padding: '12px',
      backgroundColor: 'rgba(251, 191, 36, 0.1)',
      borderRadius: '50%'
    },
    proOnlyText: {
      color: '#fbbf24',
      fontSize: '14px',
      fontWeight: '600',
      textAlign: 'center'
    },
    upgradeButton: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 16px',
      backgroundColor: '#fbbf24',
      color: '#0f172a',
      border: 'none',
      borderRadius: '6px',
      fontSize: '12px',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.2s ease'
    },
    subtitleOverlay: {
      position: 'absolute',
      bottom: '80px', // Above the controls
      left: '50%',
      transform: 'translateX(-50%)',
      padding: '12px 20px',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      borderRadius: '8px',
      border: '2px solid #8b5cf6',
      backdropFilter: 'blur(4px)',
      maxWidth: '80%',
      textAlign: 'center',
      zIndex: 10,
      transition: 'all 0.3s ease'
    },
    subtitleText: {
      color: '#ffffff',
      fontSize: '16px',
      fontWeight: '700',
      textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)',
      letterSpacing: '0.5px',
      lineHeight: '1.4',
      margin: 0,
      textTransform: 'uppercase'
    }
  };

  const getCategoryColor = (category) => {
    switch (category?.toLowerCase()) {
      case 'funny': return '#fbbf24';
      case 'engaging': return '#10b981';
      default: return '#8b5cf6';
    }
  };

  const getCategoryIcon = (category) => {
    switch (category?.toLowerCase()) {
      case 'funny': return '😂';
      case 'engaging': return '🎯';
      default: return '⭐';
    }
  };

  return (
    <div style={pageStyles.container}>
      {/* Header */}
      <div style={pageStyles.header}>
        <div style={pageStyles.headerContent}>
          <button 
            style={pageStyles.backButton}
            onClick={() => navigate('/app/viral-clips')}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = '#334155';
              e.target.style.borderColor = '#64748b';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = 'transparent';
              e.target.style.borderColor = '#475569';
            }}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Viral Clips
          </button>
          
          <div style={{ flex: 1 }}>
            <h1 style={pageStyles.title}>{videoData.originalName}</h1>
            <div style={pageStyles.subtitle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock className="w-4 h-4" />
                <span>{VideoLibraryService.formatDuration(videoData.duration)}</span>
              </div>
              <span>•</span>
              <span>{new Date(videoData.uploadDate).toLocaleDateString()}</span>
              <span>•</span>
              <span>{VideoLibraryService.formatFileSize(videoData.fileSize)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={pageStyles.content}>
        {allSegments.length > 0 ? (
          <>
            {/* Stats */}
            <div style={pageStyles.stats}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981' }}>
                <Eye className="w-5 h-5" />
                <span style={{ fontWeight: '500', fontSize: '16px' }}>
                  {allSegments.length} viral segments found
                  {isGuestTier && lockedSegments.length > 0 && (
                    <span style={{ color: '#94a3b8', fontWeight: '400', fontSize: '14px', marginLeft: '8px' }}>
                      ({visibleSegments.length} visible, {lockedSegments.length} Pro only)
                    </span>
                  )}
                </span>
              </div>
            </div>

            {/* Segments Grid */}
            <div style={pageStyles.segmentsGrid}>
              {/* Visible segments */}
              {visibleSegments.map((moment) => (
                <div 
                  key={moment.id} 
                  style={pageStyles.segmentCard}
                  onMouseEnter={(e) => {
                    e.target.style.borderColor = '#8b5cf6';
                    e.target.style.transform = 'translateY(-4px)';
                    e.target.style.boxShadow = '0 10px 25px rgba(139, 92, 246, 0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.borderColor = '#334155';
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = 'none';
                  }}
                >
                  {/* Header */}
                  <div style={pageStyles.segmentHeader}>
                    <div style={{
                      ...pageStyles.categoryBadge,
                      backgroundColor: getCategoryColor(moment.category)
                    }}>
                      {getCategoryIcon(moment.category)}
                      {moment.category}
                    </div>
                    <div style={pageStyles.segmentTime}>
                      <span>
                        {typeof moment.startTime === 'number' ? secondsToTimeString(moment.startTime) : moment.startTime} - {typeof moment.endTime === 'number' ? secondsToTimeString(moment.endTime) : moment.endTime}
                      </span>
                      <span style={pageStyles.viralScore}>
                        {moment.viralScore}%
                      </span>
                    </div>
                  </div>
                  
                  {/* Content */}
                  <h3 style={pageStyles.segmentTitle}>{moment.title}</h3>
                  <p style={pageStyles.segmentDescription}>{moment.description}</p>
                  
                  {/* Transcript */}
                  {moment.transcript && (
                    <div style={pageStyles.transcript}>
                      <div style={pageStyles.transcriptLabel}>Transcript:</div>
                      <p style={pageStyles.transcriptText}>
                        "{moment.transcript}"
                      </p>
                    </div>
                  )}
                  
                  {/* Action */}
                  <button 
                    style={pageStyles.actionButton}
                    onClick={() => previewSegment(moment)}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = '#7c3aed';
                      e.target.style.transform = 'translateY(-1px)';
                      e.target.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = '#8b5cf6';
                      e.target.style.transform = 'translateY(0)';
                      e.target.style.boxShadow = 'none';
                    }}
                  >
                    <Play className="w-4 h-4" />
                    Preview Segment
                  </button>
                </div>
              ))}
              
              {/* Locked segments (Pro only) */}
              {lockedSegments.map((moment, index) => (
                <div 
                  key={`locked-${moment.id || index}`} 
                  style={pageStyles.lockedSegmentCard}
                >
                  {/* Background content (blurred) */}
                  <div style={{ filter: 'blur(2px)' }}>
                    {/* Header */}
                    <div style={pageStyles.segmentHeader}>
                      <div style={{
                        ...pageStyles.categoryBadge,
                        backgroundColor: getCategoryColor(moment.category)
                      }}>
                        {getCategoryIcon(moment.category)}
                        {moment.category}
                      </div>
                      <div style={pageStyles.segmentTime}>
                        <span>
                          {typeof moment.startTime === 'number' ? secondsToTimeString(moment.startTime) : moment.startTime} - {typeof moment.endTime === 'number' ? secondsToTimeString(moment.endTime) : moment.endTime}
                        </span>
                        <span style={pageStyles.viralScore}>
                          {moment.viralScore}%
                        </span>
                      </div>
                    </div>
                    
                    {/* Content */}
                    <h3 style={pageStyles.segmentTitle}>{moment.title}</h3>
                    <p style={pageStyles.segmentDescription}>{moment.description}</p>
                    
                    {/* Transcript */}
                    {moment.transcript && (
                      <div style={pageStyles.transcript}>
                        <div style={pageStyles.transcriptLabel}>Transcript:</div>
                        <p style={pageStyles.transcriptText}>
                          "{moment.transcript}"
                        </p>
                      </div>
                    )}
                  </div>
                  
                  {/* Lock overlay */}
                  <div style={pageStyles.lockedOverlay}>
                    <div style={pageStyles.lockIcon}>
                      <Lock className="w-6 h-6" />
                    </div>
                    <div style={pageStyles.proOnlyText}>
                      Pro Only
                    </div>
                    <button 
                      style={pageStyles.upgradeButton}
                      onClick={() => navigate('/pricing')}
                      onMouseEnter={(e) => {
                        e.target.style.backgroundColor = '#f59e0b';
                        e.target.style.transform = 'translateY(-1px)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.backgroundColor = '#fbbf24';
                        e.target.style.transform = 'translateY(0)';
                      }}
                    >
                      <Crown className="w-3 h-3" />
                      Upgrade to Pro
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          /* Empty State */
          <div style={pageStyles.emptyState}>
            <FileVideo className="w-16 h-16" style={pageStyles.emptyIcon} />
            <h3 style={pageStyles.emptyTitle}>No segments analyzed</h3>
            <p style={pageStyles.emptyDescription}>
              This video hasn't been processed for viral moments yet.
            </p>
          </div>
        )}
      </div>

      {/* Video Player Overlay */}
      {selectedSegment && (
        <div style={pageStyles.videoPlayerOverlay} onClick={closePreview}>
          <div style={pageStyles.videoPlayerContainer} onClick={(e) => e.stopPropagation()}>
            {/* Player Header */}
            <div style={pageStyles.videoPlayerHeader}>
              <h3 style={pageStyles.videoPlayerTitle}>
                {selectedSegment.title} ({typeof selectedSegment.startTime === 'number' ? secondsToTimeString(selectedSegment.startTime) : selectedSegment.startTime} - {typeof selectedSegment.endTime === 'number' ? secondsToTimeString(selectedSegment.endTime) : selectedSegment.endTime})
              </h3>
              <button 
                style={pageStyles.closeButton}
                onClick={closePreview}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = '#374151';
                  e.target.style.color = '#fff';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = 'transparent';
                  e.target.style.color = '#9ca3af';
                }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Video Player */}
            <div style={pageStyles.videoWrapper}>
              <video
                id="segment-video"
                style={pageStyles.video}
                controls
                preload="metadata"
                src={`http://localhost:5173/server/uploads/${videoData.uploadedFileInfo?.filename || videoData.filename}`}
                onLoadedMetadata={(e) => {
                  console.log('Video loaded:', e.target.src);
                  console.log('Video duration:', e.target.duration);
                  
                  // Get start and end times to calculate duration
                  let startTimeSeconds = selectedSegment.startTimeSeconds;
                  let endTimeSeconds = selectedSegment.endTimeSeconds;
                  
                  if (startTimeSeconds === undefined || startTimeSeconds === null) {
                    startTimeSeconds = timeStringToSeconds(selectedSegment.startTime);
                  }
                  if (endTimeSeconds === undefined || endTimeSeconds === null) {
                    endTimeSeconds = timeStringToSeconds(selectedSegment.endTime);
                  }
                  
                  // Ensure valid numbers within video bounds
                  if (typeof startTimeSeconds !== 'number' || startTimeSeconds < 0) {
                    startTimeSeconds = 0;
                  }
                  if (startTimeSeconds >= e.target.duration) {
                    startTimeSeconds = Math.max(0, e.target.duration - 10);
                  }
                  
                  // Use precise server-calculated timestamps - no client-side extensions
                  console.log('🎯 USING PRECISE TIMESTAMPS: Start:', startTimeSeconds.toFixed(2), 's, End:', endTimeSeconds.toFixed(2), 's, Duration:', (endTimeSeconds - startTimeSeconds).toFixed(2), 's');
                  
                  const exactStartTime = startTimeSeconds;
                  
                  console.log('🎬 ========== VIDEO PLAYER DEBUG ==========');
                  console.log('🎬 Setting start time to:', exactStartTime);
                  console.log('🎬 Selected segment:', {
                    transcript: selectedSegment.transcript?.substring(0, 100),
                    startTime: selectedSegment.startTime,
                    endTime: selectedSegment.endTime,
                    startTimeSeconds: selectedSegment.startTimeSeconds,
                    endTimeSeconds: selectedSegment.endTimeSeconds,
                    timingMethod: selectedSegment.timingMethod,
                    timingConfidence: selectedSegment.timingConfidence
                  });
                  console.log('🎬 Video duration:', e.target.duration);
                  console.log('🎬 Video src:', e.target.src);
                  
                  e.target.currentTime = exactStartTime;
                }}
                onError={(e) => {
                  console.error('Video error:', e);
                  console.error('Video source:', e.target.src);
                }}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
                onTimeUpdate={(e) => {
                  const videoCurrentTime = e.target.currentTime;
                  setCurrentTime(videoCurrentTime);
                  
                  console.log(`🔥 SUBTITLE DEBUG: onTimeUpdate called - time: ${videoCurrentTime.toFixed(2)}s`);
                  console.log(`🔥 SUBTITLE DEBUG: selectedSegment exists: ${!!selectedSegment}`);
                  console.log(`🔥 SUBTITLE DEBUG: selectedSegment.words exists: ${!!selectedSegment?.words}`);
                  console.log(`🔥 SUBTITLE DEBUG: words length: ${selectedSegment?.words?.length || 0}`);
                  
                  // Generate real-time subtitles
                  if (selectedSegment && selectedSegment.words) {
                    const segmentStartTime = selectedSegment.startTimeSeconds || timeStringToSeconds(selectedSegment.startTime);
                    console.log(`🔥 SUBTITLE DEBUG: Calling generateSubtitle with segmentStartTime: ${segmentStartTime.toFixed(2)}s`);
                    const subtitle = generateSubtitle(videoCurrentTime, selectedSegment.words, segmentStartTime);
                    console.log(`🔥 SUBTITLE DEBUG: Generated subtitle: "${subtitle}"`);
                    setCurrentSubtitle(subtitle);
                  } else {
                    console.log(`🔥 SUBTITLE DEBUG: NOT calling generateSubtitle - missing data`);
                    setCurrentSubtitle(''); // Clear subtitle if no data
                  }
                  
                  // Auto-pause when reaching segment end time - test exact timing
                  if (selectedSegment && isPlaying) {
                    let endTimeSeconds = selectedSegment.endTimeSeconds;
                    
                    if (endTimeSeconds === undefined || endTimeSeconds === null) {
                      endTimeSeconds = timeStringToSeconds(selectedSegment.endTime);
                    }
                    
                    // Use precise end time from server - no client-side buffering
                    if (typeof endTimeSeconds === 'number' && e.target.currentTime >= endTimeSeconds) {
                      console.log('🎯 PRECISE AUTO-PAUSE at:', e.target.currentTime.toFixed(2), 's, exact end:', endTimeSeconds.toFixed(2), 's');
                      e.target.pause();
                      setIsPlaying(false);
                    }
                  }
                }}
              />
              
              {/* Real-time Subtitles */}
              {currentSubtitle && (
                <div style={pageStyles.subtitleOverlay}>
                  <p style={pageStyles.subtitleText}>{currentSubtitle}</p>
                </div>
              )}
              
              {/* Video Controls */}
              <div style={pageStyles.videoControls}>
                <button
                  style={pageStyles.playButton}
                  onClick={togglePlay}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = '#7c3aed';
                    e.target.style.transform = 'scale(1.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = '#8b5cf6';
                    e.target.style.transform = 'scale(1)';
                  }}
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
                <div style={pageStyles.timeDisplay}>
                  {typeof selectedSegment.startTime === 'number' ? secondsToTimeString(selectedSegment.startTime) : selectedSegment.startTime} - {typeof selectedSegment.endTime === 'number' ? secondsToTimeString(selectedSegment.endTime) : selectedSegment.endTime}
                </div>
                <div style={{ color: '#10b981', fontSize: '14px', fontWeight: '600' }}>
                  {selectedSegment.viralScore}% viral score
                </div>
                {selectedSegment.timingMethod && (
                  <div style={{ color: '#94a3b8', fontSize: '11px', fontStyle: 'italic' }}>
                    Timing: {selectedSegment.timingMethod} ({((selectedSegment.timingConfidence || 0) * 100).toFixed(0)}% confidence)
                  </div>
                )}
              </div>
            </div>

            {/* Segment Info */}
            <div style={{ padding: '16px 20px', backgroundColor: '#1e293b' }}>
              <p style={{ color: '#d1d5db', fontSize: '14px', margin: '0 0 8px 0' }}>
                {selectedSegment.description}
              </p>
              {selectedSegment.transcript && (
                <div style={{
                  backgroundColor: '#0f172a',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #334155'
                }}>
                  <p style={{ color: '#cbd5e1', fontSize: '13px', fontStyle: 'italic', margin: 0 }}>
                    "{selectedSegment.transcript}"
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoSegmentsPage;