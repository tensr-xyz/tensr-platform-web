import React from 'react';
import { cn } from '@/utils';

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`)/g;

function renderInline(text: string): React.ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code key={i} className="rounded bg-muted px-1 font-mono text-[0.92em]">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

/** Approach copy (plan, why, alternative, exploration): bold, inline code and numbered lists. */
export function ApproachText({ text, className }: { text: string; className?: string }) {
  const lines = text
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);
  const numbered = lines.length > 0 && lines.every(l => /^\d+\.\s/.test(l));
  if (numbered) {
    return (
      <ol className={cn('list-decimal space-y-1 pl-5', className)}>
        {lines.map((line, i) => (
          <li key={i}>{renderInline(line.replace(/^\d+\.\s+/, ''))}</li>
        ))}
      </ol>
    );
  }
  return (
    <div className={cn('space-y-1', className)}>
      {lines.map((line, i) => (
        <p key={i}>{renderInline(line)}</p>
      ))}
    </div>
  );
}
