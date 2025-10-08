import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from '@/components/molecules/context-menu';
import {
  SidebarContent,
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
  LuDatabase,
  LuRefreshCw,
} from 'react-icons/lu';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/atoms/collapsible';
import { useCallback, useEffect, useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/molecules/dialog';
import { Button } from '@/components/atoms/button';
import { Input } from '@/components/atoms/input';
import { useProjectStore } from '@/stores/project-store';
import { useAuth } from '@/hooks/api/use-auth';
import { ImportData } from '@/types/file';
import { FileResponse } from '@/types/project';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/molecules/accordion';
import { ScrollArea } from '@/components/atoms/scroll-area';
import { MENU_ITEMS, ANALYSIS_COMPONENTS } from '@/configs/analysis-config';

interface FileEntry {
  name: string;
  path: string;
  entry_type: string;
  children?: FileEntry[];
}

interface FileTreeItemProps {
  item: FileEntry;
  onDoubleClick: (item: FileEntry) => void;
  onCreateFile: (item: FileEntry) => void;
}

interface FolderTreeItemProps {
  item: FileEntry;
  onDoubleClick: (item: FileEntry) => void;
  onCreateFile: (item: FileEntry) => void;
  onRefresh: () => Promise<void>;
}

interface FileOperationsProps {
  currentPath: string;
  onRefresh: () => Promise<void>;
}

interface FileTreeProps {
  item: FileEntry;
  selectedPath: string;
  onRefresh: () => Promise<void>;
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

export const FileTreeItem = ({ item, onDoubleClick, onCreateFile }: FileTreeItemProps) => {
  const { currentProject } = useProjectStore();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDoubleClick) {
      onDoubleClick(item);
    }
  };

  const handleCreateFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onCreateFile) {
      onCreateFile(item);
    }
  };

  return (
    <div
      className="flex items-center justify-between p-1 hover:bg-accent rounded-sm cursor-pointer"
      onClick={handleClick}
    >
      <div className="flex items-center gap-2">
        {item.entry_type === 'directory' ? (
          <LuFolder className="h-4 w-4 text-blue-500" />
        ) : (
          <LuFile className="h-4 w-4 text-gray-500" />
        )}
        <span className="text-sm">{item.name}</span>
      </div>
      {item.entry_type === 'directory' && (
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 opacity-0 group-hover:opacity-100"
          onClick={handleCreateFile}
        >
          <LuFilePlus className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
};

export const FolderTreeItem = ({
  item,
  onDoubleClick,
  onCreateFile,
  onRefresh,
}: FolderTreeItemProps) => {
  const { currentProject } = useProjectStore();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDoubleClick) {
      onDoubleClick(item);
    }
  };

  const handleCreateFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onCreateFile) {
      onCreateFile(item);
    }
  };

  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <div
          className="flex items-center justify-between p-1 hover:bg-accent rounded-sm cursor-pointer"
          onClick={handleClick}
        >
          <div className="flex items-center gap-2">
            <LuFolder className="h-4 w-4 text-blue-500" />
            <span className="text-sm">{item.name}</span>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 opacity-0 group-hover:opacity-100"
            onClick={handleCreateFile}
          >
            <LuFilePlus className="h-3 w-3" />
          </Button>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pl-4">
          {item.children?.map((child, index) => (
            <FileTreeItem
              key={`${child.path}-${index}`}
              item={child}
              onDoubleClick={onDoubleClick}
              onCreateFile={onCreateFile}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export const FileOperations: React.FC<FileOperationsProps> = ({ onRefresh }) => {
  const { currentProject } = useProjectStore();
  const [dialog, setDialog] = useState<{ type: FileOperation; isOpen: boolean } | null>(null);

  const handleCreateFile = () => {
    setDialog({ type: 'file', isOpen: true });
  };

  const handleCreateFolder = () => {
    setDialog({ type: 'folder', isOpen: true });
  };

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="outline" onClick={handleCreateFile}>
        <LuFilePlus className="h-4 w-4 mr-2" />
        File
      </Button>
      <Button size="sm" variant="outline" onClick={handleCreateFolder}>
        <LuFolderPlus className="h-4 w-4 mr-2" />
        Folder
      </Button>
      <Button size="sm" variant="outline" onClick={onRefresh}>
        <LuRefreshCw className="h-4 w-4 mr-2" />
        Refresh
      </Button>

      {dialog?.isOpen && (
        <Dialog open={dialog.isOpen} onOpenChange={() => setDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create {dialog.type === 'file' ? 'File' : 'Folder'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input placeholder={`${dialog.type === 'file' ? 'File' : 'Folder'} name`} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialog(null)}>
                Cancel
              </Button>
              <Button>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export const FileTree: React.FC<FileTreeProps> = ({ item, selectedPath, onRefresh }) => {
  const { currentProject } = useProjectStore();
  const { tokens, user } = useAuth();
  const [dialog, setDialog] = useState<{ type: FileOperation; isOpen: boolean } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // File processing handler - calls the store's processFile function
  const handleFileOpen = async (file: FileEntry) => {
    if (isProcessing || !currentProject?.id) return;
    setIsProcessing(true);

    try {
      if (file.entry_type === 'file') {
        // Find the file index in the project's file list
        const { fileSystem, processFile } = useProjectStore.getState();
        const fileIndex = fileSystem.findIndex(f => f.path === file.path);

        if (fileIndex === -1) {
          console.error('File not found in project file list');
          return;
        }

        // Get auth token and user ID from auth context
        const token = tokens?.accessToken;
        const userId = user?.userId;

        console.log('Auth debug:', { tokens, user, token, userId });

        if (!token || !userId) {
          console.error('Missing authentication credentials', { token, userId });
          return;
        }

        // Process the file using the store's processFile function
        await processFile(currentProject.id, fileIndex, token, userId);
      }
    } catch (error) {
      console.error('Error opening file:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateFile = () => {
    setDialog({ type: 'file', isOpen: true });
  };

  const handleCreateFolder = () => {
    setDialog({ type: 'folder', isOpen: true });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {item.entry_type === 'directory' ? (
            <LuFolder className="h-4 w-4 text-blue-500" />
          ) : (
            <LuFile className="h-4 w-4 text-gray-500" />
          )}
          <span className="text-sm font-medium">{item.name}</span>
        </div>
        <div className="flex items-center gap-1">
          {item.entry_type === 'directory' && (
            <>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleCreateFile}>
                <LuFilePlus className="h-3 w-3" />
              </Button>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleCreateFolder}>
                <LuFolderPlus className="h-3 w-3" />
              </Button>
            </>
          )}
        </div>
      </div>

      {item.entry_type === 'file' && (
        <div
          className="pl-4 cursor-pointer hover:bg-accent rounded-sm p-1"
          onDoubleClick={() => handleFileOpen(item)}
        >
          <LuFile className="h-4 w-4 text-gray-500 inline mr-2" />
          <span className="text-sm">{item.name}</span>
        </div>
      )}

      {item.entry_type === 'directory' && item.children && (
        <div className="pl-4 space-y-1">
          {sortItems(item.children).map((child, index) => (
            <FileTree
              key={`${child.path}-${index}`}
              item={child}
              selectedPath={selectedPath}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}

      {dialog?.isOpen && (
        <Dialog open={dialog.isOpen} onOpenChange={() => setDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create {dialog.type === 'file' ? 'File' : 'Folder'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input placeholder={`${dialog.type === 'file' ? 'File' : 'Folder'} name`} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialog(null)}>
                Cancel
              </Button>
              <Button>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

// Fix DataOperationItem component to eliminate ESLint warning
const DataOperationItem = ({ item }: { item: string }) => {
  const AnalysisComponent = ANALYSIS_COMPONENTS[item];

  if (!AnalysisComponent) {
    return (
      <div className="py-2 px-2">
        <div className="px-2 py-1 opacity-50 cursor-not-allowed">{item} (Coming Soon)</div>
      </div>
    );
  }

  return (
    <AnalysisComponent>
      {/* Use children properly by not using children prop */}
      <div className="py-2 px-2 hover:bg-accent">
        <div className="px-2 py-1 cursor-pointer">{item}</div>
      </div>
    </AnalysisComponent>
  );
};

export const FolderComponent: React.FC = () => {
  const { currentProject, fileSystem, leftPanelOpen, toggleLeftPanel, isLoading } =
    useProjectStore();
  const [selectedPath] = useState('');

  return (
    <SidebarContent>
      <SidebarGroupContent title="Files" className="px-3 py-1">
        <div className="flex items-center justify-end gap-4 mb-2">
          <Button
            size="icon"
            variant="outline"
            onClick={() => {
              /* TODO: Add create file logic */
            }}
          >
            <LuFilePlus className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            onClick={() => {
              /* TODO: Add create folder logic */
            }}
          >
            <LuFolderPlus className="h-4 w-4" />
          </Button>
        </div>
        {isLoading ? (
          <div className="p-4 text-center text-muted-foreground">
            <p className="text-sm">Loading files...</p>
          </div>
        ) : fileSystem.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            <p className="text-sm">No files found</p>
          </div>
        ) : (
          <div className="space-y-1">
            {fileSystem.map((file, index) => (
              <FileTree
                key={`${file.path}-${index}`}
                item={file}
                selectedPath={selectedPath}
                onRefresh={async () => {
                  // Refresh logic can be added here if needed
                }}
              />
            ))}
          </div>
        )}
      </SidebarGroupContent>
    </SidebarContent>
  );
};
