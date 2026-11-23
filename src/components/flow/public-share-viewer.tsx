'use client';

import Link from 'next/link';
import { useMemo, useState, type ReactNode } from 'react';
import { AnalysisReportView } from '@/components/organisms/analysis-report-view';
import { Button } from '@/components/ui/button';
import { Table } from '@/components/ui/table';
import { runDocument } from '@/components/flow/run-document';
import { ShareViewerFilters } from '@/components/flow/share-viewer-filters';
import {
  formatShareUpdated,
  type PublicSharePayload,
  type PublicShareReportPage,
} from '@/lib/public-share';
import {
  evidencePageIdsFromPage,
  publicTextSegments,
  type PublicPageLinkTarget,
  type PublicTextSegment,
} from '@/lib/public-share-page-links';
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

function pageTextObjects(page: PublicShareReportPage | undefined) {
  if (!page?.objects?.length) return [];
  return [...page.objects]
    .filter(obj => obj.kind === 'text' && (String(obj.text || '').trim() || obj.runs?.length))
    .sort((a, b) => Number(a.frame?.y || 0) - Number(b.frame?.y || 0));
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

function LinkedSegments({
  segments,
  className,
  as: Tag = 'p',
  onPageLink,
}: {
  segments: PublicTextSegment[];
  className?: string;
  as?: 'p' | 'h1';
  onPageLink: (pageId: string) => void;
}) {
  if (!segments.length) return null;
  return (
    <Tag className={className}>
      {segments.map((segment, index) => {
        const key = `${segment.text}-${index}`;
        if (!segment.target) {
          return <span key={key}>{segment.text}</span>;
        }
        return (
          <PageLink key={key} target={segment.target} onPageLink={onPageLink}>
            {segment.text}
          </PageLink>
        );
      })}
    </Tag>
  );
}

function PageLink({
  target,
  onPageLink,
  children,
}: {
  target: PublicPageLinkTarget;
  onPageLink: (pageId: string) => void;
  children: ReactNode;
}) {
  if (target.kind === 'url') {
    return (
      <a className="pv-page-link" href={target.url} target="_blank" rel="noreferrer">
        {children}
      </a>
    );
  }
  return (
    <button type="button" className="pv-page-link" onClick={() => onPageLink(target.pageId)}>
      {children}
    </button>
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
  const sharedPageIds = useMemo(
    () => new Set(pages.map(page => String(page.id || '')).filter(Boolean)),
    [pages]
  );
  const [activePageId, setActivePageId] = useState(pages[0]?.id || '');
  const activePage = useMemo(() => {
    if (!pages.length) return undefined;
    return pages.find(page => page.id === activePageId) || pages[0];
  }, [pages, activePageId]);
  const textObjects = pageTextObjects(activePage);
  const headlineSegments = publicTextSegments(textObjects[0], sharedPageIds);
  const insightBlocks = textObjects.slice(1).map(obj => publicTextSegments(obj, sharedPageIds));
  const headlineFallback = activePage?.title || payload.share.title || projectName;
  const runMap = payload.report?.runs || {};
  const pageRuns = pageRunIds(activePage)
    .map(id => runMap[id])
    .filter((row): row is Record<string, unknown> => Boolean(row));
  const outputRun = payload.run;
  const sharedCount = payload.report?.shared_count ?? pages.length;
  const totalCount = payload.report?.total_count ?? pages.length;
  const showPageList = !isOutput && pages.length > 0;
  const appendixHidden = !isOutput && totalCount > sharedCount;
  const evidenceIds = evidencePageIdsFromPage(activePage, sharedPageIds);
  const evidencePages = evidenceIds
    .map(id => pages.find(page => page.id === id))
    .filter((page): page is PublicShareReportPage => Boolean(page));

  const goToPage = (pageId: string) => {
    if (sharedPageIds.has(pageId)) setActivePageId(pageId);
  };

  return (
    <div className="pv">
      <header className="pv-header">
        <div className="pv-brand">
          <span className="pv-logo" aria-hidden="true" />
          <span className="pv-titles">
            <strong>
              {isOutput ? String(payload.share.title || headlineFallback) : projectName}
            </strong>
            <span>
              Shared by {workspace}
              {updated ? ` · updated ${updated}` : ''} · read-only
            </span>
          </span>
        </div>
        <div className="pv-actions">
          <Button type="button" className="pv-btn" onClick={() => window.print()}>
            Download PDF
          </Button>
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
                  <Button
                    key={id}
                    type="button"
                    className="pv-page-item"
                    data-active={selected ? 'true' : 'false'}
                    onClick={() => setActivePageId(String(page.id || ''))}
                  >
                    {index + 1} · {page.title || 'Page'}
                  </Button>
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
                {headlineSegments.length ? (
                  <LinkedSegments
                    as="h1"
                    className="pv-headline"
                    segments={headlineSegments}
                    onPageLink={goToPage}
                  />
                ) : (
                  <h1 className="pv-headline">{headlineFallback}</h1>
                )}
                {insightBlocks.map((segments, index) => (
                  <LinkedSegments
                    key={`insight-${index}`}
                    className="pv-insight"
                    segments={segments}
                    onPageLink={goToPage}
                  />
                ))}
                {pageRuns.map(run => (
                  <RunBlock key={String(run.id)} run={run} />
                ))}
                {!pageRuns.length && !headlineSegments.length && !insightBlocks.length ? (
                  <p className="pv-muted">This page has nothing to show yet.</p>
                ) : null}
                {evidencePages.length ? (
                  <nav className="pv-evidence" aria-label="Evidence pages">
                    {evidencePages.map(page => (
                      <Button
                        key={String(page.id)}
                        type="button"
                        className="pv-evidence-link"
                        onClick={() => goToPage(String(page.id || ''))}
                      >
                        {page.title || 'Evidence'}
                      </Button>
                    ))}
                  </nav>
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
