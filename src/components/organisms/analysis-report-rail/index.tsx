'use client';

import React from 'react';
import { ArrowRight, ChevronDown, FileText, Plus, Redo2, Download, Command } from 'lucide-react';
import type { AnalysisReport } from '@/lib/analysis-report-types';
import type { ReportOutlineItem } from '@/lib/build-report-outline';
import { scrollToReportSection } from '@/lib/build-report-outline';
import type { ReportAnnotation } from '@/lib/report-annotations';
import { ColumnTypeBadge, isNumericDataType } from '@/components/molecules/column-type-badge';
import { Button } from '@/components/atoms/button';
import { Textarea } from '@/components/atoms/text-area';
import { cn } from '@/utils';
import { useAnalysisSetupStore } from '@/stores/analysis-setup-store';
import { useTabsStore } from '@/stores/tabs-store';
import {
  formatRunLabel,
  formatRunTime,
  listDatasetAnalysisRuns,
  openAnalysisRunById,
  type AnalysisRunSummary,
} from '@/lib/analysis-runs';
import { runWhenIdle } from '@/lib/dataset-open';

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
  onActivate,
}: {
  label: string;
  value: string;
  columnType?: string;
  onActivate?: () => void;
}) {
  const isNumeric = isNumericDataType(columnType) || columnType === 'number';
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onActivate}
      title={onActivate ? `Change ${value} ${label}` : undefined}
      className="h-auto w-full justify-start gap-2 whitespace-normal bg-card px-2.5 py-2 text-left text-[12.5px] font-normal text-foreground hover:bg-muted/30"
    >
      <ColumnTypeBadge isNumeric={isNumeric} className="size-4 border-0 opacity-100" />
      <span className="min-w-0 flex-1 truncate font-medium">{value}</span>
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70">{label}</span>
      <ChevronDown className="size-3 shrink-0 text-muted-foreground/60" aria-hidden />
    </Button>
  );
}

function pickSpecInputs(
  report: AnalysisReport,
  columns: { id: string; type?: string }[]
): {
  variables: { label: string; value: string; type?: string }[];
  settings: { label: string; value: string }[];
} {
  const inputs = report.analysis_spec?.inputs ?? {};
  const typeByName = new Map(columns.map(column => [column.id, column.type]));
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
  const variables: { label: string; value: string; type?: string }[] = [];
  const settings: { label: string; value: string }[] = [];

  const labelFor = (key: string) => labelMap[key] ?? key.replace(/_/g, ' ');

  for (const [key, raw] of Object.entries(inputs)) {
    if (raw === null || raw === undefined || key.startsWith('_')) continue;
    const label = labelFor(key);
    if (typeof raw === 'boolean') {
      settings.push({ label, value: raw ? 'On' : 'Off' });
      continue;
    }
    if (typeof raw === 'number') {
      settings.push({ label, value: String(raw) });
      continue;
    }
    const names = (Array.isArray(raw) ? raw : [raw]).map(item => String(item));
    const value = names.join(', ');
    if (!value) continue;
    if (names.length === 1 && (names[0] === 'true' || names[0] === 'false')) {
      settings.push({ label, value: names[0] === 'true' ? 'On' : 'Off' });
      continue;
    }
    const known = names.filter(name => typeByName.has(name));
    if (columns.length && known.length === names.length) {
      variables.push({ label, value, type: typeByName.get(known[0]) });
    } else if (!columns.length && names.every(name => Number.isNaN(Number(name)))) {
      variables.push({ label, value });
    } else {
      settings.push({ label, value });
    }
  }

  if (variables.length === 0 && settings.length === 0 && report.meta.subtitle) {
    const parts = report.meta.subtitle.split(/\s+by\s+/i);
    if (parts[0]) variables.push({ label: 'DV', value: parts[0].trim() });
    if (parts[1]) variables.push({ label: 'Factor', value: parts[1].trim() });
  }

  return { variables: variables.slice(0, 4), settings };
}

type Props = {
  report: AnalysisReport;
  outline: ReportOutlineItem[];
  sourceDatasetId?: string;
  currentRunId?: string;
  activeSection?: string;
  onSectionSelect?: (id: string) => void;
  onRerun?: () => void;
  rerunNotice?: string | null;
  onExport?: () => void;
  onExportCsv?: () => void;
  onExportExcel?: () => void;
  onExportMarkdown?: () => void;
  onExportHtml?: () => void;
  onExportNarrative?: () => void;
  synthesizing?: boolean;
  annotations?: ReportAnnotation[];
  annotationTarget?: string;
  annotationComposerOpen?: boolean;
  annotationInputRef?: React.RefObject<HTMLTextAreaElement | null>;
  onAnnotate?: () => void;
  onAnnotationTargetChange?: (target: string | undefined) => void;
  onAnnotationComposerOpenChange?: (open: boolean) => void;
  onAddAnnotation?: (text: string) => void;
  onResolveAnnotation?: (id: string, resolved: boolean) => void;
};

export function AnalysisReportRail({
  report,
  outline,
  sourceDatasetId,
  currentRunId,
  activeSection,
  onSectionSelect,
  onRerun,
  rerunNotice,
  onExport,
  onExportCsv,
  onExportExcel,
  onExportMarkdown,
  onExportHtml,
  onExportNarrative,
  synthesizing,
  annotations = [],
  annotationTarget,
  annotationComposerOpen = false,
  annotationInputRef,
  onAnnotate,
  onAnnotationTargetChange,
  onAnnotationComposerOpenChange,
  onAddAnnotation,
  onResolveAnnotation,
}: Props) {
  const [draft, setDraft] = React.useState('');
  const [otherRuns, setOtherRuns] = React.useState<AnalysisRunSummary[]>([]);

  React.useEffect(() => {
    if (!sourceDatasetId) return;
    let cancelled = false;
    const cancelIdle = runWhenIdle(() => {
      void listDatasetAnalysisRuns(sourceDatasetId).then(all => {
        if (!cancelled) {
          setOtherRuns(all.filter(r => r.id !== currentRunId).slice(0, 8));
        }
      });
    });
    return () => {
      cancelled = true;
      cancelIdle();
    };
  }, [sourceDatasetId, currentRunId]);

  const initialColumns = useTabsStore(state => {
    const tab = state.tabs.find(item => item.id === state.activeTabId);
    return tab?.data?.initialColumns;
  });
  const columns = React.useMemo(
    () =>
      (initialColumns ?? []).map(column => ({
        id: column.id,
        type: column.type,
      })),
    [initialColumns]
  );
  const { variables, settings } = pickSpecInputs(report, columns);
  const chartTitles = (report.charts?.length ? report.charts : report.chart ? [report.chart] : [])
    .filter(Boolean)
    .map(c => c!.title);
  const exportItems = [
    { label: 'Copy summary', icon: FileText, onClick: onExport },
    { label: 'CSV (all tables)', icon: FileText, onClick: onExportCsv },
    { label: 'Excel', icon: Download, onClick: onExportExcel, testId: 'export-excel' },
    { label: 'Markdown', icon: FileText, onClick: onExportMarkdown },
    { label: 'HTML report', icon: FileText, onClick: onExportHtml },
    {
      label: synthesizing ? 'Writing narrative…' : 'Narrative report (AI)',
      icon: FileText,
      onClick: onExportNarrative,
      disabled: synthesizing || !onExportNarrative,
    },
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
              <VarPicker
                key={i}
                label={v.label}
                value={v.value}
                columnType={v.type}
                onActivate={onRerun}
              />
            ))
          ) : (
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Open the setup dialog to change variables and run again.
            </p>
          )}
          {settings.length ? (
            <ul className="mt-2 space-y-1">
              {settings.map(setting => (
                <li
                  key={`${setting.label}:${setting.value}`}
                  className="flex justify-between gap-2 text-[11px]"
                >
                  <span className="text-muted-foreground">{setting.label}</span>
                  <span className="font-medium text-foreground">{setting.value}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="mt-2.5 flex gap-2">
          <Button
            type="button"
            size="sm"
            className="h-8 flex-1 gap-1.5 text-xs"
            onClick={onRerun}
            disabled={!onRerun}
            title={
              onRerun ? 'Open setup and run this analysis again' : 'This report cannot be re-run'
            }
          >
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
        {rerunNotice ? (
          <p role="alert" className="mt-2 text-[11px] leading-snug text-destructive">
            {rerunNotice}
          </p>
        ) : null}
      </RailSection>

      {otherRuns.length > 0 ? (
        <RailSection label="Other saved runs">
          <div className="flex flex-col gap-0.5">
            {otherRuns.map(run => (
              <Button
                key={run.id}
                type="button"
                variant="ghost"
                onClick={() => void openAnalysisRunById(run.id)}
                className="h-auto w-full flex-col items-start gap-0.5 whitespace-normal rounded-sm px-2 py-1.5 text-left text-xs font-normal text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              >
                <span className="truncate font-medium text-foreground">{formatRunLabel(run)}</span>
                <span className="font-mono text-[10px]">{formatRunTime(run.created_at)}</span>
              </Button>
            ))}
          </div>
        </RailSection>
      ) : null}

      <RailSection label="In this report">
        <div className="flex flex-col gap-0.5">
          {outline.map((item, i) => (
            <Button
              key={item.id}
              type="button"
              variant="ghost"
              onClick={() => {
                onSectionSelect?.(item.id);
                scrollToReportSection(item.id);
              }}
              className={cn(
                'h-auto w-full justify-start gap-2 whitespace-normal rounded-sm px-2 py-1.5 text-left text-xs font-normal transition-colors',
                activeSection === item.id
                  ? 'bg-muted text-foreground hover:bg-muted hover:text-foreground'
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
            </Button>
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
                    {note.authorName ? `${note.authorName} · ` : ''}
                    {new Date(note.createdAt).toLocaleString()}
                    {note.resolved ? ' · resolved' : ''}
                  </p>
                  {onResolveAnnotation ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="mt-1 h-auto px-0 text-[10px] font-normal text-primary hover:bg-transparent hover:text-primary"
                      onClick={() => onResolveAnnotation(note.id, !note.resolved)}
                    >
                      {note.resolved ? 'Reopen' : 'Resolve'}
                    </Button>
                  ) : null}
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
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-auto px-0 text-[10px] font-normal text-muted-foreground hover:bg-transparent hover:text-foreground"
                    onClick={() => onAnnotationTargetChange?.(undefined)}
                  >
                    Clear
                  </Button>
                </div>
              ) : null}
              <Textarea
                ref={annotationInputRef}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                rows={3}
                placeholder="Add a note about this report or chart…"
                className="w-full resize-none rounded-sm px-2 py-1.5 text-[11px] ring-primary/30 focus-visible:ring-1"
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

          <Button
            type="button"
            variant="ghost"
            className="h-auto justify-start gap-1 whitespace-normal px-0 text-[11px] font-normal text-muted-foreground hover:bg-transparent hover:text-foreground"
            onClick={() => {
              onAnnotate?.();
              onAnnotationComposerOpenChange?.(true);
            }}
          >
            <Plus className="size-3" aria-hidden />
            New annotation
          </Button>
        </div>
      </RailSection>

      <RailSection label="Session artifacts">
        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] font-medium text-foreground">{report.meta.title}</p>
          {chartTitles.length ? (
            <ul className="space-y-0.5 text-[11px] text-muted-foreground">
              {chartTitles.map(t => (
                <li key={t}>Chart · {t}</li>
              ))}
            </ul>
          ) : (
            <p className="text-[11px] text-muted-foreground">No charts on this report.</p>
          )}
          {otherRuns.length > 0 ? (
            <div className="mt-1 border-t border-border/60 pt-1.5">
              <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                Other runs
              </p>
              <ul className="space-y-0.5 text-[11px] text-muted-foreground">
                {otherRuns.slice(0, 5).map(run => (
                  <li key={run.id}>{formatRunLabel(run)}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </RailSection>

      <RailSection label="Export">
        <div className="flex flex-col gap-0.5">
          {exportItems.map((item, i) => (
            <Button
              key={i}
              type="button"
              variant="ghost"
              data-testid={(item as { testId?: string }).testId}
              disabled={!item.onClick || Boolean((item as { disabled?: boolean }).disabled)}
              onClick={item.onClick}
              className="h-auto w-full justify-start gap-2 whitespace-normal rounded-sm px-2 py-1.5 text-left text-xs font-normal text-muted-foreground hover:bg-muted/50 hover:text-foreground disabled:cursor-not-allowed"
            >
              <item.icon className="size-3 shrink-0 opacity-60" aria-hidden />
              <span className="flex-1">{item.label}</span>
              <ArrowRight className="size-3 shrink-0 opacity-40" aria-hidden />
            </Button>
          ))}
        </div>
      </RailSection>
    </aside>
  );
}
