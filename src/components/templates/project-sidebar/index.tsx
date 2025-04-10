'use client';

import * as React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  LuBlocks,
  LuGitCompare,
  LuFolder,
  LuSheet,
  LuSquareCode,
  LuArrowRight,
} from 'react-icons/lu';
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
  SidebarTrigger,
  SidebarProvider,
  SidebarRail,
  useSidebar,
} from '@/components/organisms/sidebar';
import { useProject } from '@/contexts/project-context';
import { ProjectActions, ViewType } from '@/contexts/project-context/types';
import { refreshFileSystem, setView } from '@/contexts/project-context/actions';
import { ImportData } from '@/types/file';
import { FolderComponent } from '@/components/organisms/file-tree';
import { FileEntry, FileResponse } from '@/types/project';
import { IconType } from 'react-icons';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/atoms/avatar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/api/use-auth';
import { Dialog, DialogContent, DialogTrigger } from '@/components/molecules/dialog';
import { Button } from '@/components/atoms/button';
import { EmailForm, OTPForm } from '@/components/organisms/forms/auth-form';

interface NavItem {
  title: string;
  url: string;
  icon: IconType;
  isActive: boolean;
  component?: () => React.ReactNode;
  isNavigationItem?: boolean;
  isPanelItem?: boolean;
  action?: () => { type: string; payload: any };
}

interface ProjectSidebarProps {
  onPanelContent: (content: React.ReactNode) => void;
}

export default function ProjectSidebar({ onPanelContent }: ProjectSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { state, dispatch } = useProject();
  const [selectedPath, setSelectedPath] = React.useState('');

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

  const handleSelect = async (path: string) => {
    const findFile = (entries: FileEntry[], targetPath: string): FileEntry | null => {
      for (const entry of entries) {
        if (entry.path === targetPath) return entry;
        if (entry.children) {
          const found = findFile(entry.children, targetPath);
          if (found) return found;
        }
      }
      return null;
    };

    const file = findFile(state.fileSystem, path);

    // Update UI selection for both files and folders
    setSelectedPath(path);
    dispatch({ type: ProjectActions.SET_SELECTED_PATH, payload: path });

    // Only process file operations for files
    if (file?.entry_type === 'file') {
      if (file.name.endsWith('.csv')) {
        try {
          // Replace Tauri invoke with fetch to your Next.js API
          const response = await fetch('/api/csv/read', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              path: file.path,
              projectPath: state.currentProject?.path,
            }),
          });

          const data: FileResponse = await response.json();

          if (data?.metadata) {
            const importData: ImportData = {
              fileName: file.name,
              filePath: file.path,
              preview: data.metadata.preview,
              columnNames: data.metadata.column_names,
              totalRows: data.metadata.rows,
              totalColumns: data.metadata.columns,
            };

            dispatch({
              type: ProjectActions.SET_IMPORT_DATA,
              payload: importData,
            });

            dispatch({
              type: ProjectActions.SET_SHOW_IMPORT_WIZARD,
              payload: true,
            });
          } else {
          }
        } catch (err) {}
      }
    }
  };

  const data = {
    navMain: [
      {
        title: 'Folder',
        url: '/project/folder',
        icon: LuFolder,
        isActive: true,
        isPanelItem: true,
        component: () => <FolderComponent />,
      },
      {
        title: 'Spreadsheet',
        url: '/project/spreadsheet',
        icon: LuSheet,
        action: () => setView(ViewType.SPREADSHEET),
      },
      {
        title: 'Builder',
        url: '/project/builder',
        icon: LuGitCompare,
        action: () => setView(ViewType.MODEL_BUILDER),
      },
      {
        title: 'Plugins',
        url: '/project/plugins',
        icon: LuBlocks,
        action: () => setView(ViewType.PLUGINS),
      },
    ] as NavItem[],
    navFooter: [
      {
        title: 'Notebook',
        url: '/project/notebook',
        icon: LuSquareCode,
        action: () => setView(ViewType.NOTEBOOK),
      },
    ] as NavItem[],
  };

  const [activeItem, setActiveItem] = React.useState<NavItem>(data.navMain[0]);

  const handleItemClick = (item: NavItem) => {
    if (item.isNavigationItem) {
      router.push(item.url);
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
          onPanelContent(item.component());
        }
      } else {
        setActiveItem(item);
        onPanelContent(item.component());
        if (!state.leftPanelOpen) {
          dispatch({ type: ProjectActions.TOGGLE_LEFT_PANEL, payload: true });
        }
      }
    }
  };

  const isItemActive = (item: NavItem) => {
    if (item.action) {
      return state.activeView === ViewType[item.action().payload];
    }
    if (item.isNavigationItem) {
      return pathname.startsWith(item.url);
    }
    return item.isPanelItem && activeItem.title === item.title && state.leftPanelOpen;
  };

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarTrigger />
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup className="px-1">
            <SidebarGroupContent>
              <SidebarMenu>
                {data.navMain.map(item => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      tooltip={{
                        children: item.title,
                        hidden: false,
                      }}
                      onClick={() => handleItemClick(item)}
                      isActive={isItemActive(item)}
                      className="flex h-8 w-8 items-center justify-center p-0"
                    >
                      <item.icon />
                      <span className="sr-only">{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="px-1">
          <SidebarMenu>
            {data.navFooter.map(item => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  tooltip={{
                    children: item.title,
                    hidden: false,
                  }}
                  onClick={() => handleItemClick(item)}
                  isActive={isItemActive(item)}
                  className="flex h-8 w-8 items-center justify-center p-0"
                >
                  <item.icon />
                  <span className="sr-only">{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
    </SidebarProvider>
  );
}
