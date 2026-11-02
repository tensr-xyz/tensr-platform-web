'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { Skeleton } from '@/components/ui/rest';
import { flowJson } from '@/lib/flow-api';
import { downloadExport } from '@/components/flow/survey-screens';
import {
  baseCount,
  clockLabel,
  dayLabel,
  metricLines,
  outputRuns,
  statusCounts,
  summaryText,
  type OutputRun,
} from '@/components/flow/report-output-runs';

export function ReportPaneSwitch({
  pane,
  onChange,
}: {
  pane: 'report' | 'outputs';
  onChange: (pane: 'report' | 'outputs') => void;
}) {
  return (
    <div className="outputs-switch">
      <Segmented
        className="home-segment"
        aria-label="Report or outputs"
        value={pane}
        onValueChange={onChange}
        options={[
          { value: 'report', label: 'Report' },
          { value: 'outputs', label: 'Outputs' },
        ]}
      />
    </div>
  );
}

export function ReportOutputs({ files }: { files: { id: string; name: string }[] }) {
  const [runs, setRuns] = useState<OutputRun[]>([]);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [oldest, setOldest] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [detailPhase, setDetailPhase] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [exportError, setExportError] = useState('');
  const fileKey = files.map(file => `${file.id}:${file.name}`).join('|');
  const filesRef = useMemo(() => files, [fileKey]);

  useEffect(() => {
    if (!filesRef.length) {
      setRuns([]);
      setPhase('ready');
      return;
    }
    let live = true;
    setPhase('loading');
    setError('');
    void Promise.all(
      filesRef.map(async file => {
        const page = await flowJson<{ runs?: unknown[] }>(`/datasets/${file.id}/runs`);
        return outputRuns(page.runs || []).map(run => ({ ...run, file: file.name }));
      })
    )
      .then(pages => {
        if (!live) return;
        const next = pages
          .flat()
          .sort((left, right) => right.created_at.localeCompare(left.created_at));
        setRuns(next);
        setSelectedId(current =>
          next.some(run => run.id === current) ? current : next[0]?.id || ''
        );
        setPhase('ready');
      })
      .catch(err => {
        if (!live) return;
        setRuns([]);
        setError(err instanceof Error ? err.message : 'Could not load saved analyses');
        setPhase('error');
      });
    return () => {
      live = false;
    };
  }, [fileKey, filesRef]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setDetailPhase('idle');
      return;
    }
    let live = true;
    setDetailPhase('loading');
    setExportError('');
    void flowJson<Record<string, unknown>>(`/datasets/analysis-runs/${selectedId}`)
      .then(run => {
        if (!live) return;
        setDetail(run);
        setDetailPhase('ready');
      })
      .catch(err => {
        if (!live) return;
        setDetail(null);
        setExportError(err instanceof Error ? err.message : 'Could not open this analysis');
        setDetailPhase('error');
      });
    return () => {
      live = false;
    };
  }, [selectedId]);

  const counts = useMemo(() => statusCounts(runs), [runs]);
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matched = runs.filter(run => {
      if (status !== 'all' && run.status !== status) return false;
      if (!needle) return true;
      return `${run.title} ${run.op}`.toLowerCase().includes(needle);
    });
    return oldest ? [...matched].reverse() : matched;
  }, [oldest, query, runs, status]);
  const groups = useMemo(() => {
    const order: string[] = [];
    const buckets = new Map<string, OutputRun[]>();
    for (const run of visible) {
      const label = dayLabel(run.created_at) || 'Undated';
      if (!buckets.has(label)) {
        buckets.set(label, []);
        order.push(label);
      }
      buckets.get(label)?.push(run);
    }
    return order.map(label => ({ label, runs: buckets.get(label) || [] }));
  }, [visible]);
  const selected = runs.find(run => run.id === selectedId) || null;
  const base = detail ? baseCount(detail) : null;
  const summary = detail ? summaryText(detail) : '';
  const metrics = detail ? metricLines(detail) : [];

  const download = (format: 'pdf' | 'html' | 'docx', filename: string) => {
    if (!selectedId) return;
    setExportError('');
    void downloadExport(`/reports/pipeline/export?format=${format}`, filename, {
      method: 'POST',
      body: JSON.stringify({ run_id: selectedId }),
    }).catch(err =>
      setExportError(err instanceof Error ? err.message : 'Could not export this analysis')
    );
  };

  if (phase === 'loading') {
    return (
      <div className="outputs-board" aria-busy="true">
        <Skeleton className="outputs-skeleton" />
        <Skeleton className="outputs-skeleton" />
        <Skeleton className="outputs-skeleton" />
      </div>
    );
  }

  if (phase === 'error') {
    return <p className="flow-error">{error || 'Could not load saved analyses.'}</p>;
  }

  return (
    <div className="outputs-board">
      <aside className="outputs-filters">
        <p className="flow-muted">Status</p>
        <Button
          className="flow-btn"
          type="button"
          data-active={status === 'all'}
          onClick={() => setStatus('all')}
        >
          All outputs {runs.length}
        </Button>
        {counts.map(item => (
          <Button
            key={item.status}
            className="flow-btn"
            type="button"
            data-active={status === item.status}
            onClick={() => setStatus(item.status)}
          >
            {item.status} {item.count}
          </Button>
        ))}
        <p className="flow-muted outputs-note">
          Every finished analysis in this project is listed here. Open one to read the saved
          summary.
        </p>
      </aside>
      <div className="outputs-list">
        <div className="outputs-list-tools">
          <Input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search outputs"
            aria-label="Search outputs"
          />
          <Button className="flow-btn" type="button" onClick={() => setOldest(current => !current)}>
            {oldest ? 'Oldest first' : 'Newest first'}
          </Button>
        </div>
        {groups.length ? (
          groups.map(group => (
            <section key={group.label}>
              <p className="flow-muted">{group.label}</p>
              {group.runs.map(run => (
                <Button
                  key={run.id}
                  className="outputs-row"
                  type="button"
                  data-active={run.id === selectedId}
                  onClick={() => setSelectedId(run.id)}
                >
                  <span>{run.op.replaceAll('_', ' ')}</span>
                  <span>
                    {run.title}
                    {run.file ? ` · ${run.file}` : ''}
                  </span>
                  <span>{clockLabel(run.created_at)}</span>
                  <span>{run.status}</span>
                </Button>
              ))}
            </section>
          ))
        ) : (
          <p className="flow-muted">
            {runs.length
              ? 'No analyses match this search.'
              : 'No saved analyses in this project yet. Run one from Tables, Responses, or Chat.'}
          </p>
        )}
      </div>
      <aside className="outputs-detail">
        {selected ? (
          <>
            <p className="flow-muted">{selected.op.replaceAll('_', ' ')}</p>
            <h2>{selected.title}</h2>
            <p className="flow-muted">
              {selected.status}
              {base != null ? ` · base ${base}` : ''}
              {selected.created_at ? ` · ${clockLabel(selected.created_at)}` : ''}
            </p>
            {detailPhase === 'loading' ? <Skeleton className="outputs-skeleton" /> : null}
            {detailPhase === 'error' ? <p className="flow-error">{exportError}</p> : null}
            {summary ? <p>{summary}</p> : null}
            {metrics.map(metric => (
              <p key={metric.label}>
                {metric.label}: {metric.value}
              </p>
            ))}
            {!summary && detailPhase === 'ready' ? (
              <p className="flow-muted">This run has no stored summary.</p>
            ) : null}
            <div className="outputs-export">
              <Button
                className="flow-btn"
                type="button"
                onClick={() => download('pdf', 'analysis.pdf')}
              >
                PDF
              </Button>
              <Button
                className="flow-btn"
                type="button"
                onClick={() => download('docx', 'analysis.docx')}
              >
                Word
              </Button>
              <Button
                className="flow-btn"
                type="button"
                onClick={() => download('html', 'analysis.html')}
              >
                HTML
              </Button>
              <Badge tone="soon">CSV coming soon</Badge>
              <Badge tone="soon">Markdown coming soon</Badge>
              <Badge tone="soon">APA coming soon</Badge>
            </div>
            {exportError && detailPhase !== 'error' ? (
              <p className="flow-error">{exportError}</p>
            ) : null}
            <Badge tone="soon">Add to report coming soon</Badge>
          </>
        ) : (
          <p className="flow-muted">Select an analysis.</p>
        )}
      </aside>
    </div>
  );
}
