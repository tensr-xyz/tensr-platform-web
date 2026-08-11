import { useRouter } from 'next/navigation';
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
import { ChevronDown, File, Folder, Plus } from 'lucide-react';

export const ProjectMenu = () => {
  const router = useRouter();
  const { currentProject } = useProjectStore();

  const handleNewProject = () => {
    // Real create flow lives at /project/new (store dialog flag had no UI host).
    router.push('/project/new');
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
        <DropdownMenuItem onClick={handleNewProject}>
          <Plus className="h-4 w-4 mr-2" />
          New Project
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
            <DropdownMenuItem className="flex items-center gap-2">
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
