'use client';

import React, {useCallback, useEffect, useRef, useState} from 'react';
import { useSearchParams } from 'next/navigation';
import { ImportData } from '@/types/file';
import { useTabs } from '@/contexts/tabs-context';
import { useProject } from '@/contexts/project-context';
import { useSession } from '@/hooks/ui/use-session';
import { useCollaboration } from '@/hooks/use-collaboration';
import { useProjectInitialization } from '@/hooks/use-project-initalisation';
import { ImportSettings, ImportWizard } from '@/components/organisms/wizards/import-wizard';
import TabManager from '@/components/organisms/tab-manager';
import PluginsLayout from '@/components/templates/plugins-layout';
import UserCursors from '@/components/molecules/cursor';
import { ViewType, ProjectActions } from '@/contexts/project-context/types';
import { addTab, closeTab } from '@/contexts/tabs-context/actions';
import { cleanValue, createProcessDataChunk } from '@/utils/project';
import ProjectLayout from "@/components/templates/project-layout";
import {useFileHandler} from "@/hooks/api/use-file";

export default function ProjectPage() {
    // State
    const [importData, setImportData] = useState<ImportData | null>(null);
    const [showImportWizard, setShowImportWizard] = useState(false);
    const [loading, setLoading] = useState(false);

    // Get functions from the file handler hook - note we're only using openFile
    const {
        openFile,      // The single enhanced function we're using from the hook
        isLoading: fileLoading,
        error: fileError,
        setError       // Make sure this is exported from your hook
    } = useFileHandler({});

    // Refs
    const projectRef = useRef<HTMLDivElement>(null);

    // Hooks
    const { state: tabState, dispatch: tabDispatch } = useTabs();
    const { state: projectState, dispatch: projectDispatch } = useProject();
    const { wsReady, presence, clientId, updatePresence } = useSession();
    const searchParams = useSearchParams();

    const [rightPanelOpen, setRightPanelOpen] = useState(true);

    useCollaboration(projectState.currentProject?.id || '');
    const activeTab = tabState.tabs.find(tab => tab.id === tabState.activeTabId);

    // Initialize project
    useProjectInitialization(
        projectState,
        searchParams,
        setImportData,
        setShowImportWizard
    );

    // Debug logs for tracking state
    useEffect(() => {
        console.log('Project state updated:', {
            hasImportData: !!projectState.importData,
            showImportWizard: projectState.showImportWizard,
            localImportData: !!importData,
            localShowImportWizard: showImportWizard
        });
    }, [projectState.importData, projectState.showImportWizard, importData, showImportWizard]);

    // Handlers
    const handleMouseMove = useCallback(
        (e: React.MouseEvent) => {
            if (!projectRef.current || !wsReady) return;

            updatePresence({
                x: e.clientX,
                y: e.clientY,
                tabId: activeTab?.id,
                element: null,
            });
        },
        [wsReady, activeTab?.id, updatePresence]
    );

    const handleImport = async (settings: ImportSettings) => {
        const dataToImport = projectState.importData || importData;
        if (!dataToImport) {
            console.error('No import data available');
            setError('No import data available');
            return;
        }

        try {
            setLoading(true);
            console.log('Processing import for file:', dataToImport.fileName);

            // Create columns from settings
            const columns = settings.columnNames.map(name => ({
                id: name,
                accessor: name,
                header: name,
                width: 150,
                type: settings.columnTypes[name] || 'string',
            }));

            // Fetch initial data from the server
            // Use the fileId instead of the filePath
            console.log('Fetching initial data from server using fileId:', dataToImport.fileId);
            const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
            const response = await fetch(`${API_URL}/api/files/fetch-page`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${auth.tokens?.accessToken || ''}` // Add auth token
                },
                body: JSON.stringify({
                    path: dataToImport.fileId, // Use fileId as the path
                    start_row: 0,
                    end_row: 100,
                }),
            });

            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('Data received from server', data);

            if (!data || !data.data || !Array.isArray(data.data)) {
                throw new Error('Invalid data structure received from server');
            }

            // Process data with the utility functions
            const processDataChunk = createProcessDataChunk(columns);
            const fullData = processDataChunk(data.data, 0);
            console.log('Processed data', fullData);

            // Create and add the new tab
            const newTab = {
                id: `tab-${Date.now()}`, // Add unique ID for the tab
                name: dataToImport.fileName,
                type: 'spreadsheet' as const,
                content: '',
                isDirty: false,
                data: {
                    filePath: dataToImport.fileId, // Use fileId instead of filePath
                    initialData: fullData,
                    initialColumns: columns,
                    totalRows: dataToImport.totalRows,
                    totalColumns: dataToImport.totalColumns,
                    columnStats: dataToImport.columnSummaries || {},
                    importSettings: settings,
                    isInitialized: true,
                    cleanValue,
                    processDataChunk,
                },
            };

            console.log('Adding new tab:', newTab);
            tabDispatch(addTab(newTab));

            // Clear import data
            projectDispatch({ type: ProjectActions.CLEAR_IMPORT_DATA });
            setImportData(null);
            setShowImportWizard(false);
        } catch (err) {
            console.error('Import failed:', err);
            setError(`Import failed: ${err.message}`);
            projectDispatch({ type: ProjectActions.CLEAR_IMPORT_DATA });
            setImportData(null);
            setShowImportWizard(false);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (projectState.importData) {
            console.log('Setting import data from project state:', projectState.importData.fileName);
            setImportData(projectState.importData);
            setShowImportWizard(true);
        }
    }, [projectState.importData]);

    // Handle file opening via URL parameter
    useEffect(() => {
        const handleFileOpening = async () => {
            const fileId = searchParams.get('fileId');

            console.log('Checking for fileId:', fileId, {
                hasCurrentProject: !!projectState.currentProject,
                tabCount: tabState.tabs.length
            });

            // Only proceed if we have a fileId and no current project or tabs
            if (fileId && !projectState.currentProject && tabState.tabs.length === 0) {
                console.log('Opening file with ID:', fileId);

                try {
                    setLoading(true);

                    // Use the hook function to open the file
                    console.log('Attempting to open file through hook function');
                    const success = await openFile(fileId);

                    if (success) {
                        console.log('Successfully opened file through hook');
                        // The openFile function already updates the project context
                    } else {
                        throw new Error("File opening failed");
                    }
                } catch (error) {
                    console.error('File opening failed:', error);
                    // Show error to user
                    setError(`Failed to open file: ${error.message}`);
                    alert(`Failed to open file: ${error.message}`);
                } finally {
                    setLoading(false);
                }
            }
        };

        handleFileOpening();
    }, [searchParams, projectState.currentProject, tabState.tabs.length, openFile]);

    return (
        <>
            {/* Regular project layout with main content */}
            <ProjectLayout
                activeTab={activeTab}
                rightPanelOpen={rightPanelOpen}
                onToggleSidebar={() => setRightPanelOpen(!rightPanelOpen)}
            >
                <div ref={projectRef} className="relative h-full w-full" onMouseMove={handleMouseMove}>
                    {projectState.activeView === ViewType.PLUGINS ? (
                        <div className="h-full">
                            <PluginsLayout />
                        </div>
                    ) : tabState.tabs.length > 0 ? (
                        <TabManager
                            activeTab={activeTab}
                            tabs={tabState.tabs}
                            onTabClose={tabId => tabDispatch(closeTab(tabId))}
                        />
                    ) : null}

                    {presence.size > 0 && <UserCursors presence={presence} clientId={clientId} />}
                </div>
            </ProjectLayout>

            {/* Import wizard rendered OUTSIDE the layout component */}
            {showImportWizard && importData && (
                <ImportWizard
                    isOpen={true}
                    onClose={() => {
                        console.log('Closing import wizard');
                        setShowImportWizard(false);
                        setImportData(null);
                        projectDispatch({ type: ProjectActions.CLEAR_IMPORT_DATA });
                    }}
                    previewData={importData.preview}
                    columnNames={importData.columnNames}
                    totalRows={importData.totalRows}
                    totalColumns={importData.totalColumns}
                    columnSummaries={importData.columnSummaries}
                    detectedDelimiter={importData.detectedDelimiter}
                    onImport={handleImport}
                />
            )}

            {/* Loading indicator */}
            {fileLoading && (
                <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg shadow-lg">
                        <div className="flex items-center space-x-4">
                            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
                            <p>Loading file...</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Error display */}
            {fileError && (
                <div className="fixed bottom-4 right-4 bg-red-100 border-l-4 border-red-500 p-4 max-w-md rounded shadow-lg z-50">
                    <div className="flex">
                        <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <div className="ml-3">
                            <p className="text-sm text-red-700">
                                {fileError}
                            </p>
                        </div>
                        <div className="ml-auto pl-3">
                            <div className="-mx-1.5 -my-1.5">
                                <button
                                    className="inline-flex rounded-md p-1.5 text-red-500 hover:bg-red-200 focus:outline-none"
                                    onClick={() => {
                                        // Clear error using the setError function from your hook
                                        setError(null);
                                    }}
                                >
                                    <span className="sr-only">Dismiss</span>
                                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
