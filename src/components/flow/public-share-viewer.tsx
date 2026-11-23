'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { AnalysisReportView } from '@/components/organisms/analysis-report-view';
import { Table } from '@/components/ui/table';
import { runDocument } from '@/components/flow/run-document';
import { ShareViewerFilters } from '@/components/flow/share-viewer-filters';
import {
  formatShareUpdated,
  type PublicSharePayload,
  type PublicShareReportPage,
} from '@/lib/public-share';
import type { AnalysisReport } from '@/lib/analysis-report-types';
import type { PublicViewerControl, SavedViewerView } from '@/lib/share-viewer-controls';

function storedReport(run: Record<string, unknown> | undefined): AnalysisReport | null {
  if (!run) return null;
  const report = run.report;
  if (!report || typeof report !== 'object') return null;
  const record = report as AnalysisReport;
  if (!record.meta || typeof record.meta.title !== 'string' || !Array.isArray(record.tables)) {
    return null;
  }
  return record;
}

function pageTexts(page: PublicShareReportPage | undefined): string[] {
  if (!page?.objects?.length) return [];
  return [...page.objects]
    .filter(obj => obj.kind === 'text' && String(obj.text || '').trim())
    .sort((a, b) => Number(a.frame?.y || 0) - Number(b.frame?.y || 0))
    .map(obj => String(obj.text || '').trim());
}

function pageRunIds(page: PublicShareReportPage | undefined): string[] {
  if (!page?.objects?.length) return [];
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const obj of page.objects) {
    const id = String(obj.run_id || '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

function RunBlock({ run }: { run: Record<string, unknown> }) {
  const fullReport = storedReport(run);
  const document = runDocument(run);
  if (fullReport) {
    return (
      <AnalysisReportView
        report={fullReport}
        rawResult={
          run.result && typeof run.result === 'object'
            ? (run.result as Record<string, unknown>)
            : null
        }
        datasetId={String(run.dataset_id || '')}
        analysisRunId={String(run.id || '')}
      />
    );
  }
  return (
    <>
      {document?.summary ? <p className="pv-insight">{document.summary}</p> : null}
      {(document?.tables || []).map(table => (
        <section key={table.title} className="output-section">
          <h2>{table.title}</h2>
          <Table className="flow-table output-grid">
            <thead>
              <tr>
                {table.columns.map(column => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map(row => (
                <tr key={row.join('|')}>
                  {row.map((cell, cellIndex) => (
                    <td key={`${cell}-${cellIndex}`}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </Table>
        </section>
      ))}
    </>
  );
}

export function PublicShareViewer({
  token,
  payload,
  controls,
  savedViews,
  filterValues,
  filterBusy,
  filterError,
  onFilterChange,
  onSaveView,
  onApplyView,
}: {
  token: string;
  payload: PublicSharePayload;
  controls: PublicViewerControl[];
  savedViews: SavedViewerView[];
  filterValues: Record<string, unknown>;
  filterBusy: boolean;
  filterError: string;
  onFilterChange: (next: Record<string, unknown>) => void;
  onSaveView: (name: string, values: Record<string, unknown>) => void;
  onApplyView: (view: SavedViewerView) => void;
}) {
  const workspace = payload.workspace?.name?.trim() || 'this workspace';
  const projectName = payload.project.name?.trim() || 'Shared report';
  const updated =
    formatShareUpdated(payload.report?.updated_at || payload.project.updated_at) || '';
  const loginHref = `/login?${new URLSearchParams({ returnTo: `/s/${token}` })}`;
  const isOutput = payload.share.kind === 'output';
  const pages = payload.report?.pages || [];
  const [activePageId, setActivePageId] = useState(pages[0]?.id || '');
  const activePage = useMemo(() => {
    if (!pages.length) return undefined;
    return pages.find(page => page.id === activePageId) || pages[0];
  }, [pages, activePageId]);
  const texts = pageTexts(activePage);
  const headline = texts[0] || activePage?.title || payload.share.title || projectName;
  const insight = texts.slice(1).join('\n\n');
  const runMap = payload.report?.runs || {};
  const pageRuns = pageRunIds(activePage)
    .map(id => runMap[id])
    .filter((row): row is Record<string, unknown> => Boolean(row));
  const outputRun = payload.run;
  const sharedCount = payload.report?.shared_count ?? pages.length;
  const totalCount = payload.report?.total_count ?? pages.length;
  const showPageList = !isOutput && pages.length > 0;
  const appendixHidden = !isOutput && totalCount > sharedCount;

  return (
    <div className="pv">
      <header className="pv-header">
        <div className="pv-brand">
          <span className="pv-logo" aria-hidden="true" />
          <span className="pv-titles">
            <strong>{isOutput ? String(payload.share.title || headline) : projectName}</strong>
            <span>
              Shared by {workspace}
              {updated ? ` · updated ${updated}` : ''} · read-only
            </span>
          </span>
        </div>
        <div className="pv-actions">
          <button type="button" className="pv-btn" onClick={() => window.print()}>
            Download PDF
          </button>
          <Link className="pv-btn" href={loginHref}>
            Sign in to comment
          </Link>
          <span className="pv-made">Made with Tensr</span>
        </div>
      </header>
      <div className="pv-body">
        {showPageList ? (
          <aside className="pv-pages" aria-label="Shared pages">
            <p className="pv-pages-label">Pages · {sharedCount} shared</p>
            <nav className="pv-page-list">
              {pages.map((page, index) => {
                const id = String(page.id || index);
                const selected = (activePage?.id || pages[0]?.id) === page.id;
                return (
                  <button
                    key={id}
                    type="button"
                    className="pv-page-item"
                    data-active={selected ? 'true' : 'false'}
                    onClick={() => setActivePageId(String(page.id || ''))}
                  >
                    {index + 1} · {page.title || 'Page'}
                  </button>
                );
              })}
            </nav>
            {appendixHidden ? (
              <p className="pv-pages-note">
                The appendix isn&apos;t shared. Ask {workspace} for the full report.
              </p>
            ) : null}
          </aside>
        ) : null}
        <main className="pv-main">
          <article className="pv-slide">
            {isOutput ? (
              <>
                <h1 className="pv-headline">{String(payload.share.title || 'Output')}</h1>
                <ShareViewerFilters
                  controls={controls}
                  savedViews={savedViews}
                  values={filterValues}
                  busy={filterBusy}
                  error={filterError}
                  onChange={onFilterChange}
                  onSaveView={onSaveView}
                  onApplyView={onApplyView}
                />
                {outputRun ? (
                  <RunBlock run={outputRun} />
                ) : (
                  <p className="pv-muted">This output has nothing to show.</p>
                )}
              </>
            ) : (
              <>
                <h1 className="pv-headline">{headline}</h1>
                {insight ? <p className="pv-insight">{insight}</p> : null}
                {pageRuns.map(run => (
                  <RunBlock key={String(run.id)} run={run} />
                ))}
                {!pageRuns.length && !insight ? (
                  <p className="pv-muted">This page has nothing to show yet.</p>
                ) : null}
                <p className="pv-base">Click any number to see where it came from.</p>
              </>
            )}
          </article>
        </main>
      </div>
    </div>
  );
}
