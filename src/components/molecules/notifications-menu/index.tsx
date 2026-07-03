'use client';

import type { ReactNode } from 'react';
import { Bell } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/molecules/dropdown';

type NotificationsMenuProps = {
  trigger: ReactNode;
  align?: 'start' | 'center' | 'end';
};

/** Notifications dropdown — empty until a notifications API exists. */
export function NotificationsMenu({ trigger, align = 'end' }: NotificationsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align={align}>
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled className="text-muted-foreground">
          No notifications yet
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function NotificationsSidebarButton({ className }: { className?: string }) {
  return (
    <NotificationsMenu
      trigger={
        <button type="button" className={className}>
          <Bell className="size-4" />
          <span className="text-sm">Notifications</span>
        </button>
      }
    />
  );
}
