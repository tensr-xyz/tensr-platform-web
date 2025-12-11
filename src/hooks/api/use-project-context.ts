import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

interface ProjectContext {
  snapshotId: string;
  selectedVariables: string[];
  appliedFilters: Record<string, any>;
  fileGroups: Record<string, any[]>;
  datasets: any[];
}

export function useProjectContext(projectId: string) {
  return useQuery<ProjectContext>({
    queryKey: ['project-context', projectId],
    queryFn: async () => {
      if (!projectId || projectId === 'default-project') {
        return {
          snapshotId: 'current-snapshot',
          selectedVariables: [],
          appliedFilters: {},
          fileGroups: {},
          datasets: [],
        };
      }

      try {
        // Get project details
        const project = await apiClient.projects.get(projectId);

        // Get datasets for the project - use list method or get from project data
        const datasets: any[] = [];

        return {
          snapshotId: 'current-snapshot',
          selectedVariables: [],
          appliedFilters: {},
          fileGroups: project.fileGroups || {},
          datasets: datasets || [],
        };
      } catch (error) {
        console.error('Failed to fetch project context:', error);
        return {
          snapshotId: 'current-snapshot',
          selectedVariables: [],
          appliedFilters: {},
          fileGroups: {},
          datasets: [],
        };
      }
    },
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
}
