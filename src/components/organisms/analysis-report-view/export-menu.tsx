'use client';

import React from 'react';
import { ChevronDown } from 'lucide-react';
import type { AnalysisReport } from '@/lib/analysis-report-types';
import type { AnalysisRelatedLink } from '@/lib/analysis-chain-links';
import { Button } from '@/components/atoms/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/molecules/dropdown';
import { downloadTableExport } from '@/lib/custom-tables/api';
import {
  bannerSpecId,
  downloadPipelineReport,
  downloadReportXlsx,
  downloadTextFile,
  pipelineExportRequest,
  toolTraceFromReport,
} from '@/lib/report-export';
type Props = {
  report: AnalysisReport;
  rawResult?: Record<string, unknown> | null;
  provenance?: Record<string, unknown> | null;
  datasetId?: string;
  analysisRunId?: string;
  related?: AnalysisRelatedLink[] | null;
  onStatus?: (message: string) => void;
  /** Tests open the menu without a pointer event. */
  defaultOpen?: boolean;
};

export function ReportExportMenu({
  report,
  rawResult,
  provenance,
  datasetId,
  analysisRunId,
  related,
  onStatus,
  defaultOpen,
}: Props) {
  const [busy, setBusy] = React.useState(false);
  const rScript = report.reproducibility?.r_script?.trim() || '';
  const specId = bannerSpecId(report, rawResult);
  const relatedRunIds = (related ?? [])
    .map(link => link.runId)
    .filter((id): id is string => Boolean(id));

  const run = async (label: string, action: () => Promise<void> | void) => {
    setBusy(true);
    try {
      await action();
      onStatus?.(`${label} downloaded`);
    } catch (err) {
      onStatus?.(err instanceof Error ? err.message : `${label} failed`);
    } finally {
      setBusy(false);
    }
  };

  const exportDocument = (format: 'docx' | 'pdf') =>
    run(format === 'docx' ? 'Word' : 'PDF', () => {
      const savedRun = Boolean(analysisRunId) || relatedRunIds.length > 0;
      const body = pipelineExportRequest({
        runId: analysisRunId,
        relatedRunIds,
        toolTrace: savedRun ? undefined : toolTraceFromReport(report),
      });
      return downloadPipelineReport(format, body);
    });

  const exportBanner = (kind: 'xlsx' | 'pptx' | 'docx', label: string) =>
    run(label, async () => {
      if (!datasetId || !specId) throw new Error('Save the banner before exporting it');
      const { getStytchBearerForTensrApi } = await import('@/utils/auth');
      return downloadTableExport(datasetId, specId, kind, getStytchBearerForTensrApi());
    });

  return (
    <DropdownMenu defaultOpen={defaultOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 text-xs"
          disabled={busy}
          data-testid="report-export-menu"
        >
          Export
          <ChevronDown className="ml-1.5 size-3.5" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onSelect={() => void exportDocument('docx')}>Word</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void exportDocument('pdf')}>PDF</DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() =>
            void run('Excel', () =>
              downloadReportXlsx(report, { provenance, datasetId, raw: rawResult })
            )
          }
        >
          Excel
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!rScript}
          onSelect={() =>
            void run('R script', () => {
              const slug =
                report.meta.title.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'report';
              downloadTextFile(rScript, `${slug}.R`, 'text/plain;charset=utf-8');
            })
          }
        >
          R script
        </DropdownMenuItem>
        {specId && datasetId ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void exportBanner('docx', 'Banner Word')}>
              Banner Word
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void exportBanner('pptx', 'Banner PowerPoint')}>
              Banner PowerPoint
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void exportBanner('xlsx', 'Banner Excel')}>
              Banner Excel
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
