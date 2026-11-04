'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ChoiceSelect } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger, Skeleton } from '@/components/ui/rest';
import { flowJson } from '@/lib/flow-api';
import {
  chartFilterPayload,
  conditionCount,
  describeFilter,
  sameFilter,
  sharePercent,
  valueLabel,
  type ColumnValues,
  type FlowFilter,
} from './filters-panel-logic';
import './filters-panel.css';

export type { FlowFilter } from './filters-panel-logic';
export {
  chartFilterPayload,
  describeFilter,
  describeFilters,
  rowFiltersPayload,
} from './filters-panel-logic';

type PanelColumn = { name: string; label?: string; value_labels?: Record<string, string> | null };

const OPS: { value: FlowFilter['op']; label: string }[] = [
  { value: 'is_any_of', label: 'is any of' },
  { value: 'is_none_of', label: 'is none of' },
];

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

/**
 * Right-hand filter panel for Responses (Paper 4i). `filters` are the applied
 * conditions; edits stay local until that condition's Apply.
 */
export function FiltersPanel({
  datasetId,
  columns,
  filters,
  onChange,
  onClose,
  onUseOnTables,
}: {
  datasetId: string;
  columns: PanelColumn[];
  filters: FlowFilter[];
  onChange: (next: FlowFilter[]) => void;
  onClose: () => void;
  onUseOnTables?: (filters: FlowFilter[]) => void;
}) {
  const [drafts, setDrafts] = useState<FlowFilter[]>(filters);
  const [values, setValues] = useState<Record<string, ColumnValues>>({});
  const [valueErrors, setValueErrors] = useState<Record<string, string>>({});
  const [count, setCount] = useState<{ match: number; total: number } | null>(null);
  const [countError, setCountError] = useState('');
  const [counting, setCounting] = useState(false);
  const [firstDraw, setFirstDraw] = useState(true);
  const appliedKey = JSON.stringify(filters);

  // Keep unapplied new conditions when the applied list changes from outside.
  const appliedCount = useRef(filters.length);
  useEffect(() => {
    const before = appliedCount.current;
    appliedCount.current = filters.length;
    setDrafts(current => {
      const inSync = filters.every((filter, at) => sameFilter(filter, current[at]));
      return inSync ? current : [...filters, ...current.slice(before)];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedKey]);

  const wanted = useMemo(
    () => [...new Set([...filters, ...drafts].map(filter => filter.column))],
    [filters, drafts]
  );

  useEffect(() => {
    const missing = wanted.filter(name => !values[name] && !valueErrors[name]);
    if (!missing.length) return;
    let live = true;
    void Promise.all(
      missing.map(name =>
        flowJson<ColumnValues>(
          `/datasets/${datasetId}/columns/${encodeURIComponent(name)}/values`
        ).then(
          body => ({ name, body, error: '' }),
          err => ({ name, body: null, error: apiMessage(err, 'Values did not load.') })
        )
      )
    ).then(results => {
      if (!live) return;
      setValues(current => {
        const next = { ...current };
        for (const item of results) if (item.body) next[item.name] = item.body;
        return next;
      });
      setValueErrors(current => {
        const next = { ...current };
        for (const item of results) if (item.error) next[item.name] = item.error;
        return next;
      });
    });
    return () => {
      live = false;
    };
  }, [wanted, values, valueErrors, datasetId]);

  const appliedReady = filters.every(
    filter => filter.op === 'is_any_of' || values[filter.column] || valueErrors[filter.column]
  );

  useEffect(() => {
    if (!appliedReady) return;
    const probe = filters[0]?.column || columns[0]?.name;
    if (!probe) {
      setFirstDraw(false);
      return;
    }
    let live = true;
    const { filters: clauses, empty } = chartFilterPayload(filters, values);
    setCounting(true);
    void flowJson<{ n_rows?: number; n_rows_filtered?: number }>(
      `/datasets/${datasetId}/chart-data`,
      {
        method: 'POST',
        body: JSON.stringify({
          kind: 'pie',
          x: probe,
          y: probe,
          filters: clauses,
          weight_column: null,
        }),
      }
    )
      .then(body => {
        if (!live) return;
        const total = Number(body.n_rows || 0);
        setCount({ total, match: empty ? 0 : Number(body.n_rows_filtered ?? total) });
        setCountError('');
      })
      .catch(err => {
        if (!live) return;
        setCount(null);
        setCountError(apiMessage(err, 'The match count did not load.'));
      })
      .finally(() => {
        if (!live) return;
        setCounting(false);
        setFirstDraw(false);
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedKey, appliedReady, datasetId]);

  const columnFor = (name: string) => columns.find(column => column.name === name);
  const labelsFor = (name: string) =>
    values[name]?.value_labels || columnFor(name)?.value_labels || null;

  function updateDraft(index: number, next: FlowFilter) {
    setDrafts(list => list.map((item, at) => (at === index ? next : item)));
  }

  function applyAt(index: number) {
    const next: FlowFilter[] = [];
    const keep: FlowFilter[] = [];
    drafts.forEach((draft, at) => {
      if (at === index) {
        if (draft.values.length) next.push(draft);
      } else if (at < filters.length) {
        next.push(filters[at]);
      } else {
        keep.push(draft);
      }
    });
    setDrafts([...next, ...keep]);
    onChange(next);
  }

  function removeAt(index: number) {
    setDrafts(list => list.filter((_, at) => at !== index));
    if (index < filters.length) onChange(filters.filter((_, at) => at !== index));
  }

  const unused = columns.filter(column => !drafts.some(draft => draft.column === column.name));

  return (
    <aside className="fp" aria-label="Filters">
      <div className="fp-head">
        <span className="fp-title">Filters</span>
        <span className="fp-head-actions">
          <Button
            type="button"
            className="fp-link"
            disabled={!drafts.length}
            onClick={() => {
              setDrafts([]);
              if (filters.length) onChange([]);
            }}
          >
            Clear all
          </Button>
          <Button type="button" className="fp-icon" aria-label="Close filters" onClick={onClose}>
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
              <path
                d="M2.5 2.5l7 7M9.5 2.5l-7 7"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
            </svg>
          </Button>
        </span>
      </div>

      {firstDraw ? (
        <div className="fp-body" aria-busy="true">
          <Skeleton className="fp-skel-strip" />
          {(filters.length ? filters : [null]).map((_, index) => (
            <div className="fp-cond" key={index}>
              <Skeleton className="fp-skel-line" />
              <Skeleton className="fp-skel-pill" />
            </div>
          ))}
        </div>
      ) : (
        <div className="fp-body">
          <div className="fp-strip" data-busy={counting}>
            {count ? (
              <>
                <span>
                  {filters.length
                    ? `${count.match.toLocaleString()} of ${count.total.toLocaleString()} respondents match`
                    : `All ${count.total.toLocaleString()} respondents`}
                </span>
                <span>{sharePercent(filters.length ? count.match : count.total, count.total)}</span>
              </>
            ) : (
              <span className="fp-error">{countError || 'No columns to filter.'}</span>
            )}
          </div>

          {drafts.map((draft, index) => {
            const info = values[draft.column];
            const labels = labelsFor(draft.column);
            const applied = filters[index];
            const dirty = !sameFilter(draft, applied);
            const kept = conditionCount(draft, info);
            const column = columnFor(draft.column);
            return (
              <div className="fp-cond" key={`${draft.column}-${index}`}>
                <div className="fp-cond-head">
                  <span className="fp-cond-name" title={describeFilter(draft, column)}>
                    {column?.label || draft.column}
                  </span>
                  <span className="fp-cond-op">
                    <ChoiceSelect
                      className="fp-op"
                      aria-label={`How to match ${column?.label || draft.column}`}
                      value={draft.op}
                      onValueChange={value =>
                        updateDraft(index, { ...draft, op: value as FlowFilter['op'] })
                      }
                      options={OPS}
                    />
                    {dirty ? <span className="fp-pending">· not applied yet</span> : null}
                  </span>
                </div>
                {valueErrors[draft.column] ? (
                  <p className="fp-error">{valueErrors[draft.column]}</p>
                ) : null}
                <div className="fp-pills">
                  {draft.values.map(value => (
                    <Button
                      key={value}
                      type="button"
                      className="fp-pill"
                      aria-label={`Remove ${valueLabel(value, labels)}`}
                      onClick={() =>
                        updateDraft(index, {
                          ...draft,
                          values: draft.values.filter(item => item !== value),
                        })
                      }
                    >
                      {valueLabel(value, labels)}
                      {info ? ` · ${(info.counts[value] || 0).toLocaleString()}` : ''}
                      <span className="fp-pill-x" aria-hidden="true">
                        ×
                      </span>
                    </Button>
                  ))}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button type="button" className="fp-add-value" disabled={!info}>
                        + value
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="fp-pop">
                      {(info?.values || []).map(value => {
                        const on = draft.values.includes(value);
                        const id = `fp-${index}-${value}`;
                        return (
                          <label className="fp-pop-row" key={value} htmlFor={id}>
                            <Checkbox
                              id={id}
                              checked={on}
                              onCheckedChange={checked =>
                                updateDraft(index, {
                                  ...draft,
                                  values:
                                    checked === true
                                      ? [...draft.values, value]
                                      : draft.values.filter(item => item !== value),
                                })
                              }
                            />
                            <span className="fp-pop-label">{valueLabel(value, labels)}</span>
                            <span className="fp-pop-count">
                              {(info?.counts[value] || 0).toLocaleString()}
                            </span>
                          </label>
                        );
                      })}
                      {info && !info.values.length ? (
                        <p className="fp-muted fp-pop-empty">This column has no answers.</p>
                      ) : null}
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="fp-cond-foot">
                  <span className="fp-muted">
                    {dirty && kept != null && draft.values.length
                      ? `Would leave ${kept.toLocaleString()} respondents`
                      : ''}
                  </span>
                  <span className="fp-cond-actions">
                    <Button type="button" className="fp-link" onClick={() => removeAt(index)}>
                      Remove
                    </Button>
                    {dirty ? (
                      <Button
                        type="button"
                        className="fp-btn fp-primary fp-btn-sm"
                        disabled={!draft.values.length}
                        onClick={() => applyAt(index)}
                      >
                        Apply
                      </Button>
                    ) : null}
                  </span>
                </div>
              </div>
            );
          })}

          {unused.length ? (
            <ChoiceSelect
              className="fp-add"
              aria-label="Add a condition"
              value=""
              placeholder="+ Add a condition"
              onValueChange={name => {
                if (!name) return;
                setDrafts(list => [...list, { column: name, op: 'is_any_of', values: [] }]);
              }}
              options={unused.map(column => ({
                value: column.name,
                label: column.label || column.name,
              }))}
            />
          ) : null}
        </div>
      )}

      <div className="fp-foot">
        <p className="fp-muted">
          Filters change the sheet only. Use a filter on Tables, the agent or a new version to carry
          it through.
        </p>
        {onUseOnTables ? (
          <Button
            type="button"
            className="fp-btn fp-primary"
            disabled={!filters.length}
            onClick={() => onUseOnTables(filters)}
          >
            Use on Tables
          </Button>
        ) : null}
      </div>
    </aside>
  );
}
