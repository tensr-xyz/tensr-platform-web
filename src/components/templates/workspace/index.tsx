'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useProject } from '@/contexts/project-context';
import { ProjectActions, ViewType } from '@/contexts/project-context/types';
import { ImportData } from '@/types/file';
import { useTabs } from '@/contexts/tabs-context';
import TabManager from '@/components/organisms/tab-manager';
import { ImportWizard, ImportSettings } from '@/components/organisms/wizards/import-wizard';
import { addTab, closeTab } from '@/contexts/tabs-context/actions';
import { cleanValue } from '@/utils/project';
import ProjectLayout from '@/components/templates/project-layout';
import { useCollaboration } from '@/hooks/use-collaboration';
import Loading from '@/components/molecules/loading';
import useAuth from '@/hooks/api/use-auth';
import { Tab } from '@/contexts/tabs-context/types';
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);

  // Refs
  const projectRef = useRef<HTMLDivElement>(null);
  const initialLoadedRef = useRef(false);
  const processingRef = useRef(false);

  // Hooks and context
  const { state: projectState, dispatch: projectDispatch } = useProject();
  const { state: tabState, dispatch: tabDispatch } = useTabs();
  const { tokens, user } = useAuth();

  // Make sure we have a valid resource.id before using it
  const resourceId = resource?.id || '';
  const userId = user?.userId;

  useCollaboration(resourceId);

  // Add a null check for activeTab
  const activeTab = tabState.tabs.find(tab => tab?.id === tabState.activeTabId);

  // Load data when resource changes - WITH PROTECTION AGAINST INFINITE LOOPS
  useEffect(() => {
    // Skip if we're already processing or no resource ID
    if (processingRef.current || !resourceId) return;

    // Only run this once per resource.id
    const resourceKey = `${resource.type}-${resourceId}`;
    if (initialLoadedRef.current) {
      console.log(`Resource ${resourceKey} already loaded, skipping`);
      return;
    }

    const loadResourceData = async () => {
      try {
        console.log(`Loading resource data for ${resource.type} ${resourceId}`);
        processingRef.current = true;
        setIsLoading(true);
        setError(null);

        // Create base project
        const project = {
          id: resourceId,
          name: resource.name || 'Untitled',
          path: resource.path || '',
          type: resource.type || 'file',
        };

        // Update project context
        projectDispatch({
          type: ProjectActions.SET_PROJECT,
          payload: project,
        });

        // Process the resource data
        console.log('Calling processData function');
        const result = await processData(resource);
        console.log('processData completed', result);

        // Set import data if available
        if (result.importData) {
          console.log('Setting import data from processData result');
          setImportData(result.importData);
          setShowImportWizard(result.showImportWizard || false);
        }

        initialLoadedRef.current = true;
      } catch (err: any) {
        console.error(`Error loading ${resource.type}:`, err);
        setError(err.message || `Failed to load ${resource.type}`);
      } finally {
        setIsLoading(false);
        processingRef.current = false;
      }
    };

    loadResourceData();
  }, [resourceId, resource.type, resource.name, resource.path, processData, resource]);

  // Monitor project state's importData changes - WITH PROTECTION AGAINST DUPLICATE UPDATES
  useEffect(() => {
    // Skip if we're already showing the import wizard with the same data
    if (showImportWizard && importData && projectState.importData?.fileId === importData.fileId) {
      return;
    }

    if (projectState.importData) {
      console.log('Setting import data from project state:', projectState.importData.fileName);
      setImportData(projectState.importData);
      setShowImportWizard(true);
    }
  }, [projectState.importData, showImportWizard, importData]);

  // Handle import completion
  const handleImport = useCallback(
    async (settings: ImportSettings) => {
      const dataToImport = projectState.importData || importData;
      if (!dataToImport) return;

      try {
        console.log('Processing import for file:', dataToImport.fileName);
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

        console.log('handleImport: Constructed s3Key (filePath):', s3Key);

        // Add headers to the request
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_FARGATE_API_URL}/api/files/fetch-page`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              path: dataToImport.filePath,
              start_row: 0,
              end_row: 100,
            }),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Error response:', errorText);
          throw new Error(`Failed to fetch data: ${response.status} ${errorText}`);
        }

        const data = await response.json();

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

        // Create a new tab with the correct type
        const newTab: Omit<Tab, 'id'> = {
          name: dataToImport.fileName || 'Untitled',
          type: ViewType.SPREADSHEET, // Use enum value instead of string
          content: '',
          isDirty: false,
          data: {
            filePath: dataToImport.filePath,
            initialData: fullData,
            initialColumns: columns,
            totalRows: dataToImport.totalRows,
            totalColumns: dataToImport.totalColumns,
            columnStats: dataToImport.columnSummaries || {},
            importSettings: settings,
            isInitialized: true,
            cleanValue,
            // Pass the custom processing function for future data chunks
            processDataChunk: (data: any[], startRow: number) =>
              processColumnOrientedData(data, columns),
          },
        };

        console.log('Adding new tab:', newTab.name);
        tabDispatch(addTab({ ...newTab }));
        projectDispatch({ type: ProjectActions.CLEAR_IMPORT_DATA });
        setImportData(null);
        setShowImportWizard(false);
      } catch (err) {
        console.error('Import failed:', err);
        projectDispatch({ type: ProjectActions.CLEAR_IMPORT_DATA });
        setImportData(null);
        setShowImportWizard(false);
      }
    },
    [projectState.importData, importData, resourceId, tabDispatch, projectDispatch, tokens, userId]
  );

  // Handle import wizard close
  const handleWizardClose = useCallback(() => {
    console.log('Closing import wizard');
    setShowImportWizard(false);
    setImportData(null);
    projectDispatch({ type: ProjectActions.CLEAR_IMPORT_DATA });
  }, [projectDispatch]);

  if (isLoading) {
    return <Loading />;
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
            tabs={tabState.tabs}
            onTabClose={tabId => tabId && tabDispatch(closeTab(tabId))}
            onToggleSidebar={() => setRightPanelOpen(!rightPanelOpen)}
          />
        </div>
      </ProjectLayout>

      {/* Import wizard rendered OUTSIDE the layout component */}
      {showImportWizard && importData && (
        <ImportWizard
          isOpen={true}
          onClose={handleWizardClose}
          previewData={importData.preview}
          columnNames={importData.columnNames}
          totalRows={importData.totalRows}
          totalColumns={importData.totalColumns}
          columnSummaries={importData.columnSummaries}
          onImport={handleImport}
        />
      )}
    </>
  );
}
