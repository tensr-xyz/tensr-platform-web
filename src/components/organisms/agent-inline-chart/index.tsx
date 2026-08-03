'use client';

import React, { useRef, useState } from 'react';
import { Download, Maximize2 } from 'lucide-react';
import type { AnalysisReportChart } from '@/lib/analysis-report-types';
import { ReportChart } from '@/components/molecules/report-chart';
import { Button } from '@/components/atoms/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/molecules/dropdown';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/molecules/dialog';
import { exportSvgElementAsPng, exportSvgElementAsSvg } from '@/utils/chart-export';

type Props = {
  chart: AnalysisReportChart;
  caption?: string;
  compact?: boolean;
  onExportError?: (message: string) => void;
};

export function AgentInlineChart({ chart, caption, compact = false, onExportError }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fullscreenRef = useRef<HTMLDivElement>(null);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const title = chart.title || 'chart';

  const getSvg = (scope: 'inline' | 'fullscreen') => {
    const root = scope === 'fullscreen' ? fullscreenRef.current : containerRef.current;
    return root?.querySelector('svg') ?? null;
  };

  const handleExport = async (format: 'svg' | 'png', scope: 'inline' | 'fullscreen' = 'inline') => {
    const svg = getSvg(scope);
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

  const toolbar = (
    <div className="flex items-center gap-0.5">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-[11px]"
        onClick={() => setFullscreenOpen(true)}
        aria-label="View chart fullscreen"
      >
        <Maximize2 className="mr-1 size-3" aria-hidden />
        {!compact ? 'Expand' : null}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-[11px]">
            <Download className="mr-1 size-3" aria-hidden />
            {!compact ? 'Download' : null}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => void handleExport('png')}>PNG image</DropdownMenuItem>
          <DropdownMenuItem onClick={() => void handleExport('svg')}>SVG</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  return (
    <>
      <div className="my-3 overflow-hidden rounded-lg border border-border bg-card/80">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/80 px-3 py-1.5">
          <p className="text-[11px] font-medium text-muted-foreground">{caption ?? title}</p>
          {toolbar}
        </div>
        <div ref={containerRef} className="p-3">
          <ReportChart chart={chart} />
        </div>
      </div>

      <Dialog open={fullscreenOpen} onOpenChange={setFullscreenOpen}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-auto">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div ref={fullscreenRef} className="min-h-[420px] p-2">
            <ReportChart chart={chart} />
          </div>
          <div className="flex justify-end gap-1 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-[11px]"
              onClick={() => void handleExport('png', 'fullscreen')}
            >
              Download PNG
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-[11px]"
              onClick={() => void handleExport('svg', 'fullscreen')}
            >
              Download SVG
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
