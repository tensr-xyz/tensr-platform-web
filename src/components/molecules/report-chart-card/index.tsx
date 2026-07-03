'use client';

import React, { useRef } from 'react';
import { Download, MessageSquarePlus } from 'lucide-react';
import type { AnalysisReportChart } from '@/lib/analysis-report-types';
import { ReportChart } from '@/components/molecules/report-chart';
import { Button } from '@/components/atoms/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/molecules/dropdown';
import { exportSvgElementAsPng, exportSvgElementAsSvg } from '@/utils/chart-export';

type Props = {
  chart: AnalysisReportChart;
  onAnnotate?: () => void;
  onExportError?: (message: string) => void;
};

export function ReportChartCard({ chart, onAnnotate, onExportError }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const title = chart.title || 'chart';

  const getSvg = () => containerRef.current?.querySelector('svg') ?? null;

  const handleExport = async (format: 'svg' | 'png') => {
    const svg = getSvg();
    if (!svg) {
      onExportError?.('Chart not ready to export');
      return;
    }
    try {
      if (format === 'svg') {
        exportSvgElementAsSvg(svg, title);
      } else {
        await exportSvgElementAsPng(svg, title);
      }
    } catch {
      onExportError?.('Failed to export chart');
    }
  };

  return (
    <div className="overflow-hidden rounded-md border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/30 px-3 py-2 print:hidden">
        <h4 className="text-[12.5px] font-medium text-foreground">{title}</h4>
        <div className="flex items-center gap-1">
          {onAnnotate ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[11px]"
              onClick={onAnnotate}
            >
              <MessageSquarePlus className="mr-1 size-3" aria-hidden />
              Annotate
            </Button>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-[11px]">
                <Download className="mr-1 size-3" aria-hidden />
                Download
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => void handleExport('png')}>
                PNG image
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void handleExport('svg')}>SVG</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div ref={containerRef} className="p-4 pb-2">
        <ReportChart chart={chart} />
      </div>
    </div>
  );
}
