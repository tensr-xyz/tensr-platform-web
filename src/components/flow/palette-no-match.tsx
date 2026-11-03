'use client';

import { Button } from '@/components/ui/button';

/** Empty state for the ⌘K analysis list. Null copy means the list is not empty for a search. */
export function paletteNoMatchCopy(query: string): { message: string; ask: string | null } {
  const text = query.trim();
  if (!text) {
    return { message: 'Nothing in this section yet. Search for an analysis by name.', ask: null };
  }
  return { message: `No analysis matches “${text}”.`, ask: text };
}

/**
 * Shown when ⌘K finds no analysis. "Ask the agent" hands the typed text to the
 * palette's onAsk, which opens the project chat and sends it.
 */
export function PaletteNoMatch({ query, onAsk }: { query: string; onAsk: (text: string) => void }) {
  const copy = paletteNoMatchCopy(query);
  return (
    <div className="palette-no-match">
      <p className="flow-muted">{copy.message}</p>
      {copy.ask ? (
        <Button
          className="flow-btn palette-ask"
          type="button"
          onClick={() => onAsk(copy.ask as string)}
        >
          Ask the agent
        </Button>
      ) : null}
    </div>
  );
}
