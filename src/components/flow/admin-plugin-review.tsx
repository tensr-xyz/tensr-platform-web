'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/rest';
import { Textarea } from '@/components/ui/textarea';
import { flowJson } from '@/lib/flow-api';
import {
  ageLabel,
  apiErrorText,
  errorStatus,
  languageLabel,
  permissionLines,
  priceLabel,
  scanLines,
  shortDate,
  type PluginRecord,
} from './plugin-pages';
import './plugins-pages.css';

type Decision = 'APPROVED' | 'REJECTED';

export function AdminPluginReview() {
  const [phase, setPhase] = useState<'loading' | 'ready' | 'forbidden' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [queue, setQueue] = useState<PluginRecord[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<Decision | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(() => {
    setPhase('loading');
    void flowJson<{ items?: PluginRecord[] }>('/plugins/admin/review-queue?limit=200')
      .then(body => {
        const items = body.items || [];
        setQueue(items);
        setSelectedKey(items[0] ? keyOf(items[0]) : null);
        setPhase('ready');
      })
      .catch(reason => {
        const status = errorStatus(reason);
        if (status === 401 || status === 403) {
          setPhase('forbidden');
          return;
        }
        setError(apiErrorText(reason, 'Could not load the review queue.'));
        setPhase('error');
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selected = queue.find(item => keyOf(item) === selectedKey) || null;

  const choose = (item: PluginRecord) => {
    setSelectedKey(keyOf(item));
    setNote('');
    setActionError(null);
  };

  const decide = (decision: Decision) => {
    if (!selected) return;
    if (decision === 'REJECTED' && !note.trim()) {
      setActionError('Tell the author what to change before you send it back.');
      return;
    }
    setBusy(decision);
    setActionError(null);
    void flowJson(`/plugins/admin/${encodeURIComponent(selected.pluginId)}/review`, {
      method: 'POST',
      body: JSON.stringify({
        status: decision,
        notes: note.trim() || null,
        version: selected.version || null,
      }),
    })
      .then(() => {
        const rest = queue.filter(item => keyOf(item) !== keyOf(selected));
        setQueue(rest);
        setSelectedKey(rest[0] ? keyOf(rest[0]) : null);
        setNote('');
      })
      .catch(reason => setActionError(apiErrorText(reason, 'Could not save your review.')))
      .finally(() => setBusy(null));
  };

  if (phase === 'forbidden') {
    return (
      <div className="pg-page">
        <div className="pg-empty pg-empty-page">
          <h1 className="pg-h2">This page is for Tensr staff</h1>
          <p className="pg-muted">Plugin review is only open to the Tensr team.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pg-review">
      <div className="pg-queue">
        <div className="pg-queue-head">
          <div className="pg-eyebrow">
            <span className="pg-muted">Tensr admin</span>
            <span className="pg-staff">STAFF</span>
          </div>
          <h1 className="pg-review-title">Plugin review</h1>
        </div>
        {phase === 'loading' ? (
          <div className="pg-stack" aria-busy="true">
            <div className="pg-sub">Waiting</div>
            <Skeleton className="pg-sk-queue" />
            <Skeleton className="pg-sk-queue" />
            <Skeleton className="pg-sk-queue" />
          </div>
        ) : phase === 'error' ? (
          <div className="pg-stack">
            <p className="flow-error">{error || 'Could not load the review queue.'}</p>
            <Button className="flow-btn pg-fit" type="button" onClick={load}>
              Try again
            </Button>
          </div>
        ) : (
          <div className="pg-stack">
            <div className="pg-sub">Waiting · {queue.length}</div>
            {queue.length === 0 ? (
              <p className="pg-muted pg-small">Nothing is waiting for review.</p>
            ) : (
              queue.map(item => {
                const active = selectedKey === keyOf(item);
                const age = ageLabel(item.updatedAt || item.createdAt);
                const sub = [
                  item.version ? `v${item.version}` : null,
                  item.authorName || null,
                  languageLabel(item.language),
                  item.isPaid ? 'paid' : 'free',
                ].filter(Boolean);
                return (
                  <Button
                    key={keyOf(item)}
                    type="button"
                    className={active ? 'pg-queue-item active' : 'pg-queue-item'}
                    aria-pressed={active}
                    onClick={() => choose(item)}
                  >
                    <span className="pg-queue-top">
                      <span className="pg-queue-name">{item.name}</span>
                      {age ? <span className="pg-queue-age">{age}</span> : null}
                    </span>
                    <span className="pg-sub">{sub.join(' · ')}</span>
                  </Button>
                );
              })
            )}
          </div>
        )}
      </div>

      <div className="pg-detail">
        {phase === 'loading' ? (
          <div className="pg-stack" aria-busy="true">
            <Skeleton className="pg-sk-title" />
            <Skeleton className="pg-sk-line" />
            <Skeleton className="pg-sk-card" />
          </div>
        ) : selected ? (
          <ReviewDetail
            plugin={selected}
            note={note}
            onNote={setNote}
            busy={busy}
            error={actionError}
            onDecide={decide}
          />
        ) : phase === 'ready' ? (
          <p className="pg-muted">Pick a plugin from the queue to review it.</p>
        ) : null}
      </div>
    </div>
  );
}

function keyOf(item: PluginRecord): string {
  return `${item.pluginId}@${item.version || ''}`;
}

function ReviewDetail({
  plugin,
  note,
  onNote,
  busy,
  error,
  onDecide,
}: {
  plugin: PluginRecord;
  note: string;
  onNote: (value: string) => void;
  busy: Decision | null;
  error: string | null;
  onDecide: (decision: Decision) => void;
}) {
  const submitted = shortDate(plugin.updatedAt || plugin.createdAt);
  const byline = [
    plugin.authorName ? `Submitted by ${plugin.authorName}` : 'Submitted',
    submitted ? `on ${submitted}` : null,
  ]
    .filter(Boolean)
    .join(' ');
  const checks = scanLines(plugin.scanResults);
  const permissions = permissionLines(plugin.capabilities);
  const price = plugin.isPaid ? priceLabel(plugin.pricing) : null;
  const language = languageLabel(plugin.language);

  return (
    <div className="pg-stack wide">
      <div className="pg-detail-head">
        <div className="pg-grow">
          <h2 className="pg-detail-title">
            {plugin.name}
            {plugin.version ? ` · v${plugin.version}` : ''}
          </h2>
          <div className="pg-sub">{byline}</div>
        </div>
        <div className="pg-actions">
          <Button
            className="flow-btn pg-btn"
            type="button"
            disabled={busy !== null}
            onClick={() => onDecide('REJECTED')}
          >
            {busy === 'REJECTED' ? 'Sending' : 'Ask for changes'}
          </Button>
          <Button
            className="flow-btn primary pg-btn"
            type="button"
            disabled={busy !== null}
            onClick={() => onDecide('APPROVED')}
          >
            {busy === 'APPROVED' ? 'Publishing' : 'Approve and publish'}
          </Button>
        </div>
      </div>

      {checks.length ? (
        <div className="pg-checks">
          <div className="pg-checks-head">Automatic checks</div>
          {checks.map(check => (
            <div key={check.text} className="pg-check">
              <span>{check.text}</span>
              <span className={check.passed ? 'pg-accent' : 'pg-warn'}>
                {check.passed ? 'Passed' : 'Needs a look'}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {plugin.description ? (
        <section className="pg-section">
          <h3 className="pg-h3">What it does</h3>
          <p className="pg-text">{plugin.description}</p>
        </section>
      ) : null}

      {permissions.length ? (
        <section className="pg-section">
          <h3 className="pg-h3">What it can see</h3>
          <div className="pg-box">
            {permissions.map(line => (
              <div key={line.text} className={line.allowed ? 'pg-perm' : 'pg-perm off'}>
                {line.allowed ? '✓' : '✕'} {line.text}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {language || price ? (
        <div className="pg-sub">
          {[language, price || (plugin.isPaid ? 'Paid' : 'Free')].filter(Boolean).join(' · ')}
        </div>
      ) : null}

      <section className="pg-section">
        <h3 className="pg-h3">Note to the author</h3>
        <Textarea
          className="pg-note-input"
          value={note}
          onChange={event => onNote(event.target.value)}
          placeholder="Visible to the author when you approve or ask for changes"
          rows={3}
        />
      </section>
      {error ? <p className="flow-error">{error}</p> : null}
    </div>
  );
}
