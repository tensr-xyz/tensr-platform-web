'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/molecules/dialog';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/molecules/command';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/molecules/tabs';
import { Spinner } from '@/components/atoms/spinner';
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
    <>
      {Object.entries(sections).map(([sectionName, items]) => {
        if (COMING_SOON_SECTIONS.has(sectionName)) {
          const label = sectionName.replace(/\s*\(coming soon\)\s*/i, '').trim();
          return <CommandGroup key={sectionName} heading={`${label} — Coming soon`} />;
        }
        return (
          <CommandGroup key={sectionName} heading={sectionName}>
            {items.map((item, idx) => (
              <CommandItem
                key={`${item.name}-${idx}`}
                value={`${sectionName}-${item.name}-${idx}`}
                onSelect={() => onPick(item)}
              >
                <span className="font-medium">{item.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        );
      })}
    </>
  );
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AnalysisCommandPalette({ open, onOpenChange }: Props) {
  const [query, setQuery] = useState('');
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
          <Command
            shouldFilter={false}
            className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-none bg-transparent"
          >
            <CommandInput
              autoFocus
              placeholder="Search analyses and plugins…"
              value={query}
              onValueChange={setQuery}
              onKeyDown={e => {
                if (e.key === 'Escape') onOpenChange(false);
              }}
            />
            {!hasBrowseableContent ? (
              <CommandList className="max-h-none min-h-0 flex-1">
                <CommandEmpty>{emptyListMessage}</CommandEmpty>
              </CommandList>
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

                <CommandList className="max-h-none min-h-0 flex-1 p-2">
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
                        <CommandEmpty>No plugins match your search.</CommandEmpty>
                      ) : (
                        <CommandGroup>
                          {filteredPlugins.map(plugin => {
                            const busy = runningPluginId === plugin.pluginId;
                            const canRun = !!pluginDataset && !runningPluginId;
                            return (
                              <CommandItem
                                key={plugin.pluginId}
                                value={plugin.pluginId}
                                disabled={!canRun || busy}
                                onSelect={() => void runPlugin(plugin)}
                                title={
                                  pluginDataset
                                    ? undefined
                                    : 'Open a spreadsheet tab with data to run plugins'
                                }
                              >
                                <span className="min-w-0 flex-1 font-medium">{plugin.name}</span>
                                {busy ? (
                                  <Spinner className="shrink-0" />
                                ) : (
                                  <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground">
                                    v{plugin.version}
                                  </span>
                                )}
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
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
                </CommandList>
              </Tabs>
            )}
          </Command>
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
