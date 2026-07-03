import * as React from 'react';
import {
  FileSpreadsheet as Sheet,
  CodeSquare as SquareCode,
  BarChart3,
  Search,
  Settings,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from '@/components/organisms/sidebar';
import { useProjectStore, ViewType } from '@/stores/project-store';
import { useTabsStore, Tab } from '@/stores/tabs-store';
import { ProjectActions } from '@/contexts/project-context/types';
import { type LucideIcon } from 'lucide-react';
import { cn } from '@/utils';
import { FEATURE_FLAGS } from '@/lib/feature-flags';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '../../molecules/command';
import { Home } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  isActive: boolean;
  component?: () => React.ReactNode;
  isNavigationItem?: boolean;
  isPanelItem?: boolean;
  action?: () => void;
  onClick?: () => void;
}

export default function ProjectSidebar() {
  const {
    currentProject,
    leftPanelOpen,
    toggleLeftPanel,
    setLeftPanelContent,
    activeView,
    setView,
  } = useProjectStore();
  const { activeTabId, tabs } = useTabsStore();
  const activeTab: Tab | undefined = tabs.find(t => t.id === activeTabId);
  const isSpreadsheetContext = activeTab && activeTab.type === ViewType.SPREADSHEET;
  const [isCommandOpen, setIsCommandOpen] = React.useState(false);
  const router = useRouter();

  const handleOpenSettings = () => {
    router.push('/settings/general');
  };

  const handleOpenSearch = () => {
    setIsCommandOpen(true);
  };

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsCommandOpen(open => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const data = {
    navMain: [
      {
        title: 'Spreadsheet',
        url: '#',
        icon: Sheet,
        action: () => setView(ViewType.SPREADSHEET),
      },
      {
        title: 'Notebook',
        url: '#',
        icon: SquareCode,
        action: () => setView(ViewType.NOTEBOOK),
      },
      ...(FEATURE_FLAGS.CHARTS_TAB_ENABLED
        ? [
            {
              title: 'Charts',
              url: '#',
              icon: BarChart3,
              action: () => setView(ViewType.CHARTS),
            },
          ]
        : []),
    ] as NavItem[],
    navFooter: [
      {
        title: 'Search',
        url: '#',
        icon: Search,
        onClick: handleOpenSearch,
      },
      {
        title: 'Settings',
        url: '/settings/general',
        icon: Settings,
        isNavigationItem: true,
        onClick: handleOpenSettings,
      },
    ] as NavItem[],
  };

  const [activeItem, setActiveItem] = React.useState<NavItem>(data.navMain[0]);

  const handleItemClick = (item: NavItem) => {
    if (item.isNavigationItem) {
      if (item.onClick) {
        item.onClick();
      } else {
        router.push(item.url);
      }
      return;
    }

    if (item.onClick) {
      item.onClick();
      return;
    }

    if (item.action) {
      item.action();
      return;
    }

    if (item.isPanelItem && item.component) {
      if (activeItem.title === item.title) {
        toggleLeftPanel(!leftPanelOpen);
        if (!leftPanelOpen) {
          setLeftPanelContent(item.component());
        }
      } else {
        setActiveItem(item);
        setLeftPanelContent(item.component());
        if (!leftPanelOpen) {
          toggleLeftPanel(true);
        }
      }
    }
  };

  const isItemActive = (item: NavItem) => {
    // For view items, check against activeView directly
    if (item.title === 'Spreadsheet') {
      return activeView === ViewType.SPREADSHEET;
    }
    if (item.title === 'Notebook') {
      return activeView === ViewType.NOTEBOOK;
    }
    if (item.title === 'Charts') {
      return activeView === ViewType.CHARTS;
    }

    if (item.isNavigationItem) {
      return window.location.pathname.startsWith(item.url);
    }
    return item.isPanelItem && activeItem.title === item.title && leftPanelOpen;
  };

  return (
    <SidebarProvider defaultOpen={false}>
      <Sidebar collapsible="icon" className="border-r border-border">
        <SidebarContent>
          <SidebarHeader>
            <Link href="/dashboard">
              <SidebarMenuButton
                tooltip={{
                  children: 'home',
                  hidden: false,
                }}
              >
                <Home />
                <span className="sr-only">home</span>
              </SidebarMenuButton>
            </Link>
          </SidebarHeader>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {(isSpreadsheetContext ? [] : data.navMain).map(item => {
                  const active = isItemActive(item);
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        tooltip={{
                          children: item.title,
                          hidden: false,
                        }}
                        onClick={() => handleItemClick(item)}
                        isActive={active}
                        className={cn('flex h-8 w-8 items-center justify-center p-0 rounded-md')}
                      >
                        <item.icon />
                        <span className="sr-only">{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            {data.navFooter.map(item => {
              const active = isItemActive(item);
              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    tooltip={{
                      children: item.title,
                      hidden: false,
                    }}
                    onClick={() => handleItemClick(item)}
                    isActive={active}
                    className={cn('flex h-8 w-8 items-center justify-center p-0 rounded-md')}
                  >
                    <item.icon />
                    <span className="sr-only">{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <CommandDialog open={isCommandOpen} onOpenChange={setIsCommandOpen}>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Quick Actions">
            <CommandItem onSelect={() => router.push('/settings/general')}>
              <Settings />
              <span>Open Settings</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </SidebarProvider>
  );
}
