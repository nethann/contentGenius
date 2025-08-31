import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { VideoLibraryService } from '../services/videoLibraryService';
import {
  ArrowLeft,
  Clock,
  Eye,
  Play,
  FileVideo,
  X,
  Pause,
  Volume2
} from 'lucide-react';

const VideoSegmentsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useUser();
  const videoData = location.state?.videoData;
  const [selectedSegment, setSelectedSegment] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

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
    console.log('Preview segment clicked:', segment);
    console.log('Video data:', videoData);
    console.log('Uploaded file info:', videoData.uploadedFileInfo);
    console.log('Video filename:', videoData.uploadedFileInfo?.filename || videoData.filename);
    setSelectedSegment(segment);
    setIsPlaying(false);
  };

  const closePreview = () => {
    setSelectedSegment(null);
    setIsPlaying(false);
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
        {videoData.extractedMoments && videoData.extractedMoments.length > 0 ? (
          <>
            {/* Stats */}
            <div style={pageStyles.stats}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981' }}>
                <Eye className="w-5 h-5" />
                <span style={{ fontWeight: '500', fontSize: '16px' }}>
                  {videoData.extractedMoments.length} viral segments found
                </span>
              </div>
            </div>

            {/* Segments Grid */}
            <div style={pageStyles.segmentsGrid}>
              {videoData.extractedMoments.map((moment) => (
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
                  
                  // IMMEDIATE FIX: Extend end time if segment is too short
                  const originalDuration = endTimeSeconds - startTimeSeconds;
                  if (originalDuration < 8) {
                    console.log('🔧 FIXING SHORT SEGMENT: Original duration', originalDuration.toFixed(1), 's, extending to minimum 8s');
                    endTimeSeconds = Math.min(e.target.duration, startTimeSeconds + 8);
                    // Update the segment object for the auto-pause logic
                    selectedSegment.endTimeSeconds = endTimeSeconds;
                    selectedSegment.endTime = endTimeSeconds;
                  }
                  
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
                  // Auto-pause when reaching segment end time - test exact timing
                  if (selectedSegment && isPlaying) {
                    let endTimeSeconds = selectedSegment.endTimeSeconds;
                    
                    if (endTimeSeconds === undefined || endTimeSeconds === null) {
                      endTimeSeconds = timeStringToSeconds(selectedSegment.endTime);
                    }
                    
                    // Use end time with buffer based on segment confidence
                    const timingConfidence = selectedSegment.timingConfidence || 0.5;
                    const bufferSeconds = timingConfidence > 0.8 ? 0.5 : 1.5; // Less buffer for high confidence
                    const bufferedEndTime = Math.max(0, endTimeSeconds - bufferSeconds);
                    
                    if (typeof endTimeSeconds === 'number' && e.target.currentTime >= bufferedEndTime) {
                      console.log('🎬 AUTO-PAUSING at current:', e.target.currentTime.toFixed(2), 's, target end:', endTimeSeconds.toFixed(2), 's (buffered:', bufferedEndTime.toFixed(2), 's)');
                      console.log('🎬 Difference from original end:', (e.target.currentTime - endTimeSeconds).toFixed(2), 's');
                      e.target.pause();
                      setIsPlaying(false);
                    }
                    
                    // Log every few seconds for debugging
                    if (Math.floor(e.target.currentTime * 10) % 10 === 0) {
                      console.log('🎬 Playing at:', e.target.currentTime.toFixed(2), 's, will stop at:', bufferedEndTime.toFixed(2), 's');
                    }
                  }
                }}
              />
              
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