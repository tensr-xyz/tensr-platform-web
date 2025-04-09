import { useEffect } from 'react';
import { ReadonlyURLSearchParams } from 'next/navigation';
import { ImportData } from '@/types/file';

export const useProjectInitialization = (
    projectState: any,
    searchParams: ReadonlyURLSearchParams,
    setImportData: (data: ImportData | null) => void,
    setShowImportWizard: (show: boolean) => void,
    setRightPanelOpen?: (open: boolean) => void
) => {
  // Add debugging logs
  useEffect(() => {
    console.log('ProjectInitialization - Current state:', {
      hasProject: !!projectState.currentProject,
      projectType: projectState.currentProject?.type,
      hasImportData: !!projectState.importData,
      fileName: projectState.currentProject?.name
    });
  }, [projectState.currentProject, projectState.importData]);

  // Handle project initialization
  useEffect(() => {
    if (!projectState.currentProject) {
      console.log('No current project, skipping initialization');
      return;
    }

    console.log('Project initialization - Project type:', projectState.currentProject.type);

    // For file-type projects
    if (projectState.currentProject.type === 'file') {
      const fileOpen = searchParams?.get('fileOpen') === 'true';
      console.log('File project detected - fileOpen param:', fileOpen);

      // IMPORTANT: This additional check is key for the web version
      // If we have importData in projectState, we should show the wizard regardless of URL params
      if (projectState.importData) {
        console.log('Import data found in projectState, showing wizard');
        setImportData(projectState.importData);
        setShowImportWizard(true);
        return;
      }

      // For compatibility with desktop version
      if (fileOpen && projectState.currentProject.initialFile) {
        console.log('initialFile found, setting up import data');
        const { metadata } = projectState.currentProject.initialFile;
        setImportData({
          fileName: projectState.currentProject.name,
          filePath: projectState.currentProject.path,
          fileId: projectState.currentProject.id,
          preview: metadata.preview,
          columnNames: metadata.column_names,
          totalRows: metadata.rows,
          totalColumns: metadata.columns,
          columnSummaries: metadata.columnSummaries,
        });
        setShowImportWizard(true);
      }
    } else if (setRightPanelOpen) {
      // Directory type projects
      console.log('Directory project detected, opening right panel');
      setRightPanelOpen(true);
    }
  }, [searchParams, projectState.currentProject, projectState.importData, setImportData, setShowImportWizard, setRightPanelOpen]);
};
