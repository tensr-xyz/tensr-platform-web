'use client';

import React from 'react';
import { Download, FolderOpen, Lock, PanelRight, Plus } from 'lucide-react';
import { Button } from '@/components/atoms/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/molecules/dropdown';
import { useProjectStore } from '@/stores/project-store';
import { useTabsStore, ViewType } from '@/stores/tabs-store';
import { cn } from '@/utils';

type Props = {
  reportTitle: string;
  sourceDatasetId?: string;
  railOpen: boolean;
  onToggleRail: () => void;
  onAnnotate?: () => void;
  onExport?: () => void;
  onExportCsv?: () => void;
  onExportMarkdown?: () => void;
  onNewAnalysis?: () => void;
};

export function AnalysisReportToolbar({
  reportTitle,
  sourceDatasetId,
  railOpen,
  onToggleRail,
  onAnnotate,
  onExport,
  onExportCsv,
  onExportMarkdown,
  onNewAnalysis,
}: Props) {
  const { currentProject } = useProjectStore();
  const { tabs } = useTabsStore();

  const datasetTab = tabs.find(
    t =>
      t.type === ViewType.SPREADSHEET &&
      (t.data?.filePath === sourceDatasetId ||
        t.path === sourceDatasetId ||
        t.id === sourceDatasetId)
  );

  const studyLabel = currentProject?.name ?? 'Workspace';
  const datasetLabel = datasetTab?.name ?? 'Dataset';

  return (
    <div className="sticky top-0 z-10 shrink-0 border-b border-border/60 bg-background/90 px-6 py-2.5 backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <FolderOpen className="size-3 shrink-0 opacity-60" aria-hidden />
          <span className="truncate">{studyLabel}</span>
          <span className="opacity-40">/</span>
          <span className="truncate">{datasetLabel}</span>
          <span className="opacity-40">/</span>
          <span className="truncate font-medium text-foreground">{reportTitle}</span>
          <span className="ml-2 inline-flex h-6 items-center gap-1 rounded-full border border-border bg-muted/40 px-2 text-[10.5px] text-muted-foreground">
            <Lock className="size-2.5" aria-hidden />
            Read-only
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={onAnnotate}
          >
            <Plus className="size-3" aria-hidden />
            Annotate
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
                <Download className="size-3" aria-hidden />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onExport}>Copy summary</DropdownMenuItem>
              <DropdownMenuItem onClick={onExportCsv} disabled={!onExportCsv}>
                CSV (all tables)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onExportMarkdown} disabled={!onExportMarkdown}>
                Markdown
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.print()}>Print / PDF</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button type="button" size="sm" className="h-7 gap-1.5 text-xs" onClick={onNewAnalysis}>
            <Plus className="size-3" aria-hidden />
            New analysis
          </Button>
          <span className="mx-1 h-[18px] w-px bg-border" aria-hidden />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn('size-8', railOpen && 'bg-muted')}
            title={railOpen ? 'Hide report panel' : 'Show report panel'}
            onClick={onToggleRail}
          >
            <PanelRight className="size-3.5" aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  );
}
