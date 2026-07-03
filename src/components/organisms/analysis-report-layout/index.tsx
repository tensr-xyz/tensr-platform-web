'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import type { AnalysisReport } from '@/lib/analysis-report-types';
import { AnalysisReportView } from '@/components/organisms/analysis-report-view';
import { AnalysisReportRail } from '@/components/organisms/analysis-report-rail';
import { AnalysisReportToolbar } from '@/components/organisms/analysis-report-toolbar';
import { buildReportOutline } from '@/lib/build-report-outline';
import { downloadTextFile, reportTablesToCsv, reportToMarkdown } from '@/lib/report-export';
import { useAnalysisSetupStore } from '@/stores/analysis-setup-store';
import type { AnalysisKey } from '@/lib/analysis-definitions';

import type { ReportAnnotation } from '@/lib/report-annotations';

type Props = {
  report: AnalysisReport;
  rawResult?: Record<string, unknown> | null;
  sourceDatasetId?: string;
  analysisOp?: string;
  analysisRunId?: string;
};

export function AnalysisReportLayout({
  report,
  rawResult,
  sourceDatasetId,
  analysisOp,
  analysisRunId,
}: Props) {
  const [railOpen, setRailOpen] = useState(true);
  const [activeSection, setActiveSection] = useState<string | undefined>();
  const [annotations, setAnnotations] = useState<ReportAnnotation[]>([]);
  const [annotationTarget, setAnnotationTarget] = useState<string | undefined>();
  const [annotationComposerOpen, setAnnotationComposerOpen] = useState(false);
  const annotationInputRef = useRef<HTMLTextAreaElement>(null);
  const openSetup = useAnalysisSetupStore(s => s.openSetup);

  const outline = useMemo(() => buildReportOutline(report), [report]);

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
      setAnnotations(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          text: trimmed,
          target: annotationTarget,
          createdAt: new Date().toISOString(),
        },
      ]);
      setAnnotationTarget(undefined);
      setAnnotationComposerOpen(false);
    },
    [annotationTarget]
  );

  const handleRerun = useCallback(() => {
    const key = (analysisOp ?? report.meta.analysis_key) as AnalysisKey;
    if (key) openSetup(key);
  }, [analysisOp, report.meta.analysis_key, openSetup]);

  const handleNewAnalysis = useCallback(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }));
  }, []);

  const handleExportSummary = useCallback(() => {
    const root = document.getElementById('tensr-report-print-root');
    const btn = root?.querySelector<HTMLButtonElement>('[data-report-copy-summary]');
    btn?.click();
  }, []);

  const handleExportCsv = useCallback(() => {
    const csv = reportTablesToCsv(report);
    if (!csv) return;
    const slug = report.meta.title.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'report';
    downloadTextFile(csv, `${slug}_tables.csv`, 'text/csv;charset=utf-8');
  }, [report]);

  const handleExportMarkdown = useCallback(() => {
    const md = reportToMarkdown(report);
    const slug = report.meta.title.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'report';
    downloadTextFile(md, `${slug}.md`, 'text/markdown;charset=utf-8');
  }, [report]);

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
          onExportMarkdown={handleExportMarkdown}
          onNewAnalysis={handleNewAnalysis}
        />
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="mx-auto w-full max-w-[1080px] px-7 py-6 pb-20">
            <AnalysisReportView
              report={report}
              rawResult={rawResult}
              onAnnotateChart={handleAnnotateChart}
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
          onExportMarkdown={handleExportMarkdown}
          annotations={annotations}
          annotationTarget={annotationTarget}
          annotationComposerOpen={annotationComposerOpen}
          annotationInputRef={annotationInputRef}
          onAnnotate={() => handleAnnotate()}
          onAnnotationTargetChange={setAnnotationTarget}
          onAnnotationComposerOpenChange={setAnnotationComposerOpen}
          onAddAnnotation={handleAddAnnotation}
        />
      ) : null}
    </div>
  );
}
