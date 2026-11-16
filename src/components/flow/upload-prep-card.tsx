'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  prepApplyBody,
  preparedCopyLabel,
  prepParts,
  type PrepPart,
  type PrepProposal,
} from '@/components/flow/upload-prep';

/** Accept or skip each part of an upload proposal. Applying writes a derived file. */
export function UploadPrepCard({
  proposal,
  fileName = '',
  onApply,
  onSkip,
}: {
  proposal: PrepProposal;
  fileName?: string;
  onApply: (body: ReturnType<typeof prepApplyBody>) => void;
  onSkip: () => void;
}) {
  const parts = prepParts(proposal);
  const [kept, setKept] = useState(() => parts.map(part => part.id));
  const [open, setOpen] = useState<string | null>(null);
  if (!parts.length) return null;
  const keptCount = parts.filter(part => kept.includes(part.id) && part.after).length;
  const changeCount = parts.filter(part => part.after).length;
  const respondents = proposal.quality?.respondents;
  const questions = proposal.questions;
  const extension = (fileName.split('.').pop() || 'sav').slice(0, 4).toUpperCase();
  const arrived = [
    fileName ? `${fileName} is in` : 'This file is in',
    typeof respondents === 'number' ? `${respondents.toLocaleString('en-GB')} respondents` : '',
    typeof questions === 'number' && questions > 0
      ? `${questions.toLocaleString('en-GB')} ${questions === 1 ? 'question' : 'questions'}`
      : '',
  ]
    .filter(Boolean)
    .join(' · ');
  const copyName = preparedCopyLabel(fileName);

  const setPart = (id: PrepPart['id'], on: boolean) => {
    setKept(current => (on ? [...current, id] : current.filter(item => item !== id)));
  };

  return (
    <section className="prep-card" aria-label="Prepare this file">
      <div className="prep-card-head">
        <div className="prep-card-mark">{extension}</div>
        <div>
          <strong>{arrived}</strong>
          <p>
            Tensr suggests {changeCount} {changeCount === 1 ? 'change' : 'changes'}. Nothing changes
            until you keep it, and your upload stays as it is.
          </p>
        </div>
      </div>
      {parts.map(part => {
        const on = kept.includes(part.id);
        const shown = open === part.id ? part.rest : [];
        return (
          <div key={part.id} className="prep-row">
            <div className="prep-row-name">
              <strong>{part.title}</strong>
              {part.hint ? <span>{part.hint}</span> : null}
            </div>
            <div className="prep-row-body">
              {part.before ? <span className="prep-before">{part.before}</span> : null}
              {part.after ? <span>{part.after}</span> : null}
              {shown.map(line => (
                <span key={line} className="prep-before">
                  {line}
                </span>
              ))}
              {part.rest.length ? (
                <Button
                  type="button"
                  className="flow-btn prep-more"
                  onClick={() => setOpen(current => (current === part.id ? null : part.id))}
                >
                  {open === part.id ? 'Hide the rest' : `See all ${part.rest.length + 1}`}
                </Button>
              ) : null}
            </div>
            <div className="prep-keep" role="group" aria-label={part.title}>
              <Button
                type="button"
                className="flow-btn"
                data-active={on ? 'true' : 'false'}
                aria-pressed={on}
                onClick={() => setPart(part.id, true)}
              >
                Keep
              </Button>
              <Button
                type="button"
                className="flow-btn"
                data-active={on ? 'false' : 'true'}
                aria-pressed={!on}
                onClick={() => setPart(part.id, false)}
              >
                Skip
              </Button>
            </div>
          </div>
        );
      })}
      <div className="prep-foot">
        <p>
          Applying {keptCount} of {changeCount} creates <strong>{copyName}</strong> in Working
          versions
          {typeof respondents === 'number'
            ? `. All ${respondents.toLocaleString('en-GB')} rows stay.`
            : '. Every row stays.'}
        </p>
        <Button type="button" className="flow-btn" onClick={onSkip}>
          Skip all
        </Button>
        <Button
          type="button"
          className="flow-btn primary"
          onClick={() => onApply(prepApplyBody(kept))}
        >
          Apply {keptCount} {keptCount === 1 ? 'change' : 'changes'}
        </Button>
      </div>
    </section>
  );
}
