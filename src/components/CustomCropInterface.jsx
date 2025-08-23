import React, { useState, useRef, useCallback } from 'react';
import { Move, RotateCcw, Check, X } from 'lucide-react';

const CustomCropInterface = ({ videoUrl, aspectRatio, onCropChange, onClose, onApply }) => {
  const [cropArea, setCropArea] = useState({ x: 0, y: 0, width: 100, height: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);
  const videoRef = useRef(null);

  const aspectRatios = {
    '9:16': { width: 9, height: 16 },
    '16:9': { width: 16, height: 9 },
    '1:1': { width: 1, height: 1 },
    '4:5': { width: 4, height: 5 },
    '21:9': { width: 21, height: 9 }
  };

  const targetAspectRatio = aspectRatios[aspectRatio];

  const handleMouseDown = useCallback((e, type) => {
    e.preventDefault();
    setDragStart({ x: e.clientX, y: e.clientY });
    
    if (type === 'move') {
      setIsDragging(true);
    } else if (type === 'resize') {
      setIsResizing(true);
    }
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging && !isResizing) return;
    
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    if (isDragging) {
      setCropArea(prev => ({
        ...prev,
        x: Math.max(0, Math.min(100 - prev.width, x - prev.width / 2)),
        y: Math.max(0, Math.min(100 - prev.height, y - prev.height / 2))
      }));
    } else if (isResizing) {
      const centerX = cropArea.x + cropArea.width / 2;
      const centerY = cropArea.y + cropArea.height / 2;
      
      const newWidth = Math.abs(x - centerX) * 2;
      const newHeight = (newWidth * targetAspectRatio.height) / targetAspectRatio.width;
      
      setCropArea({
        x: Math.max(0, Math.min(100 - newWidth, centerX - newWidth / 2)),
        y: Math.max(0, Math.min(100 - newHeight, centerY - newHeight / 2)),
        width: Math.min(newWidth, 100),
        height: Math.min(newHeight, 100)
      });
    }
  }, [isDragging, isResizing, cropArea, targetAspectRatio]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(false);
  }, []);

  React.useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, handleMouseMove, handleMouseUp]);

  const resetCrop = () => {
    const containerAspectRatio = 16 / 9; // Assuming video container is 16:9
    const targetRatio = targetAspectRatio.width / targetAspectRatio.height;
    
    if (targetRatio > containerAspectRatio) {
      // Fit to width
      const width = 80;
      const height = (width * targetAspectRatio.height) / targetAspectRatio.width;
      setCropArea({
        x: 10,
        y: (100 - height) / 2,
        width,
        height
      });
    } else {
      // Fit to height
      const height = 60;
      const width = (height * targetAspectRatio.width) / targetAspectRatio.height;
      setCropArea({
        x: (100 - width) / 2,
        y: 20,
        width,
        height
      });
    }
  };

  const handleApply = () => {
    onCropChange({
      x: cropArea.x / 100,
      y: cropArea.y / 100,
      width: cropArea.width / 100,
      height: cropArea.height / 100
    });
    onApply();
  };

  React.useEffect(() => {
    resetCrop();
  }, [aspectRatio]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg p-6 max-w-4xl w-full max-h-full overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-white">
            Custom Crop Position - {aspectRatio} ({aspectRatios[aspectRatio].name})
          </h3>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Video Preview with Crop Overlay */}
          <div 
            ref={containerRef}
            className="relative bg-black rounded-lg overflow-hidden"
            style={{ paddingBottom: '56.25%' }} // 16:9 aspect ratio
          >
            <video
              ref={videoRef}
              src={videoUrl}
              className="absolute inset-0 w-full h-full object-cover"
              muted
              loop
              autoPlay
            />
            
            {/* Crop Overlay */}
            <div className="absolute inset-0 bg-black bg-opacity-50">
              <div
                className="absolute border-2 border-purple-500 bg-transparent cursor-move"
                style={{
                  left: `${cropArea.x}%`,
                  top: `${cropArea.y}%`,
                  width: `${cropArea.width}%`,
                  height: `${cropArea.height}%`,
                }}
                onMouseDown={(e) => handleMouseDown(e, 'move')}
              >
                {/* Clear area inside crop */}
                <div className="absolute inset-0 bg-transparent" />
                
                {/* Move handle */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-purple-500 rounded-full p-2 cursor-move">
                    <Move className="w-4 h-4 text-white" />
                  </div>
                </div>
                
                {/* Resize handles */}
                <div 
                  className="absolute -top-2 -right-2 w-4 h-4 bg-purple-500 rounded-full cursor-se-resize"
                  onMouseDown={(e) => handleMouseDown(e, 'resize')}
                />
                <div 
                  className="absolute -bottom-2 -right-2 w-4 h-4 bg-purple-500 rounded-full cursor-se-resize"
                  onMouseDown={(e) => handleMouseDown(e, 'resize')}
                />
                <div 
                  className="absolute -top-2 -left-2 w-4 h-4 bg-purple-500 rounded-full cursor-se-resize"
                  onMouseDown={(e) => handleMouseDown(e, 'resize')}
                />
                <div 
                  className="absolute -bottom-2 -left-2 w-4 h-4 bg-purple-500 rounded-full cursor-se-resize"
                  onMouseDown={(e) => handleMouseDown(e, 'resize')}
                />
              </div>
            </div>

            {/* Grid overlay */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="w-full h-full grid grid-cols-3 grid-rows-3 opacity-30">
                {[...Array(9)].map((_, i) => (
                  <div key={i} className="border border-white border-opacity-20" />
                ))}
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={resetCrop}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </button>
              
              <div className="text-sm text-gray-300">
                <div>Target: {aspectRatio} ({targetAspectRatio.width}:{targetAspectRatio.height})</div>
                <div>Position: {Math.round(cropArea.x)}%, {Math.round(cropArea.y)}%</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleApply}
                className="flex items-center gap-2 px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
              >
                <Check className="w-4 h-4" />
                Apply Crop
              </button>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-gray-700 rounded-lg p-4">
            <h4 className="font-medium text-white mb-2">Instructions:</h4>
            <ul className="text-sm text-gray-300 space-y-1">
              <li>• Drag the purple area to move the crop position</li>
              <li>• Drag the corner handles to resize the crop area</li>
              <li>• The aspect ratio will be maintained automatically</li>
              <li>• Use the grid lines to align your content perfectly</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomCropInterface;