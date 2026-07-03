import React, { useCallback, useEffect, useMemo } from 'react';
import { useAnalysisSetupStore } from '@/stores/analysis-setup-store';
import { ProjectMenu } from '@/components/organisms/project-menu';
import { ScrollArea, ScrollBar } from '@/components/atoms/scroll-area';
import { Tabs } from '@/components/molecules/tabs';
import { useTabsStore, Tab } from '@/stores/tabs-store';
import { Button } from '@/components/atoms/button';
import { Home, Search, Sparkles, X } from 'lucide-react';
import { cn } from '@/utils';
import { AnalysisCommandPalette } from '@/components/organisms/analysis-command-palette';
import { useAnalysisPaletteShortcut } from '@/hooks/ui/use-analysis-palette-shortcut';
import { useRouter, usePathname } from 'next/navigation';
import { ViewType } from '@/stores/tabs-store';
import { Users } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/atoms/popover';
import CollaborationPanel from '@/components/organisms/collaboration-panel';
import { useProjectStore } from '@/stores/project-store';

interface SpreadsheetTab extends Tab {
  type: ViewType.SPREADSHEET;
  data: NonNullable<Tab['data']>;
}

interface TitlebarProps {
  onToggleSidebar: () => void;
  tabs?: Tab[];
  activeTab?: Tab;
  onTabClose?: (id: string) => void;
}

function isSpreadsheetTab(tab: Tab): tab is SpreadsheetTab {
  return tab.type === ViewType.SPREADSHEET && tab.data != null;
}

function extractFileId(filePath?: string): string | null {
  if (!filePath) return null;

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(filePath)) {
    return null;
  }

  if (filePath.includes('/')) {
    const parts = filePath.split('/');
    if (parts.length >= 3) {
      return parts[2];
    }
  }

  return filePath;
}

function extractProjectId(tab: Tab): string | null {
  if (tab.path) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(tab.path)) {
      return tab.path;
    }
  }

  if (tab.data?.filePath) {
    const filePath = tab.data.filePath;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (uuidRegex.test(filePath)) {
      return filePath;
    }

    if (filePath.includes('/')) {
      const parts = filePath.split('/');
      for (const part of parts) {
        if (uuidRegex.test(part)) {
          return part;
        }
      }
    }
  }

  return null;
}

type DebouncedFunction<T extends (...args: any[]) => any> = {
  (...args: Parameters<T>): void;
  cancel: () => void;
};

function debounce<T extends (...args: any[]) => any>(fn: T, delay: number): DebouncedFunction<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  function debounced(...args: Parameters<T>) {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
    }, delay);
  }

  debounced.cancel = () => {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
      timeoutId = undefined;
    }
  };

  return debounced;
}

function tabKindLabel(type: string): string {
  switch (type) {
    case ViewType.SPREADSHEET:
      return 'She';
    case ViewType.ANALYSIS_REPORT:
      return 'Ana';
    case ViewType.NOTEBOOK:
      return 'Ntb';
    case ViewType.MARKDOWN:
      return 'Md';
    default:
      return type.slice(0, 3).replace(/_/g, '');
  }
}

const Titlebar = ({
  onToggleSidebar: _onToggleSidebar,
  tabs = [],
  activeTab,
  onTabClose,
}: TitlebarProps) => {
  const { updateTab, setActiveTab } = useTabsStore();
  const { currentProject } = useProjectStore();
  const router = useRouter();
  const pathname = usePathname();
  const isHomePage = pathname === '/';
  const analysisPaletteOpen = useAnalysisSetupStore(s => s.commandPaletteOpen);
  const setAnalysisPaletteOpen = useAnalysisSetupStore(s => s.setCommandPaletteOpen);

  useAnalysisPaletteShortcut();

  const currentFileId =
    activeTab && isSpreadsheetTab(activeTab)
      ? extractFileId(activeTab.data?.filePath)
      : activeTab?.path
        ? extractFileId(activeTab.path)
        : null;

  const createDebouncedHandler = useCallback(
    (tab: SpreadsheetTab) => {
      return debounce(async (newData: Record<string, any>[]) => {
        try {
          updateTab(tab.id, {
            data: {
              ...tab.data,
              initialData: newData,
            },
            isDirty: true,
          });
        } catch (e) {}
      }, 500);
    },
    [updateTab]
  );

  const debouncedHandlers = useMemo(() => {
    const spreadsheetTabs = tabs.filter((tab): tab is SpreadsheetTab => isSpreadsheetTab(tab));

    return spreadsheetTabs.reduce(
      (acc, tab) => {
        acc[tab.id] = createDebouncedHandler(tab);
        return acc;
      },
      {} as Record<string, ReturnType<typeof createDebouncedHandler>>
    );
  }, [tabs, createDebouncedHandler]);

  useEffect(() => {
    return () => {
      Object.values(debouncedHandlers).forEach(handler => handler.cancel());
    };
  }, [debouncedHandlers]);

  const handleTabChange = (value: string) => {
    if (isHomePage) {
      const selectedTab = tabs.find(tab => tab.id === value);

      if (selectedTab) {
        setActiveTab(value);

        const projectId = extractProjectId(selectedTab);

        if (projectId) {
          router.push(`/workspace/project/${projectId}`);
        } else if (selectedTab.path) {
          const uuidRegex =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
          if (uuidRegex.test(selectedTab.path)) {
            router.push(`/workspace/project/${selectedTab.path}`);
          }
        }
      }
    } else {
      setActiveTab(value);
    }
  };

  const handleTabClose = (id: string) => {
    onTabClose?.(id);
  };

  return (
    <>
      <AnalysisCommandPalette open={analysisPaletteOpen} onOpenChange={setAnalysisPaletteOpen} />
      <header className="relative flex h-11 min-h-11 w-full shrink-0 items-stretch border-b border-border bg-card">
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          className="flex h-11 w-11 shrink-0 items-center justify-center border-r border-border text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
          aria-label="Home"
        >
          <Home className="size-4" aria-hidden />
        </button>

        <div className="flex h-full shrink-0 items-stretch">
          <ProjectMenu />
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 items-stretch overflow-hidden border-l border-border">
          {tabs.length > 0 ? (
            <Tabs
              value={activeTab?.id}
              onValueChange={handleTabChange}
              className="flex min-h-0 min-w-0 flex-1"
            >
              <ScrollArea className="h-11 w-full">
                <div className="flex h-11" role="tablist">
                  {tabs.map(tab => {
                    const isActive = activeTab?.id === tab.id;
                    const isAnalysis = tab.type === ViewType.ANALYSIS_REPORT;
                    const kind = tabKindLabel(tab.type);

                    return (
                      <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => handleTabChange(tab.id)}
                        className={cn(
                          'group relative flex h-11 min-w-[8.75rem] max-w-[13.75rem] shrink-0 items-center gap-2 border-r border-border px-3.5 text-[13px] font-medium transition-colors',
                          isActive
                            ? 'bg-card text-foreground'
                            : 'bg-muted/50 text-muted-foreground hover:text-foreground'
                        )}
                      >
                        {isActive ? (
                          <span
                            className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-primary"
                            aria-hidden
                          />
                        ) : null}
                        {isAnalysis ? (
                          <span
                            className="grid size-4 shrink-0 place-items-center rounded bg-primary text-primary-foreground"
                            title="Analysis output"
                          >
                            <Sparkles className="size-2.5" aria-hidden />
                          </span>
                        ) : null}
                        <span
                          className={cn(
                            'shrink-0 rounded border px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide',
                            isAnalysis
                              ? 'border-primary/20 bg-primary/10 text-primary'
                              : 'border-border bg-transparent text-muted-foreground'
                          )}
                        >
                          {kind}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-left">{tab.name}</span>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={e => {
                            e.stopPropagation();
                            handleTabClose(tab.id);
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              e.stopPropagation();
                              handleTabClose(tab.id);
                            }
                          }}
                          className={cn(
                            'grid size-[18px] shrink-0 place-items-center rounded-sm text-muted-foreground transition-opacity hover:bg-muted',
                            isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                          )}
                          aria-label={`Close ${tab.name}`}
                        >
                          <X className="size-2.5" aria-hidden />
                        </span>
                      </button>
                    );
                  })}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </Tabs>
          ) : null}
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setAnalysisPaletteOpen(true)}
          className="h-11 shrink-0 gap-1.5 rounded-none border-l border-border px-3 font-normal text-muted-foreground hover:text-foreground"
          aria-label="Search analyses"
        >
          <Search className="size-3.5 shrink-0" aria-hidden />
          <span className="hidden whitespace-nowrap sm:inline">Search analyses…</span>
          <span className="pointer-events-none hidden font-mono text-[10px] text-muted-foreground/80 sm:inline">
            ⌘K
          </span>
        </Button>

        {activeTab && isSpreadsheetTab(activeTab) ? (
          <div className="flex shrink-0 items-stretch border-l border-border">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="size-11 shrink-0 rounded-none">
                  <Users className="h-4 w-4" />
                  <span className="sr-only">Toggle User Collaboration</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" onOpenAutoFocus={e => e.preventDefault()}>
                <CollaborationPanel
                  projectId={currentProject?.id || currentFileId || ''}
                  activeTab={activeTab}
                />
              </PopoverContent>
            </Popover>
          </div>
        ) : null}
      </header>
    </>
  );
};

export default Titlebar;
