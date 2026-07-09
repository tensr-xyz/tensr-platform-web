'use client';
import { getIdToken } from '@/utils/auth';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useProjectStore, ViewType } from '@/stores/project-store';
import { useTabsStore } from '@/stores/tabs-store';
import TabManager from '@/components/organisms/tab-manager';
import { FileSelector, ProjectFile } from '@/components/molecules/file-selector';
import { cleanValue } from '@/utils/project';
import ProjectLayout from '@/components/templates/project-layout';
import { useCollaboration } from '@/hooks/use-collaboration';
import Loading from '@/components/molecules/loading';
import useAuth from '@/hooks/api/use-auth';
import { Tab } from '@/stores/tabs-store';
import PluginsLayout from '@/components/templates/plugins-layout';
import { getTensrApiBaseUrl, tensrApiUrl } from '@/lib/tensr-api-url';
import { buildDefaultImportSettings, type ImportSettings } from '@/lib/import-settings';
import { FEATURE_FLAGS, MULTI_FILE_PROJECTS_ENABLED } from '@/lib/feature-flags';
import { SpssWorkspaceWalkthrough } from '@/components/templates/auth/spss-switcher-flow';

export interface WorkspaceResource {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'project';
}

interface WorkspaceProps {
  resource: WorkspaceResource;
}

const UUID_PATH_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SMALL_DATASET_EAGER_LOAD = 2500;

function importRowLimit(totalRows?: number): number {
  const n = totalRows ?? SMALL_DATASET_EAGER_LOAD;
  return Math.min(Math.max(n, 1), SMALL_DATASET_EAGER_LOAD);
}

/** Column-major grid payload matching legacy `fetch-page` `data` for spreadsheet import */
async function fetchDatasetImportGrid(
  datasetId: string,
  token: string,
  rowLimit: number
): Promise<{ data: unknown[][] }> {
  const base = getTensrApiBaseUrl();
  const headers = { Authorization: `Bearer ${token}` };
  const previewRes = await fetch(tensrApiUrl(`/datasets/${datasetId}/preview?limit=${rowLimit}`), {
    headers,
  });
  if (!previewRes.ok) {
    const text = await previewRes.text();
    throw new Error(`Dataset preview failed: ${previewRes.status} ${text}`);
  }
  const preview = (await previewRes.json()) as { headers?: string[]; rows?: unknown[][] };
  const hdrs = preview.headers || [];
  const rows = preview.rows || [];
  const processedData = hdrs.map((_, colIdx) => rows.map(row => (row as unknown[])[colIdx]));
  return { data: processedData };
}

/** If `filePath` is a tensr-api dataset id, return grid data; if not found (404), return null */
async function tryDatasetImportGridFromUuidPath(
  filePath: string,
  token: string,
  rowLimit: number
): Promise<{ data: unknown[][] } | null> {
  if (!UUID_PATH_REGEX.test(filePath)) return null;
  const base = getTensrApiBaseUrl();
  const schemaRes = await fetch(tensrApiUrl(`/datasets/${filePath}/schema`), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (schemaRes.status === 404) return null;
  if (!schemaRes.ok) {
    const text = await schemaRes.text();
    throw new Error(`Dataset error: ${schemaRes.status} ${text}`);
  }
  return fetchDatasetImportGrid(filePath, token, rowLimit);
}

export default function Workspace({ resource }: WorkspaceProps) {
  // State
  const [showFileSelector, setShowFileSelector] = useState(false);
  const [projectFiles, setProjectFiles] = useState<ProjectFile[]>([]);
  const [projectName, setProjectName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [currentResource, setCurrentResource] = useState<WorkspaceResource>(resource);

  // Refs
  const projectRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(false);
  const hasLoadedRef = useRef(false);

  // Hooks and context
  const {
    setProject,
    importData: projectImportData,
    clearImportData,
    fetchProjectData,
    getProjectDetails,
    isProjectLoaded,
    cacheProject,
    isLoading: storeLoading,
    error: storeError,
    leftSidebarOpen,
    toggleLeftSidebar,
    activeView,
  } = useProjectStore();
  const { tabs, activeTabId, addTab, closeTab, setActiveTab } = useTabsStore();

  useEffect(() => {
    if (
      activeView === ViewType.NOTEBOOK ||
      (activeView === ViewType.CHARTS && FEATURE_FLAGS.CHARTS_TAB_ENABLED)
    ) {
      setRightPanelOpen(true);
    }
  }, [activeView]);
  const { user, isAuthReady } = useAuth();

  // Make sure we have a valid resource.id before using it
  const resourceId = resource?.id || '';
  const userId = user?.userId;

  // Clear tabs / project state from a previous dataset when this workspace mounts.
  // (Workspace is remounted via key={datasetId} on the page; stores are global.)
  useEffect(() => {
    if (!resourceId) return;
    useTabsStore.getState().closeAllTabs();
    useProjectStore.getState().clearProject();
    useProjectStore.getState().clearImportData();
    setCurrentResource(resource);
    setIsLoading(true);
    setError(null);
    hasLoadedRef.current = false;
    // Only re-run when the dataset id changes; `resource` object identity is unstable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resourceId]);

  useCollaboration(resourceId);

  // Add a null check for activeTab
  const activeTab = tabs.find(tab => tab?.id === activeTabId);

  // Ensure activeTab is preserved when navigating from home page
  // If activeTabId is set but activeTab is not found, it might be a timing issue
  // This ensures the activeTab is properly set when the workspace loads
  useEffect(() => {
    if (activeTabId && !activeTab && tabs.length > 0) {
      // If we have an activeTabId but no matching tab, try to find it again
      const foundTab = tabs.find(tab => tab.id === activeTabId);
      if (foundTab) {
        // Tab exists, ensure it's set as active
        setActiveTab(activeTabId);
      }
    }
  }, [activeTabId, activeTab, tabs, setActiveTab]);

  // Handle navigation events to cache project data
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (resourceId) {
        cacheProject(resourceId);
      }
    };

    // Cache project data when navigating away
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [resourceId, cacheProject]);

  // Load workspace data only after Stytch + AuthProvider have finished bootstrapping.
  useEffect(() => {
    mountedRef.current = true;

    if (!isAuthReady) return;

    if (!hasLoadedRef.current && getIdToken() && userId && resourceId) {
      hasLoadedRef.current = true;

      const loadData = async () => {
        try {
          // Check if project is already loaded before making API call
          if (isProjectLoaded(resourceId)) {
            setIsLoading(false);
            return;
          }

          // For projects, first get the project details to check for multiple files
          if (resource.type === 'project') {
            const token = getIdToken();
            if (!token) {
              throw new Error('No authentication token available');
            }
            const projectDetails = await getProjectDetails(resourceId, token, userId);

            if (projectDetails.totalFiles > 1) {
              if (MULTI_FILE_PROJECTS_ENABLED) {
                setProjectFiles(projectDetails.files);
                setProjectName(projectDetails.projectName);
                setShowFileSelector(true);
                setIsLoading(false);
                return;
              }
              // Launch: import the first file only (multi-file picker descoped).
              const fetchTokenMulti = getIdToken();
              if (!fetchTokenMulti) {
                throw new Error('No authentication token available');
              }
              await fetchProjectData(resourceId, fetchTokenMulti, userId, 0);
              if (mountedRef.current) {
                setIsLoading(false);
              }
              return;
            }
            // For single file projects, proceed with normal processing
            const fetchToken2 = getIdToken();
            if (!fetchToken2) {
              throw new Error('No authentication token available');
            }
            await fetchProjectData(resourceId, fetchToken2, userId, 0);
          } else {
            const fetchToken = getIdToken();
            if (!fetchToken) {
              throw new Error('No authentication token available');
            }
            await fetchProjectData(resourceId, fetchToken, userId, 0);
          }
          if (mountedRef.current) {
            setIsLoading(false);
          }
        } catch (err) {
          if (mountedRef.current) {
            setError(err instanceof Error ? err.message : 'Unknown error');
            setIsLoading(false);
          }
        }
      };

      loadData();
    }
  }, [
    isAuthReady,
    userId,
    resourceId,
    resource.name,
    fetchProjectData,
    getProjectDetails,
    isProjectLoaded,
    resource.type,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      // Cache the current project data when unmounting
      if (resourceId) {
        cacheProject(resourceId);
      }
    };
  }, [resourceId, cacheProject]);

  // Handle import completion
  const handleImport = useCallback(
    async (settings: ImportSettings) => {
      const dataToImport = projectImportData;
      if (!dataToImport) return;

      const alreadyOpen = useTabsStore
        .getState()
        .tabs.some(
          t =>
            t.type === ViewType.SPREADSHEET &&
            (t.data?.filePath === dataToImport.filePath || t.data?.filePath === dataToImport.fileId)
        );
      if (alreadyOpen) {
        clearImportData();
        return;
      }

      // Track sheetId for this import
      let sheetId: string | undefined;

      try {
        const columns = settings.columnNames.map(name => ({
          id: name,
          accessor: name,
          header: name,
          width: 150,
          type: settings.columnTypes[name] || 'string',
        }));

        // Get the auth token
        const token = getIdToken();
        if (!token) {
          console.error('No access token available');
          return;
        }

        // Construct the full S3 key using userId and dataToImport.filePath (which is the fileId)
        const s3Key =
          userId && dataToImport.filePath
            ? `users/${userId}/${dataToImport.filePath}/${dataToImport.fileName || 'untitled'}`
            : dataToImport.filePath;

        const rowLimit = importRowLimit(dataToImport.totalRows);

        // Load the full dataset (up to SMALL_DATASET_EAGER_LOAD) so scroll is instant
        let data;

        if (currentResource.type === 'project') {
          const preloaded = await tryDatasetImportGridFromUuidPath(
            dataToImport.filePath,
            token,
            rowLimit
          );
          if (preloaded) {
            data = preloaded;
          } else {
            let requestBody: Record<string, unknown> = {
              path: dataToImport.filePath,
              start_row: 0,
              end_row: rowLimit,
            };

            const projectResponse = await fetch(
              `${getTensrApiBaseUrl()}/projects/${dataToImport.filePath}`,
              {
                method: 'GET',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
              }
            );

            if (!projectResponse.ok) {
              throw new Error(`Failed to get project details: ${projectResponse.status}`);
            }

            const projectData = await projectResponse.json();

            const { fileSystem } = useProjectStore.getState();
            let fileId: string | undefined;

            if (fileSystem && fileSystem.length > 0) {
              const matchingFile =
                fileSystem.find(
                  (f: { path?: string; name?: string; fileId?: string }) =>
                    f.path === dataToImport.filePath || f.name === dataToImport.fileName
                ) || fileSystem[0];
              fileId = matchingFile?.fileId;
            }

            if (!fileId) {
              for (const category of Object.keys(projectData.fileGroups || {})) {
                const files = projectData.fileGroups[category];
                if (Array.isArray(files) && files.length > 0) {
                  const firstFile = files[0];
                  if (firstFile?.fileId) {
                    fileId = firstFile.fileId;
                    break;
                  }
                }
              }
            }

            if (!fileId && (!fileSystem || fileSystem.length === 0)) {
              throw new Error('No files found in project');
            }

            requestBody = {
              ...requestBody,
              project_id: dataToImport.filePath,
              ...(fileId && { file_id: fileId }),
            };

            if (fileId) {
              try {
                const sheetResponse = await fetch(
                  `${getTensrApiBaseUrl()}/projects/${dataToImport.filePath}/files/${fileId}/create-sheet`,
                  {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${token}`,
                    },
                  }
                );

                if (sheetResponse.ok) {
                  const sheetData = await sheetResponse.json();
                  const createdSheetId = sheetData.sheet?.sheetId;
                  if (createdSheetId) {
                    sheetId = createdSheetId;
                  }
                }
              } catch {
                // Continue without sheet
              }
            }

            const response = await fetch(`${getTensrApiBaseUrl()}/api/files/fetch-page`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`Failed to fetch data: ${response.status} ${errorText}`);
            }

            data = await response.json();
          }
        } else {
          const isUuidPath = UUID_PATH_REGEX.test(dataToImport.filePath);

          let requestBody: Record<string, unknown> = {
            path: dataToImport.filePath,
            start_row: 0,
            end_row: rowLimit,
          };

          let skipFetchPage = false;

          if (isUuidPath) {
            const preloaded = await tryDatasetImportGridFromUuidPath(
              dataToImport.filePath,
              token,
              rowLimit
            );
            if (preloaded) {
              data = preloaded;
              skipFetchPage = true;
            }
          }

          if (!skipFetchPage && isUuidPath) {
            const projectResponse = await fetch(
              `${getTensrApiBaseUrl()}/projects/${dataToImport.filePath}`,
              {
                method: 'GET',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
              }
            );

            if (!projectResponse.ok) {
              throw new Error(`Failed to get project details: ${projectResponse.status}`);
            }

            const projectData = await projectResponse.json();

            const { fileSystem } = useProjectStore.getState();
            let fileId: string | undefined;

            if (fileSystem && fileSystem.length > 0) {
              const matchingFile =
                fileSystem.find(
                  (f: { path?: string; name?: string; fileId?: string }) =>
                    f.path === dataToImport.filePath || f.name === dataToImport.fileName
                ) || fileSystem[0];
              fileId = matchingFile?.fileId;
            }

            if (!fileId) {
              for (const category of Object.keys(projectData.fileGroups || {})) {
                const files = projectData.fileGroups[category];
                if (Array.isArray(files) && files.length > 0) {
                  const firstFile = files[0];
                  if (firstFile?.fileId) {
                    fileId = firstFile.fileId;
                    break;
                  }
                }
              }
            }

            if (!fileId && (!fileSystem || fileSystem.length === 0)) {
              throw new Error('No files found in project');
            }

            requestBody = {
              ...requestBody,
              project_id: dataToImport.filePath,
              ...(fileId && { file_id: fileId }),
            };

            if (fileId) {
              try {
                const sheetResponse = await fetch(
                  `${getTensrApiBaseUrl()}/projects/${dataToImport.filePath}/files/${fileId}/create-sheet`,
                  {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${token}`,
                    },
                  }
                );

                if (sheetResponse.ok) {
                  const sheetData = await sheetResponse.json();
                  const createdSheetId = sheetData.sheet?.sheetId;
                  if (createdSheetId) {
                    sheetId = createdSheetId;
                  }
                }
              } catch {
                // Continue without sheet
              }
            }
          }

          if (!skipFetchPage && !isUuidPath) {
            const isProjectFilePath =
              dataToImport.filePath.includes('/users/') &&
              dataToImport.filePath.includes('/projects/');

            if (isProjectFilePath) {
              const pathParts = dataToImport.filePath.split('/');
              const usersIndex = pathParts.indexOf('users');
              const projectsIndex = pathParts.indexOf('projects');

              if (usersIndex !== -1 && projectsIndex !== -1 && projectsIndex > usersIndex) {
                const projectId = pathParts[projectsIndex + 1];
                const fileId = pathParts[projectsIndex + 3];

                requestBody = {
                  ...requestBody,
                  project_id: projectId,
                  file_id: fileId,
                };
              }
            }
          }

          if (!skipFetchPage) {
            const response = await fetch(`${getTensrApiBaseUrl()}/api/files/fetch-page`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`Failed to fetch data: ${response.status} ${errorText}`);
            }

            data = await response.json();
          }
        }

        // Define types for data processing
        type ColumnDefinition = {
          id: string;
          accessor: string;
          header: string;
          width: number;
          type: string;
        };

        // IMPORTANT: Instead of using the existing processDataChunk function,
        // we need to handle column-oriented data correctly
        const processColumnOrientedData = (
          columnData: any[],
          columns: ColumnDefinition[]
        ): Record<string, any>[] => {
          // Check if data is in expected format
          if (!Array.isArray(columnData) || columnData.length === 0) {
            console.error('Invalid data format');
            return [];
          }

          // Convert column-oriented data to row-oriented
          const rowCount = columnData[0].length;
          const processedData: Record<string, any>[] = [];

          for (let rowIdx = 0; rowIdx < rowCount; rowIdx++) {
            const rowObj: Record<string, any> = {};

            // For each column definition, get the corresponding value
            columns.forEach((column, colIdx) => {
              if (colIdx < columnData.length && rowIdx < columnData[colIdx].length) {
                // Get value for this cell
                let value = columnData[colIdx][rowIdx];

                // Process value based on column type
                if (column.type === 'number' && value !== '') {
                  value = parseFloat(value) || 0;
                } else if (column.type === 'boolean') {
                  value = Boolean(value);
                }

                rowObj[column.id] = value;
              } else {
                rowObj[column.id] = ''; // Default for missing data
              }
            });

            processedData.push(rowObj);
          }

          return processedData;
        };

        if (!data?.data || !Array.isArray(data.data)) {
          throw new Error('No tabular data returned for import');
        }

        // Process the column-oriented data
        const fullData = processColumnOrientedData(data.data, columns);

        // Add a fallback/default ID for the tab
        const tabId = dataToImport.fileId || resourceId || `tab-${Date.now()}`;

        // Use the file path from import data (which is now correctly formatted with leading /)
        const filePath = dataToImport.filePath;

        // sheetId is already set above for project files, or will be undefined for regular files
        // (regular files don't support sheets yet - only project files do)

        // Create a new tab with the correct type
        const newTab: Omit<Tab, 'id'> = {
          name: dataToImport.fileName || 'Untitled',
          type: ViewType.SPREADSHEET, // Use enum value instead of string
          content: '',
          isDirty: false,
          data: {
            filePath,
            datasetId: dataToImport.fileId,
            initialData: fullData,
            initialColumns: columns,
            totalRows: dataToImport.totalRows,
            totalColumns: dataToImport.totalColumns,
            columnStats: dataToImport.columnSummaries || {},
            importSettings: settings,
            isInitialized: true,
            sheetId, // Add sheetId for real-time collaboration
            // isProjectFile - removed as it's not in TabData type: false, // Always allow fetchMoreRows to be called
            cleanValue: (value: any) => cleanValue(value, 'string'), // Create wrapper function
            // Pass the custom processing function for future data chunks
            processDataChunk: (data: any[], startRow: number) =>
              processColumnOrientedData(data, columns),
          },
        };

        addTab({ ...newTab });
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem(`tensr:autoImport:${dataToImport.fileId}`);
        }
        clearImportData();
      } catch (err) {
        console.error('Import failed:', err);
        if (typeof window !== 'undefined' && dataToImport.fileId) {
          sessionStorage.removeItem(`tensr:autoImport:${dataToImport.fileId}`);
        }
        clearImportData();
      }
    },
    [
      projectImportData,
      resourceId,
      addTab,
      setProject,
      userId,
      currentResource.type,
      clearImportData,
    ]
  );

  // Auto-open dataset when import payload is ready (no confirmation dialog).
  useEffect(() => {
    if (!projectImportData) return;

    const alreadyOpen = useTabsStore
      .getState()
      .tabs.some(
        t =>
          t.type === ViewType.SPREADSHEET &&
          (t.data?.filePath === projectImportData.filePath ||
            t.data?.filePath === projectImportData.fileId)
      );
    if (alreadyOpen) {
      clearImportData();
      return;
    }

    const fid = projectImportData.fileId;
    if (typeof window !== 'undefined') {
      const sessionKey = `tensr:autoImport:${fid}`;
      if (sessionStorage.getItem(sessionKey)) return;
      sessionStorage.setItem(sessionKey, '1');
    }

    const settings = buildDefaultImportSettings(
      projectImportData.columnNames,
      ',',
      projectImportData.columnSummaries
    );
    void handleImport(settings);
  }, [projectImportData, handleImport, clearImportData]);

  // Handle file selection from file selector
  const handleFileSelect = useCallback(
    async (fileIndex: number) => {
      try {
        setShowFileSelector(false);
        setIsLoading(true);

        // Get the selected file info
        const selectedFile = projectFiles[fileIndex];
        if (!selectedFile) {
          throw new Error('Selected file not found');
        }

        // Update the resource to treat it as a file, not a project
        // Note: We use the project ID as the path since that's what the Rust API expects
        // But we mark it as type 'file' so the Spreadsheet knows to fetch more data
        const fileResource: WorkspaceResource = {
          id: resourceId, // Use project ID as ID
          name: (selectedFile as any).name || selectedFile.path || 'Unknown',
          path: resourceId, // Use project ID as path (Rust API expects this)
          type: 'file', // Change to file type so Spreadsheet fetches more data
        };

        // Update the current resource state
        setCurrentResource(fileResource);

        // Process the selected file using the project API (since it's still a project file)
        const fetchToken3 = getIdToken();
        if (!fetchToken3) {
          throw new Error('No authentication token available');
        }
        if (!userId) {
          throw new Error('User ID not available');
        }
        await fetchProjectData(resourceId, fetchToken3, userId, fileIndex || 0);

        if (mountedRef.current) {
          setIsLoading(false);
        }
      } catch (err) {
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : 'Unknown error');
          setIsLoading(false);
        }
      }
    },
    [projectFiles, resourceId, resource.name, getIdToken(), userId, fetchProjectData]
  );

  // Handle file selector close
  const handleFileSelectorClose = useCallback(() => {
    setShowFileSelector(false);
    // Navigate back or show an error
    setError('No file selected for import');
  }, []);

  const awaitingDatasetTab = useMemo(() => {
    if (!projectImportData) return false;
    return !tabs.some(
      t =>
        t.type === ViewType.SPREADSHEET &&
        (t.data?.filePath === projectImportData.filePath ||
          t.data?.filePath === projectImportData.fileId ||
          t.data?.datasetId === projectImportData.fileId)
    );
  }, [projectImportData, tabs]);

  if (isLoading || awaitingDatasetTab) {
    return <Loading fullScreen />;
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="p-6 bg-red-50 border border-red-200 rounded-lg max-w-md">
          <h3 className="text-lg font-semibold text-red-800 mb-2">Error</h3>
          <p className="text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <ProjectLayout
        activeTab={activeTab}
        rightPanelOpen={rightPanelOpen}
        onToggleSidebar={() => setRightPanelOpen(!rightPanelOpen)}
      >
        <div ref={projectRef} className="relative h-full w-full">
          <div className="absolute left-3 right-3 top-2 z-20 pointer-events-none [&>*]:pointer-events-auto">
            <SpssWorkspaceWalkthrough />
          </div>
          <TabManager
            activeTab={activeTab}
            tabs={tabs}
            onTabClose={tabId => tabId && closeTab(tabId)}
            onToggleSidebar={() => setRightPanelOpen(!rightPanelOpen)}
            rightPanelOpen={rightPanelOpen}
          />
        </div>
      </ProjectLayout>

      {MULTI_FILE_PROJECTS_ENABLED && showFileSelector && (
        <FileSelector
          isOpen={showFileSelector}
          onClose={handleFileSelectorClose}
          onFileSelect={handleFileSelect}
          projectName={projectName}
          files={projectFiles}
        />
      )}
    </>
  );
}
