"use client"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from '@/components/molecules/context-menu';
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
} from '@/components/organisms/sidebar';
import {
  LuChevronRight,
  LuFile,
  LuFilePlus,
  LuFolder,
  LuFolderPlus,
  LuMinus,
} from 'react-icons/lu';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/atoms/collapsible';
import { useCallback, useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/molecules/dialog';
import { Button } from '@/components/atoms/button';
import { Input } from '@/components/atoms/input';
import { ProjectActions, ViewType } from '@/contexts/project-context/types';
import { addTab } from '@/contexts/tabs-context/actions';
import { useTabs } from '@/contexts/tabs-context';
import { useProject } from '@/contexts/project-context';
import { refreshFileSystem } from '@/contexts/project-context/actions';
import { useFileOperations } from '@/hooks/use-file-operations';
import { ImportData } from '@/types/file';
import { FileResponse } from '@/types/project';

interface FileEntry {
  name: string;
  path: string;
  entry_type: string;
  children?: FileEntry[];
}

interface FileTreeProps {
  item: FileEntry;
  selectedPath: string;
  onRefresh: () => Promise<void>;
}

interface FileOperationsProps {
  currentPath: string;
  onRefresh: () => void;
}

const sortItems = (items: FileEntry[]) => {
  return [...items].sort((a, b) => {
    // If both are the same type, sort alphabetically
    if (a.entry_type === b.entry_type) {
      return a.name.localeCompare(b.name);
    }
    // Folders come before files
    return a.entry_type === 'directory' ? -1 : 1;
  });
};

const createEmptySpreadsheetData = () => ({
  initialData: [],
  initialColumns: [],
  totalRows: 100,
  totalColumns: 10,
  columnStats: {},
  importSettings: {
    delimiter: ',',
    textQualifier: '"',
    hasHeaders: true,
    trimSpaces: false,
    skipEmptyRows: true,
    columnTypes: {},
    columnNames: undefined,
  },
  isInitialized: true,
});

// types.ts
type FileOperation = 'file' | 'folder';

interface CreateDialogProps {
  type: FileOperation;
  currentPath: string;
  onClose: () => void;
  onCreateFile: (name: string) => Promise<boolean>;
  onCreateFolder: (name: string) => Promise<boolean>;
}

export const CreateDialog: React.FC<CreateDialogProps> = ({
  type,
  currentPath,
  onClose,
  onCreateFile,
  onCreateFolder,
}) => {
  const [name, setName] = useState('');
  const [error, setError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(undefined);

    try {
      const success = await (type === 'file' ? onCreateFile(name) : onCreateFolder(name));
      if (success) {
        setName('');
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create ' + type);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New {type === 'file' ? 'File' : 'Folder'}</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={`Enter ${type} name`}
            className="w-full"
            onKeyDown={e => {
              if (e.key === 'Enter' && name && !isSubmitting) {
                handleSubmit();
              }
            }}
          />
          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
          {currentPath && (
            <p className="text-sm text-muted-foreground mt-2">Creating in: {currentPath}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || isSubmitting}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

interface FileTreeItemProps {
  item: FileEntry;
  onDoubleClick: (e: React.MouseEvent) => void;
  onCreateFile: () => void;
}

export const FileTreeItem = ({ item, onDoubleClick, onCreateFile }: FileTreeItemProps) => {
  const { state, dispatch } = useProject();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dispatch({ type: ProjectActions.SET_SELECTED_PATH, payload: item.path });
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <SidebarMenuButton
          className="relative"
          isActive={state.selectedPath === item.path}
          onClick={handleClick}
          onDoubleClick={e => {
            e.preventDefault();
            e.stopPropagation();
            onDoubleClick(e);
          }}
        >
          <LuFile className="shrink-0" />
          <span className="truncate">{item.name}</span>
        </SidebarMenuButton>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={onCreateFile}>
          New File
          <ContextMenuShortcut>⌘N</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};

interface FolderTreeItemProps {
  item: FileEntry;
  selectedPath: string;
  onCreateFile: () => void;
  onCreateFolder: () => void;
  children?: FileEntry[];
  onRefresh: () => Promise<void>;
}

export const FolderTreeItem = ({
  item,
  selectedPath,
  onCreateFile,
  onCreateFolder,
  children,
  onRefresh,
}: FolderTreeItemProps) => {
  const { state, dispatch } = useProject();

  const handleClick = (e: React.MouseEvent) => {
    // Only handle folder clicks, not bubbled events
    if (e.currentTarget === e.target || e.target === e.currentTarget.firstChild) {
      e.stopPropagation();
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dispatch({ type: ProjectActions.SET_SELECTED_PATH, payload: item.path });
  };

  return (
    <SidebarMenuItem>
      <ContextMenu>
        <ContextMenuTrigger>
          <Collapsible
            className="group/collapsible [&[data-state=open]>button>svg:first-child]:rotate-90"
            defaultOpen={item.name === 'test_folder'}
          >
            <CollapsibleTrigger asChild>
              <SidebarMenuButton
                className="group relative hover:bg-accent/50"
                isActive={state.selectedPath === item.path}
                onClick={handleClick}
                onDoubleClick={handleDoubleClick}
              >
                <LuChevronRight className="transition-transform shrink-0" />
                <LuFolder className="shrink-0" />
                <span className="truncate">{item.name}</span>
              </SidebarMenuButton>
            </CollapsibleTrigger>
            {children && children.length > 0 && (
              <CollapsibleContent>
                <SidebarMenuSub>
                  {sortItems(children).map(child => (
                    <FileTree
                      key={child.path}
                      item={child}
                      selectedPath={selectedPath}
                      onRefresh={onRefresh}
                    />
                  ))}
                </SidebarMenuSub>
              </CollapsibleContent>
            )}
          </Collapsible>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={onCreateFile}>
            New File
            <ContextMenuShortcut>⌘N</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onClick={onCreateFolder}>
            New Folder
            <ContextMenuShortcut>⇧⌘N</ContextMenuShortcut>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </SidebarMenuItem>
  );
};

interface FileOperationsProps {
  onRefresh: () => void;
}

export const FileOperations: React.FC<FileOperationsProps> = ({ onRefresh }) => {
  const { state } = useProject();
  const [dialog, setDialog] = useState<{ type: FileOperation; isOpen: boolean } | null>(null);

  // Get the current directory path based on selection
  const getCurrentDirectory = () => {
    if (!state.selectedPath) return state.currentProject?.path || '';

    // If selected item is a file, use its parent directory
    const selectedItem = state.fileSystem.find(item => {
      const queue = [item];
      while (queue.length > 0) {
        const current = queue.shift()!;
        if (current.path === state.selectedPath) return current;
        if (current.children) queue.push(...current.children);
      }
      return false;
    });

    if (selectedItem?.entry_type === 'file') {
      return state.selectedPath.substring(0, state.selectedPath.lastIndexOf('/'));
    }

    return state.selectedPath;
  };

  const currentPath = getCurrentDirectory();
  const { createFile, createFolder } = useFileOperations(currentPath, onRefresh);

  return (
    <div className="flex">
      <Button size="icon" variant="ghost" onClick={() => setDialog({ type: 'file', isOpen: true })}>
        <LuFilePlus className="h-4 w-4" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        onClick={() => setDialog({ type: 'folder', isOpen: true })}
      >
        <LuFolderPlus className="h-4 w-4" />
      </Button>

      {dialog && (
        <CreateDialog
          type={dialog.type}
          currentPath={currentPath}
          onClose={() => setDialog(null)}
          onCreateFile={createFile}
          onCreateFolder={createFolder}
        />
      )}
    </div>
  );
};

export const FileTree: React.FC<FileTreeProps> = ({ item, selectedPath, onRefresh }) => {
  const { state, dispatch } = useProject();
  const { dispatch: tabsDispatch } = useTabs();
  const [dialog, setDialog] = useState<{ type: FileOperation; isOpen: boolean } | null>(null);
  const { createFile, createFolder } = useFileOperations(item.path, onRefresh);
  const [isProcessing, setIsProcessing] = useState(false);

  // Full file processing handler - moved from original handleFileSelect
  const handleFileOpen = async (file: FileEntry) => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      if (file.entry_type === 'file') {
        if (file.name.endsWith('.csv')) {
          try {
            const response = {};
            // const response = await invoke<FileResponse>('read_csv', {
            //   request: {
            //     path: file.path,
            //     projectPath: state.currentProject?.path,
            //   },
            // });

            if (response?.metadata) {
              const importData: ImportData = {
                fileName: file.name,
                filePath: file.path,
                preview: response.metadata.preview,
                columnNames: response.metadata.column_names,
                totalRows: response.metadata.rows,
                totalColumns: response.metadata.columns,
              };

              dispatch({
                type: ProjectActions.SET_IMPORT_DATA,
                payload: importData,
              });

              dispatch({
                type: ProjectActions.SET_SHOW_IMPORT_WIZARD,
                payload: true,
              });
            }
          } catch (err: any) {
            // Check if it's a Polars empty CSV error
            if (err?.Polars?.includes('empty CSV')) {
              const emptyData = createEmptySpreadsheetData();
              tabsDispatch(
                addTab({
                  name: file.name,
                  path: file.path,
                  type: ViewType.SPREADSHEET,
                  content: '',
                  data: emptyData,
                  isDirty: false,
                })
              );
            } else {
            }
          }
        } else if (file.name.endsWith('.md')) {
          try {
            const content = {};
            // const content = await invoke<string>('read_file', { path: file.path });
            tabsDispatch(
              addTab({
                name: file.name,
                path: file.path,
                type: ViewType.MARKDOWN,
                content,
                isDirty: false,
              })
            );
          } catch (err) {

          }
        }
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDoubleClick = async (e: React.MouseEvent, file: FileEntry) => {
    e.preventDefault();
    e.stopPropagation();

    if (file.entry_type === 'file') {
      await handleFileOpen(file);
    }
  };

  if (item.entry_type === 'file') {
    return (
      <FileTreeItem
        item={item}
        onDoubleClick={e => handleDoubleClick(e, item)}
        onCreateFile={() => setDialog({ type: 'file', isOpen: true })}
      />
    );
  }

  return (
    <>
      <FolderTreeItem
        item={item}
        selectedPath={selectedPath}
        onCreateFile={() => setDialog({ type: 'file', isOpen: true })}
        onCreateFolder={() => setDialog({ type: 'folder', isOpen: true })}
        children={item.children}
        onRefresh={onRefresh}
      />

      {dialog && state.selectedPath && (
        <CreateDialog
          type={dialog.type}
          currentPath={state.selectedPath}
          onClose={() => setDialog(null)}
          onCreateFile={createFile}
          onCreateFolder={createFolder}
        />
      )}
    </>
  );
};

export const FolderComponent: React.FC = () => {
  const { state, dispatch } = useProject();
  const [selectedPath] = useState('');

  const handleRefresh = useCallback(async () => {
    if (state.currentProject?.path) {
      await refreshFileSystem(state.currentProject.path, dispatch);
    }
  }, [state.currentProject?.path, dispatch]);

  useEffect(() => {
    handleRefresh();
  }, [handleRefresh]);

  return (
    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupContent className="flex justify-between items-center">
          <SidebarGroupLabel>Files</SidebarGroupLabel>
          <div className="flex items-center">
            {state.currentProject?.type === 'directory' && (
              <FileOperations currentPath={selectedPath || ''} onRefresh={handleRefresh} />
            )}
            <Button
              size="icon"
              variant="ghost"
              onClick={() => dispatch({ type: ProjectActions.TOGGLE_LEFT_PANEL, payload: false })}
            >
              <LuMinus />
            </Button>
          </div>
        </SidebarGroupContent>
        <SidebarGroupContent>
          <SidebarMenu>
            {state.fileSystem.map(item => (
              <FileTree
                key={item.path}
                item={item}
                selectedPath={selectedPath}
                onRefresh={handleRefresh}
              />
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>
  );
};
