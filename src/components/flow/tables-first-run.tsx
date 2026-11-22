'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChoiceSelect } from '@/components/ui/select';
import type { OutlineQuestion } from '@/lib/flow-columns';
import {
  filterFirstRunQuestions,
  firstRunGroupChips,
  firstRunSuggestedQuestions,
} from '@/lib/tables-first-run';

const PREVIEW_ROWS = [
  { label: 'Answer A', values: ['41%', '44%', '39%', '36%'] },
  { label: 'Answer B', values: ['33%', '31%', '38%', '29%'] },
];
const PREVIEW_COLS = ['Total', 'Group 1', 'Group 2', 'Group 3'];

export function TablesFirstRun({
  outline,
  columns,
  questionCount,
  onPickQuestion,
  onPickGroup,
  selectedGroups = [],
  onAskAgent,
  onTabSpec,
  onSummaryTables,
  summaryBusy = false,
}: {
  outline: OutlineQuestion[];
  columns: { name: string; n_unique?: number | null }[];
  questionCount: number;
  onPickQuestion: (value: string) => void;
  onPickGroup: (value: string) => void;
  selectedGroups?: string[];
  onAskAgent: () => void;
  onTabSpec: () => void;
  onSummaryTables: () => void;
  summaryBusy?: boolean;
}) {
  const [query, setQuery] = useState('');
  const suggested = useMemo(() => firstRunSuggestedQuestions(outline, 3), [outline]);
  const filtered = useMemo(() => filterFirstRunQuestions(outline, query), [outline, query]);
  const shown = query.trim() ? filtered.slice(0, 8) : suggested;
  const groups = useMemo(
    () => firstRunGroupChips(outline, columns, { limit: 3 }),
    [outline, columns]
  );
  const searchOptions = useMemo(
    () =>
      filterFirstRunQuestions(outline, '').map(item => ({
        value: item.value,
        label: item.label,
      })),
    [outline]
  );

  return (
    <div className="tables-first-run" data-testid="tables-first-run">
      <div className="tables-first-intro">
        <h2>Build your first table</h2>
        <p>
          A table counts how many people gave each answer. Pick a question for the rows, and
          optionally a group to split it by.
        </p>
      </div>

      <div className="tables-first-steps">
        <div className="tables-first-step">
          <div className="tables-first-step-head">
            <span className="tables-first-step-num" data-active="true">
              1
            </span>
            <strong>Pick a question</strong>
          </div>
          <p className="tables-first-step-copy">
            It becomes the rows. Search your questions or drag one in from Details.
          </p>
          <Input
            className="tables-first-search"
            aria-label="Search questions"
            placeholder={`Search ${questionCount} question${questionCount === 1 ? '' : 's'}`}
            value={query}
            onChange={event => setQuery(event.target.value)}
          />
          <div className="tables-first-questions">
            {shown.map(item => (
              <Button
                key={item.value}
                type="button"
                className="tables-first-question"
                onClick={() => onPickQuestion(item.value)}
              >
                <span>{item.label}</span>
                <span className="flow-muted">{item.typeLabel}</span>
              </Button>
            ))}
            {shown.length === 0 ? (
              <p className="flow-muted">No questions match that search.</p>
            ) : null}
          </div>
          {searchOptions.length > 3 ? (
            <ChoiceSelect
              className="flow-input tables-first-picker"
              aria-label="All questions"
              searchable
              value=""
              onValueChange={value => {
                if (value) onPickQuestion(value);
              }}
              options={[
                { value: '', label: 'Browse all questions…' },
                ...searchOptions.map(item => ({ value: item.value, label: item.label })),
              ]}
            />
          ) : null}
        </div>

        <div className="tables-first-step">
          <div className="tables-first-step-head">
            <span className="tables-first-step-num">2</span>
            <strong>Split it by a group</strong>
            <span className="flow-muted">Optional</span>
          </div>
          <p className="tables-first-step-copy">
            It becomes the columns, so you can compare groups side by side.
          </p>
          <ChoiceSelect
            className="flow-input tables-first-group-add"
            aria-label="Add a group"
            searchable
            value=""
            onValueChange={value => {
              if (value) onPickGroup(value);
            }}
            options={[
              { value: '', label: '+ Add a group' },
              ...searchOptions.map(item => ({ value: item.value, label: item.label })),
            ]}
          />
          <div className="tables-first-chips">
            {groups.map(item => (
              <Button
                key={item.value}
                className="tables-first-chip"
                type="button"
                data-active={selectedGroups.includes(item.value) || undefined}
                onClick={() => onPickGroup(item.value)}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="tables-first-preview">
        <div className="tables-first-preview-head">
          <span className="tables-first-preview-eyebrow">What you&apos;ll get</span>
          <div className="tables-first-preview-actions">
            <Button className="flow-btn primary" type="button" disabled>
              Save table
            </Button>
            <span className="flow-muted">3 · Save it to your report</span>
          </div>
        </div>
        <div className="tables-first-preview-labels">
          <span className="tables-first-axis">Rows · the question</span>
          <span className="tables-first-axis">Columns · the group</span>
        </div>
        <div className="tables-first-preview-grid" aria-hidden="true">
          <div className="tables-first-preview-row tables-first-preview-header">
            <span />
            {PREVIEW_COLS.map(col => (
              <span key={col}>{col}</span>
            ))}
          </div>
          {PREVIEW_ROWS.map(row => (
            <div key={row.label} className="tables-first-preview-row">
              <span>{row.label}</span>
              {row.values.map((value, index) => (
                <span key={`${row.label}-${index}`} className="flow-muted">
                  {value}
                </span>
              ))}
            </div>
          ))}
        </div>
        <p className="tables-first-preview-note">
          Weighting, significance letters, charts and the rest appear above the table once
          you&apos;ve picked a question.
        </p>
      </div>

      <div className="tables-first-alt">
        <span className="flow-muted">Or start another way</span>
        <Button className="tables-first-alt-link" type="button" onClick={onAskAgent}>
          Ask the agent to build one
        </Button>
        <Button className="tables-first-alt-link" type="button" onClick={onTabSpec}>
          Build every table from a tab spec
        </Button>
        <Button
          className="tables-first-alt-link"
          type="button"
          disabled={summaryBusy}
          onClick={onSummaryTables}
        >
          {summaryBusy ? 'Building summary tables…' : 'Run all summary tables'}
        </Button>
      </div>
    </div>
  );
}
