'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import './flow-not-found.css';

/** 404 block (Paper 8b). Links back to the project list and the archive. */
export function FlowNotFound({
  title = "We can't find that project",
  body = "It may have been archived or moved, or it's in a workspace you're not part of. Ask the owner to share it with you.",
}: {
  title?: string;
  body?: string;
}) {
  return (
    <div className="nf-block">
      <span className="nf-code">404</span>
      <h1 className="nf-title">{title}</h1>
      <p className="nf-body">{body}</p>
      <div className="nf-actions">
        <Button asChild className="nf-btn nf-primary">
          <Link href="/flow">Go to projects</Link>
        </Button>
        <Button asChild className="nf-btn">
          <Link href="/flow?view=archived">Check archived</Link>
        </Button>
      </div>
    </div>
  );
}

/** Error block (Paper 8b). The reference is what support needs to find the failure. */
export function FlowErrorState({ reference, onRetry }: { reference: string; onRetry: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="nf-block">
      <span className="nf-kicker">SOMETHING WENT WRONG</span>
      <h1 className="nf-title">This page didn&apos;t load</h1>
      <p className="nf-body">
        Your files and tables are safe. Try again, and if it keeps happening send us the reference
        below.
      </p>
      <div className="nf-actions">
        <Button type="button" className="nf-btn nf-primary" onClick={onRetry}>
          Try again
        </Button>
        <Button
          type="button"
          className="nf-btn"
          onClick={() => {
            void navigator.clipboard
              ?.writeText(reference)
              .then(() => setCopied(true))
              .catch(() => setCopied(false));
          }}
        >
          {copied ? 'Copied' : 'Copy reference'} · {reference}
        </Button>
      </div>
    </div>
  );
}

/** Full-height centred wrapper that carries its own tokens, for use outside .flow. */
export function FlowStatePage({ children }: { children: React.ReactNode }) {
  return <main className="nf-page">{children}</main>;
}
