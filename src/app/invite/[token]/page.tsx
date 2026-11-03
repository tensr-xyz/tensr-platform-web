'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/rest';
import { flowJson } from '@/lib/flow-api';
import { getStytchBearerForTensrApi } from '@/utils/auth';
import '../invite.css';

type Phase = 'checking' | 'ready' | 'accepting' | 'expired' | 'error';

function readError(err: unknown): { status: number; message: string } {
  const status = Number((err as { status?: number })?.status || 0);
  let message = err instanceof Error ? err.message : '';
  try {
    const body = JSON.parse(message) as { detail?: unknown; message?: unknown };
    if (typeof body.detail === 'string') message = body.detail;
    else if (typeof body.message === 'string') message = body.message;
  } catch {
    /* plain text */
  }
  return { status, message };
}

function TensrMark() {
  return (
    <span className="iv-mark" aria-hidden="true">
      <svg width="16" height="16" viewBox="0 0 48 48">
        <rect x="4" y="5" width="12" height="12" rx="2.5" fill="#FFFFFF" />
        <rect x="18" y="5" width="12" height="12" rx="2.5" fill="#FFFFFF" />
        <rect x="32" y="5" width="12" height="12" rx="2.5" fill="#6FC2A6" />
        <rect x="18" y="19" width="12" height="12" rx="2.5" fill="#FFFFFF" />
        <rect x="18" y="33" width="12" height="12" rx="2.5" fill="#FFFFFF" />
      </svg>
    </span>
  );
}

/** Invite acceptance (Paper 8a). Email links land here with the invitation token. */
export default function InvitePage() {
  const params = useParams<{ token: string }>();
  const token = String(params?.token || '');
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('checking');
  const [email, setEmail] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!getStytchBearerForTensrApi()) {
      setPhase('ready');
      return;
    }
    let live = true;
    flowJson<{ user?: { email?: string } }>('/api/me')
      .then(body => {
        if (live) setEmail(body.user?.email || null);
      })
      .catch(() => {
        if (live) setEmail(null);
      })
      .finally(() => {
        if (live) setPhase('ready');
      });
    return () => {
      live = false;
    };
  }, []);

  const loginHref = `/login?${new URLSearchParams({ invite: token, returnTo: '/flow' })}`;

  async function accept() {
    if (!email) {
      router.push(loginHref);
      return;
    }
    setPhase('accepting');
    setMessage('');
    try {
      await flowJson(`/api/invitations/${encodeURIComponent(token)}/accept`, { method: 'POST' });
      router.push('/flow');
    } catch (err) {
      const { status, message: text } = readError(err);
      if (status === 410 || /expired/i.test(text)) {
        setPhase('expired');
        return;
      }
      if (status === 404) {
        setMessage(
          'We could not find this invite. Ask the person who invited you to send a new one.'
        );
      } else if (status === 403) {
        setMessage(
          `This invite was sent to a different email from ${email}. Sign in with the address it was sent to.`
        );
      } else if (/no longer valid/i.test(text)) {
        setMessage('This invite has already been used or was withdrawn. Ask for a new one.');
      } else {
        setMessage(text || 'The invite was not accepted. Try again.');
      }
      setPhase('error');
    }
  }

  return (
    <main className="iv">
      <div className="iv-card">
        <div className="iv-brand">
          <TensrMark />
          <span>Tensr</span>
        </div>

        {phase === 'checking' ? (
          <div className="iv-stack" aria-busy="true">
            <Skeleton className="iv-skel-title" />
            <Skeleton className="iv-skel-line" />
            <Skeleton className="iv-skel-field" />
            <Skeleton className="iv-skel-field" />
          </div>
        ) : phase === 'expired' ? (
          <div className="iv-stack">
            <div className="iv-copy">
              <h1 className="iv-title">This invite has expired</h1>
              <p className="iv-body">Ask the person who invited you to send a new one.</p>
            </div>
            <Button asChild className="iv-btn">
              <Link href="/login">Back to sign in</Link>
            </Button>
          </div>
        ) : (
          <div className="iv-stack">
            <div className="iv-copy">
              <h1 className="iv-title">You&apos;ve been invited to a team on Tensr</h1>
              <p className="iv-body">
                Accept to join the workspace. You&apos;ll see the projects shared with you there,
                with their tables, outputs and reports.
              </p>
            </div>
            <div className="iv-form">
              {email ? (
                <Input
                  className="iv-email"
                  aria-label="Your email"
                  value={email}
                  readOnly
                  disabled
                />
              ) : null}
              <Button
                type="button"
                className="iv-btn iv-primary"
                disabled={phase === 'accepting'}
                onClick={() => void accept()}
              >
                {phase === 'accepting'
                  ? 'Accepting…'
                  : email
                    ? 'Accept and open Tensr'
                    : 'Accept and send me a sign-in code'}
              </Button>
              {message ? <p className="iv-error">{message}</p> : null}
            </div>
            <p className="iv-note">
              {email
                ? 'Not you? Sign out and open this link again. Ignore it and nothing changes.'
                : "You'll sign in with the email the invite was sent to. Not you? Ignore this and nothing changes."}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
