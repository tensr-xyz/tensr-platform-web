import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

// Query keys for consistent caching
export const projectKeys = {
  all: ['projects'] as const,
  lists: () => [...projectKeys.all, 'list'] as const,
  list: () => [...projectKeys.lists()] as const,
};

// Main projects list hook
export const useProjects = () => {
  return useQuery({
    queryKey: projectKeys.list(),
    queryFn: () => apiClient.projects.list(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });
};
