'use client';

import React from 'react';
import { ArrowRight, ChevronDown, FileText, Plus, Redo2, Download, Command } from 'lucide-react';
import type { AnalysisReport } from '@/lib/analysis-report-types';
import type { ReportOutlineItem } from '@/lib/build-report-outline';
import { scrollToReportSection } from '@/lib/build-report-outline';
import type { ReportAnnotation } from '@/lib/report-annotations';
import { ColumnTypeBadge, isNumericDataType } from '@/components/molecules/column-type-badge';
import { Button } from '@/components/atoms/button';
import { cn } from '@/utils';
import { useAnalysisSetupStore } from '@/stores/analysis-setup-store';
import {
  formatRunLabel,
  formatRunTime,
  listDatasetAnalysisRuns,
  openStoredAnalysisRun,
  type StoredAnalysisRun,
} from '@/lib/analysis-runs';

function RailSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-border px-4 py-3.5">
      <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}

function VarPicker({
  label,
  value,
  columnType,
}: {
  label: string;
  value: string;
  columnType?: string;
}) {
  const isNumeric = isNumericDataType(columnType) || columnType === 'number';
  return (
    <button
      type="button"
      className="flex w-full items-center gap-2 rounded-md border border-border bg-card px-2.5 py-2 text-left text-[12.5px] text-foreground transition-colors hover:bg-muted/30"
    >
      <ColumnTypeBadge isNumeric={isNumeric} className="size-4 border-0 opacity-100" />
      <span className="min-w-0 flex-1 truncate font-medium">{value}</span>
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70">{label}</span>
      <ChevronDown className="size-3 shrink-0 text-muted-foreground/60" aria-hidden />
    </button>
  );
}

function pickSpecInputs(report: AnalysisReport): { label: string; value: string; type?: string }[] {
  const inputs = report.analysis_spec?.inputs ?? {};
  const pairs: { label: string; value: string; type?: string }[] = [];
  const labelMap: Record<string, string> = {
    dependent_variable: 'DV',
    dependent_var: 'DV',
    dv: 'DV',
    outcome: 'DV',
    y: 'DV',
    independent_variable: 'Factor',
    independent_var: 'Factor',
    factor: 'Factor',
    group: 'Factor',
    x: 'Factor',
    predictor: 'Predictor',
    covariate: 'Covariate',
  };

  for (const [key, raw] of Object.entries(inputs)) {
    if (raw === null || raw === undefined) continue;
    const value = Array.isArray(raw) ? raw.join(', ') : String(raw);
    if (!value || key.startsWith('_')) continue;
    pairs.push({
      label: labelMap[key] ?? key.replace(/_/g, ' '),
      value,
    });
  }

  if (pairs.length === 0 && report.meta.subtitle) {
    const parts = report.meta.subtitle.split(/\s+by\s+/i);
    if (parts[0]) pairs.push({ label: 'DV', value: parts[0].trim() });
    if (parts[1]) pairs.push({ label: 'Factor', value: parts[1].trim() });
  }

  return pairs.slice(0, 4);
}

type Props = {
  report: AnalysisReport;
  outline: ReportOutlineItem[];
  sourceDatasetId?: string;
  currentRunId?: string;
  activeSection?: string;
  onSectionSelect?: (id: string) => void;
  onRerun?: () => void;
  onExport?: () => void;
  onExportCsv?: () => void;
  onExportMarkdown?: () => void;
  annotations?: ReportAnnotation[];
  annotationTarget?: string;
  annotationComposerOpen?: boolean;
  annotationInputRef?: React.RefObject<HTMLTextAreaElement | null>;
  onAnnotate?: () => void;
  onAnnotationTargetChange?: (target: string | undefined) => void;
  onAnnotationComposerOpenChange?: (open: boolean) => void;
  onAddAnnotation?: (text: string) => void;
};

export function AnalysisReportRail({
  report,
  outline,
  sourceDatasetId,
  currentRunId,
  activeSection,
  onSectionSelect,
  onRerun,
  onExport,
  onExportCsv,
  onExportMarkdown,
  annotations = [],
  annotationTarget,
  annotationComposerOpen = false,
  annotationInputRef,
  onAnnotate,
  onAnnotationTargetChange,
  onAnnotationComposerOpenChange,
  onAddAnnotation,
}: Props) {
  const [draft, setDraft] = React.useState('');
  const [otherRuns, setOtherRuns] = React.useState<StoredAnalysisRun[]>([]);

  React.useEffect(() => {
    if (!sourceDatasetId) return;
    let cancelled = false;
    listDatasetAnalysisRuns(sourceDatasetId).then(all => {
      if (!cancelled) {
        setOtherRuns(all.filter(r => r.id !== currentRunId).slice(0, 8));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [sourceDatasetId, currentRunId]);

  const variables = pickSpecInputs(report);
  const exportItems = [
    { label: 'Copy summary', icon: FileText, onClick: onExport },
    { label: 'CSV (all tables)', icon: FileText, onClick: onExportCsv },
    { label: 'Markdown', icon: FileText, onClick: onExportMarkdown },
    { label: 'Print / PDF', icon: Download, onClick: () => window.print() },
  ];

  const submitAnnotation = () => {
    if (!draft.trim()) return;
    onAddAnnotation?.(draft);
    setDraft('');
  };

  return (
    <aside className="flex h-full w-[260px] min-w-[260px] shrink-0 flex-col overflow-auto border-l border-border bg-muted/30">
      <RailSection label="Re-run analysis">
        <div className="flex flex-col gap-2">
          {variables.length > 0 ? (
            variables.map((v, i) => (
              <VarPicker key={i} label={v.label} value={v.value} columnType={v.type} />
            ))
          ) : (
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Open the setup dialog to change variables and run again.
            </p>
          )}
        </div>
        <div className="mt-2.5 flex gap-2">
          <Button type="button" size="sm" className="h-8 flex-1 gap-1.5 text-xs" onClick={onRerun}>
            <Redo2 className="size-3.5" aria-hidden />
            Re-run
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8 shrink-0"
            title="Open command palette"
            onClick={() => useAnalysisSetupStore.getState().setCommandPaletteOpen(true)}
          >
            <Command className="size-3.5" aria-hidden />
          </Button>
        </div>
        <button
          type="button"
          className="mt-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <Plus className="size-3" aria-hidden />
          Add covariate
        </button>
      </RailSection>

      {otherRuns.length > 0 ? (
        <RailSection label="Other saved runs">
          <div className="flex flex-col gap-0.5">
            {otherRuns.map(run => (
              <button
                key={run.id}
                type="button"
                onClick={() => openStoredAnalysisRun(run)}
                className="flex flex-col gap-0.5 rounded-sm px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              >
                <span className="truncate font-medium text-foreground">{formatRunLabel(run)}</span>
                <span className="font-mono text-[10px]">{formatRunTime(run.created_at)}</span>
              </button>
            ))}
          </div>
        </RailSection>
      ) : null}

      <RailSection label="In this report">
        <div className="flex flex-col gap-0.5">
          {outline.map((item, i) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSectionSelect?.(item.id);
                scrollToReportSection(item.id);
              }}
              className={cn(
                'flex items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs transition-colors',
                activeSection === item.id
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              )}
            >
              <span className="w-[18px] shrink-0 font-mono text-[10px] text-muted-foreground/70">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {item.badge ? (
                <span
                  className={cn(
                    'shrink-0 rounded px-1 py-px text-[9px] font-semibold',
                    item.badgeClassName ?? 'bg-muted text-muted-foreground'
                  )}
                >
                  {item.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </RailSection>

      <RailSection label="Annotations">
        <div id="report-rail-annotations">
          {annotations.length ? (
            <div className="mb-3 flex flex-col gap-2">
              {annotations.map(note => (
                <div
                  key={note.id}
                  className="rounded-md border border-border bg-card px-2.5 py-2 text-[11px] leading-relaxed text-foreground"
                >
                  {note.target ? (
                    <p className="mb-1 text-[10px] font-medium text-primary">{note.target}</p>
                  ) : null}
                  <p>{note.text}</p>
                  <p className="mt-1 text-[9px] text-muted-foreground">
                    {new Date(note.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mb-2 text-[11px] leading-relaxed text-muted-foreground">
              Comments on this report will appear here.
            </p>
          )}

          {annotationComposerOpen ? (
            <div className="mb-2 space-y-2 rounded-md border border-border bg-card p-2.5">
              {annotationTarget ? (
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-medium text-primary">On: {annotationTarget}</p>
                  <button
                    type="button"
                    className="text-[10px] text-muted-foreground hover:text-foreground"
                    onClick={() => onAnnotationTargetChange?.(undefined)}
                  >
                    Clear
                  </button>
                </div>
              ) : null}
              <textarea
                ref={annotationInputRef}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                rows={3}
                placeholder="Add a note about this report or chart…"
                className="w-full resize-none rounded-sm border border-border bg-background px-2 py-1.5 text-[11px] text-foreground outline-none ring-primary/30 focus:ring-1"
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    submitAnnotation();
                  }
                }}
              />
              <div className="flex justify-end gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[11px]"
                  onClick={() => {
                    setDraft('');
                    onAnnotationComposerOpenChange?.(false);
                    onAnnotationTargetChange?.(undefined);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-7 text-[11px]"
                  disabled={!draft.trim()}
                  onClick={submitAnnotation}
                >
                  Save note
                </Button>
              </div>
            </div>
          ) : null}

          <button
            type="button"
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
            onClick={() => {
              onAnnotate?.();
              onAnnotationComposerOpenChange?.(true);
            }}
          >
            <Plus className="size-3" aria-hidden />
            New annotation
          </button>
        </div>
      </RailSection>

      <RailSection label="Export">
        <div className="flex flex-col gap-0.5">
          {exportItems.map((item, i) => (
            <button
              key={i}
              type="button"
              disabled={!item.onClick}
              onClick={item.onClick}
              className={cn(
                'flex items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors',
                item.onClick && 'hover:bg-muted/50 hover:text-foreground',
                !item.onClick && 'cursor-not-allowed opacity-50'
              )}
            >
              <item.icon className="size-3 shrink-0 opacity-60" aria-hidden />
              <span className="flex-1">{item.label}</span>
              <ArrowRight className="size-3 shrink-0 opacity-40" aria-hidden />
            </button>
          ))}
        </div>
      </RailSection>
    </aside>
  );
}
