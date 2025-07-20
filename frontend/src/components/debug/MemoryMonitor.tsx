import React, { useState, useEffect, useRef } from 'react';
import { memoryManager, MemoryStats } from '../../services/memoryManager';
import './MemoryMonitor.css';

interface MemoryMonitorProps {
  isVisible?: boolean;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  updateInterval?: number;
}

interface PerformanceMetrics {
  fps: number;
  memoryUsage: number;
  jsHeapSize: number;
  socketEvents: number;
  renderTime: number;
}

export const MemoryMonitor: React.FC<MemoryMonitorProps> = ({
  isVisible = false,
  position = 'top-right',
  updateInterval = 1000
}) => {
  const [memoryStats, setMemoryStats] = useState<MemoryStats | null>(null);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics>({
    fps: 0,
    memoryUsage: 0,
    jsHeapSize: 0,
    socketEvents: 0,
    renderTime: 0
  });
  const [isExpanded, setIsExpanded] = useState(false);
  
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const renderStartRef = useRef(0);

  // FPS calculation
  useEffect(() => {
    let animationId: number;
    
    const calculateFPS = () => {
      frameCountRef.current++;
      const now = performance.now();
      
      if (now - lastTimeRef.current >= 1000) {
        const fps = Math.round((frameCountRef.current * 1000) / (now - lastTimeRef.current));
        setPerformanceMetrics(prev => ({ ...prev, fps }));
        frameCountRef.current = 0;
        lastTimeRef.current = now;
      }
      
      animationId = requestAnimationFrame(calculateFPS);
    };
    
    if (isVisible) {
      animationId = requestAnimationFrame(calculateFPS);
    }
    
    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [isVisible]);

  // Memory and performance monitoring
  useEffect(() => {
    if (!isVisible) return;

    const updateMetrics = () => {
      // Get memory stats from memory manager
      const stats = memoryManager.getMemoryStats();
      setMemoryStats(stats);

      // Get browser memory info if available
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        setPerformanceMetrics(prev => ({
          ...prev,
          memoryUsage: Math.round(memory.usedJSHeapSize / 1024 / 1024),
          jsHeapSize: Math.round(memory.totalJSHeapSize / 1024 / 1024)
        }));
      }

      // Measure render time
      renderStartRef.current = performance.now();
    };

    const interval = setInterval(updateMetrics, updateInterval);
    updateMetrics(); // Initial call

    return () => clearInterval(interval);
  }, [isVisible, updateInterval]);

  // Measure render completion time
  useEffect(() => {
    if (renderStartRef.current > 0) {
      const renderTime = performance.now() - renderStartRef.current;
      setPerformanceMetrics(prev => ({ ...prev, renderTime: Math.round(renderTime * 100) / 100 }));
    }
  });

  const handleCleanup = () => {
    memoryManager.performCleanup();
  };

  const handleClearAll = () => {
    memoryManager.clearAll();
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getMemoryUsageColor = (usage: number): string => {
    if (usage < 20) return '#4CAF50'; // Green
    if (usage < 50) return '#FF9800'; // Orange
    return '#F44336'; // Red
  };

  const getFPSColor = (fps: number): string => {
    if (fps >= 55) return '#4CAF50'; // Green
    if (fps >= 30) return '#FF9800'; // Orange
    return '#F44336'; // Red
  };

  if (!isVisible) return null;

  return (
    <div className={`memory-monitor memory-monitor--${position}`}>
      <div className="memory-monitor__header" onClick={() => setIsExpanded(!isExpanded)}>
        <span className="memory-monitor__title">Performance Monitor</span>
        <span className="memory-monitor__toggle">{isExpanded ? '−' : '+'}</span>
      </div>

      {isExpanded && (
        <div className="memory-monitor__content">
          {/* Performance Metrics */}
          <div className="memory-monitor__section">
            <h4>Performance</h4>
            <div className="memory-monitor__metric">
              <span>FPS:</span>
              <span style={{ color: getFPSColor(performanceMetrics.fps) }}>
                {performanceMetrics.fps}
              </span>
            </div>
            <div className="memory-monitor__metric">
              <span>Render Time:</span>
              <span>{performanceMetrics.renderTime}ms</span>
            </div>
          </div>

          {/* Memory Usage */}
          <div className="memory-monitor__section">
            <h4>Memory Usage</h4>
            <div className="memory-monitor__metric">
              <span>JS Heap:</span>
              <span style={{ color: getMemoryUsageColor(performanceMetrics.memoryUsage) }}>
                {performanceMetrics.memoryUsage}MB / {performanceMetrics.jsHeapSize}MB
              </span>
            </div>
            {memoryStats && (
              <>
                <div className="memory-monitor__metric">
                  <span>Messages:</span>
                  <span>{memoryStats.messagesInMemory}</span>
                </div>
                <div className="memory-monitor__metric">
                  <span>Event Listeners:</span>
                  <span>{memoryStats.activeEventListeners}</span>
                </div>
                <div className="memory-monitor__metric">
                  <span>Cache Size:</span>
                  <span>{formatBytes(memoryStats.memoryUsage)}</span>
                </div>
                <div className="memory-monitor__metric">
                  <span>Last Cleanup:</span>
                  <span>{memoryStats.lastCleanup.toLocaleTimeString()}</span>
                </div>
              </>
            )}
          </div>

          {/* Actions */}
          <div className="memory-monitor__section">
            <h4>Actions</h4>
            <div className="memory-monitor__actions">
              <button 
                className="memory-monitor__button memory-monitor__button--warning"
                onClick={handleCleanup}
              >
                Cleanup
              </button>
              <button 
                className="memory-monitor__button memory-monitor__button--danger"
                onClick={handleClearAll}
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MemoryMonitor;
