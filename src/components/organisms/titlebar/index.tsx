import React, { useCallback, useMemo } from 'react';
import { ProjectMenu } from '@/components/organisms/project-menu';
import { ScrollArea, ScrollBar } from '@/components/atoms/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/molecules/tabs';
import { useTabsStore, Tab } from '@/stores/tabs-store';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/molecules/dropdown';
import { Button } from '@/components/atoms/button';
import { MoreVertical as EllipsisVertical } from 'lucide-react';
import { Home } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { ViewType } from '@/contexts/project-context/types';
import { Users } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/atoms/popover';
import CollaborationPanel from '@/components/organisms/collaboration-panel';
import { useProjectStore } from '@/stores/project-store';

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

// Extract fileId from file path
function extractFileId(filePath?: string): string | null {
  if (!filePath) return null;

  // Check if it's a project ID (UUID) - if so, return null to avoid calling file API
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(filePath)) {
    return null;
  }

  // If the path contains slashes, it's a full path
  if (filePath.includes('/')) {
    const parts = filePath.split('/');
    if (parts.length >= 3) {
      return parts[2];
    }
  }

  // Otherwise, assume it's a direct fileId
  return filePath;
}

// Extract project ID from tab
function extractProjectId(tab: Tab): string | null {
  // Check if tab.path is a project ID (UUID)
  if (tab.path) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(tab.path)) {
      return tab.path;
    }
  }

  // Check tab.data?.filePath for project path
  if (tab.data?.filePath) {
    const filePath = tab.data.filePath;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    
    // If it's a direct UUID, return it
    if (uuidRegex.test(filePath)) {
      return filePath;
    }

    // If the path contains slashes, extract project ID from path structure
    // Path format: users/{userId}/{projectId}/... or similar
    if (filePath.includes('/')) {
      const parts = filePath.split('/');
      // Look for UUID in the path parts
      for (const part of parts) {
        if (uuidRegex.test(part)) {
          return part;
        }
      }
    }
  }

  return null;
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
  const { updateTab, setActiveTab, closeAllTabs } = useTabsStore();
  const { currentProject } = useProjectStore();
  const router = useRouter();
  const pathname = usePathname();
  const isHomePage = pathname === '/';

  // Extract fileId from activeTab for CollaborationPanel
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

  const handleTabChange = (value: string) => {
    console.log('handleTabChange called:', { value, isHomePage, tabs: tabs.length });
    
    // If on home page, navigate to workspace with the selected tab
    if (isHomePage) {
      const selectedTab = tabs.find(tab => tab.id === value);
      console.log('Selected tab:', selectedTab);
      
      if (selectedTab) {
        // Set the tab as active first (this ensures context is preserved)
        // Zustand updates are synchronous, so this will be set immediately
        setActiveTab(value);
        
        // Extract project ID from the tab
        const projectId = extractProjectId(selectedTab);
        console.log('Extracted project ID:', projectId);
        
        if (projectId) {
          // Navigate to workspace with the project ID
          // The workspace will automatically load the active tab from the store
          console.log('Navigating to:', `/workspace/project/${projectId}`);
          router.push(`/workspace/project/${projectId}`);
        } else {
          // If we can't extract project ID, try to use the tab's path as fallback
          // This handles edge cases where tab might not have a clear project ID
          if (selectedTab.path) {
            // Try using the path directly if it looks like a project ID
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            if (uuidRegex.test(selectedTab.path)) {
              console.log('Using tab.path as project ID:', selectedTab.path);
              router.push(`/workspace/project/${selectedTab.path}`);
            } else {
              console.warn('Could not extract valid project ID from tab:', selectedTab);
            }
          } else {
            console.warn('Tab has no project ID or path:', selectedTab);
          }
        }
      } else {
        console.warn('Tab not found:', value);
      }
    } else {
      // On workspace, just switch the active tab
      setActiveTab(value);
    }
  };

  // Safe tab closing function that checks if onTabClose exists
  const handleTabClose = (id: string) => {
    if (onTabClose) {
      onTabClose(id);
    }
  };

  const handleCloseAllTabs = useCallback(() => {
    Object.values(debouncedHandlers).forEach(handler => handler.cancel());
    closeAllTabs();
  }, [closeAllTabs, debouncedHandlers]);

  return (
    <div className="h-10 bg-accent border-b border-border flex items-stretch relative">
      {/* Main titlebar content */}
      <div className="flex-1 flex justify-between items-center">
        {/* Left section */}
        <div className="flex items-center h-full">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/')}
              className="h-10 w-10 bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity cursor-pointer"
              aria-label="Home"
            >
              <Home className="h-4 w-4" />
            </button>
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
                      onClick={(e) => {
                        // On home page, handle clicks even if tab is already active
                        if (isHomePage && tab.id === activeTab?.id) {
                          e.preventDefault();
                          handleTabChange(tab.id);
                        }
                      }}
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
          {activeTab && isSpreadsheetTab(activeTab) && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10">
                  <Users className="h-4 w-4" />
                  <span className="sr-only">Toggle User Collaboration</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end">
                <CollaborationPanel
                  projectId={currentProject?.id || currentFileId || ''}
                  activeTab={activeTab}
                />
              </PopoverContent>
            </Popover>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <EllipsisVertical />
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
