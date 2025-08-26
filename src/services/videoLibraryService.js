/**
 * Video Library Service - manages user's video library and history
 */
export class VideoLibraryService {
  
  /**
   * Save a video to user's library
   */
  static saveVideoToLibrary(userId, videoData) {
    try {
      const libraryKey = `video_library_${userId}`;
      const existingVideos = JSON.parse(localStorage.getItem(libraryKey) || '[]');
      
      const newVideo = {
        id: videoData.id || `video_${Date.now()}`,
        filename: videoData.filename,
        originalName: videoData.originalName || videoData.filename,
        uploadDate: new Date().toISOString(),
        fileSize: videoData.fileSize,
        duration: videoData.duration,
        status: 'uploaded',
        clips: [], // Store generated clips for this video
        analysis: videoData.analysis || null,
        thumbnail: videoData.thumbnail || null,
        extractedMoments: videoData.extractedMoments || [],
        uploadedFileInfo: videoData.uploadedFileInfo || null,
        ...videoData
      };
      
      // Check if video already exists
      const existingIndex = existingVideos.findIndex(v => v.filename === newVideo.filename);
      if (existingIndex >= 0) {
        // Update existing video
        existingVideos[existingIndex] = { ...existingVideos[existingIndex], ...newVideo };
      } else {
        // Add new video
        existingVideos.unshift(newVideo); // Add to beginning
      }
      
      localStorage.setItem(libraryKey, JSON.stringify(existingVideos));
      
      console.log('✅ Video saved to library:', newVideo);
      return newVideo;
    } catch (error) {
      console.error('❌ Error saving video to library:', error);
      return null;
    }
  }

  /**
   * Get all videos from user's library
   */
  static getUserVideoLibrary(userId) {
    try {
      const libraryKey = `video_library_${userId}`;
      const videos = JSON.parse(localStorage.getItem(libraryKey) || '[]');
      
      // Sort by upload date (newest first)
      return videos.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
    } catch (error) {
      console.error('❌ Error getting user video library:', error);
      return [];
    }
  }

  /**
   * Get a specific video from user's library
   */
  static getVideoFromLibrary(userId, videoId) {
    try {
      const videos = this.getUserVideoLibrary(userId);
      return videos.find(v => v.id === videoId || v.filename === videoId);
    } catch (error) {
      console.error('❌ Error getting video from library:', error);
      return null;
    }
  }

  /**
   * Update video data in library
   */
  static updateVideoInLibrary(userId, videoId, updateData) {
    try {
      const libraryKey = `video_library_${userId}`;
      const videos = JSON.parse(localStorage.getItem(libraryKey) || '[]');
      
      console.log('🔍 Looking for video to update:', {
        videoId,
        libraryKey,
        totalVideos: videos.length,
        videoIds: videos.map(v => ({ id: v.id, filename: v.filename }))
      });
      
      const videoIndex = videos.findIndex(v => v.id === videoId || v.filename === videoId);
      console.log('📍 Video found at index:', videoIndex);
      
      if (videoIndex >= 0) {
        const oldVideo = { ...videos[videoIndex] };
        videos[videoIndex] = { ...videos[videoIndex], ...updateData };
        localStorage.setItem(libraryKey, JSON.stringify(videos));
        
        console.log('✅ Video updated in library:');
        console.log('  Before:', { status: oldVideo.status, extractedMoments: oldVideo.extractedMoments?.length || 0 });
        console.log('  After:', { status: videos[videoIndex].status, extractedMoments: videos[videoIndex].extractedMoments?.length || 0 });
        
        return videos[videoIndex];
      } else {
        console.log('❌ Video not found in library for update');
      }
      
      return null;
    } catch (error) {
      console.error('❌ Error updating video in library:', error);
      return null;
    }
  }

  /**
   * Add a clip to a video in the library
   */
  static addClipToVideo(userId, videoId, clipData) {
    try {
      const video = this.getVideoFromLibrary(userId, videoId);
      if (!video) return null;
      
      const newClip = {
        id: clipData.id || `clip_${Date.now()}`,
        startTime: clipData.startTime,
        endTime: clipData.endTime,
        duration: clipData.duration,
        title: clipData.title || `Clip ${clipData.startTime}s - ${clipData.endTime}s`,
        createdDate: new Date().toISOString(),
        downloadUrl: clipData.downloadUrl,
        hasWatermark: clipData.hasWatermark || false,
        aspectRatio: clipData.aspectRatio,
        ...clipData
      };
      
      const updatedVideo = {
        ...video,
        clips: [...(video.clips || []), newClip]
      };
      
      return this.updateVideoInLibrary(userId, videoId, updatedVideo);
    } catch (error) {
      console.error('❌ Error adding clip to video:', error);
      return null;
    }
  }

  /**
   * Delete a video from library
   */
  static deleteVideoFromLibrary(userId, videoId) {
    try {
      const libraryKey = `video_library_${userId}`;
      const videos = JSON.parse(localStorage.getItem(libraryKey) || '[]');
      
      const filteredVideos = videos.filter(v => v.id !== videoId && v.filename !== videoId);
      localStorage.setItem(libraryKey, JSON.stringify(filteredVideos));
      
      console.log('✅ Video deleted from library:', videoId);
      return true;
    } catch (error) {
      console.error('❌ Error deleting video from library:', error);
      return false;
    }
  }

  /**
   * Get library statistics for user
   */
  static getLibraryStats(userId) {
    try {
      const videos = this.getUserVideoLibrary(userId);
      const totalClips = videos.reduce((count, video) => count + (video.clips?.length || 0), 0);
      
      return {
        totalVideos: videos.length,
        totalClips,
        totalStorage: videos.reduce((size, video) => size + (video.fileSize || 0), 0),
        recentActivity: videos.slice(0, 3) // Last 3 videos
      };
    } catch (error) {
      console.error('❌ Error getting library stats:', error);
      return {
        totalVideos: 0,
        totalClips: 0,
        totalStorage: 0,
        recentActivity: []
      };
    }
  }

  /**
   * Format file size for display
   */
  static formatFileSize(bytes) {
    if (!bytes) return 'Unknown size';
    
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Save complete analysis results for a video
   */
  static saveVideoAnalysis(userId, videoId, analysisData) {
    try {
      const updateData = {
        extractedMoments: analysisData.extractedMoments || [],
        analysis: analysisData.analysis || null,
        uploadedFileInfo: analysisData.uploadedFileInfo || null,
        thumbnail: analysisData.thumbnail || null,
        status: 'analyzed',
        analyzedAt: new Date().toISOString()
      };
      
      console.log('📝 VideoLibraryService.saveVideoAnalysis called with:', {
        userId,
        videoId,
        extractedMomentsCount: updateData.extractedMoments.length,
        status: updateData.status
      });
      
      const result = this.updateVideoInLibrary(userId, videoId, updateData);
      console.log('📝 saveVideoAnalysis result:', result ? 'SUCCESS' : 'FAILED');
      return result;
    } catch (error) {
      console.error('❌ Error saving video analysis:', error);
      return null;
    }
  }

  /**
   * Format duration for display
   */
  static formatDuration(seconds) {
    if (!seconds) return 'Unknown';
    
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}