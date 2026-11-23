'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { flowJson } from '@/lib/flow-api';
import {
  CODEFRAME_IMPORT_MODES,
  codeframeImportSummary,
  codesForImportMode,
  shouldUseImportFrameApply,
  textColumnFromCodeColumn,
  type CodeframeImportMode,
  type CodeframeImportParsed,
  type CodeframeTheme,
} from '@/lib/codeframe-import';

type CodeRow = { id: string; label: string; count: number };

function rowsFrom(values: string[]): { codes: CodeRow[]; blank: number } {
  const counts = new Map<string, number>();
  let blank = 0;
  for (const value of values) {
    const text = value.trim();
    if (!text || text === '—') {
      blank += 1;
      continue;
    }
    // Multi-response cells are pipe-joined; count each theme once per respondent.
    const parts = [
      ...new Set(
        text
          .split('|')
          .map(part => part.trim())
          .filter(Boolean)
      ),
    ];
    if (!parts.length) {
      blank += 1;
      continue;
    }
    for (const part of parts) {
      counts.set(part, (counts.get(part) || 0) + 1);
    }
  }
  const codes = [...counts.entries()]
    .map(([label, count]) => ({ id: label, label, count }))
    .sort((a, b) => b.count - a.count);
  return { codes, blank };
}

async function pollApply(
  datasetId: string,
  body: Record<string, unknown>
): Promise<{ datasetId: string; codeColumn: string }> {
  let jobId: string | null = null;
  for (;;) {
    const applied: Record<string, unknown> = await flowJson(
      `/datasets/${datasetId}/open-end/apply`,
      {
        method: 'POST',
        body: JSON.stringify({ ...body, job_id: jobId }),
      }
    );
    if (applied.done) {
      const nextId = String(applied.derived_dataset_id || '');
      if (!nextId) throw new Error('The themes were saved but no new version came back.');
      return {
        datasetId: nextId,
        codeColumn: String(applied.code_column || ''),
      };
    }
    if (!applied.job_id) throw new Error('Coding stopped before it finished.');
    jobId = String(applied.job_id);
  }
}

export function CodeFrameRail({
  datasetId,
  column,
  title,
  question = '',
  textColumn: textColumnProp,
  values,
  texts = [],
  onFilter,
  onUseAsBanner,
  onApplied,
}: {
  datasetId?: string;
  column: string;
  title: string;
  question?: string;
  /** Verbatim column when the coded name is not `*_codes` / `*_themes`. */
  textColumn?: string;
  values: string[];
  texts?: string[];
  onFilter?: (value: string) => void;
  onUseAsBanner?: () => void;
  onApplied?: (datasetId: string) => void;
}) {
  const [{ codes, blank }, setFrame] = useState(() => rowsFrom(values));
  const [selected, setSelected] = useState<string[]>([]);
  const [openId, setOpenId] = useState(codes[0]?.id || '');
  const [rename, setRename] = useState('');
  const [split, setSplit] = useState<{ left: string; right: string } | null>(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [importPreview, setImportPreview] = useState<{
    filename: string;
    parsed: CodeframeImportParsed;
  } | null>(null);
  const [importMode, setImportMode] = useState<CodeframeImportMode>('replace');
  const fileRef = useRef<HTMLInputElement>(null);
  const signature = `${column}\n${values.join('\n')}`;
  useEffect(() => {
    const next = rowsFrom(values);
    setFrame(next);
    setOpenId(next.codes[0]?.id || '');
    setSelected([]);
    setRename('');
    setSplit(null);
    setError('');
    setImportPreview(null);
    setImportMode('replace');
  }, [signature]);
  const total = values.length || 1;
  const textColumn = String(textColumnProp || '').trim() || textColumnFromCodeColumn(column);
  const headTitle = `${title || textColumn} · ${codes.length} theme${
    codes.length === 1 ? '' : 's'
  }`;

  const toggle = (id: string, checked: boolean) => {
    setSelected(current => (checked ? [...current, id] : current.filter(item => item !== id)));
  };

  const edit = async (body: Record<string, unknown>): Promise<void> => {
    if (!datasetId) throw new Error('Open a dataset before editing the frame.');
    await flowJson(`/datasets/${datasetId}/open-end/frame`, {
      method: 'POST',
      body: JSON.stringify({ code_column: column, ...body }),
    });
  };

  const percent = (count: number) => `${Math.round((count / total) * 100)}%`;

  async function loadCurrentThemes(): Promise<CodeframeTheme[]> {
    if (!datasetId) return codes.map(row => ({ id: row.id, label: row.label }));
    try {
      const body = await flowJson<{
        document?: { codes?: CodeframeTheme[] };
      }>(`/datasets/${datasetId}/open-end/export-frame?code_column=${encodeURIComponent(column)}`);
      const stored = body.document?.codes;
      if (Array.isArray(stored) && stored.length) return stored;
    } catch {
      // Fall back to labels shown in the rail.
    }
    return codes.map(row => ({ id: row.id, label: row.label }));
  }

  async function onPickFile(file: File | null) {
    if (!file || !datasetId) return;
    setBusy(true);
    setError('');
    setNote('');
    try {
      const content = await file.text();
      const parsed = await flowJson<CodeframeImportParsed>(
        `/datasets/${datasetId}/open-end/import-frame`,
        {
          method: 'POST',
          body: JSON.stringify({
            content,
            filename: file.name,
            apply: false,
          }),
        }
      );
      if (!Array.isArray(parsed.codes) || !parsed.codes.length) {
        throw new Error('No themes were found in that codeframe.');
      }
      setImportPreview({ filename: file.name, parsed });
    } catch (err) {
      setImportPreview(null);
      setError(err instanceof Error ? err.message : 'Could not read that codeframe');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function applyImport(mode: CodeframeImportMode) {
    if (!datasetId || !importPreview || busy) return;
    setImportMode(mode);
    setBusy(true);
    setError('');
    setNote('');
    try {
      const current = await loadCurrentThemes();
      const imported = importPreview.parsed.codes;
      const text = String(importPreview.parsed.source_text_column || '').trim() || textColumn;
      if (shouldUseImportFrameApply(mode)) {
        let jobId: string | null = null;
        for (;;) {
          const result: {
            applied?: { done?: unknown; derived_dataset_id?: unknown; job_id?: unknown };
          } = await flowJson(`/datasets/${datasetId}/open-end/import-frame`, {
            method: 'POST',
            body: JSON.stringify({
              frame: importPreview.parsed.document || {
                codes: imported,
                assignments: importPreview.parsed.assignments || [],
                source_text_column: text,
              },
              filename: importPreview.filename,
              text_column: text,
              apply: true,
              use_model: false,
              job_id: jobId,
            }),
          });
          const applied = result.applied ?? {};
          if (applied.done) {
            const nextId = String(applied.derived_dataset_id || '');
            if (!nextId) throw new Error('The themes were saved but no new version came back.');
            setImportPreview(null);
            onApplied?.(nextId);
            return;
          }
          if (!applied.job_id) throw new Error('Coding stopped before it finished.');
          jobId = String(applied.job_id);
        }
      }
      const frame = codesForImportMode(mode, imported, current);
      const saved = await pollApply(datasetId, {
        text_column: text,
        codes: frame,
        use_model: false,
      });
      setImportPreview(null);
      onApplied?.(saved.datasetId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not apply that codeframe');
    } finally {
      setBusy(false);
    }
  }

  async function exportFrame() {
    if (!datasetId || busy) return;
    setBusy(true);
    setError('');
    setNote('');
    try {
      const body = await flowJson<{ document?: Record<string, unknown> }>(
        `/datasets/${datasetId}/open-end/export-frame?code_column=${encodeURIComponent(column)}`
      );
      const document = body.document;
      if (!document) throw new Error('That column has no saved codeframe');
      const blob = new Blob([JSON.stringify(document, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement('a');
      anchor.href = url;
      anchor.download = `${textColumn || column}-codeframe.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setNote('Codeframe downloaded.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not export the codeframe');
    } finally {
      setBusy(false);
    }
  }

  const importSummary = importPreview
    ? codeframeImportSummary(
        importPreview.parsed,
        codes.map(row => ({ id: row.id, label: row.label }))
      )
    : '';

  return (
    <div className="code-frame">
      <div className="code-frame-head">
        <p className="flow-muted">
          Open end · coded · {codes.length} theme{codes.length === 1 ? '' : 's'}
        </p>
        <div className="code-frame-head-row">
          <h2>{headTitle}</h2>
          <div className="code-frame-head-actions">
            <Button
              type="button"
              className="code-frame-tool"
              disabled={!datasetId || busy}
              onClick={() => fileRef.current?.click()}
            >
              Import client codeframe
            </Button>
            <Button
              type="button"
              className="code-frame-tool"
              disabled={!datasetId || busy}
              onClick={() => void exportFrame()}
            >
              Export codeframe
            </Button>
            <Input
              ref={fileRef}
              className="sr-only"
              type="file"
              accept=".json,.csv,.tsv,application/json,text/csv,text/tab-separated-values"
              aria-label="Client codeframe file"
              onChange={event => void onPickFile(event.target.files?.[0] || null)}
            />
          </div>
        </div>
        {question && question !== title ? <p className="flow-muted">{question}</p> : null}
      </div>

      {importPreview ? (
        <div className="code-frame-import" aria-busy={busy}>
          <p className="code-frame-import-title">Import · {importPreview.filename}</p>
          <p className="code-frame-import-summary">{importSummary}</p>
          <div className="code-frame-import-modes">
            {CODEFRAME_IMPORT_MODES.map(mode => (
              <Button
                key={mode.id}
                type="button"
                className="code-frame-import-mode"
                data-active={importMode === mode.id ? true : undefined}
                disabled={busy}
                onClick={() => void applyImport(mode.id)}
              >
                {mode.label}
              </Button>
            ))}
          </div>
          <p className="code-frame-import-note">
            CSV or JSON: code, label, net. Pre-coded answers (respondent, code) are kept as they
            are.
          </p>
        </div>
      ) : null}

      <div className="code-frame-meta">
        <span>Code frame</span>
        <span>% of {values.length}</span>
      </div>
      <div className="code-frame-list">
        {codes.map(code => {
          const checked = selected.includes(code.id);
          const open = openId === code.id;
          return (
            <div key={code.id} className={open ? 'code-frame-open' : undefined}>
              <div className={checked ? 'code-frame-row is-on' : 'code-frame-row'}>
                <Checkbox
                  checked={checked}
                  aria-label={code.label}
                  onCheckedChange={value => toggle(code.id, value === true)}
                />
                <Button
                  type="button"
                  className="code-frame-name"
                  onClick={() => setOpenId(open ? '' : code.id)}
                >
                  {open ? <span className="code-frame-caret">▾</span> : null}
                  {code.label}
                </Button>
                <span>{percent(code.count)}</span>
              </div>
              {open ? (
                <div className="code-frame-detail">
                  <div className="code-frame-track">
                    <i style={{ width: percent(code.count) }} />
                  </div>
                  {values
                    .map((value, index) => ({ value, text: texts[index] || '' }))
                    .filter(
                      item =>
                        item.text.trim() &&
                        item.value
                          .split('|')
                          .map(part => part.trim())
                          .includes(code.label)
                    )
                    .filter(
                      (item, index, list) =>
                        list.findIndex(other => other.text.trim() === item.text.trim()) === index
                    )
                    .slice(0, 2)
                    .map(item => (
                      <p key={item.text} className="code-frame-quote">
                        “{item.text.trim()}”
                      </p>
                    ))}
                  <div className="code-frame-actions">
                    <Button type="button" onClick={() => onFilter?.(code.label)}>
                      See all {code.count}
                    </Button>
                    <Button type="button" onClick={() => setRename(code.label)}>
                      Rename
                    </Button>
                    <Button type="button" onClick={() => setSplit({ left: '', right: '' })}>
                      Split
                    </Button>
                  </div>
                  {rename && openId === code.id ? (
                    <form
                      onSubmit={event => {
                        event.preventDefault();
                        setError('');
                        void edit({ action: 'rename', code_id: code.id, label: rename })
                          .then(() => {
                            setFrame(current => ({
                              ...current,
                              codes: current.codes.map(item =>
                                item.id === code.id ? { ...item, label: rename } : item
                              ),
                            }));
                            setRename('');
                          })
                          .catch(err =>
                            setError(err instanceof Error ? err.message : 'Rename failed')
                          );
                      }}
                    >
                      <Input
                        aria-label={`Rename ${code.label}`}
                        value={rename}
                        onChange={event => setRename(event.target.value)}
                      />
                      <Button type="submit">Save</Button>
                    </form>
                  ) : null}
                  {split && openId === code.id ? (
                    <form
                      onSubmit={event => {
                        event.preventDefault();
                        const left = split.left.trim();
                        const right = split.right.trim();
                        if (!left || !right) return;
                        setError('');
                        void edit({
                          action: 'split',
                          code_id: code.id,
                          parts: [
                            { id: left, label: left, keywords: [left.toLowerCase()] },
                            { id: right, label: right, keywords: [right.toLowerCase()] },
                          ],
                        })
                          .then(() => {
                            setFrame(current => ({
                              ...current,
                              codes: current.codes.flatMap(item =>
                                item.id === code.id
                                  ? [
                                      { id: left, label: left, count: item.count },
                                      { id: right, label: right, count: 0 },
                                    ]
                                  : [item]
                              ),
                            }));
                            setSplit(null);
                          })
                          .catch(err =>
                            setError(err instanceof Error ? err.message : 'Split failed')
                          );
                      }}
                    >
                      <Input
                        aria-label="First theme"
                        value={split.left}
                        onChange={event => setSplit({ ...split, left: event.target.value })}
                      />
                      <Input
                        aria-label="Second theme"
                        value={split.right}
                        onChange={event => setSplit({ ...split, right: event.target.value })}
                      />
                      <Button type="submit">Split</Button>
                    </form>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
        {blank ? (
          <p className="code-frame-blank">
            <span>Not coded yet</span>
            <span>{blank} · Review</span>
          </p>
        ) : null}
      </div>
      {error ? <p className="flow-error">{error}</p> : null}
      {note ? <p className="flow-muted">{note}</p> : null}
      {selected.length ? (
        <div className="code-frame-bar">
          <span>
            {selected.length} theme{selected.length === 1 ? '' : 's'} selected
          </span>
          <Button
            type="button"
            disabled={selected.length < 2}
            onClick={() => {
              const [into, ...rest] = selected;
              setError('');
              void rest
                .reduce(
                  (chain, codeId) =>
                    chain.then(() => edit({ action: 'merge', code_id: codeId, into })),
                  Promise.resolve()
                )
                .then(() => {
                  setFrame(current => ({
                    ...current,
                    codes: current.codes.filter(code => !rest.includes(code.id)),
                  }));
                  setSelected([into]);
                })
                .catch(err => setError(err instanceof Error ? err.message : 'Merge failed'));
            }}
          >
            Merge
          </Button>
          <Button type="button" onClick={() => setSelected([])}>
            Clear
          </Button>
        </div>
      ) : null}
      <div className="code-frame-foot">
        <Button type="button" onClick={() => onUseAsBanner?.()}>
          Use as banner
        </Button>
        <Button type="button" onClick={() => setNote('Recode another wave from Interviews.')}>
          Recode
        </Button>
      </div>
    </div>
  );
}
