import { useEffect, useState } from 'react';
import { useRouter } from '@tanstack/react-router';
import { Button } from '@/components/atoms/button';
import { Input } from '@/components/atoms/input';
import { LuFolder, LuFile, LuSearch, LuX, LuPlus } from 'react-icons/lu';
import { useProject } from '@/contexts/project-context';
import { Project } from '@/types/project';
import * as projectActions from '@/contexts/project-context/actions';
import { ProjectActions } from '@/contexts/project-context/types';
import { useApp } from '@/contexts/app-context';
import { DialogType } from '@/contexts/app-context/types';
import * as appActions from '@/contexts/app-context/actions';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/molecules/dropdown';
import ProjectAvatar from '@/components/molecules/project-avatar';

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

interface AddRecentProjectRequest {
  path: string;
  title: string;
  current_file: string | null;
  entry_type: string;
}

interface FileResponse {
  metadata: {
    preview: string[][];
    column_names: string[];
    rows: number;
    columns: number;
  };
}

export default function Projects() {
  const { dispatch: projectDispatch } = useProject();
  const { dispatch: appDispatch } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const router = useRouter();

  const fetchRecentProjects = async () => {
    try {
      const recent = {};
      // const recent = await invoke<RecentProject[]>('get_recent_projects');

      const projects: Project[] = recent.map(rp => ({
        id: rp.path,
        name: rp.title,
        path: rp.path,
        type: rp.entry_type as 'file' | 'directory',
        lastOpened: new Date(rp.last_accessed),
        initialFile: rp.current_file
          ? {
              path: rp.current_file,
            }
          : undefined,
      }));

      setRecentProjects(projects);
    } catch (err) {
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchRecentProjects();
  }, []);

  const handleNewProject = () => {
    appDispatch(appActions.showDialog(DialogType.NEW_PROJECT));
  };

  const addToHistory = async (project: Project) => {
    try {
      const request: AddRecentProjectRequest = {
        path: project.path,
        title: project.name,
        current_file: project.initialFile?.path ?? null,
        entry_type: project.type,
      };

      // await invoke('add_recent_project', { request });
      await fetchRecentProjects();
    } catch (err) {}
  };

  const handleOpenFile = async () => {
    try {
      setIsLoading(true);

      const filePath = {};
      // const filePath = await invoke<string | null>('open_file_dialog');
      if (!filePath) return;

      const fileName = filePath.split('/').pop() || 'Untitled';

      const project: Project = {
        id: crypto.randomUUID(),
        name: fileName,
        path: filePath,
        type: 'file',
      };

      projectDispatch({ type: ProjectActions.SET_PROJECT, payload: project });
      await addToHistory(project);

      if (fileName.endsWith('.csv') || fileName.endsWith('.xlsx')) {
        const response = {};
        // const response = await invoke<FileResponse>(
        //   fileName.endsWith('.csv') ? 'read_csv' : 'read_excel',
        //   { request: { path: filePath } }
        // );

        if (response.metadata) {
          const metadata = response.metadata;
          project.initialFile = {
            path: filePath,
            metadata: metadata,
          };

          projectDispatch({
            type: ProjectActions.SET_PROJECT,
            payload: project,
          });

          projectDispatch({
            type: ProjectActions.SET_SHOW_IMPORT_WIZARD,
            payload: true,
          });
        }
      }

      router.navigate({
        to: '/projects/$projectId',
        params: { projectId: project.id },
      });
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

      if (!dirPath) {
        return;
      }

      const project = await projectActions.openDirectory(dirPath, projectDispatch);

      await addToHistory(project);

      router.navigate({
        to: '/projects/$projectId',
        params: { projectId: project.id },
      });
    } catch (err) {
    } finally {
      setIsLoading(false);
    }
  };

  const handleProjectClick = async (project: Project) => {
    try {
      setIsLoading(true);

      if (project.type === 'file') {
        const fileExtension = project.path.split('.').pop()?.toLowerCase();

        if (fileExtension && ['csv', 'xlsx', 'xls'].includes(fileExtension)) {
          // Read file metadata first
          const response = {};
          // const response = await invoke<FileResponse>(
          //   fileExtension === 'csv' ? 'read_csv' : 'read_excel',
          //   { request: { path: project.path } }
          // );

          if (response.metadata) {
            // Set up project
            const reopenedProject = await projectActions.openFile(project.path);

            // Set up import data
            const importData = {
              fileName: project.name,
              filePath: project.path,
              preview: response.metadata.preview,
              columnNames: response.metadata.column_names,
              totalRows: response.metadata.rows,
              totalColumns: response.metadata.columns,
            };

            projectDispatch({
              type: ProjectActions.SET_IMPORT_DATA,
              payload: importData,
            });

            // Set up file system with single file entry
            projectDispatch({
              type: ProjectActions.SET_FILE_SYSTEM,
              payload: [
                {
                  name: project.name,
                  path: project.path,
                  entry_type: 'file',
                },
              ],
            });

            // Show import wizard
            projectDispatch({
              type: ProjectActions.SET_SHOW_IMPORT_WIZARD,
              payload: true,
            });

            // Update history
            await addToHistory(reopenedProject);

            router.navigate({
              to: '/projects/$projectId',
              params: { projectId: project.id },
              search: {
                fileOpen: 'true',
              },
            });
            return;
          }
        } else {
          // Handle other file types
          const reopenedProject = await projectActions.openFile(project.path);

          // Set up file system with single file entry
          projectDispatch({
            type: ProjectActions.SET_FILE_SYSTEM,
            payload: [
              {
                name: project.name,
                path: project.path,
                entry_type: 'file',
              },
            ],
          });

          // For markdown files, add a tab
          if (project.path.endsWith('.md')) {
            const content = {};
            // const content = await invoke<string>('read_file', { path: project.path });
            tabDispatch(
              addTab({
                name: project.name,
                path: project.path,
                type: ViewType.MARKDOWN,
                content,
                isDirty: false,
              })
            );
          }

          await addToHistory(reopenedProject);

          router.navigate({
            to: '/projects/$projectId',
            params: { projectId: project.id },
          });
        }
      } else {
        // Handle directories
        const reopenedProject = await projectActions.openDirectory(project.path, projectDispatch);
        await addToHistory(reopenedProject);

        router.navigate({
          to: '/projects/$projectId',
          params: { projectId: project.id },
        });
      }
    } catch (err) {
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveProject = async (e: React.MouseEvent, project: Project) => {
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

  const filteredProjects = recentProjects.filter(project =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (recentProjects.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 space-y-4">
        <h1 className="text-3xl font-semibold">Welcome to DataFlow</h1>
        <p className="text-muted-foreground text-center max-w-md">
          Create a new project to start from scratch.
          <br />
          Open existing project from disk or version control.
        </p>

        <div className="grid grid-cols-3 gap-8 mt-8">
          <Button
            variant="ghost"
            className="flex flex-col items-center p-8 hover:bg-accent hover:text-accent-foreground space-y-2"
            onClick={handleNewProject}
          >
            <LuPlus className="h-8 w-8" />
            <span>New Project</span>
          </Button>

          <Button
            variant="ghost"
            className="flex flex-col items-center p-8 hover:bg-accent hover:text-accent-foreground space-y-2"
            onClick={handleOpenDirectory}
          >
            <LuFolder className="h-8 w-8" />
            <span>Open</span>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <main className="grow p-6">
      <div className="flex items-center gap-4 pb-4 mb-4 border-b">
        <div className="relative grow max-w-md">
          <LuSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            type="text"
            placeholder="Search projects"
            variant="ghost"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-row gap-2">
          <Button size="sm" variant="outline" onClick={handleNewProject}>
            New Project
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" disabled={isLoading}>
                {isLoading ? 'Opening...' : 'Open'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleOpenFile}>
                <LuFile className="mr-2 h-4 w-4" />
                <span>File</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleOpenDirectory}>
                <LuFolder className="mr-2 h-4 w-4" />
                <span>Folder</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="space-y-2 max-w-xl mx-auto">
        {loadingHistory ? (
          <div className="text-center text-muted-foreground">Loading recent projects...</div>
        ) : (
          filteredProjects.map(project => (
            <div
              key={project.id}
              className="group relative hover:bg-accent hover:text-accent-foreground"
            >
              <Button
                variant="ghost"
                className="w-full items-start justify-start gap-3 h-auto py-3 hover:bg-transparent"
                onClick={() => handleProjectClick(project)}
              >
                <ProjectAvatar name={project.name} />
                <div className="text-left min-w-0 flex-1">
                  <div className="font-medium truncate">{project.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{project.path}</div>
                  {project.initialFile && (
                    <div className="text-sm text-muted-foreground truncate">
                      Last file: {project.initialFile.path}
                    </div>
                  )}
                </div>
              </Button>
              <Button
                variant="link"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={e => handleRemoveProject(e, project)}
                disabled={isLoading}
              >
                <LuX className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
