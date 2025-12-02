'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useProjectStore, ViewType } from '@/stores/project-store';
import { ImportData } from '@/types/file';
import { useTabsStore } from '@/stores/tabs-store';
import TabManager from '@/components/organisms/tab-manager';
import { ImportWizard, ImportSettings } from '@/components/organisms/wizards/import-wizard';
import { FileSelector, ProjectFile } from '@/components/molecules/file-selector';
import { cleanValue } from '@/utils/project';
import ProjectLayout from '@/components/templates/project-layout';
import { useCollaboration } from '@/hooks/use-collaboration';
import Loading from '@/components/molecules/loading';
import useAuth from '@/hooks/api/use-auth';
import { Tab } from '@/stores/tabs-store';
import PluginsLayout from '@/components/templates/plugins-layout';

export interface WorkspaceResource {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'project';
}

interface WorkspaceProps {
  resource: WorkspaceResource;
  processData: (resource: WorkspaceResource) => Promise<{
    importData?: ImportData | null;
    showImportWizard?: boolean;
  }>;
}

export default function Workspace({ resource, processData }: WorkspaceProps) {
  // State
  const [importData, setImportData] = useState<ImportData | null>(null);
  const [showImportWizard, setShowImportWizard] = useState(false);
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
    setImportData: setProjectImportData,
    clearImportData,
    fetchProjectData,
    getProjectDetails,
    isProjectLoaded,
    cacheProject,
    isLoading: storeLoading,
    error: storeError,
    leftSidebarOpen,
    toggleLeftSidebar,
  } = useProjectStore();
  const { tabs, activeTabId, addTab, closeTab, setActiveTab } = useTabsStore();
  const { tokens, user } = useAuth();

  // Make sure we have a valid resource.id before using it
  const resourceId = resource?.id || '';
  const userId = user?.userId;

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

  // Proper useEffect with mounted guard - only runs once when auth is ready
  useEffect(() => {
    // Mark as mounted
    mountedRef.current = true;

    // Only load data once when we have all required data
    if (!hasLoadedRef.current && tokens?.accessToken && userId && resourceId) {
      hasLoadedRef.current = true;

      const loadData = async () => {
        try {
          // Check if project is already loaded before making API call
          if (isProjectLoaded(resourceId)) {
            console.log('Project already loaded, skipping API call');
            setIsLoading(false);
            return;
          }

          // For projects, first get the project details to check for multiple files
          if (resource.type === 'project') {
            const projectDetails = await getProjectDetails(resourceId, tokens.accessToken, userId);

            if (projectDetails.totalFiles > 1) {
              // Show file selector for multiple files
              setProjectFiles(projectDetails.files);
              setProjectName(projectDetails.projectName);
              setShowFileSelector(true);
              setIsLoading(false);
              return;
            }
            // For single file projects, proceed with normal processing
            await fetchProjectData(
              resourceId,
              tokens.accessToken,
              userId,
              0,
              projectDetails.projectName
            );
          } else {
            await fetchProjectData(resourceId, tokens.accessToken, userId);
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
    tokens?.accessToken,
    userId,
    resourceId,
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

  // Monitor project state's importData changes - WITH PROTECTION AGAINST DUPLICATE UPDATES
  useEffect(() => {
    // Skip if we're already showing the import wizard with the same data
    if (showImportWizard && importData && projectImportData?.fileId === importData.fileId) {
      return;
    }

    // Process import data for both files and projects
    if (projectImportData) {
      setProjectImportData(projectImportData);
      setShowImportWizard(true);
    }
  }, [projectImportData, showImportWizard, importData]);

  // Handle import completion
  const handleImport = useCallback(
    async (settings: ImportSettings) => {
      const dataToImport = projectImportData || importData;
      if (!dataToImport) return;

      try {
        const columns = settings.columnNames.map(name => ({
          id: name,
          accessor: name,
          header: name,
          width: 150,
          type: settings.columnTypes[name] || 'string',
        }));

        // Get the auth token
        const token = tokens?.accessToken;
        if (!token) {
          console.error('No access token available');
          return;
        }

        // Construct the full S3 key using userId and dataToImport.filePath (which is the fileId)
        const s3Key =
          userId && dataToImport.filePath
            ? `users/${userId}/${dataToImport.filePath}/${dataToImport.fileName || 'untitled'}`
            : dataToImport.filePath;

        // For both projects and files, fetch the first 250 rows
        let data;

        if (currentResource.type === 'project') {
          // For projects, fetch the first 250 rows instead of using preview
          const uuidRegex =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
          const isProjectFile = uuidRegex.test(dataToImport.filePath);

          let requestBody: any = {
            path: dataToImport.filePath,
            start_row: 0,
            end_row: 250,
          };

          // Get project details to find the file_id
          const projectResponse = await fetch(
            `https://api.dev.tensr.xyz/projects/${dataToImport.filePath}`,
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
          const firstFile = projectData.fileGroups?.data?.[0];
          if (!firstFile) {
            throw new Error('No files found in project');
          }

          requestBody = {
            ...requestBody,
            project_id: dataToImport.filePath,
            file_id: firstFile.fileId,
          };

          // Fetch data for projects using the file API
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_FARGATE_API_URL}/api/files/fetch-page`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify(requestBody),
            }
          );

          if (!response.ok) {
            const errorText = await response.text();
            console.error('Error response:', errorText);
            throw new Error(`Failed to fetch data: ${response.status} ${errorText}`);
          }

          data = await response.json();
        } else {
          // For files, we need to fetch the data using the file API
          // Check if this is a project file (filePath is a project ID) or a regular file
          const uuidRegex =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
          const isProjectFile = uuidRegex.test(dataToImport.filePath);

          let requestBody: any = {
            path: dataToImport.filePath,
            start_row: 0,
            end_row: 250,
          };

          // If it's a project file (filePath is a project ID), we need to get the file_id
          if (isProjectFile) {
            // For project files, we need to fetch the project data to get the file_id
            const projectResponse = await fetch(
              `https://api.dev.tensr.xyz/projects/${dataToImport.filePath}`,
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
            const firstFile = projectData.fileGroups?.data?.[0];
            if (!firstFile) {
              throw new Error('No files found in project');
            }

            requestBody = {
              ...requestBody,
              project_id: dataToImport.filePath,
              file_id: firstFile.fileId,
            };
          } else {
            // For regular files, check if filePath contains project structure
            const isProjectFilePath =
              dataToImport.filePath.includes('/users/') &&
              dataToImport.filePath.includes('/projects/');

            if (isProjectFilePath) {
              const pathParts = dataToImport.filePath.split('/');
              const usersIndex = pathParts.indexOf('users');
              const projectsIndex = pathParts.indexOf('projects');

              if (usersIndex !== -1 && projectsIndex !== -1 && projectsIndex > usersIndex) {
                const userId = pathParts[usersIndex + 1];
                const projectId = pathParts[projectsIndex + 1];
                const fileId = pathParts[projectsIndex + 3]; // files/{fileId}/{fileName}

                requestBody = {
                  ...requestBody,
                  project_id: projectId,
                  file_id: fileId,
                };
              }
            }
          }

          // Fetch data for files using the updated approach
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_FARGATE_API_URL}/api/files/fetch-page`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify(requestBody),
            }
          );

          if (!response.ok) {
            const errorText = await response.text();
            console.error('Error response:', errorText);
            throw new Error(`Failed to fetch data: ${response.status} ${errorText}`);
          }

          data = await response.json();
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

        // Process the column-oriented data
        const fullData = processColumnOrientedData(data.data, columns);

        // Add a fallback/default ID for the tab
        const tabId = dataToImport.fileId || resourceId || `tab-${Date.now()}`;

        // Use the file path from import data (which is now correctly formatted with leading /)
        const filePath = dataToImport.filePath;

        // Create a new tab with the correct type
        const newTab: Omit<Tab, 'id'> = {
          name: dataToImport.fileName || 'Untitled',
          type: ViewType.SPREADSHEET, // Use enum value instead of string
          content: '',
          isDirty: false,
          data: {
            filePath,
            initialData: fullData,
            initialColumns: columns,
            totalRows: dataToImport.totalRows,
            totalColumns: dataToImport.totalColumns,
            columnStats: dataToImport.columnSummaries || {},
            importSettings: settings,
            isInitialized: true,
            isProjectFile: false, // Always allow fetchMoreRows to be called
            cleanValue: (value: any) => cleanValue(value, 'string'), // Create wrapper function
            // Pass the custom processing function for future data chunks
            processDataChunk: (data: any[], startRow: number) =>
              processColumnOrientedData(data, columns),
          },
        };

        addTab({ ...newTab });
        clearImportData();
        setImportData(null);
        setShowImportWizard(false);
      } catch (err) {
        console.error('Import failed:', err);
        clearImportData();
        setImportData(null);
        setShowImportWizard(false);
      }
    },
    [projectImportData, importData, resourceId, addTab, setProject, tokens, userId]
  );

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
          name: selectedFile.name,
          path: resourceId, // Use project ID as path (Rust API expects this)
          type: 'file', // Change to file type so Spreadsheet fetches more data
        };

        // Update the current resource state
        setCurrentResource(fileResource);

        // Process the selected file using the project API (since it's still a project file)
        await fetchProjectData(
          resourceId,
          tokens?.accessToken || '',
          userId,
          fileIndex,
          projectName
        );

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
    [projectFiles, resourceId, tokens?.accessToken, userId, fetchProjectData]
  );

  // Handle file selector close
  const handleFileSelectorClose = useCallback(() => {
    setShowFileSelector(false);
    // Navigate back or show an error
    setError('No file selected for import');
  }, []);

  // Handle import wizard close
  const handleWizardClose = useCallback(() => {
    setShowImportWizard(false);
    setImportData(null);
    clearImportData();
  }, [clearImportData]);

  if (isLoading) {
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
          <TabManager
            activeTab={activeTab}
            tabs={tabs}
            onTabClose={tabId => tabId && closeTab(tabId)}
            onToggleSidebar={() => setRightPanelOpen(!rightPanelOpen)}
            rightPanelOpen={rightPanelOpen}
          />
        </div>
      </ProjectLayout>

      {/* File selector for multi-file projects */}
      {showFileSelector && (
        <FileSelector
          isOpen={showFileSelector}
          onClose={handleFileSelectorClose}
          onFileSelect={handleFileSelect}
          projectName={projectName}
          files={projectFiles}
        />
      )}

      {/* Import wizard rendered OUTSIDE the layout component */}
      {projectImportData && (
        <ImportWizard
          isOpen={true}
          onClose={handleWizardClose}
          previewData={projectImportData.preview}
          columnNames={projectImportData.columnNames}
          totalRows={projectImportData.totalRows}
          totalColumns={projectImportData.totalColumns}
          columnSummaries={projectImportData.columnSummaries}
          onImport={handleImport}
        />
      )}
    </>
  );
}
