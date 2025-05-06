'use client';

import { useParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useProject } from '@/hooks/api/use-project';
import Workspace, { WorkspaceResource } from '@/components/templates/workspace';
import Loading from '@/components/molecules/loading';
import { ImportData } from '@/types/file';
import { Project } from '@/types/project';

export default function ProjectWorkspacePage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resource, setResource] = useState<WorkspaceResource>({
    id: projectId,
    name: '', // Will be populated from project info
    path: '', // Will be populated from project info
    type: 'project',
  });

  // Use the project hook with initialLoad set to false so we can control when to load
  const {
    project,
    getProject,
    isLoading: projectLoading,
    error: projectError,
  } = useProject({ projectId, initialLoad: false });

  // Load project data when component mounts
  useEffect(() => {
    const loadProject = async () => {
      try {
        setIsLoading(true);
        await getProject(projectId);
      } catch (err) {
        console.error('Failed to load project:', err);
        setError(err instanceof Error ? err.message : 'Failed to load project');
      } finally {
        setIsLoading(false);
      }
    };

    loadProject();
  }, [projectId, getProject]);

  // Update resource when project data loads
  useEffect(() => {
    if (project) {
      setResource({
        id: projectId,
        name: project.name || project.projectName || '', // Handle both field names
        path: project.path || projectId, // Fallback to ID if path is not available
        type: 'project',
      });
    }
  }, [project, projectId]);

  // If there's an error from the project hook, update our error state
  useEffect(() => {
    if (projectError) {
      setError(projectError.message);
    }
  }, [projectError]);

  // Define the data processing function for projects with correct return type
  const processProjectData = async (): Promise<{
    importData?: ImportData | null;
    showImportWizard?: boolean;
  }> => {
    // If the project has associated import data, you can return it here
    // For now, just return an empty object that matches the expected return type
    return {
      importData: null,
      showImportWizard: false,
    };
  };

  if (isLoading || projectLoading) {
    return <Loading />;
  }

  // if (error) {
  //   return (
  //     <div className="flex flex-col justify-center items-center min-h-screen">
  //       <h2 className="text-xl font-bold text-red-600 mb-4">Error</h2>
  //       <p className="text-gray-700">{error}</p>
  //     </div>
  //   );
  // }

  return (
    <Suspense fallback={<Loading />}>
      <Workspace resource={resource} processData={processProjectData} />
    </Suspense>
  );
}
