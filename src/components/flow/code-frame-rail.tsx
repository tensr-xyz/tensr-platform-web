'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { flowJson } from '@/lib/flow-api';

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
    counts.set(text, (counts.get(text) || 0) + 1);
  }
  const codes = [...counts.entries()]
    .map(([label, count]) => ({ id: label, label, count }))
    .sort((a, b) => b.count - a.count);
  return { codes, blank };
}

export function CodeFrameRail({
  datasetId,
  column,
  title,
  values,
  onFilter,
  onUseAsBanner,
}: {
  datasetId?: string;
  column: string;
  title: string;
  values: string[];
  onFilter?: (value: string) => void;
  onUseAsBanner?: () => void;
}) {
  const [{ codes, blank }, setFrame] = useState(() => rowsFrom(values));
  const [selected, setSelected] = useState<string[]>([]);
  const [openId, setOpenId] = useState(codes[0]?.id || '');
  const [rename, setRename] = useState('');
  const [split, setSplit] = useState<{ left: string; right: string } | null>(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const signature = `${column}\n${values.join('\n')}`;
  useEffect(() => {
    const next = rowsFrom(values);
    setFrame(next);
    setOpenId(next.codes[0]?.id || '');
    setSelected([]);
    setRename('');
    setSplit(null);
    setError('');
  }, [signature]);
  const total = values.length || 1;

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

  return (
    <div className="code-frame">
      <div className="code-frame-head">
        <p className="flow-muted">
          Open end · coded · {codes.length} theme{codes.length === 1 ? '' : 's'}
        </p>
        <h2>{title}</h2>
        <p className="flow-muted">On this page</p>
      </div>
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
                  {code.label}
                </Button>
                <span>{percent(code.count)}</span>
              </div>
              {open ? (
                <div className="code-frame-detail">
                  <div className="code-frame-track">
                    <i style={{ width: percent(code.count) }} />
                  </div>
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
        <Button
          type="button"
          onClick={() => {
            const blob = new Blob([JSON.stringify({ column, codes, blank }, null, 2)], {
              type: 'application/json',
            });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = `${column}-frame.json`;
            anchor.click();
            URL.revokeObjectURL(url);
          }}
        >
          Export frame
        </Button>
      </div>
    </div>
  );
}
