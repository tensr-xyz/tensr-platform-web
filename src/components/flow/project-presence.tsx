'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/atoms/tooltip';
import { memberInitials } from '@/components/flow/flow-shell';
import {
  buildProjectPresenceView,
  type ProjectPresenceView,
} from '@/components/flow/project-presence-logic';
import { useAuth } from '@/hooks/api/use-auth';
import { wsService, type ProjectViewerPresence } from '@/hooks/ui/use-session';
import { useAuthStore } from '@/stores/auth-store';

function syncIdentity() {
  const user = useAuthStore.getState().user;
  if (!user?.userId) return;
  const displayName =
    [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
    user.email?.trim() ||
    undefined;
  wsService.setIdentity(user.userId, displayName);
}

/** Keep the shared socket joined to this project and publish the active tab. */
export function useProjectPresence(projectId: string | null | undefined, page: string) {
  const { user } = useAuth();
  const pageRef = useRef(page);
  pageRef.current = page;
  const [presence, setPresence] = useState<Map<string, ProjectViewerPresence>>(
    () => new Map(wsService.projectPresence)
  );

  useEffect(() => {
    syncIdentity();
    return useAuthStore.subscribe(state => {
      if (state.user?.userId) syncIdentity();
    });
  }, []);

  useEffect(() => {
    return wsService.onProjectPresenceChange(next => setPresence(new Map(next)));
  }, []);

  useEffect(() => {
    const id = (projectId || '').trim();
    if (!id) {
      wsService.leaveProject();
      return;
    }
    wsService.joinProject(id, pageRef.current);
    return () => {
      wsService.leaveProject(id);
    };
  }, [projectId]);

  useEffect(() => {
    const id = (projectId || '').trim();
    if (!id) return;
    wsService.updateProjectPage(page);
  }, [projectId, page]);

  const view = buildProjectPresenceView(presence, user?.userId || wsService.userId, memberInitials);
  return view;
}

/** Paper 9f: overlapping avatars + “Priya is on Report” in the project header. */
export function ProjectPresenceAvatars({ view }: { view: ProjectPresenceView }) {
  if (!view.avatars.length && !view.overflow) {
    return null;
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="proj-presence" aria-label="People in this project">
        <div className="proj-presence-stack">
          {view.avatars.map(avatar => (
            <Tooltip key={avatar.userId}>
              <TooltipTrigger asChild>
                <span
                  className="proj-presence-avatar"
                  style={{ backgroundColor: avatar.tone.background, color: avatar.tone.color }}
                >
                  {avatar.initials}
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">{avatar.userName}</TooltipContent>
            </Tooltip>
          ))}
          {view.overflow > 0 ? (
            <span
              className="proj-presence-avatar proj-presence-more"
              style={{
                backgroundColor: '#E7E6E1',
                color: '#6A6B66',
              }}
            >
              +{view.overflow}
            </span>
          ) : null}
        </div>
        {view.status ? <span className="proj-presence-status">{view.status}</span> : null}
      </div>
    </TooltipProvider>
  );
}
