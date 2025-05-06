import * as React from 'react';
import { LuSheet, LuSquareCode, LuSearch, LuSettings } from 'react-icons/lu';
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
} from '@/components/organisms/sidebar';
import { useProject } from '@/contexts/project-context';
import { ProjectActions, ViewType, ActionProps } from '@/contexts/project-context/types';
import {
  refreshFileSystem,
  setLeftPanelContent,
  setView,
} from '@/contexts/project-context/actions';
import { IconType } from 'react-icons';
import { cn } from '@/utils';
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

interface NavItem {
  title: string;
  url: string;
  icon: IconType;
  isActive: boolean;
  component?: () => React.ReactNode;
  isNavigationItem?: boolean;
  isPanelItem?: boolean;
  action?: () => ActionProps;
  onClick?: () => void;
}

interface ProjectSidebarProps {}

export default function ProjectSidebar({}: ProjectSidebarProps) {
  const { state, dispatch } = useProject();
  const [isCommandOpen, setIsCommandOpen] = React.useState(false);

  const handleRefreshFileSystem = React.useCallback(async () => {
    if (state.currentProject?.path) {
      await refreshFileSystem(state.currentProject.path, dispatch);
    }
  }, [state.currentProject?.path, dispatch]);

  React.useEffect(() => {
    handleRefreshFileSystem();
  }, [handleRefreshFileSystem]);

  React.useEffect(() => {
    if (state.currentProject?.type === 'directory') {
      handleRefreshFileSystem();
    }
  }, [state.currentProject, handleRefreshFileSystem]);

  const handleOpenSettings = () => {
    // Add your settings dialog opening logic here
    console.log('Open settings dialog');
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
        icon: LuSheet,
        action: () => setView(ViewType.SPREADSHEET),
      },
      {
        title: 'Notebook',
        url: '#',
        icon: LuSquareCode,
        action: () => setView(ViewType.NOTEBOOK),
      },
    ] as NavItem[],
    navFooter: [
      {
        title: 'Search',
        url: '#',
        icon: LuSearch,
        onClick: handleOpenSearch,
      },
      {
        title: 'Settings',
        url: '#',
        icon: LuSettings,
        onClick: handleOpenSettings,
      },
    ] as NavItem[],
  };

  const [activeItem, setActiveItem] = React.useState<NavItem>(data.navMain[0]);

  const handleItemClick = (item: NavItem) => {
    if (item.isNavigationItem) {
      return;
    }

    if (item.onClick) {
      item.onClick();
      return;
    }

    if (item.action) {
      const action = item.action();
      dispatch(action);
      return;
    }

    if (item.isPanelItem && item.component) {
      if (activeItem.title === item.title) {
        dispatch({ type: ProjectActions.TOGGLE_LEFT_PANEL, payload: !state.leftPanelOpen });
        if (!state.leftPanelOpen) {
          dispatch(setLeftPanelContent(item.component()));
        }
      } else {
        setActiveItem(item);
        dispatch(setLeftPanelContent(item.component()));
        if (!state.leftPanelOpen) {
          dispatch({ type: ProjectActions.TOGGLE_LEFT_PANEL, payload: true });
        }
      }
    }
  };

  const isItemActive = (item: NavItem) => {
    if (item.action) {
      const actionPayload = item.action().payload;
      return Object.values(ViewType).includes(actionPayload) && state.activeView === actionPayload;
    }
    if (item.isNavigationItem) {
      return window.location.pathname.startsWith(item.url);
    }
    return item.isPanelItem && activeItem.title === item.title && state.leftPanelOpen;
  };

  // Custom style classes for icon color
  const iconStyle = 'text-[rgba(241,243,242,1)]';
  const activeIconStyle = '!active:text-[rgb(225,227,227)]';
  const activeBackgroundStyle = '!active:bg-[rgba(199,209,207,0.1)]';

  return (
    <>
      <Sidebar
        collapsible="none"
        style={{
          background: 'var(--foreground)',
          backgroundColor: 'var(--foreground)',
        }}
      >
        <SidebarContent>
          <SidebarHeader>
            <Link href="/">
              <SidebarMenuButton
                tooltip={{
                  children: 'home',
                  hidden: false,
                }}
                className={cn(iconStyle)}
              >
                <Home />
                <span className="sr-only">home</span>
              </SidebarMenuButton>
            </Link>
          </SidebarHeader>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {data.navMain.map(item => {
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
                        className={cn(
                          'flex h-8 w-8 items-center justify-center p-0 rounded-md',
                          iconStyle,
                          active ? cn(activeIconStyle, activeBackgroundStyle) : ''
                        )}
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
            {data.navFooter.map(item => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  tooltip={{
                    children: item.title,
                    hidden: false,
                  }}
                  onClick={() => handleItemClick(item)}
                  className={cn(
                    'flex h-8 w-8 items-center justify-center p-0 rounded-md',
                    iconStyle
                  )}
                >
                  <item.icon />
                  <span className="sr-only">{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <CommandDialog open={isCommandOpen} onOpenChange={setIsCommandOpen}>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Quick Actions">
            <CommandItem>
              <LuSettings />
              <span>Open Settings</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
