'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ANALYSIS_RUN_POLL_MS,
  attachStoredRuns,
  fetchAnalysisRun,
  waitForAnalysisRun,
  type StoredAnalysisRun,
} from '@/lib/analysis-runs';
import { AnalysisResult } from '@/components/flow/analysis-result';
import {
  answerWithoutBase,
  answerWithoutTables,
  outputBaseClause,
  outputKind,
  outputRunIds,
  resultLead,
  withoutResultTokens,
} from '@/components/flow/chat-output';
import { FlowMarkdown } from '@/components/flow/flow-markdown';
import {
  answerResultTables,
  resultFootnote,
  resultViewFromToolResults,
  type ColumnLabels,
} from '@/components/flow/result-tables';

function runIds(results: unknown[] | undefined): string {
  return (results || [])
    .map(item => {
      if (!item || typeof item !== 'object') return '';
      const record = item as {
        name?: unknown;
        run_id?: unknown;
        result?: { run_id?: unknown; procedure?: unknown; job_id?: unknown; pending?: unknown };
      };
      const nested = record.result && typeof record.result === 'object' ? record.result : null;
      const procedure = String(record.name || nested?.procedure || '');
      // Deck progress is polled via the client-deck job endpoint; the run id is
      // the same job id and stays pending until the worker finishes.
      if (procedure === 'build_client_deck' || nested?.procedure === 'build_client_deck') {
        if (nested?.pending === true || nested?.job_id) return '';
      }
      return String(record.run_id || nested?.run_id || '');
    })
    .filter(Boolean)
    .join('|');
}

/** The streamed summary has no grid. Load the stored run and keep its tables. */
export function useEnrichedToolResults<T>(results: T[] | undefined): T[] | undefined {
  const [runs, setRuns] = useState<StoredAnalysisRun[]>([]);
  const [loadedFor, setLoadedFor] = useState('');
  const ids = runIds(results);
  useEffect(() => {
    if (!ids) return;
    let cancelled = false;
    const controller = new AbortController();
    void Promise.all(
      ids.split('|').map(async id => {
        const first = await fetchAnalysisRun(id);
        if (!first) return null;
        if (String(first.status || '') !== 'pending') return first;
        return waitForAnalysisRun(id, {
          intervalMs: ANALYSIS_RUN_POLL_MS,
          signal: controller.signal,
        });
      })
    ).then(loaded => {
      if (cancelled) return;
      setRuns(loaded.filter((run): run is StoredAnalysisRun => Boolean(run)));
      setLoadedFor(ids);
    });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [ids]);
  if (!results) return results;
  const ready = ids && loadedFor === ids ? runs : [];
  if (!ready.length) return results;
  return attachStoredRuns(results, ready) as T[];
}

type ToolResults = Parameters<typeof outputKind>[0];

/** One earlier reply. Tables load from the stored run; a sentence alone stays prose. */
export function ThreadResult({
  results,
  answer,
  columns = [],
}: {
  results: ToolResults;
  answer: string;
  columns?: ColumnLabels[];
}) {
  const enriched = useEnrichedToolResults(results);
  const view = useMemo(() => resultViewFromToolResults(enriched), [enriched]);
  const tables = view.tables.length ? view.tables : answerResultTables(answer);
  const charts = view.charts;
  const prose = answerWithoutBase(
    withoutResultTokens(tables.length || charts.length ? answerWithoutTables(answer) : answer)
  );
  if (!tables.length && !charts.length && !view.duplication) {
    if (!prose) return null;
    return <FlowMarkdown className="chat-prose">{prose}</FlowMarkdown>;
  }
  return (
    <AnalysisResult
      lead={resultLead(answer, enriched, tables)}
      tables={tables}
      charts={charts}
      footnote={resultFootnote(
        view,
        outputBaseClause(enriched, answer),
        outputKind(enriched),
        columns
      )}
      checks={view.checks}
      script={view.script}
      rCheck={view.rCheck}
      rStatement={view.rStatement}
      runId={outputRunIds(enriched)[0]}
      duplication={view.duplication}
      audience={view.audience}
    />
  );
}
