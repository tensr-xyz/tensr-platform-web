import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

// Define a simplified Project interface for the store
interface Project {
  id: string;
  name: string;
  description?: string;
  organizationId?: string;
  createdAt?: string;
  updatedAt?: string;
  status?: 'active' | 'archived' | 'deleted';
  path?: string;
  type?: 'file' | 'directory';
  lastOpened?: Date;
  initialFile?: {
    path: string;
    metadata?: any;
  };
}

// Define FileEntry interface
interface FileEntry {
  name: string;
  path: string;
  entry_type: string;
  fileId?: string;
  children?: FileEntry[];
  metadata?: any;
}

// Define ImportData interface
interface ImportData {
  fileName: string;
  filePath: string;
  fileId: string;
  preview: string[][];
  columnNames: string[];
  totalRows: number;
  totalColumns: number;
  columnSummaries?: Record<string, any>;
}

export enum ViewType {
  SPREADSHEET = 'spreadsheet',
  CHARTS = 'charts',
  MODEL_BUILDER = 'model_builder',
  NOTEBOOK = 'notebook',
  PLUGINS = 'plugins',
  MARKDOWN = 'markdown',
  SEM = 'sem',
}

interface ProjectState {
  // UI State
  activeView: ViewType;
  rightPanelOpen: boolean;
  leftPanelOpen: boolean;
  leftSidebarOpen: boolean;
  footerOpen: boolean;
  terminalOpen: boolean;
  isMaximized: boolean;

  // Project Data
  currentProject: Project | null;
  fileSystem: FileEntry[];
  selectedPath: string | null;

  // Loading & Error States
  isLoading: boolean;
  error: string | null;

  // Import State
  importData: ImportData | null;
  showImportWizard: boolean;

  // UI Content
  leftPanelContent: React.ReactNode;

  // Project List
  projects: Project[];
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;

  // Project Cache for navigation
  projectCache: Map<string, { project: Project; importData: ImportData; timestamp: number }>;
}

interface ProjectActions {
  // View Actions
  setView: (view: ViewType) => void;

  // Panel Actions
  toggleRightPanel: (open: boolean) => void;
  toggleLeftPanel: (open: boolean) => void;
  toggleLeftSidebar: (open: boolean) => void;
  toggleFooter: (open: boolean) => void;
  toggleTerminal: (open: boolean) => void;
  setMaximized: (maximized: boolean) => void;

  // Project Actions
  setProject: (payload: Project | { project: Project; files: FileEntry[] } | null) => void;
  setFileSystem: (files: FileEntry[]) => void;
  setSelectedPath: (path: string | null) => void;
  fetchProjectData: (
    projectId: string,
    token: string,
    userId: string,
    fileIndex?: number
  ) => Promise<{ importData: ImportData; showImportWizard: boolean }>;
  clearProject: () => void;

  // Import Actions
  setImportData: (data: ImportData | null) => void;
  setShowImportWizard: (show: boolean) => void;
  clearImportData: () => void;

  // UI Content Actions
  setLeftPanelContent: (content: React.ReactNode) => void;

  // Loading & Error Actions
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;

  // Project List Actions
  setProjects: (projects: Project[]) => void;
  addProject: (project: Project) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  removeProject: (id: string) => void;
  setCreating: (creating: boolean) => void;
  setUpdating: (updating: boolean) => void;
  setDeleting: (deleting: boolean) => void;

  // Reset Actions
  reset: () => void;

  // Initialize cache cleanup
  initCacheCleanup: () => void;

  // Check if a project is already loaded
  isProjectLoaded: (projectId: string) => boolean;

  // Cache current project data for later restoration
  cacheProject: (projectId: string) => void;

  // Restore project from cache if available
  restoreFromCache: (projectId: string) => boolean;

  // Clear old cache entries
  clearOldCache: () => void;

  // Process a specific file from the project
  processFile: (
    projectId: string,
    fileIndex: number,
    token: string,
    userId: string
  ) => Promise<void>;

  // Get project details (list of files) without processing
  getProjectDetails: (
    projectId: string,
    token: string,
    userId: string
  ) => Promise<{
    projectName: string;
    files: any[];
    totalFiles: number;
  }>;
}

type ProjectStore = ProjectState & ProjectActions;

const initialState: ProjectState = {
  // UI State
  activeView: ViewType.SPREADSHEET,
  rightPanelOpen: false,
  leftPanelOpen: true,
  leftSidebarOpen: true,
  footerOpen: true,
  terminalOpen: false,
  isMaximized: false,

  // Project Data
  currentProject: null,
  fileSystem: [],
  selectedPath: null,

  // Loading & Error States
  isLoading: false,
  error: null,

  // Import State
  importData: null,
  showImportWizard: false,

  // UI Content
  leftPanelContent: null,

  // Project List
  projects: [],
  isCreating: false,
  isUpdating: false,
  isDeleting: false,

  // Project Cache for navigation
  projectCache: new Map(),
};

export const useProjectStore = create<ProjectStore>()(
  devtools(
    (set, get) => {
      // Initialize cache cleanup
      const store = {
        ...initialState,

        // View Actions
        setView: (view: ViewType) => set({ activeView: view }),

        // Panel Actions
        toggleRightPanel: (open: boolean) => set({ rightPanelOpen: open }),
        toggleLeftPanel: (open: boolean) => set({ leftPanelOpen: open }),
        toggleLeftSidebar: (open: boolean) => set({ leftSidebarOpen: open }),
        toggleFooter: (open: boolean) => set({ footerOpen: open }),
        toggleTerminal: (open: boolean) => set({ terminalOpen: open }),
        setMaximized: (maximized: boolean) => set({ isMaximized: maximized }),

        // Project Actions
        setProject: (payload: any) => {
          if (payload && typeof payload === 'object' && 'files' in payload) {
            set({
              currentProject: payload.project,
              fileSystem: payload.files,
              error: null,
            });
          } else {
            set({
              currentProject: payload as Project | null,
              error: null,
            });
          }
        },
        setFileSystem: (files: FileEntry[]) => set({ fileSystem: files, error: null }),
        setSelectedPath: (path: string | null) => set({ selectedPath: path }),

        // Modern data fetching method for React 19
        fetchProjectData: async (
          projectId: string,
          token: string,
          userId: string,
          fileIndex: number = 0,
          projectName?: string
        ) => {
          try {
            // Check if we already have this project data loaded
            const state = get();
            if (state.currentProject?.id === projectId && state.importData?.fileId === projectId) {
              console.log('Project data already loaded, skipping API call');
              return {
                importData: state.importData,
                showImportWizard: state.showImportWizard,
              };
            }

            // Try to restore from cache first
            const restored = get().restoreFromCache(projectId);
            if (restored) {
              console.log('Project restored from cache, skipping API call');
              const currentState = get();
              return {
                importData: currentState.importData,
                showImportWizard: currentState.showImportWizard,
              };
            }

            set({ isLoading: true, error: null });

            // Create base project
            const project = {
              id: projectId,
              name: 'Untitled',
              path: '',
              type: 'file' as const,
            };

            set({ currentProject: project });

            // Fetch project metadata from TypeScript API (not processing)
            const projectUrl = `${process.env.NEXT_PUBLIC_API_BASE_URL}/projects/${projectId}`;

            const response = await fetch(projectUrl, {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            });

            if (!response.ok) {
              throw new Error(`API error: ${response.status}`);
            }

            const projectData = await response.json();

            // Update project with metadata from API
            const updatedProject = {
              ...project,
              name: projectData.projectName || projectName || 'Untitled',
              description: projectData.description || '',
            };

            // Transform API response to FileEntry format expected by file tree
            const fileSystem = (projectData.fileGroups?.data || []).map((file: any) => ({
              name: file.path.split('/').pop() || file.path, // Extract filename from path
              path: file.path,
              entry_type: 'file',
              fileId: file.fileId,
              size: file.size,
            }));

            set({
              currentProject: updatedProject,
              fileSystem,
              isLoading: false,
              error: null,
              showImportWizard: false, // Don't show import wizard automatically
            });

            return {
              importData: null, // No import data until user selects a file
              showImportWizard: false,
            };
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            set({
              error: errorMessage,
              isLoading: false,
            });
            throw error;
          }
        },

        // Get project details (list of files) without processing
        getProjectDetails: async (projectId: string, token: string, userId: string) => {
          try {
            set({ isLoading: true, error: null });

            // Get project details from TypeScript API
            const projectUrl = `${process.env.NEXT_PUBLIC_API_BASE_URL}/projects/${projectId}`;
            const response = await fetch(projectUrl, {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });

            if (!response.ok) {
              throw new Error(`API error: ${response.status}`);
            }

            const projectData = await response.json();

            return {
              projectName: projectData.projectName || 'Untitled',
              files: projectData.files || [],
              totalFiles: projectData.files?.length || 0,
            };
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            set({
              error: errorMessage,
              isLoading: false,
            });
            throw error;
          }
        },

        // Check if a project is already loaded
        isProjectLoaded: (projectId: string) => {
          const state = get();
          return state.currentProject?.id === projectId && state.importData?.fileId === projectId;
        },

        // Cache current project data for later restoration
        cacheProject: (projectId: string) => {
          const state = get();
          if (state.currentProject?.id === projectId && state.importData?.fileId === projectId) {
            const cacheEntry = {
              project: state.currentProject,
              importData: state.importData,
              timestamp: Date.now(),
            };
            set(state => ({
              projectCache: new Map(state.projectCache).set(projectId, cacheEntry),
            }));
          }
        },

        // Restore project from cache if available
        restoreFromCache: (projectId: string) => {
          const state = get();
          const cached = state.projectCache.get(projectId);
          if (cached && Date.now() - cached.timestamp < 30 * 60 * 1000) {
            // 30 minute cache
            console.log('Restoring project from cache:', projectId);
            set({
              currentProject: cached.project,
              importData: cached.importData,
              showImportWizard: false, // Don't show wizard when restoring
              error: null,
            });
            return true;
          }
          return false;
        },

        // Clear old cache entries
        clearOldCache: () => {
          const state = get();
          const now = Date.now();
          const thirtyMinutes = 30 * 60 * 1000;
          const newCache = new Map();

          for (const [id, entry] of state.projectCache.entries()) {
            if (now - entry.timestamp < thirtyMinutes) {
              newCache.set(id, entry);
            }
          }

          set({ projectCache: newCache });
        },

        clearProject: () =>
          set({
            currentProject: null,
            fileSystem: [],
            selectedPath: null,
            error: null,
          }),

        // Import Actions
        setImportData: (data: ImportData | null) => set({ importData: data }),
        setShowImportWizard: (show: boolean) => set({ showImportWizard: show }),
        clearImportData: () => set({ importData: null, showImportWizard: false }),

        // UI Content Actions
        setLeftPanelContent: (content: React.ReactNode) => set({ leftPanelContent: content }),

        // Loading & Error Actions
        setLoading: (loading: boolean) => set({ isLoading: loading }),
        setError: (error: string | null) => set({ error }),
        clearError: () => set({ error: null }),

        // Project List Actions
        setProjects: (projects: Project[]) => set({ projects }),
        addProject: (project: Project) =>
          set(state => ({
            projects: [...state.projects, project],
          })),
        updateProject: (id: string, updates: Partial<Project>) =>
          set(state => ({
            projects: state.projects.map(p => (p.id === id ? { ...p, ...updates } : p)),
            currentProject:
              state.currentProject?.id === id
                ? { ...state.currentProject, ...updates }
                : state.currentProject,
          })),
        removeProject: (id: string) =>
          set(state => ({
            projects: state.projects.filter(p => p.id !== id),
            currentProject: state.currentProject?.id === id ? null : state.currentProject,
          })),
        setCreating: (creating: boolean) => set({ isCreating: creating }),
        setUpdating: (updating: boolean) => set({ isUpdating: updating }),
        setDeleting: (deleting: boolean) => set({ isDeleting: deleting }),

        // Reset Actions
        reset: () => {
          set(initialState);
          // Clear old cache entries when resetting
          setTimeout(() => {
            const state = get();
            if (state.clearOldCache) {
              state.clearOldCache();
            }
          }, 0);
        },

        // Initialize cache cleanup
        initCacheCleanup: () => {
          // Clear old cache entries every 5 minutes
          setInterval(
            () => {
              const state = get();
              if (state.clearOldCache) {
                state.clearOldCache();
              }
            },
            5 * 60 * 1000
          );
        },

        // Process a specific file from the project
        processFile: async (
          projectId: string,
          fileIndex: number,
          token: string,
          userId: string
        ) => {
          try {
            set({ isLoading: true, error: null });

            // Call the Fargate API to process the specific file
            const processUrl = `${process.env.NEXT_PUBLIC_FARGATE_API_URL}/api/projects/${projectId}/process`;

            let response: Response;
            try {
              response = await fetch(processUrl, {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  userId,
                  fileName: 'Untitled',
                  fileType: 'csv',
                  token,
                  file_index: fileIndex,
                }),
              });
            } catch (fetchError) {
              // Handle network errors (e.g., "Failed to fetch")
              throw new Error(
                fetchError instanceof Error
                  ? `Network error: ${fetchError.message}`
                  : 'Failed to connect to the server. Please check your connection and try again.'
              );
            }

            if (!response.ok) {
              const errorText = await response.text().catch(() => '');
              throw new Error(errorText || `API error: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();

            // Get file information from the file system
            const { fileSystem } = get();
            const fileInfo = fileSystem[fileIndex];
            const fileName = fileInfo?.name || result.fileName || 'Untitled';
            const filePath = fileInfo?.path || result.fileName || 'Untitled';

            // Set import data for the processed file
            const importData = {
              fileName,
              filePath: projectId, // Use project ID so Spreadsheet can detect it's a project
              fileId: fileInfo?.fileId || projectId,
              preview: result.metadata?.preview || [],
              columnNames: result.metadata?.column_names || [],
              totalRows: result.metadata?.rows || 0,
              totalColumns: result.metadata?.columns || 0,
              columnSummaries: result.column_summaries || {},
            };

            set({
              importData,
              showImportWizard: true,
              isLoading: false,
              error: null,
            });

            return { importData, showImportWizard: true };
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            set({
              error: errorMessage,
              isLoading: false,
            });
            throw error;
          }
        },
      };

      // Initialize cache cleanup
      store.initCacheCleanup();

      return store;
    },
    {
      name: 'project-store',
    }
  )
);
