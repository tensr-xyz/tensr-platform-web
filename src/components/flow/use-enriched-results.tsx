'use client';

import { useEffect, useMemo, useState } from 'react';
import { attachStoredRuns, fetchAnalysisRun, type StoredAnalysisRun } from '@/lib/analysis-runs';
import { AnalysisResult } from '@/components/flow/analysis-result';
import {
  answerWithoutBase,
  outputBaseClause,
  outputKind,
  outputRunIds,
  outputTakeaway,
} from '@/components/flow/chat-output';
import { FlowMarkdown } from '@/components/flow/flow-markdown';
import {
  resultFootnote,
  resultViewFromToolResults,
  type ColumnLabels,
} from '@/components/flow/result-tables';

function runIds(results: unknown[] | undefined): string {
  return (results || [])
    .map(item => {
      if (!item || typeof item !== 'object') return '';
      const record = item as { run_id?: unknown; result?: { run_id?: unknown } };
      return String(record.run_id || record.result?.run_id || '');
    })
    .filter(Boolean)
    .join('|');
}

/** The streamed summary has no grid. Load the stored run and keep its tables. */
export function useEnrichedToolResults<T>(results: T[] | undefined): T[] | undefined {
  const [runs, setRuns] = useState<StoredAnalysisRun[]>([]);
  const [loadedFor, setLoadedFor] = useState('');
  const ids = runIds(results);
  const hasLocalTables = useMemo(
    () => Boolean(results && resultViewFromToolResults(results).tables.length),
    [results]
  );
  useEffect(() => {
    if (!ids || hasLocalTables) return;
    let cancelled = false;
    void Promise.all(ids.split('|').map(id => fetchAnalysisRun(id))).then(loaded => {
      if (cancelled) return;
      setRuns(loaded.filter((run): run is StoredAnalysisRun => Boolean(run)));
      setLoadedFor(ids);
    });
    return () => {
      cancelled = true;
    };
  }, [ids, hasLocalTables]);
  if (!results || hasLocalTables) return results;
  const ready = ids && loadedFor === ids ? runs : [];
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
  if (!view.tables.length) {
    if (!answer) return null;
    return <FlowMarkdown className="chat-prose">{answerWithoutBase(answer)}</FlowMarkdown>;
  }
  return (
    <AnalysisResult
      lead={outputTakeaway(answer)}
      tables={view.tables}
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
    />
  );
}
