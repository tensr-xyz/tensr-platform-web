import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { FileMetadata } from '@/components/templates/home/file-fetcher';

// Query keys for consistent caching
export const fileKeys = {
  all: ['files'] as const,
  lists: () => [...fileKeys.all, 'list'] as const,
  list: (filters: { context?: string; organizationId?: string }) =>
    [...fileKeys.lists(), filters] as const,
  details: () => [...fileKeys.all, 'detail'] as const,
  detail: (id: string) => [...fileKeys.details(), id] as const,
  versions: (id: string) => [...fileKeys.detail(id), 'versions'] as const,
};

// Main files list hook with proper caching
export const useFiles = (filters: { context?: string; organizationId?: string } = {}) => {
  return useQuery({
    queryKey: fileKeys.list(filters),
    queryFn: () => apiClient.files.list(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });
};

// Individual file hook
export const useFile = (id: string) => {
  return useQuery({
    queryKey: fileKeys.detail(id),
    queryFn: () => apiClient.files.get(id),
    enabled: !!id,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
};

// File versions hook
export const useFileVersions = (id: string) => {
  return useQuery({
    queryKey: fileKeys.versions(id),
    queryFn: () => apiClient.files.versions(id),
    enabled: !!id,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
};

// Create file mutation with optimistic updates
export const useCreateFile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: apiClient.files.create,
    onMutate: async newFile => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: fileKeys.lists() });

      // Snapshot the previous value
      const previousFiles = queryClient.getQueryData(fileKeys.lists());

      // Optimistically update to the new value
      queryClient.setQueryData(fileKeys.lists(), (old: any) => {
        if (!old?.files) return old;
        return {
          ...old,
          files: [...old.files, { ...newFile, id: 'temp-id', isOptimistic: true }],
          total: old.total + 1,
        };
      });

      // Return a context object with the snapshotted value
      return { previousFiles };
    },
    onError: (err, newFile, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousFiles) {
        queryClient.setQueryData(fileKeys.lists(), context.previousFiles);
      }
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: fileKeys.lists() });
    },
  });
};

// Update file mutation
export const useUpdateFile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiClient.files.update(id, data),
    onSuccess: (updatedFile, { id }) => {
      // Update the file in the cache
      queryClient.setQueryData(fileKeys.detail(id), updatedFile);

      // Update the file in the list cache
      queryClient.setQueryData(fileKeys.lists(), (old: any) => {
        if (!old?.files) return old;
        return {
          ...old,
          files: old.files.map((file: any) =>
            file.fileId === id ? { ...file, ...updatedFile } : file
          ),
        };
      });
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: fileKeys.lists() });
    },
  });
};

// Delete file mutation
export const useDeleteFile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.files.delete(id),
    onMutate: async id => {
      await queryClient.cancelQueries({ queryKey: fileKeys.lists() });

      const previousFiles = queryClient.getQueryData(fileKeys.lists());

      // Optimistically remove the file
      queryClient.setQueryData(fileKeys.lists(), (old: any) => {
        if (!old?.files) return old;
        return {
          ...old,
          files: old.files.filter((file: any) => file.fileId !== id),
          total: old.total - 1,
        };
      });

      return { previousFiles };
    },
    onError: (err, id, context) => {
      if (context?.previousFiles) {
        queryClient.setQueryData(fileKeys.lists(), context.previousFiles);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: fileKeys.lists() });
    },
  });
};

// File upload mutation
export const useFileUpload = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      file,
      onProgress,
    }: {
      file: File;
      onProgress?: (progress: number) => void;
    }) => {
      // Get upload URL
      const uploadData = await apiClient.files.uploadUrl({
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
      return apiClient.files.completeUpload(uploadData.fileId, {
        fileId: uploadData.fileId,
        uploadId: uploadData.uploadId,
      });
    },
    onSuccess: () => {
      // Invalidate files list to show new file
      queryClient.invalidateQueries({ queryKey: fileKeys.lists() });
    },
  });
};

// Revert file version mutation
export const useRevertFileVersion = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ fileId, versionId }: { fileId: string; versionId: string }) =>
      apiClient.files.revert(fileId, versionId),
    onSuccess: (data, { fileId }) => {
      // Update file details
      queryClient.setQueryData(fileKeys.detail(fileId), data);

      // Invalidate versions
      queryClient.invalidateQueries({ queryKey: fileKeys.versions(fileId) });

      // Invalidate files list
      queryClient.invalidateQueries({ queryKey: fileKeys.lists() });
    },
  });
};
