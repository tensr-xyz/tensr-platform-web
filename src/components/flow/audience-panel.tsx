'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { tensrApiUrl } from '@/lib/tensr-api-url';
import { getTensrApiHeaders } from '@/utils/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { FlowColumn } from '@/lib/flow-columns';
import { projectQueryKeys } from '@/lib/project-query-cache';
import { useDatasetAudiences, type DatasetAudiencesPayload } from '@/hooks/api/use-project-data';
import {
  answerOptions,
  audienceDefinitionText,
  audienceFilter,
  audienceQuestions,
  conditionsFromFilter,
  isScale,
  questionCode,
  questionLabel,
  type AudienceCombine,
  type AudienceCondition,
} from './audience-filter';

export type SavedAudience = {
  name: string;
  label: string;
  description?: string;
  filter?: { combine?: string; filters?: unknown[] };
  n?: number;
  n_total?: number;
  share?: number;
  weighted_share?: number | null;
  projected_people?: number | null;
};

type Size = {
  n: number;
  n_total: number;
  share: number;
  weighted_share?: number | null;
  projected_people?: number | null;
};

type Props = {
  datasetId: string;
  columns: FlowColumn[];
  canEdit?: boolean;
};

const BLANK: AudienceCondition = { column: '', op: '=', value: '', exclude: false };
const LOW_BASE = 50;

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function counted(value: unknown): number | null {
  const number =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(number) ? number : null;
}

function peopleCount(value: number): string {
  return new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 }).format(Math.round(value));
}

function shareOf(size: { share?: number; weighted_share?: number | null }): number | null {
  if (typeof size.weighted_share === 'number') return size.weighted_share;
  if (typeof size.share === 'number') return size.share;
  return null;
}

function Definition({ text }: { text: string }) {
  const parts = text.split(/( and | or )/g);
  return (
    <span className="audience-definition">
      {parts.map((part, index) => {
        if (part === ' and ' || part === ' or ') {
          return (
            <span key={index}>
              {' '}
              <span className="audience-join">{part.trim()}</span>{' '}
            </span>
          );
        }
        const match = part.match(/^(Q\d+)\s+(.+?)\s+(is|includes any)\s+(.+)$/i);
        if (match) {
          return (
            <span key={index}>
              <span className="audience-def-muted">{match[1]}</span> {match[2]}{' '}
              <span className="audience-def-muted">{match[3]}</span> {match[4]}
            </span>
          );
        }
        const plain = part.match(/^(.+?)\s+(is|includes any)\s+(.+)$/i);
        if (plain) {
          return (
            <span key={index}>
              {plain[1]} <span className="audience-def-muted">{plain[2]}</span> {plain[3]}
            </span>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </span>
  );
}

function QuestionSearch({
  columns,
  onPick,
}: {
  columns: FlowColumn[];
  onPick: (name: string) => void;
}) {
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const matches = needle
    ? columns.filter(column => questionLabel(column).toLowerCase().includes(needle))
    : [];
  return (
    <div className="audience-search">
      <Input
        aria-label="Add a question, search by label"
        placeholder="+ Add a question · search by label"
        value={query}
        onChange={event => setQuery(event.target.value)}
      />
      {needle ? (
        <div className="audience-search-list">
          {matches.map(column => (
            <Button
              key={column.name}
              type="button"
              className="flow-btn audience-search-hit"
              onClick={() => {
                onPick(column.name);
                setQuery('');
              }}
            >
              {[questionCode(column), questionLabel(column)].filter(Boolean).join(' ')}
            </Button>
          ))}
          {matches.length === 0 ? <p className="flow-muted">No question with that label.</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function ValueChoices({
  column,
  selected,
  onToggle,
}: {
  column: FlowColumn;
  selected: string[];
  onToggle: (code: string) => void;
}) {
  const options = answerOptions(column);
  const numbers = isScale(options) && options.every(option => option.label === option.code);
  return (
    <div className={numbers ? 'audience-scale' : 'audience-pills'}>
      {options.map(option => {
        const on = selected.includes(option.code);
        return (
          <Button
            key={option.code}
            type="button"
            aria-pressed={on}
            className={on ? 'audience-choice on' : 'audience-choice'}
            onClick={() => onToggle(option.code)}
          >
            {numbers ? option.label : on ? `✓ ${option.label}` : option.label}
          </Button>
        );
      })}
    </div>
  );
}

export function AudiencePanel({ datasetId, columns, canEdit = true }: Props) {
  const questions = audienceQuestions(columns);
  const queryClient = useQueryClient();
  const audiencesQuery = useDatasetAudiences(datasetId);
  const audiences = audiencesQuery.isPending
    ? null
    : ((audiencesQuery.data?.audiences || []) as SavedAudience[]);
  const unmatched = (audiencesQuery.data?.unmatched || [])
    .map(item => String(item || '').trim())
    .filter(Boolean);
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [combine, setCombine] = useState<AudienceCombine>('and');
  const [conditions, setConditions] = useState<AudienceCondition[]>([{ ...BLANK }]);
  const [editing, setEditing] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [size, setSize] = useState<Size | null>(null);
  const [sizeFailed, setSizeFailed] = useState(false);

  useEffect(() => {
    if (audiencesQuery.isError) {
      setError('Audiences could not be loaded.');
    }
  }, [audiencesQuery.isError]);

  const writeAudiencesCache = (page: DatasetAudiencesPayload) => {
    queryClient.setQueryData(projectQueryKeys.audiences(datasetId), page);
  };

  const filter = audienceFilter(combine, conditions);
  const filterKey = JSON.stringify(filter);

  useEffect(() => {
    const body = JSON.parse(filterKey) as { filters?: unknown[] };
    if (!open || !datasetId || !body.filters?.length) {
      setSize(null);
      setSizeFailed(false);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      void fetch(tensrApiUrl(`/datasets/${datasetId}/audiences/preview`), {
        method: 'POST',
        headers: getTensrApiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ filter: body }),
      })
        .then(async response => {
          if (!response.ok) throw new Error('The size could not be counted.');
          return response.json() as Promise<Size>;
        })
        .then(page => {
          if (!cancelled) {
            setSize(page);
            setSizeFailed(false);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setSize(null);
            setSizeFailed(true);
          }
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, datasetId, filterKey]);

  const reset = () => {
    setLabel('');
    setDescription('');
    setCombine('and');
    setConditions([{ ...BLANK }]);
    setEditing('');
    setOpen(false);
    setSize(null);
  };

  const save = () => {
    if (!label.trim() || !description.trim() || !filter.filters.length) {
      setError('An audience needs a name, a description, and at least one condition.');
      return;
    }
    setBusy(true);
    setError(null);
    const body: Record<string, unknown> = {
      name: label.trim(),
      label: label.trim(),
      description: description.trim(),
      filter,
    };
    if (editing && editing !== label.trim()) body.replaces = editing;
    void fetch(tensrApiUrl(`/datasets/${datasetId}/audiences`), {
      method: 'POST',
      headers: getTensrApiHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    })
      .then(async response => {
        if (!response.ok) throw new Error('The audience was not saved.');
        return response.json() as Promise<SavedAudience>;
      })
      .then(saved => {
        const rest = (audiences || []).filter(
          item => item.name !== saved.name && item.name !== editing
        );
        writeAudiencesCache({
          audiences: [
            ...rest,
            {
              ...saved,
              description: saved.description || description.trim(),
              n: size?.n,
              n_total: size?.n_total,
              share: size?.share,
              weighted_share: size?.weighted_share,
            },
          ],
          unmatched,
        });
        reset();
      })
      .catch(() => setError('The audience was not saved.'))
      .finally(() => setBusy(false));
  };

  const remove = (name: string) => {
    setBusy(true);
    setError(null);
    void fetch(tensrApiUrl(`/datasets/${datasetId}/audiences/${encodeURIComponent(name)}`), {
      method: 'DELETE',
      headers: getTensrApiHeaders(),
    })
      .then(response => {
        if (!response.ok) throw new Error('The audience was not deleted.');
        writeAudiencesCache({
          audiences: (audiences || []).filter(item => item.name !== name),
          unmatched,
        });
        reset();
      })
      .catch(() => setError('The audience was not deleted.'))
      .finally(() => setBusy(false));
  };

  const edit = (audience: SavedAudience) => {
    const stored = conditionsFromFilter(audience.filter);
    setEditing(audience.name);
    setLabel(audience.label || audience.name);
    setDescription(audience.description || '');
    setCombine(stored.combine);
    const labelled = new Set(questions.map(column => column.name));
    setConditions(
      stored.conditions.flatMap(condition => {
        if (condition.group) {
          const group = condition.group.filter(item => labelled.has(item.column));
          return group.length ? [{ ...condition, group }] : [];
        }
        return labelled.has(condition.column) ? [condition] : [];
      })
    );
    setError(null);
    setOpen(true);
  };

  const used = new Set(
    conditions.flatMap(condition =>
      condition.group ? condition.group.map(item => item.column) : [condition.column]
    )
  );
  const remaining = questions.filter(column => !used.has(column.name));

  const setValues = (index: number, groupIndex: number | null, code: string) => {
    setConditions(current =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        const target = groupIndex === null ? item : item.group?.[groupIndex];
        if (!target) return item;
        const values = target.values?.length
          ? [...target.values]
          : target.value
            ? [target.value]
            : [];
        const nextValues = values.includes(code)
          ? values.filter(value => value !== code)
          : [...values, code];
        const next = { ...target, value: nextValues[0] || '', values: nextValues };
        if (groupIndex === null) return next;
        return {
          ...item,
          group: item.group?.map((child, childIndex) => (childIndex === groupIndex ? next : child)),
        };
      })
    );
  };

  const renderCondition = (
    condition: AudienceCondition,
    index: number,
    groupIndex: number | null
  ) => {
    const column = questions.find(item => item.name === condition.column);
    if (!column) return null;
    const values = condition.values?.length
      ? condition.values
      : condition.value
        ? [condition.value]
        : [];
    const operator = values.length > 1 ? 'includes any' : 'is';
    return (
      <div
        key={`${index}-${groupIndex ?? 'top'}-${condition.column}`}
        className="audience-condition"
      >
        <div className="audience-condition-head">
          <span className="audience-q">{questionCode(column)}</span>
          <span className="audience-q-label">{questionLabel(column)}</span>
          <span className="audience-op">{operator}</span>
          <Button
            type="button"
            className="flow-btn audience-remove"
            aria-label={`Remove ${questionLabel(column)}`}
            onClick={() => {
              if (groupIndex === null) {
                setConditions(current => current.filter((_, itemIndex) => itemIndex !== index));
                return;
              }
              setConditions(current =>
                current.map((item, itemIndex) =>
                  itemIndex === index
                    ? {
                        ...item,
                        group: item.group?.filter((_, childIndex) => childIndex !== groupIndex),
                      }
                    : item
                )
              );
            }}
          >
            ×
          </Button>
        </div>
        <ValueChoices
          column={column}
          selected={values}
          onToggle={code => setValues(index, groupIndex, code)}
        />
      </div>
    );
  };

  const liveShare = size ? shareOf(size) : null;
  const typed = label.trim();

  return (
    <section className="details-audiences" aria-label="Audiences">
      <header className="audience-head">
        <div>
          <div className="audience-count">Audiences · {audiences ? audiences.length : '…'}</div>
          <p>Ask for an audience by name in chat and every answer uses this exact definition.</p>
        </div>
        {canEdit ? (
          <Button
            type="button"
            className="flow-btn"
            onClick={() => {
              setEditing('');
              setLabel('');
              setDescription('');
              setCombine('and');
              setConditions([]);
              setError(null);
              setOpen(true);
            }}
          >
            + New audience
          </Button>
        ) : null}
      </header>
      {unmatched.length ? (
        <p className="audience-unmatched" role="status">
          Did not carry to this file: {unmatched.join(', ')}.
        </p>
      ) : null}
      {audiences === null ? <p className="flow-muted">Loading audiences.</p> : null}
      {audiences && audiences.length === 0 ? <p className="flow-muted">No audiences yet.</p> : null}
      {audiences && audiences.length > 0 ? (
        <ul className="audience-list">
          {audiences.map(audience => {
            const n = counted(audience.n);
            const low = n != null && n < LOW_BASE;
            const share = shareOf(audience);
            const people = counted(audience.projected_people);
            const definition = audienceDefinitionText(audience.filter, columns);
            return (
              <li key={audience.name} className="audience-row">
                <div className="audience-row-name">
                  <strong>{audience.label || audience.name}</strong>
                  {low ? <div className="audience-low">Low base · flagged in answers</div> : null}
                </div>
                <div className="audience-row-copy">
                  {definition ? <Definition text={definition} /> : null}
                </div>
                <div className={low ? 'audience-stat low' : 'audience-stat'}>
                  {n != null ? <div>n = {n}</div> : null}
                  {share !== null ? (
                    <div className="flow-muted">
                      {percent(share)}
                      {typeof audience.weighted_share === 'number' ? ' weighted' : ''}
                    </div>
                  ) : null}
                  {people != null ? (
                    <div className="flow-muted">{peopleCount(people)} people</div>
                  ) : null}
                </div>
                {canEdit ? (
                  <Button
                    type="button"
                    className="flow-btn audience-edit"
                    onClick={() => edit(audience)}
                  >
                    Edit
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      {open ? (
        <div className="audience-scrim">
          <form
            className="audience-drawer"
            role="dialog"
            aria-label={editing ? 'Edit audience' : 'New audience'}
            onSubmit={event => {
              event.preventDefault();
              save();
            }}
          >
            <header className="audience-drawer-head">
              <div>
                <h2>{editing ? 'Edit audience' : 'New audience'}</h2>
                <p>Saved to this project. Carries to new waves when the questions match.</p>
              </div>
              <Button
                type="button"
                className="flow-btn audience-close"
                aria-label="Close"
                onClick={reset}
              >
                ×
              </Button>
            </header>
            <div className="audience-drawer-body">
              <label className="audience-field">
                Name · what people will type in chat
                <Input
                  aria-label="Name · what people will type in chat"
                  value={label}
                  onChange={event => setLabel(event.target.value)}
                />
              </label>
              <label className="audience-field">
                Plain description · shown in answers and footnotes
                <Textarea
                  aria-label="Plain description · shown in answers and footnotes"
                  value={description}
                  onChange={event => setDescription(event.target.value)}
                />
              </label>
              <div className="audience-match">
                <span>Respondents who match</span>
                <div
                  className="audience-segment"
                  role="group"
                  aria-label="How the conditions combine"
                >
                  <Button
                    type="button"
                    aria-pressed={combine === 'and'}
                    className={
                      combine === 'and' ? 'audience-segment-btn on' : 'audience-segment-btn'
                    }
                    onClick={() => setCombine('and')}
                  >
                    all
                  </Button>
                  <Button
                    type="button"
                    aria-pressed={combine === 'or'}
                    className={
                      combine === 'or' ? 'audience-segment-btn on' : 'audience-segment-btn'
                    }
                    onClick={() => setCombine('or')}
                  >
                    any
                  </Button>
                </div>
                <span>of these</span>
              </div>
              <div className="audience-conditions">
                {conditions.map((condition, index) =>
                  condition.group ? (
                    <div key={`group-${index}`} className="audience-group">
                      <div className="audience-group-label">any of</div>
                      {condition.group.map((child, childIndex) =>
                        renderCondition(child, index, childIndex)
                      )}
                      <QuestionSearch
                        columns={remaining}
                        onPick={name =>
                          setConditions(current =>
                            current.map((item, itemIndex) =>
                              itemIndex === index
                                ? {
                                    ...item,
                                    group: [...(item.group || []), { ...BLANK, column: name }],
                                  }
                                : item
                            )
                          )
                        }
                      />
                    </div>
                  ) : (
                    renderCondition(condition, index, null)
                  )
                )}
                <div className="audience-add-row">
                  <QuestionSearch
                    columns={remaining}
                    onPick={name =>
                      setConditions(current => [...current, { ...BLANK, column: name }])
                    }
                  />
                  <Button
                    type="button"
                    className="flow-btn audience-dashed audience-group-add"
                    onClick={() => setConditions(current => [...current, { ...BLANK, group: [] }])}
                  >
                    + Group (any of)
                  </Button>
                </div>
              </div>
              <div className="audience-size">
                <div className="audience-size-head">
                  <div className={size && size.n < LOW_BASE ? 'audience-n low' : 'audience-n'}>
                    n = {size ? size.n : '…'}
                  </div>
                  <div className="flow-muted audience-size-share">
                    {liveShare !== null
                      ? `${percent(liveShare)}${typeof size?.weighted_share === 'number' ? ' weighted' : ' of the file'}${
                          typeof size?.projected_people === 'number'
                            ? ` · ${peopleCount(size.projected_people)} people`
                            : ''
                        }`
                      : sizeFailed
                        ? 'The base could not be counted.'
                        : 'The base appears once a question is chosen.'}
                  </div>
                </div>
                <div className="audience-bar" aria-hidden="true">
                  <span style={{ width: `${Math.min(100, (liveShare || 0) * 100)}%` }} />
                </div>
                <p>
                  Every answer that uses this audience states this definition and its base.
                  {size && size.n < LOW_BASE
                    ? ' Bases under 50 are flagged, under 30 are hidden.'
                    : ''}
                </p>
              </div>
              {error ? <p role="alert">{error}</p> : null}
            </div>
            <footer className="audience-footer">
              <p className="audience-try">Test it: “How many {typed || '…'}?”</p>
              <div className="audience-footer-actions">
                {editing ? (
                  <Button
                    type="button"
                    className="flow-btn"
                    disabled={busy}
                    onClick={() => remove(editing)}
                  >
                    Delete
                  </Button>
                ) : null}
                <Button type="button" className="flow-btn" onClick={reset}>
                  Cancel
                </Button>
                <Button className="flow-btn primary" type="submit" disabled={busy}>
                  {busy ? 'Saving…' : 'Save audience'}
                </Button>
              </div>
            </footer>
          </form>
        </div>
      ) : null}
      {!open && error ? <p role="alert">{error}</p> : null}
    </section>
  );
}
