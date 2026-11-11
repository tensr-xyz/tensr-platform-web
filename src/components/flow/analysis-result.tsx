'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Table } from '@/components/ui/table';
import type { RunTable } from '@/components/flow/run-document';
import { fetchAnalysisRun, R_CHECK_POLL_MS, rCheckPhase } from '@/lib/analysis-runs';

/** Column role for a theme table so the count, share, and quote each keep their own space. */
export function quoteColumnFit(header: string): 'count' | 'share' | 'quote' | 'label' {
  const name = header.trim().toLowerCase();
  if (name === 'quote') return 'quote';
  if (name === 'count' || name === 'n') return 'count';
  if (name.includes('%')) return 'share';
  return 'label';
}

/** The shared result: a lead, the tables, one footnote, and checks folded away. */
export function AnalysisResult({
  lead,
  tables,
  footnote,
  checks,
  script,
  rCheck,
  rStatement,
  runId,
}: {
  lead?: string;
  tables: RunTable[];
  footnote?: string;
  checks?: string[];
  script?: string;
  rCheck?: string;
  rStatement?: string;
  runId?: string;
}) {
  const [checksOpen, setChecksOpen] = useState(false);
  const [scriptOpen, setScriptOpen] = useState(false);
  const [mark, setMark] = useState({ kind: rCheck || '', statement: rStatement || '' });
  useEffect(() => {
    setMark({ kind: rCheck || '', statement: rStatement || '' });
  }, [rCheck, rStatement]);
  useEffect(() => {
    if ((rCheck || '') !== 'pending') return;
    if (!runId) {
      setMark({ kind: 'unknown', statement: 'R check unavailable.' });
      return;
    }
    let cancelled = false;
    let polls = 0;
    const timer = window.setInterval(() => {
      polls += 1;
      if (rCheckPhase(polls) === 'unavailable') {
        window.clearInterval(timer);
        if (!cancelled) setMark({ kind: 'unknown', statement: 'R check unavailable.' });
        return;
      }
      void fetchAnalysisRun(runId).then(run => {
        const next = run?.report?.r_syntax_verification;
        if (cancelled || !next || next.kind === 'pending') return;
        setMark({ kind: next.kind, statement: next.statement || '' });
        window.clearInterval(timer);
      });
    }, R_CHECK_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [rCheck, runId]);
  const shownCheck = mark.kind || rCheck;
  const shownStatement = mark.statement || rStatement;
  const checkLabel =
    shownCheck === 'pending'
      ? 'R check running'
      : shownCheck === 'mismatch' || shownCheck === 'not_verified'
        ? 'R mismatch'
        : shownCheck === 'unknown'
          ? 'R check unavailable'
          : shownCheck
            ? 'Checked in R'
            : '';
  const checkDetail =
    shownStatement && shownStatement !== 'R check unavailable.' ? ` · ${shownStatement}` : '';
  const checkNote = checkLabel ? `${checkLabel}${checkDetail}` : '';
  const leadText =
    lead && shownStatement && lead.includes(shownStatement)
      ? lead.replace(shownStatement, '').replace(/\s+/g, ' ').trim()
      : lead;
  const foot = [footnote, checkNote].filter(Boolean).join(' · ');
  if (!leadText && !tables.length && !foot) return null;
  return (
    <div className="analysis-result">
      {leadText ? <p className="analysis-lead">{leadText}</p> : null}
      {tables.map(table => {
        const columns = Array.isArray(table.columns) ? table.columns : [];
        const rows = Array.isArray(table.rows) ? table.rows : [];
        if (!columns.length || !rows.length) return null;
        const quoteTable = columns.includes('Quote');
        return (
          <section
            key={`${table.title}-${columns.join('-')}`}
            className={quoteTable ? 'analysis-table analysis-table-quote' : 'analysis-table'}
          >
            {table.title ? <h3>{table.title}</h3> : null}
            <Table className="flow-table output-grid">
              {quoteTable ? (
                <colgroup>
                  {columns.map((column, index) => (
                    <col key={`${column}-${index}`} data-fit={quoteColumnFit(column)} />
                  ))}
                </colgroup>
              ) : null}
              <thead>
                <tr>
                  {columns.map((column, index) => (
                    <th
                      key={`${column}-${index}`}
                      data-fit={quoteTable ? quoteColumnFit(column) : undefined}
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`${table.title}-${index}`}>
                    {row.map((value, cellIndex) => (
                      <td
                        key={`${index}-${cellIndex}`}
                        data-fit={quoteTable ? quoteColumnFit(columns[cellIndex] || '') : undefined}
                      >
                        {value}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </Table>
          </section>
        );
      })}
      {foot ? <p className="flow-muted analysis-footnote">{foot}</p> : null}
      {checks && checks.length ? (
        <div className="analysis-fold">
          <Button type="button" className="flow-btn" onClick={() => setChecksOpen(open => !open)}>
            {checksOpen ? 'Hide checks' : `Checks (${checks.length})`}
          </Button>
          {checksOpen ? (
            <ul>
              {checks.map(check => (
                <li key={check}>{check}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {script ? (
        <div className="analysis-fold">
          <Button type="button" className="flow-btn" onClick={() => setScriptOpen(open => !open)}>
            {scriptOpen ? 'Hide R script' : 'R script'}
          </Button>
          {scriptOpen ? <pre className="analysis-script">{script}</pre> : null}
        </div>
      ) : null}
    </div>
  );
}
