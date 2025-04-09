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

    // Refs
    const projectRef = useRef<HTMLDivElement>(null);

    // Hooks
    const { state: tabState, dispatch: tabDispatch } = useTabs();
    const { state: projectState, dispatch: projectDispatch } = useProject();
    const { wsReady, presence, clientId, updatePresence } = useSession();
    const searchParams = useSearchParams();
    const { fetchUserFiles } = useFileHandler({});

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

    // Update the useEffect dependency array and add debugging
    useEffect(() => {
        const openFileDirectly = async () => {
            const fileId = searchParams.get('fileId');

            console.log('Checking for fileId:', fileId, {
                hasCurrentProject: !!projectState.currentProject,
                tabCount: tabState.tabs.length
            });

            if (fileId && !projectState.currentProject && tabState.tabs.length === 0) {
                console.log('Opening file directly:', fileId);

                try {
                    // Get file metadata
                    console.log('Fetching files...');
                    const files = await fetchUserFiles();
                    console.log('Files fetched:', files.length);

                    const fileInfo = files.find(file => file.fileId === fileId);
                    console.log('File info found:', fileInfo);

                    if (!fileInfo) {
                        console.error('File not found:', fileId);
                        return;
                    }

                    // Create a project object
                    const project = {
                        id: fileId,
                        name: fileInfo.fileName,
                        path: fileInfo.fileName,
                        type: 'file',
                    };

                    console.log('Setting project in context:', project);
                    // Set the project in context
                    projectDispatch({
                        type: ProjectActions.SET_PROJECT,
                        payload: project
                    });

                    // Default columns based on file extension
                    const fileExtension = fileInfo.fileName.split('.').pop()?.toLowerCase();
                    const defaultType = fileExtension === 'csv' ? 'string' : 'auto';

                    // For this direct opening, we'll create a simple settings object
                    const settings = {
                        columnNames: ['column1'], // This will be overwritten by the API response
                        columnTypes: { column1: defaultType }
                    };

                    // Make the same API call as in handleImport
                    console.log('Calling API to fetch CSV data');
                    const response = await fetch('/api/csv/page', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            path: fileInfo.fileName,
                            start_row: 0,
                            end_row: 100,
                        }),
                    });

                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`API call failed: ${response.status} ${errorText}`);
                    }

                    const data = await response.json();
                    console.log('API response:', data);

                    // Get actual column names from the response
                    const columnNames = Object.keys(data.data[0] || {});
                    console.log('Column names:', columnNames);

                    // Update settings with actual column names
                    settings.columnNames = columnNames;
                    columnNames.forEach(name => {
                        settings.columnTypes[name] = defaultType;
                    });

                    // Create columns as in handleImport
                    const columns = columnNames.map(name => ({
                        id: name,
                        accessor: name,
                        header: name,
                        width: 150,
                        type: settings.columnTypes[name] || 'string',
                    }));

                    // Process data the same way as in handleImport
                    const processDataChunk = createProcessDataChunk(columns);
                    const fullData = processDataChunk(data.data, 0);

                    // Create the tab exactly as in handleImport
                    const newTab = {
                        id: fileId, // Add an ID for the tab
                        name: fileInfo.fileName,
                        type: 'spreadsheet' as const,
                        content: '',
                        isDirty: false,
                        data: {
                            filePath: fileInfo.fileName,
                            initialData: fullData,
                            initialColumns: columns,
                            totalRows: data.totalRows || 100, // Fallback if not provided
                            totalColumns: columns.length,
                            columnStats: {}, // We might not have this info
                            importSettings: settings,
                            isInitialized: true,
                            cleanValue,
                            processDataChunk,
                        },
                    };

                    console.log('Adding new tab directly:', newTab);
                    tabDispatch(addTab(newTab));

                } catch (error) {
                    console.error('Failed to open file directly:', error);
                }
            }
        };

        openFileDirectly();
    }, [searchParams, projectState.currentProject, tabState.tabs.length, fetchUserFiles, tabDispatch, projectDispatch]);

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

            // Add headers to the request
            const response = await fetch('/api/csv/page', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    path: dataToImport.filePath,
                    start_row: 0,
                    end_row: 100,
                }),
            });

            const data = await response.json();

            const processDataChunk = createProcessDataChunk(columns);
            const fullData = processDataChunk(data.data, 0);

            const newTab = {
                name: dataToImport.fileName,
                type: 'spreadsheet' as const,
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
                    processDataChunk,
                },
            };

            console.log('Adding new tab:', newTab.name);
            tabDispatch(addTab(newTab));
            projectDispatch({ type: ProjectActions.CLEAR_IMPORT_DATA });
            setImportData(null);
            setShowImportWizard(false);
        } catch (err) {
            console.error('Import failed:', err);
            projectDispatch({ type: ProjectActions.CLEAR_IMPORT_DATA });
            setImportData(null);
            setShowImportWizard(false);
        }
    };

    useEffect(() => {
        if (projectState.importData) {
            console.log('Setting import data from project state:', projectState.importData.fileName);
            setImportData(projectState.importData);
            setShowImportWizard(true);
        }
    }, [projectState.importData]);

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
        </>
    );
}
