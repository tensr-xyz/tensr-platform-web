import { Avatar, AvatarFallback, AvatarImage } from '@/components/atoms/avatar';
import { Button } from '@/components/atoms/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/atoms/popover';
import React, { useState, useEffect } from 'react';
import { Link, Shield, Settings } from 'lucide-react';
import { MoreVertical } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/atoms/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/atoms/select';
import { useCollaboration, UserPresence } from '@/hooks/use-collaboration';
import { useAuth } from '@/hooks/api/use-auth';
import { useProjectStore } from '@/stores/project-store';
import { getIdToken } from '@/utils/auth';
import { apiClient } from '@/lib/api-client';

// API Base URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

// Utility to get initials from a name
const getInitials = (name: string) => {
  if (!name) return '';
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase();
};

// Simulate different user roles
const ROLES = {
  HOST: 'Host',
  EDITOR: 'Editor',
  VIEWER: 'Viewer',
};

// User component with role
const CollaboratorItem = ({
  user,
  currentUser = false,
  onRoleChange,
}: {
  user: UserPresence;
  currentUser?: boolean;
  onRoleChange?: (userId: string, role: string) => void;
}) => {
  const [role, setRole] = useState(user.role || ROLES.VIEWER);

  const handleRoleChange = (newRole: string) => {
    setRole(newRole);
    if (onRoleChange) {
      onRoleChange(user.userId, newRole);
    }
  };

  return (
    <div className="flex items-center justify-between py-2 px-1 hover:bg-secondary/50 rounded-md">
      <div className="flex items-center gap-2">
        <Avatar className="h-8 w-8 bg-primary/10">
          <AvatarImage src={user.avatar} />
          <AvatarFallback className="text-xs">{getInitials(user.userName)}</AvatarFallback>
        </Avatar>
        <div>
          <div className="flex items-center gap-1">
            <span className="text-sm font-medium">{user.userName}</span>
            {currentUser && <span className="text-xs text-muted-foreground">You</span>}
          </div>
          <span className="text-xs text-muted-foreground">{role}</span>
        </div>
      </div>

      {!currentUser && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <MoreVertical size={14} />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="p-1 w-32">
            <div className="flex flex-col">
              <Button
                variant="ghost"
                className="justify-start text-xs h-8"
                onClick={() => handleRoleChange(ROLES.EDITOR)}
              >
                Make Editor
              </Button>
              <Button
                variant="ghost"
                className="justify-start text-xs h-8"
                onClick={() => handleRoleChange(ROLES.VIEWER)}
              >
                Make Viewer
              </Button>
              <Button variant="ghost" className="justify-start text-xs h-8 text-destructive">
                Remove
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
};

interface CollaborationPanelProps {
  projectId: string;
  activeTab?: any; // Add activeTab prop for file context
}

// Main Collaboration Component
const CollaborationPanel = ({ projectId, activeTab }: CollaborationPanelProps) => {
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [accessLevel, setAccessLevel] = useState('read-only');
  const collaborationState = useCollaboration(projectId);
  const [collaborators, setCollaborators] = useState<UserPresence[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user, isAuthenticated } = useAuth();
  const { selectedPath, fileSystem } = useProjectStore();

  // Effect to manage collaboration and awareness - FIXED VERSION
  useEffect(() => {
    if (collaborationState && collaborationState.awareness) {
      const { awareness } = collaborationState;

      // Get current user ID from awareness if not already set
      const states = awareness.getStates();
      const localState = states.get(awareness.clientID);
      if (localState && !currentUserId) {
        setCurrentUserId(localState.userId);
      } else if (user?.userId && !localState?.userId) {
        // Set the user data in awareness if we have auth user but not in awareness
        awareness.setLocalState({
          ...(localState || {}),
          userId: user.userId,
          userName: user.email || 'Anonymous',
        });
      }

      // Update collaborators when awareness changes
      const updateCollaborators = () => {
        const users: UserPresence[] = [];
        awareness.getStates().forEach((state: any) => {
          if (state.userId) {
            users.push({
              userId: state.userId,
              userName: state.userName,
              cursor: state.cursor,
              lastActive: state.lastActive,
              role: state.role || ROLES.VIEWER,
              avatar: state.avatar || '',
            });
          }
        });
        setCollaborators(users);
      };

      awareness.on('change', updateCollaborators);
      updateCollaborators();

      return () => {
        awareness.off('change', updateCollaborators);
      };
    }
  }, [collaborationState, currentUserId, user]);

  const handleStartSession = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Get the ID token for authentication
      const idToken = getIdToken();

      if (!idToken) {
        throw new Error('You must be logged in to start a session');
      }

      // Get current file information from either project context or active tab
      let filePath: string;
      let fileName: string;

      if (activeTab && activeTab.data && activeTab.data.filePath) {
        // File workspace context - get info from active tab
        // Ensure file path starts with / for API compatibility
        filePath = activeTab.data.filePath.startsWith('/')
          ? activeTab.data.filePath
          : `/${activeTab.data.filePath}`;
        fileName = activeTab.name;
      } else {
        // Project workspace context - get info from project context
        const currentFile = fileSystem.find(file => file.path === selectedPath);
        if (!currentFile) {
          throw new Error('No file is currently selected. Please select a file to collaborate on.');
        }
        // Ensure file path starts with / for API compatibility
        filePath = currentFile.path.startsWith('/') ? currentFile.path : `/${currentFile.path}`;
        fileName = currentFile.name;
      }

      // Create a new session by calling the API with the correct data
      const sessionData = await apiClient.collaboration.createSession({
        filePath,
        fileName,
        userName: user?.email || 'Anonymous',
      });

      setSessionId(sessionData.id);

      if (collaborationState) {
        // Connect to WebSocket with the new session ID and get the awareness object
        const awareness = collaborationState.connect(
          sessionData.id,
          user?.userId || currentUserId || '',
          user?.email || 'Anonymous'
        );

        // Update local state to "Host" for the creator
        if (awareness) {
          const localState = awareness.getLocalState();
          if (localState) {
            awareness.setLocalState({
              ...localState,
              role: ROLES.HOST,
            });
          }
        }

        // Auto-join the session you just created
        await joinSession(sessionData.id);

        setIsSessionActive(true);
      }
    } catch (err) {
      console.error('Error starting session:', err);
      setError(err instanceof Error ? err.message : 'Failed to start session');
    } finally {
      setIsLoading(false);
    }
  };

  const joinSession = async (id: string) => {
    try {
      // Get the ID token for authentication
      const idToken = getIdToken();

      if (!idToken) {
        throw new Error('You must be logged in to join a session');
      }

      const response = await fetch(`${API_BASE_URL}/sessions/${id}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          userId: user?.userId || currentUserId,
          userName: user?.email || 'Anonymous',
        }),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to join session: ${response.status}`);
      }

      return await response.json();
    } catch (err) {
      console.error('Error joining session:', err);
      throw err;
    }
  };

  const handleEndSession = async () => {
    if (!sessionId) return;

    try {
      setIsLoading(true);

      // Get the ID token for authentication
      const idToken = getIdToken();

      if (!idToken) {
        throw new Error('You must be logged in to end a session');
      }

      // First leave the session
      await fetch(`${API_BASE_URL}/sessions/${sessionId}/leave`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          userId: user?.userId || currentUserId,
        }),
        credentials: 'include',
      });

      if (collaborationState) {
        // Disconnect the WebSocket
        collaborationState.disconnect();
      }

      setIsSessionActive(false);
      setSessionId(null);
    } catch (err) {
      console.error('Error ending session:', err);
      setError(err instanceof Error ? err.message : 'Failed to end session');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (!sessionId) return;

    // In a real implementation, this would copy a collaboration link
    const collaborationLink = `${window.location.origin}/collaborate/${projectId}?session=${sessionId}`;
    navigator.clipboard.writeText(collaborationLink);
  };

  const handleRoleChange = (userId: string, role: string) => {
    if (collaborationState && collaborationState.doc) {
      // In a real implementation, you'd broadcast this change to all users
      // For now, we just update our local state
      const updatedCollaborators = collaborators.map(user =>
        user.userId === userId ? { ...user, role } : user
      );
      setCollaborators(updatedCollaborators);

      // You could also update the shared document to persist roles
      const { doc } = collaborationState;
      const roles = doc.getMap('roles');
      roles.set(userId, role);
    }
  };

  const handleAccessLevelChange = (value: string) => {
    setAccessLevel(value);

    if (collaborationState && collaborationState.doc) {
      // Update the document with the new access level
      const { doc } = collaborationState;
      doc.getMap('settings').set('accessLevel', value);
    }
  };

  return (
    <div className="w-full">
      {error && <div className="text-sm text-destructive mb-2">{error}</div>}

      {!isAuthenticated && (
        <div className="p-4 bg-amber-50 text-amber-800 rounded-md mb-4">
          You need to be logged in to start or join a collaboration session.
        </div>
      )}

      {!isSessionActive ? (
        // Not in session view
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              {/* Fixed TooltipTrigger to avoid nested button issue */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <div className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-secondary/80">
                      <Shield className="h-4 w-4" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Security Settings</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <div className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-secondary/80">
                      <Settings className="h-4 w-4" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Collaboration Settings</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          <div className="flex gap-2">
            <Select value={accessLevel} onValueChange={handleAccessLevelChange}>
              <SelectTrigger className="h-8">
                <SelectValue placeholder="Read Only" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="read-only">Read Only</SelectItem>
                <SelectItem value="edit">Edit</SelectItem>
                <SelectItem value="full-access">Full Access</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              className="w-full"
              onClick={handleStartSession}
              disabled={
                isLoading ||
                (!activeTab?.data?.filePath &&
                  (!selectedPath || !fileSystem.find(file => file.path === selectedPath)))
              }
            >
              {isLoading ? 'Starting...' : 'Start Session'}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            {!activeTab?.data?.filePath &&
            (!selectedPath || !fileSystem.find(file => file.path === selectedPath))
              ? 'Select a file to start a collaboration session'
              : 'Start a collaboration session, share link and work together on this file with your teammates.'}
          </p>
        </div>
      ) : (
        // In session view
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              {/* Fixed TooltipTrigger to avoid nested button issue */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <div className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-secondary/80">
                      <Shield className="h-4 w-4" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Security Settings</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <div className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-secondary/80">
                      <Settings className="h-4 w-4" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Collaboration Settings</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          <div className="flex gap-2">
            <Select value={accessLevel} onValueChange={handleAccessLevelChange}>
              <SelectTrigger className="h-8">
                <SelectValue placeholder="Read Only" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="read-only">Read Only</SelectItem>
                <SelectItem value="edit">Edit</SelectItem>
                <SelectItem value="full-access">Full Access</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              className="w-full flex items-center gap-2"
              onClick={handleCopyLink}
            >
              <Link size={14} />
              Copy Link
            </Button>
          </div>

          <Button
            size="sm"
            variant="outline"
            className="w-full text-destructive hover:text-destructive"
            onClick={handleEndSession}
            disabled={isLoading}
          >
            {isLoading ? 'Ending...' : 'End Session'}
          </Button>

          {collaborators.length > 0 && (
            <div className="mt-2">
              <div className="text-sm text-muted-foreground mb-2">
                In Session: {collaborators.length}
              </div>
              <div className="flex flex-col">
                {collaborators.map(user => (
                  <CollaboratorItem
                    key={user.userId}
                    user={user}
                    currentUser={user.userId === currentUserId}
                    onRoleChange={handleRoleChange}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="text-xs text-green-500 flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-green-500"></span>
            Connected to session
          </div>
        </div>
      )}
    </div>
  );
};

export default CollaborationPanel;
