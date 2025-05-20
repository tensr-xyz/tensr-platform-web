import React, { useCallback, useMemo } from 'react';
import { ProjectMenu } from '@/components/organisms/project-menu';
import { ScrollArea, ScrollBar } from '@/components/atoms/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/molecules/tabs';
import { useTabs } from '@/contexts/tabs-context';
import { closeAllTabs, setActiveTab, updateTab } from '@/contexts/tabs-context/actions';
import { Tab } from '@/contexts/tabs-context/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/molecules/dropdown';
import { Button } from '@/components/atoms/button';
import { LuEllipsisVertical } from 'react-icons/lu';
import { ViewType } from '@/contexts/project-context/types';

// Define the SpreadsheetTab interface here to match the Tab interface from your context
interface SpreadsheetTab extends Tab {
  type: ViewType.SPREADSHEET;
  data: {
    initialData: Record<string, any>[];
    [key: string]: any;
  };
}

interface TitlebarProps {
  onToggleSidebar: () => void;
  tabs?: Tab[];
  activeTab?: Tab;
  onTabClose?: (id: string) => void;
}

// Fixed type predicate to correctly identify SpreadsheetTab
function isSpreadsheetTab(tab: Tab): tab is SpreadsheetTab {
  return (
    tab.type === ViewType.SPREADSHEET &&
    typeof tab.data === 'object' &&
    tab.data !== null &&
    Array.isArray(tab.data.initialData)
  );
}

// Utility Types
type DebouncedFunction<T extends (...args: any[]) => any> = {
  (...args: Parameters<T>): void;
  cancel: () => void;
};

// Debounce utility
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

const Titlebar = ({ onToggleSidebar, tabs = [], activeTab, onTabClose }: TitlebarProps) => {
  const { dispatch } = useTabs();

  const createDebouncedHandler = useCallback(
    (tab: SpreadsheetTab) => {
      return debounce(async (newData: Record<string, any>[]) => {
        try {
          dispatch(
            updateTab(tab.id, {
              data: {
                ...tab.data,
                initialData: newData,
              },
              isDirty: true,
            })
          );
        } catch (e) {}
      }, 500);
    },
    [dispatch]
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

  const handleTabChange = (value: string) => {
    dispatch(setActiveTab(value));
  };

  // Safe tab closing function that checks if onTabClose exists
  const handleTabClose = (id: string) => {
    if (onTabClose) {
      onTabClose(id);
    }
  };

  const handleCloseAllTabs = useCallback(() => {
    Object.values(debouncedHandlers).forEach(handler => handler.cancel());
    dispatch(closeAllTabs());
  }, [dispatch, debouncedHandlers]);

  return (
    <div className="h-10 bg-secondary border-b border-border flex items-stretch relative">
      {/* Main titlebar content */}
      <div className="flex-1 flex justify-between items-center">
        {/* Left section */}
        <div className="flex items-center h-full">
          <div className="flex items-center gap-4">
            <ProjectMenu />
          </div>
        </div>

        {/* Middle section with tabs */}
        <div className="flex-1 flex items-center overflow-hidden">
          {tabs && tabs.length > 0 && (
            <Tabs value={activeTab?.id} onValueChange={handleTabChange} className="flex-1">
              <ScrollArea className="w-full h-10">
                <TabsList className="h-10 inline-flex border-none p-0 rounded-none">
                  {tabs.map(tab => (
                    <TabsTrigger
                      key={tab.id}
                      value={tab.id}
                      onClose={() => handleTabClose(tab.id)}
                      isClosable
                      className="shrink-0 h-10 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:mb-0 text-xs"
                    >
                      {tab.name}
                    </TabsTrigger>
                  ))}
                </TabsList>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </Tabs>
          )}
        </div>

        {/* Right section */}
        <div className="flex items-center h-full gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <LuEllipsisVertical />
                <span className="sr-only">Toggle Menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleCloseAllTabs}>Close All Tabs</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
};

export default Titlebar;
