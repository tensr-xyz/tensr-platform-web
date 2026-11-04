'use client';

import type { ReactNode } from 'react';
import { memberInitials } from '@/components/flow/flow-shell';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/rest';

const TONES = ['accent', 'slate', 'warn'] as const;

/** Initials in a round mark. The tone is picked from the label so a person keeps their colour. */
export function PersonMark({
  label,
  size = 'sm',
  pending,
}: {
  label: string;
  size?: 'sm' | 'lg';
  pending?: boolean;
}) {
  const sum = Array.from(label).reduce((total, ch) => total + ch.charCodeAt(0), 0);
  const tone = pending ? 'pending' : TONES[sum % TONES.length];
  return (
    <span className="st-mark" data-size={size} data-tone={tone} aria-hidden="true">
      {memberInitials(label)}
    </span>
  );
}

export function SettingsError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="st-card st-error" role="alert">
      <div>
        <p className="st-row-title">This page did not load</p>
        <p className="st-row-sub">{message}</p>
      </div>
      <Button className="st-btn" type="button" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

export function SkeletonCard({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={`st-card st-skeleton ${className || ''}`} aria-hidden="true">
      <Skeleton className="h-5 w-40" />
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}

export function RowCard({
  title,
  sub,
  action,
}: {
  title: ReactNode;
  sub?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="st-card st-rowcard">
      <div className="st-rowcard-text">
        <p className="st-row-title">{title}</p>
        {sub ? <p className="st-row-sub">{sub}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Bar({ percent, warn }: { percent: number; warn?: boolean }) {
  return (
    <div className="st-bar" aria-hidden="true">
      <span
        data-warn={warn ? 'true' : undefined}
        style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
      />
    </div>
  );
}
