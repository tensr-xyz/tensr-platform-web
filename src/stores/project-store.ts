import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { getTensrApiBaseUrl, tensrApiUrl } from '@/lib/tensr-api-url';
import { columnNamesFromSchemaResponse } from '@/lib/dataset-schema';
import { FEATURE_FLAGS } from '@/lib/feature-flags';
import { getTensrApiHeaders } from '@/utils/auth';
import { handleUnauthorizedResponse } from '@/lib/session-expired';
import { devLog } from '@/lib/dev-log';

function datasetAuthHeaders(token: string): HeadersInit {
  return {
    ...getTensrApiHeaders(),
    Authorization: `Bearer ${token}`,
  };
}

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
  columnNames: string[];
  totalRows: number;
  totalColumns: number;
  columnSummaries?: Record<string, any>;
}

const SMALL_DATASET_EAGER_LOAD = 2500;

/** Dataset-backed workspace: tensr-api exposes /datasets/* (no /projects/:id). */
async function fetchDatasetWorkspacePayload(
  baseUrl: string,
  datasetId: string,
  token: string,
  projectName?: string
): Promise<{
  importData: ImportData;
  label: string;
} | null> {
  const authHeaders = datasetAuthHeaders(token);
  const schemaRes = await fetch(tensrApiUrl(`/datasets/${datasetId}/schema`), {
    headers: authHeaders,
  });
  if (
    handleUnauthorizedResponse(schemaRes, `project-store:fetchDatasetWorkspacePayload:${datasetId}`)
  ) {
    return null;
  }
  if (!schemaRes.ok) {
    return null;
  }
  const schemaJson = (await schemaRes.json()) as {
    n_rows?: number;
    n_cols?: number;
    original_filename?: string | null;
    schema?: { name: string }[];
  };
  const columnNames = columnNamesFromSchemaResponse(schemaJson);
  const label =
    projectName ||
    (schemaJson.original_filename ? String(schemaJson.original_filename) : '') ||
    'Dataset';
  const importData: ImportData = {
    fileName: label,
    filePath: datasetId,
    fileId: datasetId,
    columnNames,
    totalRows: schemaJson.n_rows ?? columnNames.length,
    totalColumns: schemaJson.n_cols ?? columnNames.length,
    columnSummaries: {},
  };
  return { importData, label };
}

export enum ViewType {
  SPREADSHEET = 'spreadsheet',
  CHARTS = 'charts',
  MODEL_BUILDER = 'model_builder',
  NOTEBOOK = 'notebook',
  PLUGINS = 'plugins',
  MARKDOWN = 'markdown',
  SEM = 'sem',
  ANALYSIS_REPORT = 'analysis_report',
  ANALYSIS_RESULT = 'analysis_result',
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
  ) => Promise<{ importData: ImportData | null }>;
  clearProject: () => void;

  // Import Actions
  setImportData: (data: ImportData | null) => void;
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
        setView: (view: ViewType) => {
          if (view === ViewType.CHARTS && !FEATURE_FLAGS.CHARTS_TAB_ENABLED) {
            set({ activeView: ViewType.SPREADSHEET });
            return;
          }
          set({ activeView: view });
        },

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
              devLog('Project data already loaded, skipping API call');
              return {
                importData: state.importData,
              };
            }

            // Try to restore from cache first
            const restored = get().restoreFromCache(projectId);
            if (restored) {
              devLog('Project restored from cache, skipping API call');
              const currentState = get();
              return {
                importData: currentState.importData!,
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

            const base = getTensrApiBaseUrl();
            const datasetPayload = await fetchDatasetWorkspacePayload(
              base,
              projectId,
              token,
              projectName
            );
            if (datasetPayload) {
              const { importData, label } = datasetPayload;
              const updatedProject = {
                ...project,
                name: label,
                description: '',
              };
              const fileSystem = [
                {
                  name: label,
                  path: label,
                  entry_type: 'file',
                  fileId: projectId,
                },
              ];
              set({
                currentProject: updatedProject,
                fileSystem,
                importData,
                isLoading: false,
                error: null,
              });
              return {
                importData,
              };
            }

            // Legacy multi-file project API (Rust / gateway)
            const projectUrl = `${base}/projects/${projectId}`;
            const response = await fetch(projectUrl, {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            });

            if (!response.ok) {
              throw new Error(
                `API error: ${response.status} ${await response.text().catch(() => '')}`
              );
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
            });

            return {
              importData: null,
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

            const base = getTensrApiBaseUrl();
            const authHeaders = datasetAuthHeaders(token);
            const dsSchema = await fetch(tensrApiUrl(`/datasets/${projectId}/schema`), {
              headers: authHeaders,
            });
            if (
              handleUnauthorizedResponse(dsSchema, `project-store:getProjectDetails:${projectId}`)
            ) {
              set({ isLoading: false, error: 'Session expired' });
              return null;
            }
            if (dsSchema.ok) {
              const schemaJson = (await dsSchema.json()) as {
                original_filename?: string | null;
              };
              const name =
                (schemaJson.original_filename && String(schemaJson.original_filename)) || 'Dataset';
              set({ isLoading: false, error: null });
              return {
                projectName: name,
                files: [
                  {
                    path: name,
                    type: 'tabular',
                    size: 0,
                    fileId: projectId,
                  },
                ],
                totalFiles: 1,
              };
            }

            const projectUrl = `${base}/projects/${projectId}`;
            const response = await fetch(projectUrl, {
              method: 'GET',
              headers: authHeaders,
            });

            if (!response.ok) {
              throw new Error(`API error: ${response.status}`);
            }

            const projectData = await response.json();

            set({ isLoading: false, error: null });
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
            devLog('Restoring project from cache:', projectId);
            set({
              currentProject: cached.project,
              importData: cached.importData,
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
        clearImportData: () => set({ importData: null }),

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
          _userId: string
        ) => {
          try {
            set({ isLoading: true, error: null });

            const { fileSystem } = get();
            const fileInfo = fileSystem[fileIndex];
            const datasetId = fileInfo?.fileId;
            if (!datasetId) {
              throw new Error(
                'This file has no dataset id. Open a dataset-backed file or re-upload via Datasets.'
              );
            }

            const base = getTensrApiBaseUrl();
            const authHeaders = datasetAuthHeaders(token);

            let schemaRes: Response;
            let schemaJson: {
              n_rows?: number;
              n_cols?: number;
              schema?: { name: string }[];
            };
            try {
              schemaRes = await fetch(tensrApiUrl(`/datasets/${datasetId}/schema`), {
                headers: authHeaders,
              });
              if (
                handleUnauthorizedResponse(schemaRes, `project-store:fetchImportGrid:${datasetId}`)
              ) {
                set({ isLoading: false, error: 'Session expired' });
                return null;
              }
              if (!schemaRes.ok) {
                const detail = await schemaRes.text().catch(() => '');
                throw new Error(detail || `Could not load dataset schema (${schemaRes.status})`);
              }
              schemaJson = (await schemaRes.json()) as {
                n_rows?: number;
                n_cols?: number;
                schema?: { name: string }[];
              };
            } catch (fetchError) {
              throw new Error(
                fetchError instanceof Error
                  ? `Network error: ${fetchError.message}`
                  : 'Failed to connect to the server. Please check your connection and try again.'
              );
            }

            const columnNames = columnNamesFromSchemaResponse(schemaJson);
            const fileName = fileInfo?.name || 'Untitled';

            const importData = {
              fileName,
              filePath: projectId,
              fileId: datasetId,
              columnNames,
              totalRows: schemaJson.n_rows ?? columnNames.length,
              totalColumns: schemaJson.n_cols ?? columnNames.length,
              columnSummaries: {} as Record<string, unknown>,
            };

            set({
              importData,
              isLoading: false,
              error: null,
            });

            return { importData };
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
