import { useState } from 'react';
import {
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/organisms/sidebar';
import { LuFolder } from 'react-icons/lu';
import { Button } from '@/components/atoms/button';
import { Input } from '@/components/atoms/input';
import { useRouter } from '@tanstack/react-router';
import { useProject } from '@/contexts/project-context';
import { ProjectActions } from '@/contexts/project-context/types';
import { useApp } from '@/contexts/app-context';
import { AppActions } from '@/contexts/app-context/types';

interface CreateProjectError {
  message?: string;
}

export default function NewProject() {
  const { dispatch: projectDispatch } = useProject();
  const { dispatch: appDispatch } = useApp();
  const router = useRouter();
  const [currentTemplate, setCurrentTemplate] = useState('blank');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const [projectConfig, setProjectConfig] = useState({
    name: '',
    location: '',
  });

  const navigationItems = [
    {
      id: 'blank',
      name: 'Blank Project',
    },
  ];

  const handleLocationSelect = async () => {
    try {
      const path = {};
      // const path = await invoke<string | null>('open_directory_dialog');
      if (path) {
        setProjectConfig(prev => ({
          ...prev,
          location: path,
        }));
        setError('');
      }
    } catch (err) {
      console.error('Failed to select location:', err);
      setError('Failed to select location');
    }
  };

  const handleCreate = async () => {
    try {
      setIsCreating(true);
      setError('');

      const newProject = {};
      // const newProject = await invoke<{
      //   id: string;
      //   path: string;
      //   title: string;
      //   entry_type: string;
      // }>('create_project', {
      //   name: projectConfig.name,
      //   location: projectConfig.location,
      // });
      //
      // // Add to recent projects
      // await invoke('add_recent_project', {
      //   request: {
      //     path: newProject.path,
      //     title: newProject.title,
      //     current_file: null,
      //     entry_type: newProject.entry_type,
      //   },
      // });

      const project = {
        id: newProject.id,
        name: newProject.title,
        path: newProject.path,
        type: newProject.entry_type,
      };

      projectDispatch({ type: ProjectActions.SET_PROJECT, payload: project });

      router.navigate({
        to: '/projects/$projectId',
        params: { projectId: project.id },
      });
    } catch (err) {
      console.error('Failed to create project:', err);
      const error = err as CreateProjectError;
      setError(error.message || 'Failed to create project');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="h-full flex">
      <Sidebar collapsible="none" className="border-r p-4 w-52 shrink-0">
        <SidebarContent>
          <SidebarMenu>
            {navigationItems.map(item => (
              <SidebarMenuItem key={item.id}>
                <SidebarMenuButton
                  asChild
                  isActive={currentTemplate === item.id}
                  className="hover:bg-neutral-200 active:bg-neutral-200 w-full"
                  onClick={() => setCurrentTemplate(item.id)}
                >
                  <button className="flex items-center gap-2 px-2 py-1 w-full text-left">
                    <span>{item.name}</span>
                  </button>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>

      <div className="flex-1 flex flex-col bg-foreground min-w-0">
        <main className="flex-1 p-8 max-w-2xl">
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="text-sm w-24 font-medium">Name:</div>
              <div className="flex-1">
                <Input
                  inputSize="sm"
                  value={projectConfig.name}
                  onChange={e =>
                    setProjectConfig(prev => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                  placeholder="My Project"
                  className={`w-full ${error ? 'border-red-500' : ''}`}
                />
                {error && <div className="text-sm text-red-500 mt-1">{error}</div>}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-sm w-24 font-medium">Location:</div>
              <div className="relative flex-1">
                <Input
                  inputSize="sm"
                  value={projectConfig.location}
                  readOnly
                  placeholder="/Users/username/Projects"
                  className={`pr-9 ${error ? 'border-red-500' : ''}`}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleLocationSelect}
                  className="absolute right-0 top-0"
                >
                  <LuFolder className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </main>

        <footer className="h-12 border-t flex items-center px-8">
          <div className="flex gap-2 ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                appDispatch({ type: AppActions.SHOW_DIALOG, payload: { dialog: null } })
              }
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={!projectConfig.name || !projectConfig.location || isCreating}
            >
              {isCreating ? 'Creating...' : 'Create Project'}
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}
