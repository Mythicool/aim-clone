import React, { useState, useEffect } from 'react';
import { PerformanceMonitor } from './PerformanceMonitor';
import { MemoryMonitor } from './MemoryMonitor';
import { ConnectionStatus } from '../connection/ConnectionStatus';
import { memoryManager } from '../../services/memoryManager';
import { socketService } from '../../services/socket';
import './PerformanceDashboard.css';

interface PerformanceDashboardProps {
  isVisible?: boolean;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  enabledTools?: ('performance' | 'memory' | 'connection')[];
}

interface SystemHealth {
  overall: 'excellent' | 'good' | 'warning' | 'critical';
  score: number;
  issues: string[];
  recommendations: string[];
}

export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({
  isVisible = import.meta.env.DEV,
  position = 'top-right',
  enabledTools = ['performance', 'memory', 'connection']
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [systemHealth, setSystemHealth] = useState<SystemHealth>({
    overall: 'good',
    score: 85,
    issues: [],
    recommendations: []
  });
  const [autoOptimize, setAutoOptimize] = useState(false);

  // System health monitoring
  useEffect(() => {
    const assessSystemHealth = () => {
      const memoryStats = memoryManager.getMemoryStats();
      const socket = socketService.getSocket();
      
      let score = 100;
      const issues: string[] = [];
      const recommendations: string[] = [];

      // Memory assessment
      if (memoryStats.messagesInMemory > 1000) {
        score -= 20;
        issues.push('High message count in memory');
        recommendations.push('Enable automatic message cleanup');
      }

      if (memoryStats.activeEventListeners > 50) {
        score -= 15;
        issues.push('High event listener count');
        recommendations.push('Review component cleanup');
      }

      // Connection assessment
      if (!socket?.connected) {
        score -= 30;
        issues.push('No server connection');
        recommendations.push('Check network connectivity');
      }

      // Browser memory assessment
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        const usagePercent = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
        
        if (usagePercent > 80) {
          score -= 25;
          issues.push('High browser memory usage');
          recommendations.push('Clear browser cache or restart');
        }
      }

      // Determine overall health
      let overall: SystemHealth['overall'] = 'excellent';
      if (score < 90) overall = 'good';
      if (score < 70) overall = 'warning';
      if (score < 50) overall = 'critical';

      setSystemHealth({
        overall,
        score: Math.max(0, score),
        issues,
        recommendations
      });
    };

    const interval = setInterval(assessSystemHealth, 5000);
    assessSystemHealth(); // Initial assessment

    return () => clearInterval(interval);
  }, []);

  // Auto-optimization
  useEffect(() => {
    if (!autoOptimize) return;

    const performAutoOptimization = () => {
      const memoryStats = memoryManager.getMemoryStats();
      
      // Auto cleanup if memory usage is high
      if (memoryStats.messagesInMemory > 800) {
        memoryManager.performCleanup();
        console.log('Auto-optimization: Memory cleanup performed');
      }

      // Force garbage collection if available and memory is critical
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        const usagePercent = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
        
        if (usagePercent > 85 && (window as any).gc) {
          (window as any).gc();
          console.log('Auto-optimization: Garbage collection triggered');
        }
      }
    };

    const interval = setInterval(performAutoOptimization, 30000); // Every 30 seconds
    return () => clearInterval(interval);
  }, [autoOptimize]);

  const getHealthColor = () => {
    switch (systemHealth.overall) {
      case 'excellent': return '#4CAF50';
      case 'good': return '#8BC34A';
      case 'warning': return '#FF9800';
      case 'critical': return '#F44336';
      default: return '#9E9E9E';
    }
  };

  const getHealthIcon = () => {
    switch (systemHealth.overall) {
      case 'excellent': return '🟢';
      case 'good': return '🟡';
      case 'warning': return '🟠';
      case 'critical': return '🔴';
      default: return '⚪';
    }
  };

  const handleOptimizeNow = () => {
    memoryManager.performCleanup();
    
    if ((window as any).gc) {
      (window as any).gc();
    }

    // Reconnect if disconnected
    const socket = socketService.getSocket();
    if (!socket?.connected) {
      socketService.forceReconnect();
    }
  };

  const handleExportMetrics = () => {
    const metrics = {
      timestamp: new Date().toISOString(),
      systemHealth,
      memoryStats: memoryManager.getMemoryStats(),
      performance: {
        memory: 'memory' in performance ? (performance as any).memory : null,
        timing: performance.timing,
        navigation: performance.navigation
      }
    };

    const blob = new Blob([JSON.stringify(metrics, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aim-performance-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isVisible) return null;

  return (
    <div className={`performance-dashboard performance-dashboard--${position}`}>
      <div 
        className="dashboard-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="dashboard-status">
          <span className="status-icon">{getHealthIcon()}</span>
          <span className="status-text" style={{ color: getHealthColor() }}>
            System Health: {systemHealth.overall} ({systemHealth.score}%)
          </span>
        </div>
        <span className="expand-icon">{isExpanded ? '−' : '+'}</span>
      </div>

      {isExpanded && (
        <div className="dashboard-content">
          {/* System Health Overview */}
          <div className="health-overview">
            <div className="health-score">
              <div 
                className="score-circle"
                style={{ 
                  background: `conic-gradient(${getHealthColor()} ${systemHealth.score * 3.6}deg, #e0e0e0 0deg)`
                }}
              >
                <span className="score-text">{systemHealth.score}</span>
              </div>
            </div>
            
            <div className="health-details">
              {systemHealth.issues.length > 0 && (
                <div className="health-issues">
                  <h4>Issues:</h4>
                  {systemHealth.issues.map((issue, index) => (
                    <div key={index} className="issue-item">⚠️ {issue}</div>
                  ))}
                </div>
              )}
              
              {systemHealth.recommendations.length > 0 && (
                <div className="health-recommendations">
                  <h4>Recommendations:</h4>
                  {systemHealth.recommendations.map((rec, index) => (
                    <div key={index} className="recommendation-item">💡 {rec}</div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Monitoring Tools */}
          <div className="monitoring-tools">
            {enabledTools.includes('performance') && (
              <div className="tool-section">
                <PerformanceMonitor isVisible={true} compact={true} />
              </div>
            )}

            {enabledTools.includes('memory') && (
              <div className="tool-section">
                <MemoryMonitor isVisible={true} position="top-left" />
              </div>
            )}
          </div>

          {/* Dashboard Actions */}
          <div className="dashboard-actions">
            <div className="action-row">
              <label className="auto-optimize-toggle">
                <input
                  type="checkbox"
                  checked={autoOptimize}
                  onChange={(e) => setAutoOptimize(e.target.checked)}
                />
                Auto-optimize
              </label>
            </div>
            
            <div className="action-buttons">
              <button 
                className="dashboard-button dashboard-button--primary"
                onClick={handleOptimizeNow}
              >
                Optimize Now
              </button>
              
              <button 
                className="dashboard-button dashboard-button--secondary"
                onClick={handleExportMetrics}
              >
                Export Metrics
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PerformanceDashboard;
