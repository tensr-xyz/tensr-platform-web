'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/utils';

export const settingsNavItems = [
  { title: 'General', href: '/settings/general' },
  { title: 'Billing', href: '/settings/billing' },
  { title: 'Usage', href: '/settings/usage' },
  { title: 'Organisation', href: '/settings/organisation' },
  { title: 'Members', href: '/settings/members' },
] as const;

interface SettingsNavProps {
  className?: string;
  /** Vertical list for dialogs; default is horizontal pills. */
  orientation?: 'horizontal' | 'vertical';
}

export function SettingsNav({ className, orientation = 'horizontal' }: SettingsNavProps) {
  const pathname = usePathname();

  if (orientation === 'vertical') {
    return (
      <nav aria-label="Settings" className={cn('flex flex-col gap-1 p-2', className)}>
        {settingsNavItems.map(link => {
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'rounded-md px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-muted font-medium text-foreground'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              )}
            >
              {link.title}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav
      aria-label="Settings sections"
      className={cn('mt-6 flex flex-wrap justify-center gap-2', className)}
    >
      {settingsNavItems.map(link => {
        const isActive = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              'rounded-full border px-3 py-1.5 text-sm transition-colors',
              isActive
                ? 'border-border bg-muted font-medium text-foreground'
                : 'border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground'
            )}
          >
            {link.title}
          </Link>
        );
      })}
    </nav>
  );
}
