'use client';

import React, { useCallback, useMemo } from 'react';
import FilterPanel from '@/components/organisms/filter-panel';
import { ChartConfigurationPanel } from '@/components/organisms/chart-configuration-panel';
import ChartPanel from '@/components/organisms/chart-panel';
import { useTabsStore } from '@/stores/tabs-store';
import { useProjectStore, ViewType as ProjectViewType } from '@/stores/project-store';
import { ScrollArea } from '@/components/atoms/scroll-area';
import { mergeColumnFilter } from '@/utils/column-filters';
import { resolveColumnIsNumeric } from '@/components/molecules/column-type-badge';
import type { ColumnSummary } from '@/types/file';
import type { Column } from '@/stores/tabs-store';
import { DatasetAnalysisRuns } from '@/components/organisms/dataset-analysis-runs';
import { FEATURE_FLAGS } from '@/lib/feature-flags';
import { getDatasetIdFromTab, resolveSpreadsheetContextTab } from '@/lib/workspace-dataset';
import { cn } from '@/utils';

type PanelMode = 'filters' | 'chart-config';

export const LeftPanel: React.FC = () => {
  const { tabs, activeTabId, updateTab } = useTabsStore();
  const { activeView } = useProjectStore();
  const activeTab = tabs.find(tab => tab.id === activeTabId);
  const panelTab = useMemo(() => resolveSpreadsheetContextTab(tabs, activeTab), [tabs, activeTab]);

  const panelMode: PanelMode =
    FEATURE_FLAGS.CHARTS_TAB_ENABLED && activeView === ProjectViewType.CHARTS
      ? 'chart-config'
      : 'filters';

  const handleFilterChange = useCallback(
    (columnName: string, values: Set<string>) => {
      if (!panelTab?.id || !panelTab.data) return;
      const columnFilters = mergeColumnFilter(panelTab.data.columnFilters, columnName, values);
      updateTab(panelTab.id, {
        data: {
          ...panelTab.data,
          columnFilters,
        },
      });
    },
    [panelTab, updateTab]
  );

  const spreadsheetSidePanel = panelTab?.data;

  const datasetId = panelTab ? (getDatasetIdFromTab(panelTab) ?? undefined) : undefined;
  const localAnalysisEntries = spreadsheetSidePanel?.analysisHistory ?? [];

  const columnList =
    spreadsheetSidePanel?.initialColumns?.map((col: { id: string }) => col.id) ?? [];
  const columnStats = (spreadsheetSidePanel?.columnStats ?? {}) as Record<string, ColumnSummary>;
  const initialData = (spreadsheetSidePanel?.initialData ?? []) as Record<string, unknown>[];

  const columnSampleValues = useMemo(() => {
    const samples: Record<string, unknown[]> = {};
    for (const id of columnList) {
      samples[id] = [];
    }
    for (const row of initialData.slice(0, 80)) {
      for (const id of columnList) {
        const v = row[id];
        if (v !== undefined && v !== '') {
          samples[id].push(v);
        }
      }
    }
    return samples;
  }, [columnList, initialData]);

  const showExploreTools =
    !!spreadsheetSidePanel && !!(spreadsheetSidePanel.filePath || columnList.length > 0);

  const { numericCount, textCount, visibleCount, totalCount } = useMemo(() => {
    const total = columnList.length;
    let numeric = 0;
    let text = 0;
    let visible = 0;
    const visibility = panelTab?.columnVisibility ?? {};

    const initialColumns = (spreadsheetSidePanel?.initialColumns ?? []) as Column[];

    for (const id of columnList) {
      const col = initialColumns.find(c => c.id === id);
      if (resolveColumnIsNumeric(id, columnStats, col?.type, undefined, columnSampleValues[id])) {
        numeric += 1;
      } else text += 1;
      if (visibility[id] !== false) visible += 1;
    }

    return {
      numericCount: numeric,
      textCount: text,
      visibleCount: visible,
      totalCount: total,
    };
  }, [
    columnList,
    columnStats,
    columnSampleValues,
    panelTab?.columnVisibility,
    spreadsheetSidePanel?.initialColumns,
  ]);

  const panelLabel = panelMode === 'chart-config' ? 'Chart configuration' : 'Column filters';

  return (
    <div className="flex h-full flex-col overflow-hidden bg-muted/30">
      {showExploreTools && spreadsheetSidePanel ? (
        <>
          <div className="shrink-0 border-b border-border px-2.5 pb-2 pt-3">
            <p
              key={panelLabel}
              className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground transition-opacity duration-200"
            >
              {panelLabel}
            </p>
            {panelMode === 'filters' && totalCount > 0 ? (
              <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-primary" aria-hidden />
                  {numericCount} numeric
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-muted-foreground/50" aria-hidden />
                  {textCount} text
                </span>
              </div>
            ) : panelMode === 'chart-config' ? (
              <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                Assign variables from your dataset to build the chart.
              </p>
            ) : null}
          </div>

          <div className="relative min-h-0 flex-1 overflow-hidden">
            <div
              key={panelMode}
              className={cn(
                'absolute inset-0 flex flex-col overflow-hidden',
                'animate-in fade-in-0 slide-in-from-left-1 duration-200'
              )}
            >
              {panelMode === 'chart-config' ? (
                <ScrollArea className="min-h-0 flex-1">
                  <ChartConfigurationPanel
                    columnList={columnList}
                    initialColumns={(spreadsheetSidePanel.initialColumns ?? []) as Column[]}
                    columnStats={columnStats}
                    columnSampleValues={columnSampleValues}
                  />
                  <div className="border-t border-border px-2 pb-4 pt-3">
                    <p className="pb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Graph options
                    </p>
                    <ChartPanel
                      columns={(spreadsheetSidePanel.initialColumns ?? []).map(
                        (col: { id: string; type?: string }) => ({
                          id: col.id,
                          type: col.type || 'string',
                        })
                      )}
                      mode="options"
                    />
                  </div>
                </ScrollArea>
              ) : (
                <ScrollArea className="min-h-0 flex-1">
                  <FilterPanel
                    filePath={spreadsheetSidePanel.filePath}
                    columnNames={columnList}
                    columnStats={columnStats}
                    initialColumns={spreadsheetSidePanel.initialColumns}
                    columnSampleValues={columnSampleValues}
                    onFilterChange={handleFilterChange}
                  />
                  <DatasetAnalysisRuns datasetId={datasetId} localEntries={localAnalysisEntries} />
                </ScrollArea>
              )}
            </div>
          </div>

          <footer className="flex h-7 min-h-7 shrink-0 items-center justify-between border-t border-border bg-muted/40 px-3.5 font-mono text-[11px] text-muted-foreground">
            <span>{panelMode === 'chart-config' ? 'Variables' : 'Visible'}</span>
            <span className="tabular-nums text-foreground/80">
              {panelMode === 'chart-config'
                ? `${totalCount} cols`
                : `${visibleCount}/${totalCount} cols`}
            </span>
          </footer>
        </>
      ) : (
        <div className="flex h-full flex-col items-center justify-center px-4 text-center text-xs text-muted-foreground">
          Open a spreadsheet or dataset tab to explore columns and charts. Run analyses with ⌘K.
        </div>
      )}
    </div>
  );
};
