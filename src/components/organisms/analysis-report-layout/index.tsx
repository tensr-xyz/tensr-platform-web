'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AnalysisReport } from '@/lib/analysis-report-types';
import type { AnalysisRelatedLink } from '@/lib/analysis-chain-links';
import { AnalysisReportView } from '@/components/organisms/analysis-report-view';
import { AnalysisReportRail } from '@/components/organisms/analysis-report-rail';
import { AnalysisReportToolbar } from '@/components/organisms/analysis-report-toolbar';
import { buildReportOutline } from '@/lib/build-report-outline';
import {
  downloadReportXlsx,
  downloadTextFile,
  exportIdentityFrom,
  reportTablesToCsv,
  reportToHtml,
  reportToMarkdown,
} from '@/lib/report-export';
import { apiClient } from '@/lib/api-client';
import { useAnalysisSetupStore } from '@/stores/analysis-setup-store';
import type { AnalysisKey } from '@/lib/analysis-definitions';
import { revealConsumedRowsFromRun } from '@/lib/provenance-click-through';

import type { ReportAnnotation } from '@/lib/report-annotations';

type Props = {
  report: AnalysisReport;
  rawResult?: Record<string, unknown> | null;
  sourceDatasetId?: string;
  analysisOp?: string;
  analysisRunId?: string;
  relatedAnalyses?: AnalysisRelatedLink[] | null;
  provenance?: Record<string, unknown> | null;
};

export function AnalysisReportLayout({
  report,
  rawResult,
  sourceDatasetId,
  analysisOp,
  analysisRunId,
  relatedAnalyses,
  provenance,
}: Props) {
  const [railOpen, setRailOpen] = useState(true);
  const [activeSection, setActiveSection] = useState<string | undefined>();
  const [annotations, setAnnotations] = useState<ReportAnnotation[]>([]);
  const [annotationTarget, setAnnotationTarget] = useState<string | undefined>();
  const [annotationComposerOpen, setAnnotationComposerOpen] = useState(false);
  const [synthesizing, setSynthesizing] = useState(false);
  const annotationInputRef = useRef<HTMLTextAreaElement>(null);
  const openSetup = useAnalysisSetupStore(s => s.openSetup);

  const outline = useMemo(() => buildReportOutline(report), [report]);

  useEffect(() => {
    if (!analysisRunId || !sourceDatasetId) return;
    let cancelled = false;
    apiClient.reportComments
      .list(analysisRunId, sourceDatasetId)
      .then(payload => {
        if (cancelled) return;
        setAnnotations(
          (payload.comments || []).map(row => ({
            id: String(row.id),
            text: String(row.text || ''),
            target:
              row.anchor && typeof row.anchor === 'object'
                ? String((row.anchor as { id?: string }).id || '')
                : undefined,
            createdAt: String(row.created_at || new Date().toISOString()),
            authorName: row.author_name ? String(row.author_name) : undefined,
            parentId: row.parent_id ? String(row.parent_id) : undefined,
            resolved: Boolean(row.resolved),
          }))
        );
      })
      .catch(() => {
        /* Keep local notes if the report has not been saved yet. */
      });
    return () => {
      cancelled = true;
    };
  }, [analysisRunId, sourceDatasetId]);
  const exportIdentity = useMemo(
    () =>
      exportIdentityFrom({
        runId: analysisRunId,
        datasetId: sourceDatasetId,
        provenance,
      }),
    [analysisRunId, sourceDatasetId, provenance]
  );

  const focusAnnotations = useCallback(() => {
    setRailOpen(true);
    setAnnotationComposerOpen(true);
    window.setTimeout(() => {
      document.getElementById('report-rail-annotations')?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
      annotationInputRef.current?.focus();
    }, 50);
  }, []);

  const handleAnnotate = useCallback(
    (target?: string) => {
      setAnnotationTarget(target);
      focusAnnotations();
    },
    [focusAnnotations]
  );

  const handleAnnotateChart = useCallback(
    (_sectionId: string, chartTitle: string) => {
      handleAnnotate(chartTitle);
    },
    [handleAnnotate]
  );

  const handleAddAnnotation = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const local = {
        id: crypto.randomUUID(),
        text: trimmed,
        target: annotationTarget,
        createdAt: new Date().toISOString(),
      };
      setAnnotations(prev => [...prev, local]);
      setAnnotationTarget(undefined);
      setAnnotationComposerOpen(false);
      if (!analysisRunId || !sourceDatasetId) return;
      void apiClient.reportComments
        .create(analysisRunId, {
          text: trimmed,
          dataset_id: sourceDatasetId,
          anchor: annotationTarget ? { kind: 'section', id: annotationTarget } : undefined,
        })
        .then(payload => {
          const saved = payload.comment;
          setAnnotations(prev =>
            prev.map(note =>
              note.id === local.id
                ? {
                    ...note,
                    id: String(saved.id || note.id),
                    createdAt: String(saved.created_at || note.createdAt),
                    authorName: saved.author_name ? String(saved.author_name) : note.authorName,
                  }
                : note
            )
          );
        })
        .catch(err => {
          console.error('Saving the report comment failed', err);
        });
    },
    [analysisRunId, annotationTarget, sourceDatasetId]
  );

  const handleResolveAnnotation = useCallback(
    (id: string, resolved: boolean) => {
      setAnnotations(prev => prev.map(note => (note.id === id ? { ...note, resolved } : note)));
      if (!analysisRunId || !sourceDatasetId) return;
      void apiClient.reportComments
        .resolve(analysisRunId, id, { resolved, dataset_id: sourceDatasetId })
        .catch(err => {
          console.error('Updating the report comment failed', err);
        });
    },
    [analysisRunId, sourceDatasetId]
  );

  const handleRerun = useCallback(() => {
    const key = (analysisOp ?? report.meta.analysis_key) as AnalysisKey;
    if (key) openSetup(key);
  }, [analysisOp, report.meta.analysis_key, openSetup]);

  const handleRevealConsumedRows = useCallback(
    (group?: string) => {
      if (!analysisRunId || !sourceDatasetId) return;
      void revealConsumedRowsFromRun({
        runId: analysisRunId,
        sourceDatasetId,
        provenance,
        group,
      });
    },
    [analysisRunId, sourceDatasetId, provenance]
  );

  const handleNewAnalysis = useCallback(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }));
  }, []);

  const handleExportSummary = useCallback(() => {
    const root = document.getElementById('tensr-report-print-root');
    const btn = root?.querySelector<HTMLButtonElement>('[data-report-copy-summary]');
    btn?.click();
  }, []);

  const handleExportCsv = useCallback(() => {
    const csv = reportTablesToCsv(report, exportIdentity);
    if (!csv) return;
    const slug = report.meta.title.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'report';
    downloadTextFile(csv, `${slug}_tables.csv`, 'text/csv;charset=utf-8');
  }, [exportIdentity, report]);

  const handleExportExcel = useCallback(() => {
    void downloadReportXlsx(report, {
      provenance,
      datasetId: sourceDatasetId,
      raw: rawResult,
    }).catch(err => {
      console.error('Excel export failed', err);
    });
  }, [provenance, rawResult, report, sourceDatasetId]);

  const handleExportMarkdown = useCallback(() => {
    const md = reportToMarkdown(report, exportIdentity);
    const slug = report.meta.title.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'report';
    downloadTextFile(md, `${slug}.md`, 'text/markdown;charset=utf-8');
  }, [exportIdentity, report]);

  const handleExportHtml = useCallback(() => {
    const html = reportToHtml(report, { identity: exportIdentity });
    const slug = report.meta.title.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'report';
    downloadTextFile(html, `${slug}.html`, 'text/html;charset=utf-8');
  }, [exportIdentity, report]);

  const handleExportNarrative = useCallback(async () => {
    if (synthesizing) return;
    setSynthesizing(true);
    try {
      const charts = report.charts?.length ? report.charts : report.chart ? [report.chart] : [];
      const chartAssets = charts.filter(Boolean).map(c => ({ title: c!.title, kind: c!.kind }));
      const result = await apiClient.assistant.synthesizeReport({
        report: report as unknown as Record<string, unknown>,
        datasetId: sourceDatasetId ?? null,
        userQuestion: report.meta.subtitle || report.meta.title,
        prepLog:
          [report.analysis_log, report.case_exclusion_note].filter(Boolean).join('\n\n') || null,
        chartAssets,
        executionSummary: report.session_trace || report.approach?.exploration || null,
        useLlm: true,
      });
      const slug = report.meta.title.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'report';
      downloadTextFile(result.markdown, `${slug}_narrative.md`, 'text/markdown;charset=utf-8');
      const html = reportToHtml(report, {
        narrativeMarkdown: result.markdown,
        identity: exportIdentity,
      });
      downloadTextFile(html, `${slug}_narrative.html`, 'text/html;charset=utf-8');
    } catch (err) {
      console.error('Narrative report synthesis failed', err);
    } finally {
      setSynthesizing(false);
    }
  }, [exportIdentity, report, sourceDatasetId, synthesizing]);

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden bg-muted/20">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <AnalysisReportToolbar
          reportTitle={report.meta.title}
          sourceDatasetId={sourceDatasetId}
          railOpen={railOpen}
          onToggleRail={() => setRailOpen(o => !o)}
          onAnnotate={() => handleAnnotate()}
          onExport={handleExportSummary}
          onExportCsv={handleExportCsv}
          onExportExcel={handleExportExcel}
          onExportMarkdown={handleExportMarkdown}
          onExportHtml={handleExportHtml}
          onExportNarrative={handleExportNarrative}
          synthesizing={synthesizing}
          onNewAnalysis={handleNewAnalysis}
        />
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="mx-auto w-full max-w-[1080px] px-7 py-6 pb-20">
            <AnalysisReportView
              report={report}
              rawResult={rawResult}
              onAnnotateChart={handleAnnotateChart}
              relatedAnalyses={relatedAnalyses}
              provenance={provenance}
              onRevealConsumedRows={
                analysisRunId && sourceDatasetId ? handleRevealConsumedRows : undefined
              }
            />
          </div>
        </div>
      </div>
      {railOpen ? (
        <AnalysisReportRail
          report={report}
          outline={outline}
          sourceDatasetId={sourceDatasetId}
          currentRunId={analysisRunId}
          activeSection={activeSection}
          onSectionSelect={setActiveSection}
          onRerun={handleRerun}
          onExport={handleExportSummary}
          onExportCsv={handleExportCsv}
          onExportExcel={handleExportExcel}
          onExportMarkdown={handleExportMarkdown}
          onExportHtml={handleExportHtml}
          onExportNarrative={handleExportNarrative}
          synthesizing={synthesizing}
          annotations={annotations}
          annotationTarget={annotationTarget}
          annotationComposerOpen={annotationComposerOpen}
          annotationInputRef={annotationInputRef}
          onAnnotate={() => handleAnnotate()}
          onAnnotationTargetChange={setAnnotationTarget}
          onAnnotationComposerOpenChange={setAnnotationComposerOpen}
          onAddAnnotation={handleAddAnnotation}
          onResolveAnnotation={handleResolveAnnotation}
        />
      ) : null}
    </div>
  );
}
