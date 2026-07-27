import { Avatar, AvatarFallback } from '@/components/atoms/avatar';
import { Button } from '@/components/atoms/button';
import React, { useState } from 'react';
import { Link, Shield, Settings, MoreVertical, type LucideIcon } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/atoms/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/atoms/popover';
import { useSession } from '@/hooks/ui/use-session';
import { useAuth } from '@/hooks/api/use-auth';
import { useProjectStore } from '@/stores/project-store';
import { buildCollaborateUrl } from '@/lib/collaboration-url';

/** Hover-only hint; not in tab order so opening the share popover does not flash a tooltip. */
function PanelIconHint({ label, icon: Icon }: { label: string; icon: LucideIcon }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={-1}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
          aria-label={label}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

function CollaborationIconRow() {
  return (
    <div className="flex items-center gap-1">
      <PanelIconHint label="Security settings" icon={Shield} />
      <PanelIconHint label="Collaboration settings" icon={Settings} />
    </div>
  );
}

// Utility to get initials from a name
const getInitials = (name: string) => {
  if (!name) return '';
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase();
};

interface SessionParticipant {
  userId: string;
  userName: string;
  role?: string;
}

// Roster row. Role controls only render for the Host viewing another (non-Host)
// participant, and call the real collaboration API (`useSession().updateParticipantRole`
// → `POST /sessions/{id}/participants/{userId}/role`) — not the local-only Yjs awareness
// state the very first version of this panel used.
const CollaboratorItem = ({
  user,
  currentUser = false,
  canManageRole = false,
  onRoleChange,
}: {
  user: SessionParticipant;
  currentUser?: boolean;
  canManageRole?: boolean;
  onRoleChange?: (userId: string, role: 'Editor' | 'Viewer') => void;
}) => {
  const showRoleMenu = canManageRole && !currentUser && user.role !== 'Host';

  return (
    <div className="flex items-center justify-between py-2 px-1 rounded-md hover:bg-secondary/50">
      <div className="flex items-center gap-2">
        <Avatar className="h-8 w-8 bg-primary/10">
          <AvatarFallback className="text-xs">{getInitials(user.userName)}</AvatarFallback>
        </Avatar>
        <div>
          <div className="flex items-center gap-1">
            <span className="text-sm font-medium">{user.userName}</span>
            {currentUser && <span className="text-xs text-muted-foreground">You</span>}
          </div>
          {user.role && <span className="text-xs text-muted-foreground">{user.role}</span>}
        </div>
      </div>

      {showRoleMenu && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <MoreVertical size={14} />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="p-1 w-36">
            <div className="flex flex-col">
              <Button
                variant="ghost"
                className="justify-start text-xs h-8"
                disabled={user.role === 'Editor'}
                onClick={() => onRoleChange?.(user.userId, 'Editor')}
              >
                Make Editor
              </Button>
              <Button
                variant="ghost"
                className="justify-start text-xs h-8"
                disabled={user.role === 'Viewer'}
                onClick={() => onRoleChange?.(user.userId, 'Viewer')}
              >
                Make Viewer
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
//
// Transport: this panel talks to the production JSON hub via `useSession`
// (REST create/join/leave + `RealtimeStack` WebSocket — see `lib/tensr-api-url.ts`).
// It intentionally does NOT use the Yjs-based `hooks/use-collaboration`: that hook
// speaks `y-websocket` binary protocol, which only has a server behind local uvicorn
// (`app/yjs_ws.py`) and no Fargate/production counterpart. Pointing it at
// `RealtimeStack` would connect but never handshake, so it is not wired here.
const CollaborationPanel = ({ projectId: _projectId, activeTab }: CollaborationPanelProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    currentSession,
    createSession,
    leaveSession,
    updateParticipantRole,
    saveBackSession,
    discardSession,
  } = useSession();
  const { user, isAuthenticated } = useAuth();
  const { selectedPath, fileSystem } = useProjectStore();

  const isSessionActive = !!currentSession;
  const collaborators: SessionParticipant[] = currentSession?.participants ?? [];
  const isHost = !!user && !!currentSession && currentSession.ownerId === user.userId;

  const handleRoleChange = async (userId: string, role: 'Editor' | 'Viewer') => {
    try {
      setError(null);
      await updateParticipantRole(userId, role);
    } catch (err) {
      console.error('Error updating participant role:', err);
      setError(err instanceof Error ? err.message : 'Failed to update participant role');
    }
  };

  // A session always forks a dataset — there is no filePath-only collaboration (see
  // `app/routers/sessions.py::CreateSessionBody`). `activeTab.data.datasetId` (or the
  // selected file's `fileId`, which is a dataset id for dataset-backed files) is the
  // only accepted target.
  const resolveDatasetId = (): { datasetId: string; fileName: string } | null => {
    if (activeTab?.data?.datasetId) {
      return { datasetId: activeTab.data.datasetId, fileName: activeTab.name };
    }
    const currentFile = fileSystem.find(file => file.path === selectedPath);
    if (currentFile?.fileId) {
      return { datasetId: currentFile.fileId, fileName: currentFile.name };
    }
    return null;
  };

  const canStartSession = resolveDatasetId() !== null;

  const handleStartSession = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const target = resolveDatasetId();
      if (!target) {
        throw new Error('Select a dataset-backed file to start a collaboration session.');
      }

      // `createSession` both creates the session over REST and opens the RealtimeStack
      // WebSocket, sending the hub `join` message so presence/participants populate
      // immediately (see `app/realtime/hub.py::_handle_join`).
      await createSession(target);
    } catch (err) {
      console.error('Error starting session:', err);
      setError(err instanceof Error ? err.message : 'Failed to start session');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveBack = async () => {
    try {
      setIsLoading(true);
      setError(null);
      await saveBackSession();
    } catch (err) {
      console.error('Error saving back session:', err);
      setError(err instanceof Error ? err.message : 'Failed to save back to source dataset');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDiscardSession = async () => {
    try {
      setIsLoading(true);
      setError(null);
      await discardSession();
    } catch (err) {
      console.error('Error discarding session:', err);
      setError(err instanceof Error ? err.message : 'Failed to discard collaboration session');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEndSession = async () => {
    try {
      setIsLoading(true);
      setError(null);
      await leaveSession();
    } catch (err) {
      console.error('Error ending session:', err);
      setError(err instanceof Error ? err.message : 'Failed to end session');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (!currentSession) return;

    const collaborationLink = `${window.location.origin}${buildCollaborateUrl({ sessionId: currentSession.id })}`;
    try {
      await navigator.clipboard.writeText(collaborationLink);
    } catch {
      setError('Could not copy link to clipboard');
    }
  };

  return (
    <TooltipProvider delayDuration={400}>
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
            <CollaborationIconRow />

            <Button
              size="sm"
              className="w-full"
              onClick={handleStartSession}
              disabled={isLoading || !canStartSession}
            >
              {isLoading ? 'Starting...' : 'Start Session'}
            </Button>

            <p className="text-xs text-muted-foreground">
              {!canStartSession
                ? 'Select a dataset-backed file to start a collaboration session'
                : 'Start a collaboration session, share link and work together on this file with your teammates.'}
            </p>
          </div>
        ) : (
          // In session view
          <div className="flex flex-col gap-4">
            <CollaborationIconRow />

            <Button
              size="sm"
              variant="outline"
              className="w-full flex items-center gap-2"
              onClick={handleCopyLink}
            >
              <Link size={14} />
              Copy Link
            </Button>

            {isHost && (
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={handleSaveBack}
                disabled={isLoading}
              >
                {isLoading ? 'Saving...' : 'Save Back to Dataset'}
              </Button>
            )}

            <Button
              size="sm"
              variant="outline"
              className="w-full text-destructive hover:text-destructive"
              onClick={isHost ? handleDiscardSession : handleEndSession}
              disabled={isLoading}
            >
              {isLoading ? 'Ending...' : isHost ? 'Discard Session' : 'Leave Session'}
            </Button>

            {isHost && (
              <p className="text-xs text-muted-foreground">
                Save Back overwrites the source dataset with this session&apos;s changes. Discard
                ends the session for everyone without saving.
              </p>
            )}

            {collaborators.length > 0 && (
              <div className="mt-2">
                <div className="text-sm text-muted-foreground mb-2">
                  In Session: {collaborators.length}
                </div>
                <div className="flex flex-col">
                  {collaborators.map(participant => (
                    <CollaboratorItem
                      key={participant.userId}
                      user={participant}
                      currentUser={participant.userId === user?.userId}
                      canManageRole={isHost}
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
    </TooltipProvider>
  );
};

export default CollaborationPanel;
