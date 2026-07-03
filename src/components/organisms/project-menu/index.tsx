import { useAppStore, DialogType } from '@/stores/app-store';
import React, { useEffect, useState } from 'react';
import { useProjectStore } from '@/stores/project-store';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/molecules/dropdown';
import { Button } from '@/components/atoms/button';
import { FolderComponent } from '@/components/organisms/file-tree';
import { ChevronDown, File, Folder, Plus, X } from 'lucide-react';

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
  const { setProject, currentProject } = useProjectStore();
  const { showDialog } = useAppStore();
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchRecentProjects = async () => {
    try {
      const recent: RecentProject[] = [];
      // const recent = await invoke<RecentProject[]>('get_recent_projects');
      setRecentProjects(recent);
    } catch (err) {}
  };

  useEffect(() => {
    fetchRecentProjects();
  }, []);

  const handleNewProject = () => {
    showDialog(DialogType.NEW_PROJECT);
  };

  const handleOpenFile = async () => {
    try {
      setIsLoading(true);
      const filePath: string = '';
      // const filePath = await invoke<string | null>('open_file_dialog');
      if (!filePath) return;

      const fileName = filePath.split('/').pop() || 'Untitled';
      const project = {
        id: crypto.randomUUID(),
        name: fileName,
        path: filePath,
        type: 'file' as const,
      };

      setProject(project);
      await addToHistory(project);
    } catch (err) {
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDirectory = async () => {
    try {
      setIsLoading(true);
      const dirPath: string = '';
      // const dirPath = await invoke<string | null>('open_directory_dialog');
      if (!dirPath) return;

      const project = {
        id: crypto.randomUUID(),
        name: dirPath.split('/').pop() || 'Untitled',
        path: dirPath,
        type: 'directory' as const,
      };

      setProject(project);
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
        <Button variant="ghost" className="h-11 gap-2 rounded-none px-3 text-xs font-normal">
          {currentProject?.name || 'No Project'}
          <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80 max-h-[min(80vh,28rem)] overflow-y-auto">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuItem disabled={isLoading} onClick={handleNewProject}>
          <Plus className="h-4 w-4 mr-2" />
          New Project
        </DropdownMenuItem>
        <DropdownMenuItem disabled={isLoading} onClick={handleOpenFile}>
          <File className="h-4 w-4 mr-2" />
          Open File
        </DropdownMenuItem>
        <DropdownMenuItem disabled={isLoading} onClick={handleOpenDirectory}>
          <Folder className="h-4 w-4 mr-2" />
          Open Folder
        </DropdownMenuItem>

        {currentProject ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Project files</DropdownMenuLabel>
            <div className="px-1 py-1" onPointerDown={e => e.stopPropagation()}>
              <FolderComponent />
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Current Project</DropdownMenuLabel>
            <DropdownMenuItem disabled={isLoading} className="flex items-center gap-2">
              {currentProject.type === 'directory' ? (
                <Folder className="h-4 w-4" />
              ) : (
                <File className="h-4 w-4" />
              )}
              <div className="flex flex-col">
                <span className="font-medium">{currentProject.name}</span>
                <span className="text-xs text-muted-foreground">{currentProject.path}</span>
              </div>
            </DropdownMenuItem>
          </>
        ) : null}

        {recentProjects.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Recent Projects</DropdownMenuLabel>
            {recentProjects.map(project => (
              <DropdownMenuItem
                disabled={isLoading}
                key={project.path}
                className="flex items-center justify-between group"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {project.entry_type === 'directory' ? (
                    <Folder className="h-4 w-4 shrink-0" />
                  ) : (
                    <File className="h-4 w-4 shrink-0" />
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
                  <X className="h-4 w-4" />
                </Button>
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
