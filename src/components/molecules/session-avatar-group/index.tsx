'use client';

import { Avatar, AvatarFallback } from '@/components/atoms/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/atoms/tooltip';
import { cn } from '@/utils';

export interface SessionAvatarParticipant {
  userId: string;
  userName: string;
  role?: string;
}

function initials(name: string): string {
  if (!name.trim()) return '?';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase();
}

function avatarTone(userId: string): string {
  const hue = Math.abs(userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % 360;
  return `hsl(${hue} 55% 42%)`;
}

interface SessionAvatarGroupProps {
  participants: SessionAvatarParticipant[];
  currentUserId?: string | null;
  max?: number;
  className?: string;
  size?: 'sm' | 'md';
}

/** Overlapping avatar stack for an active collaboration session (shadcn Avatar pattern). */
export function SessionAvatarGroup({
  participants,
  currentUserId,
  max = 4,
  className,
  size = 'sm',
}: SessionAvatarGroupProps) {
  if (participants.length === 0) {
    return null;
  }

  const visible = participants.slice(0, max);
  const overflow = participants.length - visible.length;
  const dim = size === 'sm' ? 'h-7 w-7' : 'h-8 w-8';
  const text = size === 'sm' ? 'text-[10px]' : 'text-xs';

  return (
    <TooltipProvider delayDuration={300}>
      <div className={cn('flex items-center', className)}>
        <div className="flex -space-x-2">
          {visible.map(participant => {
            const label =
              participant.userId === currentUserId
                ? `${participant.userName} (you)`
                : participant.userName;
            return (
              <Tooltip key={participant.userId}>
                <TooltipTrigger asChild>
                  <Avatar
                    className={cn(
                      dim,
                      'border-2 border-background shadow-sm ring-0',
                      'transition-transform hover:z-10 hover:scale-105'
                    )}
                  >
                    <AvatarFallback
                      className={cn(text, 'font-medium text-white')}
                      style={{ backgroundColor: avatarTone(participant.userId) }}
                    >
                      {initials(participant.userName)}
                    </AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>
                    {label}
                    {participant.role ? ` · ${participant.role}` : ''}
                  </p>
                </TooltipContent>
              </Tooltip>
            );
          })}
          {overflow > 0 ? (
            <Avatar className={cn(dim, 'border-2 border-background')}>
              <AvatarFallback className={cn(text, 'bg-muted font-medium text-muted-foreground')}>
                +{overflow}
              </AvatarFallback>
            </Avatar>
          ) : null}
        </div>
      </div>
    </TooltipProvider>
  );
}
