'use client';

import { useEffect, useState } from 'react';
import { tensrApiUrl } from '@/lib/tensr-api-url';
import { getTensrApiHeaders } from '@/utils/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { FlowColumn } from '@/lib/flow-columns';
import { audienceFilter, type AudienceCombine, type AudienceCondition } from './audience-filter';

export type SavedAudience = {
  name: string;
  label: string;
  description?: string;
  filter?: { combine?: string; filters?: unknown[] };
};

type Props = {
  datasetId: string;
  columns: FlowColumn[];
};

const BLANK: AudienceCondition = { column: '', op: '=', value: '', exclude: false };

function columnText(column: FlowColumn): string {
  const label = String(column.label || '').trim();
  return label && label !== column.name ? label : column.name;
}

export function AudiencePanel({ datasetId, columns }: Props) {
  const [audiences, setAudiences] = useState<SavedAudience[] | null>(null);
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [combine, setCombine] = useState<AudienceCombine>('and');
  const [conditions, setConditions] = useState<AudienceCondition[]>([{ ...BLANK }]);
  const [editing, setEditing] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!datasetId) return;
    let cancelled = false;
    setAudiences(null);
    void fetch(tensrApiUrl(`/datasets/${datasetId}/audiences`), {
      headers: getTensrApiHeaders(),
    })
      .then(async response => {
        if (!response.ok) throw new Error('Audiences could not be loaded.');
        return response.json() as Promise<{ audiences?: SavedAudience[] }>;
      })
      .then(page => {
        if (!cancelled) setAudiences(page.audiences || []);
      })
      .catch(() => {
        if (!cancelled) {
          setAudiences([]);
          setError('Audiences could not be loaded.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [datasetId]);

  const reset = () => {
    setLabel('');
    setDescription('');
    setCombine('and');
    setConditions([{ ...BLANK }]);
    setEditing('');
  };

  const save = () => {
    const filter = audienceFilter(combine, conditions);
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
        setAudiences(current => {
          const rest = (current || []).filter(
            item => item.name !== saved.name && item.name !== editing
          );
          return [...rest, { ...saved, description: saved.description || description.trim() }];
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
        setAudiences(current => (current || []).filter(item => item.name !== name));
        if (editing === name) reset();
      })
      .catch(() => setError('The audience was not deleted.'))
      .finally(() => setBusy(false));
  };

  const edit = (audience: SavedAudience) => {
    setEditing(audience.name);
    setLabel(audience.label || audience.name);
    setDescription(audience.description || '');
    const stored = audience.filter?.combine === 'or' ? 'or' : 'and';
    setCombine(stored);
    const filters = Array.isArray(audience.filter?.filters) ? audience.filter?.filters : [];
    const next = filters.flatMap(item => {
      if (!item || typeof item !== 'object') return [];
      const group = item as {
        op?: string;
        filters?: { column?: string; op?: string; value?: unknown }[];
      };
      const excluded = group.op === 'not';
      const clause = excluded
        ? group.filters?.[0]
        : (item as { column?: string; op?: string; value?: unknown });
      if (!clause?.column) return [];
      return [
        {
          column: String(clause.column),
          op: String(clause.op || '='),
          value: String(clause.value ?? ''),
          exclude: excluded,
        },
      ];
    });
    setConditions(next.length ? next : [{ ...BLANK }]);
  };

  const options = columns
    .filter(column => column.name)
    .map(column => ({ value: column.name, label: columnText(column) }));

  return (
    <section className="details-audiences" aria-label="Audiences">
      <h2>Audiences</h2>
      <p className="details-explainer">
        A named audience is a set of conditions. Ask for it by name and the answer uses this
        definition.
      </p>
      {audiences === null ? <p className="flow-muted">Loading audiences.</p> : null}
      {audiences && audiences.length === 0 ? <p className="flow-muted">No audiences yet.</p> : null}
      {audiences && audiences.length > 0 ? (
        <ul>
          {audiences.map(audience => (
            <li key={audience.name}>
              <strong>{audience.label || audience.name}</strong>
              {audience.description ? <span> {audience.description}</span> : null}
              <Button type="button" className="flow-btn" onClick={() => edit(audience)}>
                Edit {audience.label || audience.name}
              </Button>
              <Button
                type="button"
                className="flow-btn"
                disabled={busy}
                onClick={() => remove(audience.name)}
              >
                Delete {audience.label || audience.name}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <form
        onSubmit={event => {
          event.preventDefault();
          save();
        }}
      >
        <label>
          Name
          <Input
            aria-label="Audience name"
            value={label}
            onChange={event => setLabel(event.target.value)}
          />
        </label>
        <label>
          Description
          <Textarea
            aria-label="Audience description"
            value={description}
            onChange={event => setDescription(event.target.value)}
          />
        </label>
        <label>
          How the conditions combine
          <select
            aria-label="How the conditions combine"
            value={combine}
            onChange={event => setCombine(event.target.value === 'or' ? 'or' : 'and')}
          >
            <option value="and">All of these</option>
            <option value="or">Any of these</option>
          </select>
        </label>
        <fieldset>
          <legend>Conditions</legend>
          {conditions.map((condition, index) => (
            <div key={`${index}-${condition.column}`} className="flow-row">
              <label>
                Question
                <select
                  aria-label={`Condition ${index + 1} question`}
                  value={condition.column}
                  onChange={event =>
                    setConditions(current =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, column: event.target.value } : item
                      )
                    )
                  }
                >
                  <option value="">Question</option>
                  {options.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Operator
                <select
                  aria-label={`Condition ${index + 1} operator`}
                  value={condition.op}
                  onChange={event =>
                    setConditions(current =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, op: event.target.value } : item
                      )
                    )
                  }
                >
                  <option value="=">equals</option>
                  <option value="!=">does not equal</option>
                </select>
              </label>
              <Input
                aria-label={`Condition ${index + 1} value`}
                value={condition.value}
                onChange={event =>
                  setConditions(current =>
                    current.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, value: event.target.value } : item
                    )
                  )
                }
              />
              <label>
                <input
                  type="checkbox"
                  checked={condition.exclude}
                  aria-label={`Exclude condition ${index + 1}`}
                  onChange={event =>
                    setConditions(current =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, exclude: event.target.checked } : item
                      )
                    )
                  }
                />
                Exclude
              </label>
            </div>
          ))}
        </fieldset>
        <div className="flow-row">
          <Button
            type="button"
            className="flow-btn"
            onClick={() => setConditions(current => [...current, { ...BLANK }])}
          >
            Add condition
          </Button>
          <Button className="flow-btn primary" type="submit" disabled={busy}>
            {busy ? 'Saving…' : editing ? 'Save changes' : 'Save audience'}
          </Button>
          {editing ? (
            <Button type="button" className="flow-btn" onClick={reset}>
              Cancel
            </Button>
          ) : null}
        </div>
      </form>
      {error ? <p role="alert">{error}</p> : null}
    </section>
  );
}
