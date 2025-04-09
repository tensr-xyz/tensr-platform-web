import React from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/molecules/dropdown';
import { Button } from '@/components/atoms/button';
import { LuUsers } from 'react-icons/lu';
import { Avatar, AvatarFallback } from '@/components/atoms/avatar';
import { useSession } from '@/hooks/ui/use-session';
import { Badge } from '@/components/atoms/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from '@/components/molecules/dialog';
import { Tab } from '@/contexts/tabs-context/types';

interface CollaborationMenuProps {
  activeTab?: Tab;
}

export function CollaborationMenu({ activeTab }: CollaborationMenuProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [dropdownOpen, setDropdownOpen] = React.useState(false);
  const { sessions, currentSession, createSession, joinSession, leaveSession } = useSession();

  if (!activeTab) return null;

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            <LuUsers className="h-4 w-4" />
            {currentSession && (
              <Badge
                variant="secondary"
                className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center"
              >
                {currentSession.participantCount}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {currentSession ? (
            <>
              <div className="p-2">
                <div className="text-sm font-medium">Current Session</div>
                <div className="text-xs text-muted-foreground">
                  {currentSession.ownerName}'s session
                </div>
              </div>
              <DropdownMenuSeparator />
              {currentSession.participants.map(participant => (
                <DropdownMenuItem key={participant.userId} className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback>{participant.userName[0]}</AvatarFallback>
                  </Avatar>
                  <span>{participant.userName}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => leaveSession()}>Leave Session</DropdownMenuItem>
            </>
          ) : (
            <>
              <DialogTrigger asChild>
                <DropdownMenuItem
                  onSelect={() => {
                    setDropdownOpen(false);
                    setDialogOpen(true);
                  }}
                >
                  Start Collaboration
                </DropdownMenuItem>
              </DialogTrigger>
              <DropdownMenuSeparator />
              <div className="p-2">
                <div className="text-xs text-muted-foreground">No active session</div>
              </div>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Collaboration</DialogTitle>
          <DialogDescription>
            Start a new collaboration session or join an existing one.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <h4 className="text-sm font-medium mb-2">Create New Session</h4>
            <Button
              onClick={async () => {
                if (activeTab?.data.filePath) {
                  try {
                    await createSession(activeTab.data.filePath, activeTab.name);
                    setDialogOpen(false);
                  } catch (error) {
                  }
                }
              }}
              disabled={!activeTab?.data.filePath}
              className="w-full"
            >
              Start Session
            </Button>
          </div>

          {sessions.length > 0 && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Available Sessions
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                {sessions.map(session => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between p-2 border rounded-lg"
                  >
                    <div>
                      <div className="text-sm font-medium">{session.fileName}</div>
                      <div className="text-xs text-muted-foreground">
                        {session.ownerName}'s session ({session.participantCount} participants)
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={async () => {
                        await joinSession(session.id);
                        setDialogOpen(false);
                      }}
                    >
                      Join
                    </Button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setDialogOpen(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
