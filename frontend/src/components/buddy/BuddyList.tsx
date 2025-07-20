import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Buddy } from '../../types';
import { UserStatus } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useUserPreferences } from '../../contexts/UserPreferencesContext';
import { socketService } from '../../services/socket';
import { AddBuddyDialog } from './AddBuddyDialog';
import { RemoveBuddyDialog } from './RemoveBuddyDialog';
import { BuddyProfileDialog } from './BuddyProfileDialog';
import { BuddyListSkeleton, TransitionWrapper } from '../ui/SkeletonLoader';
import './BuddyList.css';
import aimLogo from '../../assets/aim-logo-small.png';

interface BuddyGroup {
  name: string;
  buddies: Buddy[];
  isExpanded: boolean;
}

interface BuddyListProps {
  onBuddyDoubleClick?: (buddy: Buddy) => void;
  onBuddyRightClick?: (buddy: Buddy, event: React.MouseEvent) => void;
}

export const BuddyList: React.FC<BuddyListProps> = ({
  onBuddyDoubleClick,
  onBuddyRightClick
}) => {
  const { user, token } = useAuth();
  const { preferences } = useUserPreferences();
  const [groups, setGroups] = useState<BuddyGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const windowRef = useRef<HTMLDivElement>(null);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [selectedBuddy, setSelectedBuddy] = useState<Buddy | null>(null);
  const [showAddBuddyDialog, setShowAddBuddyDialog] = useState(false);
  const [showRemoveBuddyDialog, setShowRemoveBuddyDialog] = useState(false);
  const [showBuddyProfileDialog, setShowBuddyProfileDialog] = useState(false);

  // Organize buddies into groups
  const organizeBuddiesIntoGroups = useCallback((buddyList: Buddy[]) => {
    const groupMap = new Map<string, Buddy[]>();
    
    buddyList.forEach(buddy => {
      const groupName = buddy.relationship.groupName || 'Buddies';
      if (!groupMap.has(groupName)) {
        groupMap.set(groupName, []);
      }
      groupMap.get(groupName)!.push(buddy);
    });

    // Sort buddies within each group by status (online first) then by screen name
    const sortedGroups: BuddyGroup[] = Array.from(groupMap.entries()).map(([name, buddies]) => ({
      name,
      buddies: buddies.sort((a, b) => {
        // Online buddies first
        if (a.status === UserStatus.ONLINE && b.status !== UserStatus.ONLINE) return -1;
        if (b.status === UserStatus.ONLINE && a.status !== UserStatus.ONLINE) return 1;
        
        // Then by screen name
        return a.screenName.localeCompare(b.screenName);
      }),
      isExpanded: true // Default to expanded
    }));

    // Sort groups alphabetically, but keep "Buddies" first
    sortedGroups.sort((a, b) => {
      if (a.name === 'Buddies') return -1;
      if (b.name === 'Buddies') return 1;
      return a.name.localeCompare(b.name);
    });

    setGroups(sortedGroups);
  }, []);

  // Fetch buddy list from API
  const fetchBuddyList = useCallback(async () => {
    if (!token) return;

    try {
      setIsLoading(true);
      const response = await fetch('/api/buddies', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch buddy list');
      }

      const buddyList: Buddy[] = await response.json();
      organizeBuddiesIntoGroups(buddyList);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load buddy list');
    } finally {
      setIsLoading(false);
    }
  }, [token, organizeBuddiesIntoGroups]);

  // Handle buddy status updates from WebSocket
  const handleBuddyStatusUpdate = useCallback((data: { userId: string; status: UserStatus; lastSeen?: Date }) => {
    setGroups(prevGroups => {
      const updatedGroups = prevGroups.map(group => ({
        ...group,
        buddies: group.buddies.map(buddy => 
          buddy.id === data.userId 
            ? { ...buddy, status: data.status, lastSeen: data.lastSeen || buddy.lastSeen }
            : buddy
        )
      }));
      
      // Re-sort buddies within groups after status update
      return updatedGroups.map(group => ({
        ...group,
        buddies: group.buddies.sort((a, b) => {
          // Online buddies first
          if (a.status === 'online' && b.status !== 'online') return -1;
          if (b.status === 'online' && a.status !== 'online') return 1;
          
          // Then by screen name
          return a.screenName.localeCompare(b.screenName);
        })
      }));
    });
  }, []);

  // Handle buddy online/offline events
  const handleBuddyOnline = useCallback((data: { userId: string }) => {
    handleBuddyStatusUpdate({ userId: data.userId, status: UserStatus.ONLINE });
    
    // Trigger buddy online sound event
    const buddyOnlineEvent = new CustomEvent('buddyOnline', { detail: { userId: data.userId } });
    window.dispatchEvent(buddyOnlineEvent);
  }, [handleBuddyStatusUpdate]);

  const handleBuddyOffline = useCallback((data: { userId: string; lastSeen: Date }) => {
    handleBuddyStatusUpdate({ userId: data.userId, status: UserStatus.OFFLINE, lastSeen: data.lastSeen });
    
    // Trigger buddy offline sound event
    const buddyOfflineEvent = new CustomEvent('buddyOffline', { detail: { userId: data.userId } });
    window.dispatchEvent(buddyOfflineEvent);
  }, [handleBuddyStatusUpdate]);

  // Handle new buddy added
  const handleBuddyAdded = useCallback((buddy: Buddy) => {
    const groupName = buddy.relationship.groupName || 'Buddies';
    
    setGroups(prevGroups => {
      const existingGroupIndex = prevGroups.findIndex(group => group.name === groupName);
      
      if (existingGroupIndex >= 0) {
        // Add to existing group
        const updatedGroups = [...prevGroups];
        updatedGroups[existingGroupIndex] = {
          ...updatedGroups[existingGroupIndex],
          buddies: [...updatedGroups[existingGroupIndex].buddies, buddy].sort((a, b) => {
            // Online buddies first
            if (a.status === 'online' && b.status !== 'online') return -1;
            if (b.status === 'online' && a.status !== 'online') return 1;
            
            // Then by screen name
            return a.screenName.localeCompare(b.screenName);
          })
        };
        return updatedGroups;
      } else {
        // Create new group
        const newGroup: BuddyGroup = {
          name: groupName,
          buddies: [buddy],
          isExpanded: true
        };
        
        const updatedGroups = [...prevGroups, newGroup];
        
        // Sort groups alphabetically, but keep "Buddies" first
        return updatedGroups.sort((a, b) => {
          if (a.name === 'Buddies') return -1;
          if (b.name === 'Buddies') return 1;
          return a.name.localeCompare(b.name);
        });
      }
    });
  }, []);

  // Setup WebSocket listeners
  useEffect(() => {
    if (!token || !user) return;

    const socket = socketService.connect(token);

    // Listen for buddy status events
    socket.on('buddy:online', handleBuddyOnline);
    socket.on('buddy:offline', handleBuddyOffline);
    socket.on('buddy:status-change', handleBuddyStatusUpdate);
    socket.on('buddy:added', handleBuddyAdded);

    return () => {
      socket.off('buddy:online', handleBuddyOnline);
      socket.off('buddy:offline', handleBuddyOffline);
      socket.off('buddy:status-change', handleBuddyStatusUpdate);
      socket.off('buddy:added', handleBuddyAdded);
    };
  }, [token, user, handleBuddyOnline, handleBuddyOffline, handleBuddyStatusUpdate, handleBuddyAdded]);

  // Initial load
  useEffect(() => {
    fetchBuddyList();
  }, [fetchBuddyList]);

  // Toggle group expansion
  const toggleGroup = (groupName: string) => {
    setGroups(prevGroups => 
      prevGroups.map(group => 
        group.name === groupName 
          ? { ...group, isExpanded: !group.isExpanded }
          : group
      )
    );
  };

  // Get status icon for buddy
  const getStatusIcon = (status: UserStatus) => {
    switch (status) {
      case UserStatus.ONLINE:
        return '●'; // Green dot
      case UserStatus.AWAY:
        return '◐'; // Half-filled circle
      case UserStatus.INVISIBLE:
        return '○'; // Empty circle
      case UserStatus.OFFLINE:
      default:
        return '○'; // Empty circle
    }
  };

  // Get status color
  const getStatusColor = (status: UserStatus) => {
    switch (status) {
      case UserStatus.ONLINE:
        return '#00ff00';
      case UserStatus.AWAY:
        return '#ffff00';
      case UserStatus.INVISIBLE:
        return '#808080';
      case UserStatus.OFFLINE:
      default:
        return '#808080';
    }
  };

  // Handle buddy double click
  const handleBuddyDoubleClick = (buddy: Buddy) => {
    if (onBuddyDoubleClick) {
      onBuddyDoubleClick(buddy);
    }
  };

  // Handle buddy right click
  const handleBuddyRightClick = (buddy: Buddy, event: React.MouseEvent) => {
    event.preventDefault();
    setSelectedBuddy(buddy);
    setContextMenuPosition({ x: event.clientX, y: event.clientY });
    setShowContextMenu(true);

    if (onBuddyRightClick) {
      onBuddyRightClick(buddy, event);
    }
  };

  const handleContextMenuAction = (action: string) => {
    if (!selectedBuddy) return;

    switch (action) {
      case 'sendMessage':
        if (onBuddyDoubleClick) {
          onBuddyDoubleClick(selectedBuddy);
        }
        break;
      case 'getInfo':
        setShowBuddyProfileDialog(true);
        break;
      case 'deleteBuddy':
        setShowRemoveBuddyDialog(true);
        break;
    }

    setShowContextMenu(false);
  };

  const handleMyProfileClick = () => {
    // Dispatch custom event to open profile window
    window.dispatchEvent(new CustomEvent('openProfile'));
  };

  const handlePreferencesClick = () => {
    // Dispatch custom event to open preferences window
    window.dispatchEvent(new CustomEvent('openPreferences'));
  };

  const handleAddBuddyClick = () => {
    setShowAddBuddyDialog(true);
  };

  const handleBuddyAddedFromDialog = (screenName: string) => {
    // Refresh buddy list
    // loadBuddyList();
  };

  const handleBuddyRemoved = (buddy: Buddy) => {
    // Remove buddy from local state
    // setBuddies(prev => prev.filter(b => b.id !== buddy.id));
    setSelectedBuddy(null);
  };

  const handleCloseDialogs = () => {
    setShowAddBuddyDialog(false);
    setShowRemoveBuddyDialog(false);
    setShowBuddyProfileDialog(false);
    setSelectedBuddy(null);
  };
  
  // Handle window dragging
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target instanceof HTMLElement && 
        (e.target.classList.contains('aim-window-header') || 
         e.target.closest('.aim-window-header'))) {
      setIsDragging(true);
      const rect = windowRef.current?.getBoundingClientRect();
      if (rect) {
        setDragOffset({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        });
      }
    }
  };
  
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      });
    }
  }, [isDragging, dragOffset]);
  
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);
  
  // Set up mouse event listeners for dragging
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);
  
  // Close context menu when clicking elsewhere
  useEffect(() => {
    const handleClickOutside = () => {
      setShowContextMenu(false);
    };
    
    if (showContextMenu) {
      document.addEventListener('click', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showContextMenu]);

  const renderWindow = (content: React.ReactNode) => (
    <div 
      className="aim-window buddy-list-window"
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
      ref={windowRef}
      onMouseDown={handleMouseDown}
    >
      <div className="aim-window-header">
        <div className="aim-window-title">
          <img src={aimLogo} alt="AIM" className="buddy-list-icon" width="16" height="16" />
          <span>Buddy List</span>
        </div>
        <div className="aim-window-controls">
          <div className="aim-window-control" title="Minimize">_</div>
          <div className="aim-window-control" title="Maximize">□</div>
          <div className="aim-window-control" title="Close">×</div>
        </div>
      </div>

      {/* Menu Bar */}
      <div className="buddy-list-menu">
        <button className="menu-button" onClick={handleMyProfileClick}>
          My Profile
        </button>
        <button className="menu-button" onClick={handleAddBuddyClick}>
          Add Buddy
        </button>
        <button className="menu-button" onClick={handlePreferencesClick}>
          Preferences
        </button>
      </div>
      <div className="aim-window-content buddy-list-content">
        {content}
      </div>
      
      {/* Context Menu */}
      {showContextMenu && selectedBuddy && (
        <div 
          className="buddy-context-menu"
          style={{ 
            left: `${contextMenuPosition.x}px`, 
            top: `${contextMenuPosition.y}px` 
          }}
        >
          <div
            className="buddy-context-menu-item"
            onClick={() => handleContextMenuAction('sendMessage')}
          >
            Send Instant Message
          </div>
          <div
            className="buddy-context-menu-item"
            onClick={() => handleContextMenuAction('getInfo')}
          >
            Get Info
          </div>
          <div className="buddy-context-menu-separator"></div>
          <div className="buddy-context-menu-item">Move To...</div>
          <div
            className="buddy-context-menu-item"
            onClick={() => handleContextMenuAction('deleteBuddy')}
          >
            Delete Buddy
          </div>
        </div>
      )}
    </div>
  );

  if (isLoading) {
    return renderWindow(
      <TransitionWrapper isVisible={isLoading} type="fade">
        <BuddyListSkeleton count={8} />
      </TransitionWrapper>
    );
  }

  if (error) {
    return renderWindow(
      <div className="buddy-list-error">
        Error: {error}
        <button className="aim-button" onClick={fetchBuddyList}>
          Retry
        </button>
      </div>
    );
  }

  const mainContent = (
    <>
      {user && (
        <div className="buddy-list-user-info">
          <div className="user-screen-name">{user.screenName}</div>
          <div className="user-status">
            <span 
              className="status-icon" 
              style={{ color: getStatusColor(user.status) }}
            >
              {getStatusIcon(user.status)}
            </span>
            <span className="status-text">{user.status}</span>
          </div>
        </div>
      )}
      
      <div className="buddy-list-toolbar">
        <button className="buddy-list-tool-button" title="Add Buddy">
          <span role="img" aria-label="Add">➕</span>
        </button>
        <button className="buddy-list-tool-button" title="Create Group">
          <span role="img" aria-label="Group">📁</span>
        </button>
        <button 
          className="buddy-list-tool-button" 
          title="Preferences"
          onClick={() => {
            const openPreferencesEvent = new CustomEvent('openPreferences');
            window.dispatchEvent(openPreferencesEvent);
          }}
        >
          <span role="img" aria-label="Settings">⚙️</span>
        </button>
      </div>
      
      <div className="buddy-groups">
        {groups.map(group => (
          <div key={group.name} className="buddy-group">
            <div 
              className="buddy-group-header"
              onClick={() => toggleGroup(group.name)}
            >
              <span className="group-expand-icon">
                {group.isExpanded ? '▼' : '▶'}
              </span>
              <span className="group-name">{group.name}</span>
              <span className="group-count">
                ({group.buddies.filter(b => b.status === UserStatus.ONLINE).length}/{group.buddies.length})
              </span>
            </div>
            
            {group.isExpanded && (
              <div className="buddy-group-content">
                {group.buddies.map(buddy => (
                  <div
                    key={buddy.id}
                    className={`buddy-item ${buddy.status === UserStatus.ONLINE ? 'online' : 'offline'}`}
                    onDoubleClick={() => handleBuddyDoubleClick(buddy)}
                    onContextMenu={(e) => handleBuddyRightClick(buddy, e)}
                  >
                    <span
                      className={`aim-status-icon ${buddy.status.toLowerCase()}`}
                      title={buddy.status}
                    >
                    </span>
                    <span className="buddy-screen-name">{buddy.screenName}</span>
                    {buddy.profile.awayMessage && buddy.status === UserStatus.AWAY && (
                      <span className="buddy-away-indicator" title={buddy.profile.awayMessage}>
                        💤
                      </span>
                    )}
                    {buddy.status === UserStatus.INVISIBLE && (
                      <span className="buddy-invisible-indicator" title="Invisible">
                        👁️
                      </span>
                    )}
                  </div>
                ))}
                
                {group.buddies.length === 0 && (
                  <div className="buddy-group-empty">No buddies in this group</div>
                )}
              </div>
            )}
          </div>
        ))}
        
        {groups.length === 0 && (
          <div className="buddy-list-empty">
            <p>No buddies yet!</p>
            <p>Add some friends to get started.</p>
            <button
              className="aim-button aim-button-primary"
              onClick={handleAddBuddyClick}
            >
              Add Buddy
            </button>
          </div>
        )}
      </div>

      {/* Dialogs */}
      {showAddBuddyDialog && (
        <AddBuddyDialog
          onClose={handleCloseDialogs}
          onBuddyAdded={handleBuddyAddedFromDialog}
        />
      )}

      {showRemoveBuddyDialog && selectedBuddy && (
        <RemoveBuddyDialog
          buddy={selectedBuddy}
          onClose={handleCloseDialogs}
          onBuddyRemoved={handleBuddyRemoved}
        />
      )}

      {showBuddyProfileDialog && selectedBuddy && (
        <BuddyProfileDialog
          buddy={selectedBuddy}
          onClose={handleCloseDialogs}
          onSendMessage={onBuddyDoubleClick}
        />
      )}
    </>
  );

  return renderWindow(mainContent);
};