'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { flowJson } from '@/lib/flow-api';

export type AskerTurn = {
  turn_id: string;
  user_id?: string;
  question: string;
  answer: string;
  checked?: boolean;
  status?: string;
  audience?: string;
  base?: string;
  weight?: string;
  wave?: string;
  source?: string;
  test?: string;
  table_note?: string;
  owner_note?: string;
  created_at?: string;
};

type FilterId = 'to_check' | 'checked' | 'not_in_data' | 'all';

function askerBucket(turn: AskerTurn): 'to_check' | 'checked' | 'not_in_data' {
  if (
    turn.status === 'not_in_data' ||
    turn.answer.trim().toLowerCase().startsWith('not in this data')
  ) {
    return 'not_in_data';
  }
  if (turn.status === 'checked' || turn.checked) return 'checked';
  return 'to_check';
}

function statusLabel(turn: AskerTurn): string {
  if (turn.status === 'check_requested') return 'Check requested';
  if (turn.status === 'flagged') return 'Low base';
  if (askerBucket(turn) === 'not_in_data') return 'Not in data';
  if (askerBucket(turn) === 'checked') return 'Checked by you';
  return 'To check';
}

function whenLabel(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const today = new Date();
  const sameDay =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
  if (sameDay) {
    return `today ${date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
  }
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function summaryLine(turn: AskerTurn): string {
  if (askerBucket(turn) === 'not_in_data') {
    return 'No matching question';
  }
  return [turn.audience, turn.base ? `base ${turn.base.replace(/^base:\s*/i, '')}` : '', turn.wave]
    .filter(Boolean)
    .join(' · ');
}

export function AskerQuestionsScreen({ projectId }: { projectId: string }) {
  const [turns, setTurns] = useState<AskerTurn[] | null>(null);
  const [filter, setFilter] = useState<FilterId>('to_check');
  const [openId, setOpenId] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    let live = true;
    void flowJson<{ turns?: AskerTurn[] }>(`/api/projects/${projectId}/asker-log`)
      .then(page => {
        if (!live) return;
        const list = page.turns || [];
        setTurns(list);
        setOpenId(current => current || list[0]?.turn_id || '');
      })
      .catch(() => {
        if (live) setTurns([]);
      });
    return () => {
      live = false;
    };
  }, [projectId]);

  const counts = useMemo(() => {
    const list = turns || [];
    return {
      to_check: list.filter(turn => askerBucket(turn) === 'to_check').length,
      checked: list.filter(turn => askerBucket(turn) === 'checked').length,
      not_in_data: list.filter(turn => askerBucket(turn) === 'not_in_data').length,
      all: list.length,
    };
  }, [turns]);

  const shown = useMemo(() => {
    const list = turns || [];
    return filter === 'all' ? list : list.filter(turn => askerBucket(turn) === filter);
  }, [filter, turns]);

  const open = shown.find(turn => turn.turn_id === openId) || shown[0];

  useEffect(() => {
    setNote(open?.owner_note || '');
  }, [open?.turn_id, open?.owner_note]);

  const mark = (status: 'checked' | 'flagged') => {
    if (!open?.turn_id) return;
    setBusy(true);
    setError('');
    void flowJson<{ turn?: AskerTurn }>(`/api/projects/${projectId}/asker-log/${open.turn_id}`, {
      method: 'POST',
      body: JSON.stringify({
        checked: status === 'checked',
        status,
        owner_note: note.trim() || null,
      }),
    })
      .then(page => {
        const saved = page.turn;
        if (!saved) return;
        setTurns(current =>
          (current || []).map(turn => (turn.turn_id === saved.turn_id ? saved : turn))
        );
      })
      .catch(() => setError('Could not update that answer.'))
      .finally(() => setBusy(false));
  };

  if (turns === null) {
    return (
      <section className="asker-log-page">
        <p className="flow-muted">Loading Asker questions…</p>
      </section>
    );
  }

  return (
    <section className="asker-log-page" aria-label="Asker questions">
      <aside className="asker-log-list">
        <div className="asker-log-filters" role="tablist" aria-label="Asker question filters">
          {(
            [
              ['to_check', `To check · ${counts.to_check}`],
              ['checked', `Checked · ${counts.checked}`],
              ['not_in_data', `Not in data · ${counts.not_in_data}`],
              ['all', 'All'],
            ] as const
          ).map(([id, label]) => (
            <Button
              key={id}
              type="button"
              className="asker-log-filter"
              aria-pressed={filter === id}
              onClick={() => {
                setFilter(id);
                setOpenId('');
              }}
            >
              {label}
            </Button>
          ))}
        </div>
        {shown.map(turn => {
          const active = (open?.turn_id || '') === turn.turn_id;
          return (
            <Button
              key={turn.turn_id}
              type="button"
              className={active ? 'asker-log-row is-active' : 'asker-log-row'}
              onClick={() => setOpenId(turn.turn_id)}
            >
              <span className="asker-log-row-top">
                <span className="flow-muted">
                  {turn.user_id || 'Asker'} · {whenLabel(turn.created_at)}
                </span>
                <span className={`asker-log-status status-${askerBucket(turn)}`}>
                  {statusLabel(turn)}
                </span>
              </span>
              <strong>{turn.question}</strong>
              <span className="flow-muted">{summaryLine(turn)}</span>
            </Button>
          );
        })}
        {shown.length ? null : <p className="flow-muted">Nothing in this list.</p>}
      </aside>
      <div className="asker-log-detail">
        {open ? (
          <>
            <p className="flow-muted">
              {(open.user_id || 'Asker') + ' (Asker) asked '}
              {whenLabel(open.created_at) || 'recently'}
              {open.status === 'check_requested' ? ' · asked you to check' : ''}
            </p>
            <h2>{open.question}</h2>
            <div
              className={
                askerBucket(open) === 'not_in_data' ? 'asker-not-in-data' : 'asker-answer-card'
              }
            >
              {askerBucket(open) === 'not_in_data' ? (
                <p>
                  <strong>Not in this data.</strong>{' '}
                  {open.answer.replace(/^not in this data\.?\s*/i, '')}
                </p>
              ) : (
                <>
                  <p>{open.answer}</p>
                  {open.table_note ? <p className="flow-muted">Table: {open.table_note}</p> : null}
                </>
              )}
            </div>
            {askerBucket(open) === 'not_in_data' ? null : (
              <div className="asker-worked">
                <p>How it was worked out</p>
                <p>
                  <span className="flow-muted">Audience</span>{' '}
                  {open.audience || 'The rows this answer used'}
                </p>
                <p>
                  <span className="flow-muted">Base</span> {open.base || 'The base on this answer'}
                </p>
                <p>
                  <span className="flow-muted">Weight</span>{' '}
                  {open.weight || 'The weight on this answer'}
                </p>
                {open.test ? (
                  <p>
                    <span className="flow-muted">Test</span> {open.test}
                  </p>
                ) : null}
                <p>
                  <span className="flow-muted">Source</span>{' '}
                  {[open.source, open.wave].filter(Boolean).join(' · ') || 'This project’s file'}
                </p>
              </div>
            )}
            <label className="asker-note">
              <span className="flow-muted">Note to asker (optional)</span>
              <Textarea
                value={note}
                onChange={event => setNote(event.target.value)}
                placeholder="Add context before they use this with a client…"
                rows={3}
              />
            </label>
            <div className="asker-log-actions">
              <Button
                className="flow-btn primary"
                type="button"
                disabled={busy || askerBucket(open) === 'checked'}
                onClick={() => mark('checked')}
              >
                Mark as checked
              </Button>
              <Button
                className="flow-btn asker-flag"
                type="button"
                disabled={busy}
                onClick={() => mark('flagged')}
              >
                Flag a problem
              </Button>
              <span className="flow-muted">They see the result next to their answer</span>
            </div>
            {error ? <p className="flow-error">{error}</p> : null}
          </>
        ) : (
          <p className="flow-muted">Select a question to review it.</p>
        )}
      </div>
    </section>
  );
}

export function askerQuestionsTabLabel(turns: AskerTurn[] | null | undefined): string {
  const pending = (turns || []).filter(turn => askerBucket(turn) === 'to_check').length;
  return pending > 0 ? `Asker questions · ${pending} to check` : 'Asker questions';
}
