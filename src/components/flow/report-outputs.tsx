'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { Skeleton } from '@/components/ui/rest';
import { flowJson } from '@/lib/flow-api';
import { OutputPage } from '@/components/flow/output-page';
import {
  cachedReportRuns,
  pinsFromRuns,
  setProjectPins,
  useProjectPins,
  type RunSummary,
} from '@/components/flow/report-pins';
import { downloadExport } from '@/components/flow/survey-screens';
import {
  documentApa,
  documentCsv,
  documentMarkdown,
  runDocument,
} from '@/components/flow/run-document';
import {
  baseCount,
  runState,
  clockLabel,
  dayLabel,
  metricLines,
  outputCounts,
  outputRuns,
  uniqueRuns,
  summaryText,
  type OutputRun,
} from '@/components/flow/report-output-runs';

function downloadText(filename: string, contents: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

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

export function ReportOutputs({
  projectId,
  files,
  findings = [],
  lead,
  openRunId = '',
  refreshKey = 0,
}: {
  projectId: string;
  files: { id: string; name: string }[];
  findings?: { id: string; label: string }[];
  lead?: ReactNode;
  openRunId?: string;
  refreshKey?: number;
}) {
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
  const [opened, setOpened] = useState(false);
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
    const applyRuns = (next: OutputRun[], raw: RunSummary[]) => {
      if (!live) return;
      if (raw.length) setProjectPins(projectId, pinsFromRuns(raw));
      setRuns(next);
      if (openRunId && next.some(run => run.id === openRunId)) {
        setSelectedId(openRunId);
        setOpened(true);
      } else {
        setSelectedId(current =>
          next.some(run => run.id === current) ? current : next[0]?.id || ''
        );
      }
      setPhase('ready');
    };
    const cached = cachedReportRuns(projectId);
    if (cached) {
      const next = uniqueRuns(outputRuns(cached)).sort((left, right) =>
        right.created_at.localeCompare(left.created_at)
      );
      applyRuns(next, cached);
      return () => {
        live = false;
      };
    }
    const fileIds = filesRef.map(file => file.id).filter(Boolean);
    const loadPerFile = () => {
      const rawRuns: RunSummary[] = [];
      return Promise.all(
        filesRef.map(async file => {
          const page = await flowJson<{ runs?: unknown[] }>(`/datasets/${file.id}/runs`);
          rawRuns.push(...((page.runs || []) as RunSummary[]));
          return outputRuns(page.runs || []).map(run => ({ ...run, file: file.name }));
        })
      ).then(pages => {
        const sorted = uniqueRuns(pages.flat()).sort((left, right) =>
          right.created_at.localeCompare(left.created_at)
        );
        applyRuns(sorted, rawRuns);
      });
    };
    void flowJson<{ ok?: boolean; runs?: unknown[] }>(
      `/api/projects/${projectId}/overview${
        fileIds.length ? `?dataset_ids=${encodeURIComponent(fileIds.join(','))}` : ''
      }`
    )
      .then(overview => {
        if (!live) return;
        if (overview?.ok && Array.isArray(overview.runs)) {
          const next = uniqueRuns(outputRuns(overview.runs)).sort((left, right) =>
            right.created_at.localeCompare(left.created_at)
          );
          applyRuns(next, overview.runs as RunSummary[]);
          return;
        }
        return loadPerFile();
      })
      .catch(err => {
        if (!live) return;
        return loadPerFile().catch(() => {
          if (!live) return;
          setRuns([]);
          setError(err instanceof Error ? err.message : 'Could not load saved analyses');
          setPhase('error');
        });
      });
    return () => {
      live = false;
    };
  }, [fileKey, filesRef, projectId, refreshKey, openRunId]);

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

  const pins = useProjectPins(projectId, []);
  const pinnedRuns = useMemo(() => new Set(pins.map(pin => pin.runId)), [pins]);
  const stateOf = (run: OutputRun) => runState(run.status, pinnedRuns.has(run.id));
  const tally = useMemo(() => outputCounts(runs, pinnedRuns), [runs, pinnedRuns]);
  const counts = tally.counts;
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matched = runs.filter(run => {
      if (status !== 'all') {
        const state = stateOf(run);
        if (status === 'Saved' ? state === 'Draft' : state !== status) return false;
      }
      if (!needle) return true;
      return `${run.title} ${run.op}`.toLowerCase().includes(needle);
    });
    return oldest ? [...matched].reverse() : matched;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oldest, query, runs, status, pinnedRuns]);
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
    void downloadExport(`/datasets/reports/pipeline/export?format=${format}`, filename, {
      method: 'POST',
      body: JSON.stringify({ run_id: selectedId }),
    }).catch(err =>
      setExportError(err instanceof Error ? err.message : 'Could not export this analysis')
    );
  };

  const downloadLocal = (format: 'csv' | 'md' | 'apa') => {
    if (!detail) return;
    const document = runDocument(detail);
    const stem = (document.title || 'analysis').replace(/[^\w.-]+/g, '-').slice(0, 40);
    if (format === 'csv') downloadText(`${stem}.csv`, documentCsv(document), 'text/csv');
    else if (format === 'md')
      downloadText(`${stem}.md`, documentMarkdown(document), 'text/markdown');
    else downloadText(`${stem}-apa.txt`, documentApa(document), 'text/plain');
  };

  if (opened && selected && detail && detailPhase === 'ready') {
    const datasetId = String(detail.dataset_id || selected.file || '');
    const fileId =
      files.find(file => file.name === selected.file)?.id || String(detail.dataset_id || '');
    return (
      <OutputPage
        projectId={projectId}
        datasetId={fileId || datasetId}
        runId={selected.id}
        run={detail}
        findings={findings}
        onBack={() => setOpened(false)}
      />
    );
  }

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

  const kindLabel = (op: string) => {
    const known: Record<string, string> = {
      anova_oneway: 'ANOVA',
      banner_table: 'Crosstab',
      descriptives: 'Descriptives',
      chi_square: 'Chi-square',
      frequencies: 'Frequencies',
      linear_regression: 'Regression',
      ttest_independent: 't-test',
    };
    return known[op] || op.replaceAll('_', ' ');
  };

  return (
    <div className="outputs-shell">
      <div className="outputs-top">
        {lead}
        <span className="sheet-spacer" />
        <label className="outputs-search">
          <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden="true">
            <circle cx="6" cy="6" r="4" fill="none" stroke="currentColor" strokeWidth="1.3" />
            <path d="M9 9l3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          <Input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search outputs"
            aria-label="Search outputs"
          />
        </label>
        <Button className="flow-btn" type="button" onClick={() => setOldest(current => !current)}>
          {oldest ? 'Oldest first' : 'Newest first'}
        </Button>
        <Button
          className="flow-btn"
          type="button"
          disabled
          title="Selecting several outputs is coming soon"
        >
          Select
        </Button>
      </div>
      <div className="outputs-board">
        <aside className="outputs-filters">
          <p className="outputs-label">Status</p>
          <Button
            className="outputs-filter"
            type="button"
            data-active={status === 'all'}
            onClick={() => setStatus('all')}
          >
            <span>All outputs</span>
            <span>{tally.all}</span>
          </Button>
          {counts.map(item => (
            <Button
              key={item.status}
              className="outputs-filter"
              type="button"
              data-active={status === item.status}
              onClick={() => setStatus(item.status)}
            >
              <span>
                <i data-status={item.status} />
                {item.status}
              </span>
              <span>{item.count}</span>
            </Button>
          ))}
          <p className="outputs-label">Ran from</p>
          <p className="outputs-soon">Agent chat, dialogs, notebook and ⌘K · filters coming soon</p>
          <span className="sheet-spacer" />
          <div className="outputs-howto">
            <strong>How outputs work</strong>
            <span>
              Every finished analysis in this project is kept here. Add to report puts it in the
              curated report and deliverables.
            </span>
          </div>
        </aside>
        <div className="outputs-list">
          <div className="outputs-list-head">
            <div>
              <h2>Outputs</h2>
              <p>Every analysis you run on this project&apos;s files is kept here.</p>
            </div>
          </div>
          <div className="outputs-cols">
            <span />
            <span>Base n</span>
            <span>Ran</span>
            <span>Status</span>
          </div>
          {groups.length ? (
            groups.map(group => (
              <section key={group.label}>
                <p className="outputs-day">{group.label}</p>
                {group.runs.map(run => (
                  <Button
                    key={run.id}
                    className="outputs-row"
                    type="button"
                    data-active={run.id === selectedId}
                    onClick={() => setSelectedId(run.id)}
                    onDoubleClick={() => {
                      setSelectedId(run.id);
                      setOpened(true);
                    }}
                  >
                    <span className="outputs-kind">{kindLabel(run.op)}</span>
                    <span className="outputs-title">
                      <strong>{run.title}</strong>
                      <span>
                        {[
                          run.file,
                          run.weightedBase != null
                            ? `Weighted base ${run.weightedBase.toLocaleString('en-GB')}`
                            : run.weighting,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                    <span className="outputs-base">
                      {run.base != null ? run.base.toLocaleString('en-GB') : '—'}
                    </span>
                    <span className="outputs-time">{clockLabel(run.created_at)}</span>
                    <span className="outputs-states">
                      <span className="outputs-status" data-state={stateOf(run)}>
                        {stateOf(run)}
                      </span>
                      {stateOf(run) === 'In report' ? (
                        <span className="outputs-status" data-state="Saved">
                          Saved
                        </span>
                      ) : null}
                    </span>
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
              <div className="outputs-detail-body">
                <p className="outputs-detail-meta">
                  <span className="outputs-kind">{kindLabel(selected.op)}</span>
                  {selected.file ? ` ${selected.file}` : ''}
                  {selected.created_at ? ` · ${clockLabel(selected.created_at)}` : ''}
                </p>
                <h2>{selected.title}</h2>
                <p className="flow-muted outputs-detail-sub">
                  {[
                    stateOf(selected),
                    base != null || selected.base != null ? `n = ${base ?? selected.base}` : '',
                    selected.weighting,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {detailPhase === 'loading' ? <Skeleton className="outputs-skeleton" /> : null}
                {detailPhase === 'error' ? <p className="flow-error">{exportError}</p> : null}
                {summary ? <p className="outputs-summary">{summary}</p> : null}
                {metrics.length ? (
                  <div className="outputs-block">
                    <span className="outputs-label">Key stat</span>
                    {metrics.slice(0, 3).map(metric => (
                      <p key={metric.label}>
                        {metric.label}: {metric.value}
                      </p>
                    ))}
                  </div>
                ) : null}
                {!summary && detailPhase === 'ready' ? (
                  <p className="flow-muted">This run has no stored summary.</p>
                ) : null}
                <div className="outputs-export">
                  <span className="outputs-label">Export</span>
                  <Button
                    className="outputs-fmt"
                    type="button"
                    onClick={() => download('pdf', 'analysis.pdf')}
                  >
                    PDF
                  </Button>
                  <Button
                    className="outputs-fmt"
                    type="button"
                    onClick={() => download('docx', 'analysis.docx')}
                  >
                    Word
                  </Button>
                  <Button
                    className="outputs-fmt"
                    type="button"
                    onClick={() => download('html', 'analysis.html')}
                  >
                    HTML
                  </Button>
                  <Button
                    className="outputs-fmt"
                    type="button"
                    disabled={!detail}
                    onClick={() => downloadLocal('csv')}
                  >
                    CSV
                  </Button>
                  <Button
                    className="outputs-fmt"
                    type="button"
                    disabled={!detail}
                    onClick={() => downloadLocal('md')}
                  >
                    Markdown
                  </Button>
                  <Button
                    className="outputs-fmt"
                    type="button"
                    disabled={!detail}
                    onClick={() => downloadLocal('apa')}
                  >
                    APA 7
                  </Button>
                </div>
                {exportError && detailPhase !== 'error' ? (
                  <p className="flow-error">{exportError}</p>
                ) : null}
              </div>
              <div className="outputs-detail-foot">
                <Button
                  className="flow-btn"
                  type="button"
                  disabled={!detail}
                  onClick={() => setOpened(true)}
                >
                  Add to report
                </Button>
                <Button className="flow-btn primary" type="button" onClick={() => setOpened(true)}>
                  Open
                </Button>
              </div>
            </>
          ) : (
            <p className="flow-muted outputs-detail-body">Select an analysis.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
