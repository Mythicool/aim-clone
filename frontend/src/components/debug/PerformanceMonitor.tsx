import React, { useState, useEffect, useRef } from 'react';
import { memoryManager } from '../../services/memoryManager';
import { socketService } from '../../services/socket';
import './PerformanceMonitor.css';

interface PerformanceStats {
  fps: number;
  memoryUsage: number;
  connectionLatency: number;
  renderTime: number;
  socketEvents: number;
  activeComponents: number;
  messagesInMemory: number;
  eventListeners: number;
  connectionQuality: 'excellent' | 'good' | 'poor' | 'disconnected';
  cacheSize: number;
}

interface PerformanceMonitorProps {
  isVisible?: boolean;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  compact?: boolean;
}

export const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({
  isVisible = import.meta.env.DEV,
  position = 'top-right',
  compact = false
}) => {
  const [stats, setStats] = useState<PerformanceStats>({
    fps: 0,
    memoryUsage: 0,
    connectionLatency: 0,
    renderTime: 0,
    socketEvents: 0,
    activeComponents: 0,
    messagesInMemory: 0,
    eventListeners: 0,
    connectionQuality: 'disconnected',
    cacheSize: 0
  });
  const [isExpanded, setIsExpanded] = useState(!compact);
  const [alerts, setAlerts] = useState<string[]>([]);

  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const renderStartRef = useRef(0);
  const socketEventCountRef = useRef(0);
  const componentCountRef = useRef(0);

  // FPS calculation
  useEffect(() => {
    let animationId: number;

    const calculateFPS = () => {
      frameCountRef.current++;
      const now = performance.now();
      
      if (now - lastTimeRef.current >= 1000) {
        const fps = Math.round((frameCountRef.current * 1000) / (now - lastTimeRef.current));
        
        setStats(prev => ({ ...prev, fps }));
        
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

  // Memory monitoring with memory manager integration
  useEffect(() => {
    const updateMemoryStats = () => {
      // Browser memory info
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        setStats(prev => ({
          ...prev,
          memoryUsage: Math.round(memory.usedJSHeapSize / 1024 / 1024)
        }));
      }

      // Memory manager stats
      const memoryStats = memoryManager.getMemoryStats();
      setStats(prev => ({
        ...prev,
        messagesInMemory: memoryStats.messagesInMemory,
        eventListeners: memoryStats.activeEventListeners,
        cacheSize: Math.round(memoryStats.memoryUsage / 1024) // Convert to KB
      }));

      // Check for memory alerts
      if (memoryStats.messagesInMemory > 1000) {
        setAlerts(prev => [...prev.filter(a => !a.includes('messages')), 'High message count in memory']);
      }
      if (memoryStats.activeEventListeners > 50) {
        setAlerts(prev => [...prev.filter(a => !a.includes('listeners')), 'High event listener count']);
      }
    };

    const memoryInterval = setInterval(updateMemoryStats, 1000);
    updateMemoryStats(); // Initial call
    return () => clearInterval(memoryInterval);
  }, []);

  // Connection latency monitoring
  useEffect(() => {
    let latencyInterval: NodeJS.Timeout;

    const measureLatency = () => {
      const start = performance.now();
      const socket = socketService.getSocket();
      
      if (socket?.connected) {
        socket.emit('ping', start, (response: number) => {
          const latency = performance.now() - response;
          const quality = getConnectionQuality(latency);
          setStats(prev => ({
            ...prev,
            connectionLatency: Math.round(latency),
            connectionQuality: quality
          }));

          // Connection quality alerts
          if (quality === 'poor') {
            setAlerts(prev => [...prev.filter(a => !a.includes('connection')), 'Poor connection quality']);
          } else if (quality === 'disconnected') {
            setAlerts(prev => [...prev.filter(a => !a.includes('connection')), 'Connection lost']);
          }
        });
      } else {
        setStats(prev => ({ ...prev, connectionQuality: 'disconnected' }));
      }
    };

    if (isVisible) {
      latencyInterval = setInterval(measureLatency, 5000);
    }

    return () => {
      if (latencyInterval) {
        clearInterval(latencyInterval);
      }
    };
  }, [isVisible]);

  // Socket event monitoring
  useEffect(() => {
    const originalEmit = socketService.getSocket()?.emit;
    const originalOn = socketService.getSocket()?.on;

    if (originalEmit && originalOn) {
      // Wrap emit to count outgoing events
      socketService.getSocket()!.emit = function(...args: any[]) {
        socketEventCountRef.current++;
        return originalEmit.apply(this, args);
      };

      // Wrap on to count incoming events
      socketService.getSocket()!.on = function(...args: any[]) {
        socketEventCountRef.current++;
        return originalOn.apply(this, args);
      };
    }

    const eventCountInterval = setInterval(() => {
      setStats(prev => ({ ...prev, socketEvents: socketEventCountRef.current }));
      socketEventCountRef.current = 0;
    }, 1000);

    return () => {
      clearInterval(eventCountInterval);
      
      // Restore original methods
      if (originalEmit && originalOn) {
        const socket = socketService.getSocket();
        if (socket) {
          socket.emit = originalEmit;
          socket.on = originalOn;
        }
      }
    };
  }, []);

  // Render time monitoring
  useEffect(() => {
    renderStartRef.current = performance.now();
  });

  useEffect(() => {
    const renderTime = performance.now() - renderStartRef.current;
    setStats(prev => ({ ...prev, renderTime: Math.round(renderTime * 100) / 100 }));
  });

  // Component count monitoring (simplified)
  useEffect(() => {
    const countComponents = () => {
      const components = document.querySelectorAll('[data-component]').length;
      setStats(prev => ({ ...prev, activeComponents: components }));
    };

    const componentInterval = setInterval(countComponents, 2000);
    return () => clearInterval(componentInterval);
  }, []);

  const getConnectionQuality = (latency: number): PerformanceStats['connectionQuality'] => {
    if (latency < 100) return 'excellent';
    if (latency < 300) return 'good';
    if (latency < 1000) return 'poor';
    return 'disconnected';
  };

  const getStatusColor = (value: number, thresholds: [number, number]) => {
    if (value > thresholds[1]) return '#ff4444';
    if (value > thresholds[0]) return '#ffaa00';
    return '#44aa44';
  };

  const getQualityColor = (quality: PerformanceStats['connectionQuality']) => {
    switch (quality) {
      case 'excellent': return '#44aa44';
      case 'good': return '#88aa44';
      case 'poor': return '#ffaa00';
      case 'disconnected': return '#ff4444';
      default: return '#888888';
    }
  };

  const clearAlerts = () => setAlerts([]);

  if (!isVisible) return null;

  return (
    <div className={`performance-monitor ${position} ${compact ? 'compact' : ''}`}>
      <div className="monitor-header" onClick={() => setIsExpanded(!isExpanded)}>
        <span className="monitor-title">⚡ Performance</span>
        <span className="expand-icon">{isExpanded ? '−' : '+'}</span>
      </div>

      {isExpanded && (
        <div className="monitor-content">
          <div className="stat-row">
            <span className="stat-label">FPS:</span>
            <span 
              className="stat-value"
              style={{ color: getStatusColor(60 - stats.fps, [10, 20]) }}
            >
              {stats.fps}
            </span>
          </div>

          <div className="stat-row">
            <span className="stat-label">Memory:</span>
            <span
              className="stat-value"
              style={{ color: getStatusColor(stats.memoryUsage, [50, 100]) }}
            >
              {stats.memoryUsage}MB
            </span>
          </div>

          <div className="stat-row">
            <span className="stat-label">Connection:</span>
            <span
              className="stat-value"
              style={{ color: getQualityColor(stats.connectionQuality) }}
            >
              {stats.connectionQuality} ({stats.connectionLatency}ms)
            </span>
          </div>

          <div className="stat-row">
            <span className="stat-label">Render:</span>
            <span 
              className="stat-value"
              style={{ color: getStatusColor(stats.renderTime, [5, 16]) }}
            >
              {stats.renderTime}ms
            </span>
          </div>

          <div className="stat-row">
            <span className="stat-label">Events/s:</span>
            <span className="stat-value">{stats.socketEvents}</span>
          </div>

          <div className="stat-row">
            <span className="stat-label">Components:</span>
            <span className="stat-value">{stats.activeComponents}</span>
          </div>

          <div className="stat-row">
            <span className="stat-label">Messages:</span>
            <span
              className="stat-value"
              style={{ color: getStatusColor(stats.messagesInMemory, [500, 1000]) }}
            >
              {stats.messagesInMemory}
            </span>
          </div>

          <div className="stat-row">
            <span className="stat-label">Listeners:</span>
            <span
              className="stat-value"
              style={{ color: getStatusColor(stats.eventListeners, [30, 50]) }}
            >
              {stats.eventListeners}
            </span>
          </div>

          <div className="stat-row">
            <span className="stat-label">Cache:</span>
            <span className="stat-value">{stats.cacheSize}KB</span>
          </div>

          {alerts.length > 0 && (
            <div className="alerts-section">
              <div className="alerts-header">
                <span>⚠️ Alerts</span>
                <button onClick={clearAlerts} className="clear-alerts">×</button>
              </div>
              <div className="alerts-list">
                {alerts.map((alert, index) => (
                  <div key={index} className="alert-item">{alert}</div>
                ))}
              </div>
            </div>
          )}

          <div className="monitor-actions">
            <button
              onClick={() => memoryManager.performCleanup()}
              className="action-button"
              title="Force garbage collection"
            >
              🗑️ GC
            </button>
            <button 
              onClick={() => console.log('Performance stats:', stats)}
              className="action-button"
              title="Log stats to console"
            >
              📊 Log
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
