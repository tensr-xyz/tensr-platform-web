'use client';

import { useCallback, useEffect, useState } from 'react';
import { Megaphone } from 'lucide-react';

import { Button } from '@/components/atoms/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/atoms/popover';
import {
  CHANGELOG_PAGE_URL,
  type ChangelogEntry,
  fetchChangelogFeed,
  hasUnread,
  latestVersion,
  readSeenVersion,
  writeSeenVersion,
} from '@/lib/changelog';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

const tagLabel = {
  feature: 'Feature',
  fix: 'Fix',
  improvement: 'Improvement',
} as const;

function formatEntryDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function WhatsNewPopover({
  fetchFeed = fetch,
  storage,
}: {
  fetchFeed?: typeof fetch;
  storage?: StorageLike;
}) {
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [seen, setSeen] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const store = storage ?? window.localStorage;
    setSeen(readSeenVersion(store));
    let cancelled = false;
    fetchChangelogFeed(fetchFeed)
      .then(next => {
        if (cancelled) return;
        setEntries(next);
        setError(null);
      })
      .catch(() => {
        if (cancelled) return;
        setError('Changelog is unavailable.');
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchFeed, storage]);

  const unread = hasUnread(latestVersion(entries), seen);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) return;
      const version = latestVersion(entries);
      if (!version) return;
      writeSeenVersion(version, storage ?? window.localStorage);
      setSeen(version);
    },
    [entries, storage]
  );

  return (
    <Popover onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative h-10 w-10 rounded-full border border-border"
          aria-label={unread ? "What's new, unread" : "What's new"}
          data-unread={unread ? 'true' : 'false'}
        >
          <Megaphone className="h-[15px] w-[15px]" aria-hidden />
          {unread ? (
            <span
              className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-primary"
              aria-hidden
            />
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0" sideOffset={8}>
        <div className="border-b border-border px-3 py-2">
          <p className="text-sm font-medium text-foreground">What&apos;s new</p>
          <p className="text-xs text-muted-foreground">
            Newest changes in Tensr, from the changelog.
          </p>
        </div>
        <div className="max-h-[min(70vh,360px)] overflow-y-auto">
          {!loaded ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">Loading…</p>
          ) : error ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">{error}</p>
          ) : entries.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">No changelog entries yet.</p>
          ) : (
            <ol className="divide-y divide-border">
              {entries.map(entry => (
                <li key={`${entry.version}-${entry.title}`} className="px-3 py-3">
                  <a
                    href={entry.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-sm outline-none hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                      <time dateTime={entry.date}>{formatEntryDate(entry.date)}</time>
                      <span className="font-mono">v{entry.version}</span>
                      {entry.tags.map(tag => (
                        <span
                          key={tag}
                          className="rounded-full border border-border px-1.5 py-px uppercase tracking-wide"
                        >
                          {tagLabel[tag]}
                        </span>
                      ))}
                    </div>
                    <p className="mt-1 text-sm font-medium text-foreground">{entry.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {entry.summary}
                    </p>
                  </a>
                </li>
              ))}
            </ol>
          )}
        </div>
        <div className="border-t border-border px-3 py-2">
          <a
            href={CHANGELOG_PAGE_URL}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Full changelog
          </a>
        </div>
      </PopoverContent>
    </Popover>
  );
}
