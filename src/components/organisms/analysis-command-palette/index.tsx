'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/molecules/dialog';
import { Input } from '@/components/atoms/input';
import { ScrollArea } from '@/components/atoms/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/molecules/tabs';
import { Loader } from '@/components/molecules/loading';
import PluginUIRenderer from '@/components/molecules/plugin-ui-renderer';
import { cn } from '@/utils';
import {
  getAnalysisOpForMenuName,
  isDialogMenuItem,
} from '@/configs/analysis-config/menu-registry';
import {
  DATA_TAB_VALUE,
  ACTIVE_PALETTE_TABS,
  COMING_SOON_PALETTE_TABS,
  filterAnalysisItems,
  getAllAnalysisItems,
  getPaletteTabContent,
  groupAnalysisItems,
  PALETTE_TAB_LABELS,
  PLUGINS_TAB_VALUE,
  COMING_SOON_SECTIONS,
  type AnalysisItem,
} from '@/configs/analysis-config/utils';
import { Badge } from '@/components/atoms/badge';
import { useAnalysisSetupStore } from '@/stores/analysis-setup-store';
import usePlugins from '@/hooks/api/use-plugin';
import { apiClient } from '@/lib/api-client';
import { useTabsStore, ViewType, type Tab } from '@/stores/tabs-store';
import { ColumnType } from '@tensr/sdk';
import type { PluginRecord } from '@/types/plugin';

type PluginDatasetPayload = {
  data: Record<string, unknown>[];
  metadata: {
    columns: { id: string; name: string; type: string }[];
    totalRows?: number;
    totalColumns?: number;
  };
};

function buildSpreadsheetDatasetForPlugins(
  activeTab: Tab | undefined
): PluginDatasetPayload | null {
  if (
    !activeTab ||
    activeTab.type !== ViewType.SPREADSHEET ||
    !activeTab.data?.initialData ||
    !activeTab.data?.initialColumns
  ) {
    return null;
  }

  const { initialData, initialColumns } = activeTab.data;

  const processedData = initialData.map((row: Record<string, unknown>) => {
    const processedRow: Record<string, unknown> = {};
    initialColumns.forEach((col: { id: string }) => {
      const value = row[col.id];
      if (typeof value === 'string' && !isNaN(Number(value)) && value !== '') {
        processedRow[col.id] = Number(value);
      } else {
        processedRow[col.id] = value;
      }
    });
    return processedRow;
  });

  return {
    data: processedData,
    metadata: {
      columns: initialColumns.map((col: { id: string; header: string; type: string }) => ({
        id: col.id,
        name: col.header,
        type: col.type as ColumnType,
      })),
      totalRows: activeTab.data.totalRows,
      totalColumns: activeTab.data.totalColumns,
    },
  };
}

function mergeUsablePlugins(
  marketplace: PluginRecord[],
  installed: PluginRecord[]
): PluginRecord[] {
  const byId = new Map<string, PluginRecord>();
  for (const p of marketplace) {
    if (p.status === 'APPROVED') {
      byId.set(p.pluginId, p);
    }
  }
  for (const p of installed) {
    byId.set(p.pluginId, p);
  }
  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function pluginMatchesQuery(plugin: PluginRecord, raw: string): boolean {
  const q = raw.trim().toLowerCase();
  if (!q) return true;
  const blob = [plugin.name, plugin.description, plugin.pluginId, ...(plugin.tags || [])]
    .join(' ')
    .toLowerCase();
  return blob.includes(q);
}

function paletteTabLabel(tab: string): string {
  if (tab === PLUGINS_TAB_VALUE) return 'Plugins';
  return PALETTE_TAB_LABELS[tab] ?? tab;
}

function AnalysisSectionsList({
  sections,
  onPick,
}: {
  sections: Record<string, AnalysisItem[]>;
  onPick: (item: AnalysisItem) => void;
}) {
  return (
    <div className="space-y-3 px-1 pb-2">
      {Object.entries(sections).map(([sectionName, items]) => {
        if (COMING_SOON_SECTIONS.has(sectionName)) {
          return (
            <div key={sectionName} className="px-2 py-2">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <span>{sectionName.replace(/\s*\(coming soon\)\s*/i, '')}</span>
                <Badge variant="secondary" className="text-[10px] font-normal">
                  Coming soon
                </Badge>
              </div>
            </div>
          );
        }
        return (
          <div key={sectionName}>
            <div className="px-2 py-1 text-xs font-medium text-foreground/90">{sectionName}</div>
            <ul className="space-y-0.5">
              {items.map((item, idx) => (
                <li key={`${item.name}-${idx}`}>
                  <button
                    type="button"
                    onClick={() => onPick(item)}
                    className={cn(
                      'flex w-full rounded-md px-2 py-2 text-left text-sm transition-colors',
                      'hover:bg-accent hover:text-accent-foreground',
                      'disabled:pointer-events-none disabled:opacity-50'
                    )}
                  >
                    <span className="font-medium">{item.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AnalysisCommandPalette({ open, onOpenChange }: Props) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [paletteTab, setPaletteTab] = useState<string>(DATA_TAB_VALUE);
  const [runningPluginId, setRunningPluginId] = useState<string | null>(null);
  const [pluginUi, setPluginUi] = useState<{ plugin: PluginRecord; result: unknown } | null>(null);
  const { tabs, activeTabId } = useTabsStore();
  const activeTab = tabs.find(t => t.id === activeTabId);
  const pluginDataset = useMemo(() => buildSpreadsheetDatasetForPlugins(activeTab), [activeTab]);

  const { plugins, installedPlugins, loading: pluginsLoading, error: pluginsError } = usePlugins();

  const allItems = useMemo(() => getAllAnalysisItems(), []);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  const filtered = useMemo(() => filterAnalysisItems(allItems, query), [allItems, query]);
  const grouped = useMemo(() => groupAnalysisItems(filtered), [filtered]);

  const usablePlugins = useMemo(
    () => mergeUsablePlugins(plugins, installedPlugins),
    [plugins, installedPlugins]
  );

  const filteredPlugins = useMemo(
    () => usablePlugins.filter(p => pluginMatchesQuery(p, query)),
    [usablePlugins, query]
  );

  const showPluginsTab = filteredPlugins.length > 0;

  const visiblePaletteTabs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ACTIVE_PALETTE_TABS.filter(tab => {
      const sections = getPaletteTabContent(grouped, tab);
      const sectionNames = Object.keys(sections);
      if (sectionNames.length === 0) return false;
      if (!q) return true;

      const tabLabel = (PALETTE_TAB_LABELS[tab] ?? tab).toLowerCase();
      if (tabLabel.includes(q)) return true;

      return sectionNames.some(sectionName => {
        if ((sections[sectionName]?.length ?? 0) > 0) return true;
        if (COMING_SOON_SECTIONS.has(sectionName)) {
          return sectionName.toLowerCase().includes(q);
        }
        return false;
      });
    });
  }, [grouped, query]);

  const hasBrowseableContent =
    showPluginsTab || visiblePaletteTabs.length > 0 || COMING_SOON_PALETTE_TABS.length > 0;

  const emptyListMessage = (() => {
    if (hasBrowseableContent) return '';
    if (pluginsLoading && usablePlugins.length === 0) return 'Loading…';
    return 'Nothing matches your search.';
  })();

  useEffect(() => {
    if (!open) return;
    const candidates: string[] = [];
    if (visiblePaletteTabs.length > 0) candidates.push(visiblePaletteTabs[0]);
    if (showPluginsTab) candidates.push(PLUGINS_TAB_VALUE);
    setPaletteTab(candidates[0] ?? DATA_TAB_VALUE);
  }, [open, showPluginsTab, visiblePaletteTabs]);

  useEffect(() => {
    if (!open) return;
    const candidates: string[] = [...visiblePaletteTabs];
    if (showPluginsTab) candidates.push(PLUGINS_TAB_VALUE);
    if (candidates.length === 0) return;
    if (!candidates.includes(paletteTab)) {
      setPaletteTab(candidates[0]);
    }
  }, [open, grouped, showPluginsTab, paletteTab, visiblePaletteTabs]);

  const pick = (item: AnalysisItem) => {
    if (!item.component) return;
    onOpenChange(false);
    queueMicrotask(() => {
      const store = useAnalysisSetupStore.getState();
      if (isDialogMenuItem(item.name)) {
        store.openDialog(item.name);
        return;
      }
      const op = getAnalysisOpForMenuName(item.name);
      if (op) {
        store.openSetupFromPalette(op);
        return;
      }
      store.openUnavailable(item.name);
    });
  };

  const runPlugin = async (plugin: PluginRecord) => {
    if (!pluginDataset || runningPluginId) return;

    const ds = pluginDataset;
    const transformedData = {
      rows: ds.data,
      columns: ds.metadata.columns.map(col => ({
        id: col.id || col.name,
        name: col.name || col.id,
        type: col.type || 'string',
      })),
      totalRows: ds.metadata.totalRows ?? ds.data.length,
      totalColumns: ds.metadata.columns.length,
    };

    setRunningPluginId(plugin.pluginId);
    try {
      const executionResult = await apiClient.plugins.execute(plugin.pluginId, transformedData);
      if (executionResult.success) {
        onOpenChange(false);
        setPluginUi({ plugin, result: executionResult.result });
      } else {
        window.alert(executionResult.error || 'Plugin execution failed');
      }
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to execute plugin');
    } finally {
      setRunningPluginId(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          overlayClassName="z-[200]"
          className={cn(
            'z-[200] flex h-[min(78vh,720px)] min-h-[520px] max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl'
          )}
          aria-describedby={undefined}
          onOpenAutoFocus={e => e.preventDefault()}
        >
          <DialogTitle className="sr-only">Search analyses and plugins</DialogTitle>
          <div className="shrink-0 border-b border-border p-3">
            <Input
              ref={inputRef}
              placeholder="Search analyses and plugins…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="border-0 bg-transparent shadow-none focus-visible:ring-0"
              onKeyDown={e => {
                if (e.key === 'Escape') onOpenChange(false);
              }}
            />
          </div>
          {!hasBrowseableContent ? (
            <div className="px-2 py-6 text-center text-sm text-muted-foreground">
              {emptyListMessage}
            </div>
          ) : (
            <Tabs
              value={paletteTab}
              onValueChange={setPaletteTab}
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
            >
              <div className="shrink-0 overflow-x-auto overflow-y-hidden border-b border-border">
                <TabsList className="inline-flex h-10 w-max min-w-full justify-start gap-0 rounded-none bg-transparent p-0">
                  {visiblePaletteTabs.map(tab => (
                    <TabsTrigger
                      key={tab}
                      value={tab}
                      isClosable={false}
                      className="flex h-10 shrink-0 items-center rounded-none border-b-2 border-transparent px-3 text-xs data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                    >
                      {paletteTabLabel(tab)}
                    </TabsTrigger>
                  ))}
                  {COMING_SOON_PALETTE_TABS.map(tab => (
                    <span
                      key={tab}
                      role="presentation"
                      aria-disabled="true"
                      title="Coming soon"
                      className="flex h-10 shrink-0 cursor-not-allowed items-center rounded-none border-b-2 border-transparent px-3 text-xs text-muted-foreground/70"
                    >
                      {paletteTabLabel(tab)}
                    </span>
                  ))}
                  {showPluginsTab ? (
                    <TabsTrigger
                      value={PLUGINS_TAB_VALUE}
                      isClosable={false}
                      className="flex h-10 shrink-0 items-center rounded-none border-b-2 border-transparent px-3 text-xs data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                    >
                      Plugins
                    </TabsTrigger>
                  ) : null}
                </TabsList>
              </div>

              <ScrollArea className="min-h-0 flex-1 p-2">
                {showPluginsTab ? (
                  <TabsContent
                    value={PLUGINS_TAB_VALUE}
                    forceMount
                    className="m-0 h-full border-0 p-0 outline-none data-[state=inactive]:hidden"
                  >
                    {pluginsError ? (
                      <p className="px-2 pb-2 text-xs text-destructive">{pluginsError.message}</p>
                    ) : null}
                    {filteredPlugins.length === 0 ? (
                      <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                        No plugins match your search.
                      </p>
                    ) : (
                      <ul className="space-y-0.5 px-1">
                        {filteredPlugins.map(plugin => {
                          const busy = runningPluginId === plugin.pluginId;
                          const canRun = !!pluginDataset && !runningPluginId;
                          return (
                            <li key={plugin.pluginId}>
                              <button
                                type="button"
                                disabled={!canRun || busy}
                                title={
                                  pluginDataset
                                    ? undefined
                                    : 'Open a spreadsheet tab with data to run plugins'
                                }
                                onClick={() => void runPlugin(plugin)}
                                className={cn(
                                  'flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors',
                                  'hover:bg-accent hover:text-accent-foreground',
                                  'disabled:pointer-events-none disabled:opacity-50'
                                )}
                              >
                                <span className="min-w-0 flex-1 font-medium">{plugin.name}</span>
                                {busy ? (
                                  <Loader size="sm" className="shrink-0" />
                                ) : (
                                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                                    v{plugin.version}
                                  </span>
                                )}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </TabsContent>
                ) : null}

                {visiblePaletteTabs.map(tab => (
                  <TabsContent
                    key={tab}
                    value={tab}
                    forceMount
                    className="m-0 h-full border-0 p-0 outline-none data-[state=inactive]:hidden"
                  >
                    <AnalysisSectionsList
                      sections={getPaletteTabContent(grouped, tab)}
                      onPick={pick}
                    />
                  </TabsContent>
                ))}
              </ScrollArea>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {pluginUi ? (
        <div className="fixed inset-0 z-[100] flex flex-col bg-background">
          <PluginUIRenderer
            plugin={pluginUi.plugin}
            result={pluginUi.result}
            onClose={() => setPluginUi(null)}
          />
        </div>
      ) : null}
    </>
  );
}
