import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

// Query keys for consistent caching
export const projectKeys = {
  all: ['projects'] as const,
  lists: () => [...projectKeys.all, 'list'] as const,
  list: () => [...projectKeys.lists()] as const,
  details: () => [...projectKeys.all, 'detail'] as const,
  detail: (id: string) => [...projectKeys.details(), id] as const,
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

// Individual project hook
export const useProject = (id: string) => {
  return useQuery({
    queryKey: projectKeys.detail(id),
    queryFn: () => apiClient.projects.get(id),
    enabled: !!id,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Create project mutation
export const useCreateProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: apiClient.projects.create,
    onSuccess: newProject => {
      // Add new project to the list cache
      queryClient.setQueryData(projectKeys.list(), (old: any) => {
        if (!old) return [newProject];
        return [...old, newProject];
      });
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
};

// Update project mutation
export const useUpdateProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiClient.projects.update(id, data),
    onSuccess: (updatedProject, { id }) => {
      // Update the project in the cache
      queryClient.setQueryData(projectKeys.detail(id), updatedProject);

      // Update the project in the list cache
      queryClient.setQueryData(projectKeys.list(), (old: any) => {
        if (!old) return old;
        return old.map((project: any) =>
          project.id === id ? { ...project, ...updatedProject } : project
        );
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
};

// Delete project mutation
export const useDeleteProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.projects.delete(id),
    onMutate: async id => {
      await queryClient.cancelQueries({ queryKey: projectKeys.lists() });

      const previousProjects = queryClient.getQueryData(projectKeys.list());

      // Optimistically remove the project
      queryClient.setQueryData(projectKeys.list(), (old: any) => {
        if (!old) return old;
        return old.filter((project: any) => project.id !== id);
      });

      return { previousProjects };
    },
    onError: (err, id, context) => {
      if (context?.previousProjects) {
        queryClient.setQueryData(projectKeys.list(), context.previousProjects);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
};

// Project upload mutation
export const useProjectUpload = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      file,
      onProgress,
    }: {
      projectId: string;
      file: File;
      onProgress?: (progress: number) => void;
    }) => {
      // Get upload URL
      const uploadData = await apiClient.projects.uploadUrl(projectId, {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
      });

      // Upload to S3
      const uploadResponse = await fetch(uploadData.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error('Upload failed');
      }

      // Complete upload
      return apiClient.projects.completeUpload(projectId, {
        fileId: uploadData.fileId,
        uploadId: uploadData.uploadId,
      });
    },
    onSuccess: (data, { projectId }) => {
      // Update project details
      queryClient.setQueryData(projectKeys.detail(projectId), data);

      // Invalidate projects list
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
};
