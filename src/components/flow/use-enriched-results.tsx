'use client';

import { useEffect, useMemo, useState } from 'react';
import { attachStoredRuns, fetchAnalysisRun, type StoredAnalysisRun } from '@/lib/analysis-runs';
import { AnalysisResult } from '@/components/flow/analysis-result';
import {
  answerWithoutBase,
  answerWithoutTables,
  outputBaseClause,
  outputKind,
  outputRunIds,
  outputTakeaway,
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
  useEffect(() => {
    if (!ids) return;
    let cancelled = false;
    void Promise.all(ids.split('|').map(id => fetchAnalysisRun(id))).then(loaded => {
      if (cancelled) return;
      setRuns(loaded.filter((run): run is StoredAnalysisRun => Boolean(run)));
      setLoadedFor(ids);
    });
    return () => {
      cancelled = true;
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
  const prose = answerWithoutBase(
    withoutResultTokens(tables.length ? answerWithoutTables(answer) : answer)
  );
  if (!tables.length) {
    if (!prose) return null;
    return <FlowMarkdown className="chat-prose">{prose}</FlowMarkdown>;
  }
  return (
    <AnalysisResult
      lead={outputTakeaway(withoutResultTokens(answer))}
      tables={tables}
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
