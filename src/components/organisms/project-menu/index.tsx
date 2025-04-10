import { useProject } from '@/contexts/project-context';
import { useApp } from '@/contexts/app-context';
import React, { useEffect, useState } from 'react';
import { AppActions, DialogType } from '@/contexts/app-context/types';
import { ProjectActions } from '@/contexts/project-context/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/molecules/dropdown';
import { Button } from '@/components/atoms/button';
import { LuChevronDown, LuFile, LuFolder, LuPlus, LuX } from 'react-icons/lu';

interface RecentProject {
  path: string;
  title: string;
  last_accessed: number;
  color_index: number;
  current_file: string | null;
  recent_files: string[];
  entry_type: string;
  children: string[] | null;
}

export const ProjectMenu = () => {
  const { state: projectState, dispatch: projectDispatch } = useProject();
  const { dispatch: appDispatch } = useApp();
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchRecentProjects = async () => {
    try {
      const recent = {};
      // const recent = await invoke<RecentProject[]>('get_recent_projects');
      setRecentProjects(recent);
    } catch (err) {}
  };

  useEffect(() => {
    fetchRecentProjects();
  }, []);

  const handleNewProject = () => {
    appDispatch({ type: AppActions.SHOW_DIALOG, payload: DialogType.NEW_PROJECT });
  };

  const handleOpenFile = async () => {
    try {
      setIsLoading(true);
      const filePath = {};
      // const filePath = await invoke<string | null>('open_file_dialog');
      if (!filePath) return;

      const fileName = filePath.split('/').pop() || 'Untitled';
      const project = {
        id: crypto.randomUUID(),
        name: fileName,
        path: filePath,
        type: 'file',
      };

      projectDispatch({ type: ProjectActions.SET_PROJECT, payload: project });
      await addToHistory(project);
    } catch (err) {
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDirectory = async () => {
    try {
      setIsLoading(true);
      const dirPath = {};
      // const dirPath = await invoke<string | null>('open_directory_dialog');
      if (!dirPath) return;

      const project = {
        id: crypto.randomUUID(),
        name: dirPath.split('/').pop() || 'Untitled',
        path: dirPath,
        type: 'directory',
      };

      projectDispatch({ type: ProjectActions.SET_PROJECT, payload: project });
      await addToHistory(project);
    } catch (err) {
    } finally {
      setIsLoading(false);
    }
  };

  const addToHistory = async (project: any) => {
    try {
      // await invoke('add_recent_project', {
      //   request: {
      //     path: project.path,
      //     title: project.name,
      //     current_file: project.currentFile,
      //     entry_type: project.type,
      //   },
      // });
      await fetchRecentProjects();
    } catch (err) {}
  };

  const handleRemoveProject = async (e: React.MouseEvent, project: RecentProject) => {
    e.stopPropagation();
    try {
      setIsLoading(true);
      // await invoke('remove_from_history', { path: project.path });
      await fetchRecentProjects();
    } catch (err) {
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          {projectState.currentProject?.name || 'No Project'}
          <LuChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuItem disabled={isLoading} onClick={handleNewProject}>
          <LuPlus className="h-4 w-4 mr-2" />
          New Project
        </DropdownMenuItem>
        <DropdownMenuItem disabled={isLoading} onClick={handleOpenFile}>
          <LuFile className="h-4 w-4 mr-2" />
          Open File
        </DropdownMenuItem>
        <DropdownMenuItem disabled={isLoading} onClick={handleOpenDirectory}>
          <LuFolder className="h-4 w-4 mr-2" />
          Open Folder
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {projectState.currentProject && (
          <>
            <DropdownMenuLabel>Current Project</DropdownMenuLabel>
            <DropdownMenuItem disabled={isLoading} className="flex items-center gap-2">
              {projectState.currentProject.type === 'directory' ? (
                <LuFolder className="h-4 w-4" />
              ) : (
                <LuFile className="h-4 w-4" />
              )}
              <div className="flex flex-col">
                <span className="font-medium">{projectState.currentProject.name}</span>
                <span className="text-xs text-muted-foreground">
                  {projectState.currentProject.path}
                </span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        {recentProjects.length > 0 && (
          <>
            <DropdownMenuLabel>Recent Projects</DropdownMenuLabel>
            {recentProjects.map(project => (
              <DropdownMenuItem
                disabled={isLoading}
                key={project.path}
                className="flex items-center justify-between group"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {project.entry_type === 'directory' ? (
                    <LuFolder className="h-4 w-4 shrink-0" />
                  ) : (
                    <LuFile className="h-4 w-4 shrink-0" />
                  )}
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium truncate">{project.title}</span>
                    <span className="text-xs text-muted-foreground truncate">{project.path}</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={e => handleRemoveProject(e, project)}
                >
                  <LuX className="h-4 w-4" />
                </Button>
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
