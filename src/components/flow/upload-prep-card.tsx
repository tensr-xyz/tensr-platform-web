'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { prepApplyBody, prepParts, type PrepProposal } from '@/components/flow/upload-prep';

/** Accept or skip each part of an upload proposal. Applying writes a derived file. */
export function UploadPrepCard({
  proposal,
  onApply,
  onSkip,
}: {
  proposal: PrepProposal;
  onApply: (body: ReturnType<typeof prepApplyBody>) => void;
  onSkip: () => void;
}) {
  const parts = prepParts(proposal);
  const [kept, setKept] = useState(() => parts.map(part => part.id));
  if (!parts.length) return null;
  return (
    <section className="sources-block" aria-label="Prepare this file">
      <div className="sources-block-head">
        <h2>Prepare this file</h2>
      </div>
      <ul>
        {parts.map(part => {
          const on = kept.includes(part.id);
          return (
            <li key={part.id}>
              <span>{part.label}</span>{' '}
              <Button
                type="button"
                className="flow-btn"
                aria-pressed={on}
                onClick={() =>
                  setKept(current =>
                    current.includes(part.id)
                      ? current.filter(id => id !== part.id)
                      : [...current, part.id]
                  )
                }
              >
                {on ? 'Keep' : 'Skip'}
              </Button>
            </li>
          );
        })}
      </ul>
      <div className="flow-row">
        <Button
          type="button"
          className="flow-btn primary"
          onClick={() => onApply(prepApplyBody(kept))}
        >
          Apply
        </Button>
        <Button type="button" className="flow-btn" onClick={onSkip}>
          Skip
        </Button>
      </div>
    </section>
  );
}
