'use client';

import { useParams, useRouter } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useProject } from '@/hooks/api/use-project';
import Workspace, { WorkspaceResource } from '@/components/templates/workspace';
import { SubscriptionGate } from '@/components/templates/subscription-gate';
import Loading from '@/components/molecules/loading';
import { Project } from '@/types/project';
import { Button } from '@/components/atoms/button';

function ProjectWorkspaceContent() {
  const params = useParams();
  const router = useRouter();
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
        name: (project as any).name || project.projectName || '', // Handle both field names
        path: projectId, // Always use project ID as path for project detection
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

  if (isLoading || projectLoading) {
    return <Loading fullScreen />;
  }

  if (error) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <h2 className="text-xl font-normal tracking-tighter text-foreground">
          Unable to open workspace
        </h2>
        <p className="max-w-md text-sm font-medium text-muted-foreground">{error}</p>
        <Button type="button" variant="outline" onClick={() => router.push('/dashboard')}>
          Back to overview
        </Button>
      </div>
    );
  }

  return (
    <SubscriptionGate>
      <Workspace resource={resource} />
    </SubscriptionGate>
  );
}

export default function ProjectWorkspacePage() {
  return (
    <Suspense fallback={<Loading fullScreen />}>
      <ProjectWorkspaceContent />
    </Suspense>
  );
}
