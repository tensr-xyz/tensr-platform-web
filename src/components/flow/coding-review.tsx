'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { Skeleton } from '@/components/ui/rest';
import { flowJson } from '@/lib/flow-api';
import {
  buildOverrides,
  codesForApply,
  frameCodes,
  isLowConfidence,
  newCodeId,
  respondentLabel,
  reviewRowsFromPreview,
  type FrameCode,
  type PreviewPage,
  type ReviewRow,
} from './coding-review-data';
import './coding-review.css';

type Segment = 'none' | 'low' | 'reviewed';

export type CodingReviewResult = { datasetId: string; codeColumn: string };

const PAGE = 5000;

function apiMessage(err: unknown, fallback: string): string {
  if (!(err instanceof Error) || !err.message) return fallback;
  try {
    const body = JSON.parse(err.message) as { detail?: unknown };
    if (typeof body.detail === 'string') return body.detail;
  } catch {
    /* plain text */
  }
  return err.message;
}

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
}

/**
 * Review the answers a code frame left without a theme (Paper 4h).
 * Saving re-applies the frame with every row pinned, which writes a new version
 * of the file; onDone receives that version. onDone() with no argument means
 * nothing changed.
 */
export function CodingReview({
  datasetId,
  textColumn,
  codeColumn,
  onDone,
}: {
  datasetId: string;
  textColumn: string;
  codeColumn: string;
  onDone: (result?: CodingReviewResult) => void;
}) {
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState('');
  const [codes, setCodes] = useState<FrameCode[]>([]);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [totalUncoded, setTotalUncoded] = useState(0);
  const [edits, setEdits] = useState<Record<number, string[]>>({});
  const [segment, setSegment] = useState<Segment>('none');
  const [currentRow, setCurrentRow] = useState<number | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const newInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let live = true;
    setPhase('loading');
    const params = new URLSearchParams({
      limit: String(PAGE),
      offset: '0',
      show_value_labels: 'false',
      slim: 'true',
      filter_column: codeColumn,
      filter_value: 'uncoded',
    });
    Promise.all([
      flowJson<{ column_metadata?: Record<string, unknown> }>(`/datasets/${datasetId}/metadata`),
      flowJson<PreviewPage>(`/datasets/${datasetId}/preview?${params}`),
    ])
      .then(([meta, page]) => {
        if (!live) return;
        const frame = frameCodes(meta.column_metadata?.[codeColumn]);
        const queue = reviewRowsFromPreview(page, textColumn, codeColumn);
        setCodes(frame);
        setRows(queue);
        setTotalUncoded(Number(page.n_rows_matched ?? queue.length));
        setCurrentRow(queue[0]?.row ?? null);
        setPhase('ready');
      })
      .catch(err => {
        if (!live) return;
        setLoadError(apiMessage(err, 'The uncoded answers did not load.'));
        setPhase('error');
      });
    return () => {
      live = false;
    };
  }, [datasetId, textColumn, codeColumn]);

  const reviewed = useMemo(() => rows.filter(row => edits[row.row]), [rows, edits]);
  const open = useMemo(() => rows.filter(row => !edits[row.row]), [rows, edits]);
  const low = useMemo(() => open.filter(isLowConfidence), [open]);
  const hasLow = useMemo(() => rows.some(isLowConfidence), [rows]);
  const listed = segment === 'reviewed' ? reviewed : segment === 'low' ? low : open;
  const left = Math.max(0, totalUncoded - reviewed.length);
  const current = rows.find(row => row.row === currentRow) || null;
  const labelFor = useCallback(
    (id: string) => codes.find(code => code.id === id)?.label || id,
    [codes]
  );

  useEffect(() => {
    if (!current) {
      setPicked([]);
      return;
    }
    setPicked(edits[current.row] ? [...edits[current.row]] : []);
    // Only reset the picks when the answer changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRow]);

  const move = useCallback(
    (step: number) => {
      if (!listed.length) return;
      const at = listed.findIndex(row => row.row === currentRow);
      const next = at < 0 ? 0 : Math.min(listed.length - 1, Math.max(0, at + step));
      setCurrentRow(listed[next].row);
    },
    [listed, currentRow]
  );

  const toggle = useCallback((id: string) => {
    setPicked(list => (list.includes(id) ? list.filter(item => item !== id) : [...list, id]));
  }, []);

  const saveAndNext = useCallback(() => {
    if (!current || !picked.length) return;
    const nextEdits = { ...edits, [current.row]: [...picked] };
    setEdits(nextEdits);
    const remaining = rows.filter(
      row => !nextEdits[row.row] && (segment !== 'low' || isLowConfidence(row))
    );
    const after = remaining.find(row => row.row > current.row) || remaining[0];
    if (segment === 'reviewed') move(1);
    else setCurrentRow(after ? after.row : null);
  }, [current, picked, edits, rows, segment, move]);

  const addTheme = useCallback(() => {
    const label = newLabel.trim();
    if (!label) return;
    const id = newCodeId(
      label,
      codes.map(code => code.id)
    );
    setCodes(list => [...list, { id, label, definition: '', keywords: [label], examples: [] }]);
    setPicked(list => [...list, id]);
    setNewLabel('');
    setAdding(false);
  }, [newLabel, codes]);

  useEffect(() => {
    if (phase !== 'ready' || saving) return;
    const onKey = (event: KeyboardEvent) => {
      if (isTyping(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (/^[1-9]$/.test(key)) {
        const code = codes[Number(key) - 1];
        if (code && current) {
          event.preventDefault();
          toggle(code.id);
        }
      } else if (key === 'j') {
        event.preventDefault();
        move(1);
      } else if (key === 'k') {
        event.preventDefault();
        move(-1);
      } else if (key === 'n') {
        event.preventDefault();
        setAdding(true);
        window.setTimeout(() => newInput.current?.focus(), 0);
      } else if (key === 'enter') {
        event.preventDefault();
        saveAndNext();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, saving, codes, current, toggle, move, saveAndNext]);

  async function finish() {
    if (!Object.keys(edits).length) {
      onDone();
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      const cells: unknown[] = [];
      for (let offset = 0; ; offset += PAGE) {
        const params = new URLSearchParams({
          limit: String(PAGE),
          offset: String(offset),
          show_value_labels: 'false',
          slim: 'true',
        });
        const page = await flowJson<PreviewPage>(`/datasets/${datasetId}/preview?${params}`);
        const at = (page.variable_names || []).indexOf(codeColumn);
        if (at < 0) throw new Error('That coded column is no longer in this file.');
        for (const line of page.rows || []) cells.push(line[at]);
        if (!page.truncated || !(page.rows || []).length) break;
      }
      const overrides = buildOverrides(cells, edits);
      let jobId: string | null = null;
      for (;;) {
        const applied: Record<string, unknown> = await flowJson(
          `/datasets/${datasetId}/open-end/apply`,
          {
            method: 'POST',
            body: JSON.stringify({
              text_column: textColumn,
              codes: codesForApply(codes),
              overrides,
              use_model: false,
              job_id: jobId,
            }),
          }
        );
        if (applied.done) {
          const nextId = String(applied.derived_dataset_id || '');
          if (!nextId) throw new Error('The themes were saved but no new version came back.');
          onDone({ datasetId: nextId, codeColumn: String(applied.code_column || codeColumn) });
          return;
        }
        if (!applied.job_id) throw new Error('Saving stopped before it finished.');
        jobId = String(applied.job_id);
      }
    } catch (err) {
      setSaveError(apiMessage(err, 'Your themes were not saved. Try again.'));
      setSaving(false);
    }
  }

  const position = current ? listed.findIndex(row => row.row === current.row) : -1;
  const segments: { value: Segment; label: string }[] = [
    { value: 'none', label: `No theme · ${open.length}` },
    ...(hasLow ? [{ value: 'low' as const, label: `Low confidence · ${low.length}` }] : []),
    { value: 'reviewed', label: `Reviewed · ${reviewed.length}` },
  ];

  return (
    <div className="cr">
      <div className="cr-bar">
        <div className="cr-bar-left">
          <span className="cr-crumb">Themes ›</span>
          <span className="cr-title">Review uncoded answers · {textColumn}</span>
          {phase === 'ready' ? <span className="cr-left">{left} left</span> : null}
        </div>
        <div className="cr-bar-right">
          <span className="cr-keys">J / K to move · 1–9 to pick a theme · N for new</span>
          <Button className="cr-btn" type="button" disabled={saving} onClick={() => onDone()}>
            Skip for now
          </Button>
          <Button
            className="cr-btn cr-primary"
            type="button"
            disabled={phase !== 'ready' || saving}
            onClick={() => void finish()}
          >
            {saving ? 'Updating tables…' : 'Done · update tables'}
          </Button>
        </div>
      </div>

      {phase === 'loading' ? (
        <div className="cr-body" aria-busy="true">
          <div className="cr-list">
            <Skeleton className="cr-skel-tabs" />
            {[0, 1, 2, 3, 4].map(index => (
              <div className="cr-skel-item" key={index}>
                <Skeleton className="cr-skel-line" />
                <Skeleton className="cr-skel-meta" />
              </div>
            ))}
          </div>
          <div className="cr-pane">
            <Skeleton className="cr-skel-meta" />
            <Skeleton className="cr-skel-answer" />
            <div className="cr-chips">
              {[0, 1, 2, 3, 4, 5].map(index => (
                <Skeleton className="cr-skel-chip" key={index} />
              ))}
            </div>
          </div>
        </div>
      ) : phase === 'error' ? (
        <div className="cr-empty">
          <p className="cr-error">{loadError}</p>
        </div>
      ) : !rows.length ? (
        <div className="cr-empty">
          <p className="cr-empty-title">Every answer has a theme</p>
          <p className="cr-muted">There is nothing left to review in {textColumn}.</p>
        </div>
      ) : (
        <div className="cr-body">
          <div className="cr-list">
            <Segmented
              className="cr-tabs"
              aria-label="Which answers"
              value={segment}
              onValueChange={value => {
                setSegment(value);
                const first =
                  value === 'reviewed' ? reviewed[0] : value === 'low' ? low[0] : open[0];
                setCurrentRow(first ? first.row : null);
              }}
              options={segments}
            />
            <div className="cr-items">
              {listed.map(row => (
                <Button
                  key={row.row}
                  type="button"
                  className="cr-item"
                  data-active={row.row === currentRow}
                  onClick={() => setCurrentRow(row.row)}
                >
                  <span className="cr-item-text">“{row.text || '(blank)'}”</span>
                  <span className="cr-item-meta">
                    {respondentLabel(row)}
                    {edits[row.row] ? ` · ${edits[row.row].map(labelFor).join(', ')}` : ''}
                  </span>
                </Button>
              ))}
              {!listed.length ? (
                <p className="cr-muted cr-list-empty">
                  {segment === 'reviewed' ? 'Nothing reviewed yet.' : 'Nothing left here.'}
                </p>
              ) : null}
              {totalUncoded > rows.length && segment === 'none' ? (
                <p className="cr-muted cr-list-empty">
                  Showing the first {rows.length.toLocaleString()} of{' '}
                  {totalUncoded.toLocaleString()}.
                </p>
              ) : null}
            </div>
          </div>

          <div className="cr-pane">
            {current ? (
              <>
                <div className="cr-answer">
                  <span className="cr-muted cr-small">
                    {respondentLabel(current)}
                    {position >= 0 ? ` · ${position + 1} of ${listed.length}` : ''}
                  </span>
                  <p className="cr-answer-text">“{current.text || '(blank)'}”</p>
                </div>

                {current.suggested.length ? (
                  <div className="cr-suggest">
                    <span className="cr-suggest-title">Suggested</span>
                    <span className="cr-muted">
                      Closest match: {current.suggested.map(labelFor).join(', ')}
                      {current.confidence != null ? ` (${current.confidence.toFixed(2)})` : ''}. It
                      was not sure enough to apply it on its own.
                    </span>
                    <div>
                      <Button
                        type="button"
                        className="cr-btn cr-primary cr-btn-sm"
                        onClick={() =>
                          setPicked(
                            current.suggested.filter(id => codes.some(code => code.id === id))
                          )
                        }
                      >
                        Use {current.suggested.length > 1 ? 'these' : 'this'}
                      </Button>
                    </div>
                  </div>
                ) : null}

                <div className="cr-pick">
                  <span className="cr-pick-label">
                    {current.suggested.length
                      ? 'Or pick one or more themes'
                      : 'Pick one or more themes'}
                  </span>
                  <div className="cr-chips">
                    {codes.map((code, index) => {
                      const on = picked.includes(code.id);
                      return (
                        <Button
                          key={code.id}
                          type="button"
                          className="cr-chip"
                          data-active={on}
                          aria-pressed={on}
                          onClick={() => toggle(code.id)}
                        >
                          {index < 9 ? <span className="cr-chip-key">{index + 1}</span> : null}
                          <span>
                            {code.label}
                            {on ? ' ✓' : ''}
                          </span>
                        </Button>
                      );
                    })}
                    {adding ? (
                      <span className="cr-new">
                        <Input
                          ref={newInput}
                          className="cr-new-input"
                          aria-label="New theme name"
                          placeholder="Name the theme"
                          value={newLabel}
                          onChange={event => setNewLabel(event.target.value)}
                          onKeyDown={event => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              addTheme();
                            } else if (event.key === 'Escape') {
                              setAdding(false);
                              setNewLabel('');
                            }
                          }}
                        />
                        <Button
                          type="button"
                          className="cr-btn cr-btn-sm"
                          disabled={!newLabel.trim()}
                          onClick={addTheme}
                        >
                          Add
                        </Button>
                      </span>
                    ) : (
                      <Button
                        type="button"
                        className="cr-chip cr-chip-new"
                        onClick={() => {
                          setAdding(true);
                          window.setTimeout(() => newInput.current?.focus(), 0);
                        }}
                      >
                        <span className="cr-chip-key">N</span>
                        <span>New theme…</span>
                      </Button>
                    )}
                  </div>
                </div>

                <div className="cr-foot">
                  <span className="cr-muted cr-small">
                    {saveError ? (
                      <span className="cr-error">{saveError}</span>
                    ) : (
                      'Tables and Evidence update when you press Done. Until then the base stays answered-and-coded.'
                    )}
                  </span>
                  <Button
                    type="button"
                    className="cr-btn cr-primary"
                    disabled={!picked.length || saving}
                    onClick={saveAndNext}
                  >
                    Save and next ↵
                  </Button>
                </div>
              </>
            ) : (
              <div className="cr-empty">
                <p className="cr-empty-title">
                  {segment === 'reviewed' ? 'Pick an answer to change it' : 'All done here'}
                </p>
                <p className="cr-muted">
                  {reviewed.length
                    ? `Press Done to save ${reviewed.length} reviewed ${reviewed.length === 1 ? 'answer' : 'answers'} and update the tables.`
                    : 'Choose an answer on the left.'}
                </p>
                {saveError ? <p className="cr-error">{saveError}</p> : null}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
