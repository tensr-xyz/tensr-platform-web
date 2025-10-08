import { useQuery } from '@tanstack/react-query';
import { getAccessToken, getIdToken } from '@/utils/auth';

export interface FileMetadata {
  fileId: string;
  fileName: string;
  fileType: string;
  size: number;
  createdAt: string;
  updatedAt: string;
  uploadedAt: string;
}

interface FilesResponse {
  files: FileMetadata[];
  context: {
    type: 'personal' | 'organization';
    organizationId?: string;
    organizationRole?: 'ADMIN' | 'MEMBER';
  };
  total: number;
}

interface UseFilesOptions {
  context?: 'personal' | 'organization';
  organizationId?: string;
  enabled?: boolean; // Allow disabling the query
}

async function fetchFiles(options: UseFilesOptions = {}): Promise<FilesResponse> {
  const token = getIdToken();

  if (!token) {
    console.error('No authentication token found');
    throw new Error('No authentication token found');
  }

  // Build query parameters
  const params = new URLSearchParams();
  const context = options.context || 'personal';
  params.append('context', context);

  if (context === 'organization' && options.organizationId) {
    params.append('organizationId', options.organizationId);
  }

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.tensr.xyz';
  const url = `${API_BASE_URL}/files?${params.toString()}`;
  console.log('Fetching files from:', url);

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Failed to fetch files:', response.status, errorText);
    throw new Error(`Failed to fetch files: ${response.statusText}`);
  }

  const data = await response.json();
  return data;
}

export const useFiles = (options: UseFilesOptions = {}) => {
  const { context = 'personal', organizationId, enabled = true } = options;

  // Create a unique query key that includes the context and organization
  const queryKey = ['files', context, organizationId].filter(Boolean);

  const query = useQuery({
    queryKey,
    queryFn: () => fetchFiles(options),
    enabled, // Allow disabling the query if needed
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes (renamed from cacheTime)
  });

  // Debug logging
  console.log('useFiles hook - query state:', {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    isSuccess: query.isSuccess,
    isError: query.isError,
    queryKey,
  });

  const result = {
    files: query.data?.files || [],
    contextInfo: query.data?.context || null,
    total: query.data?.total || 0,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    // Convenience properties
    isPersonalContext: query.data?.context?.type === 'personal',
    isOrganizationContext: query.data?.context?.type === 'organization',
    organizationRole: query.data?.context?.organizationRole,
  };

  console.log('useFiles hook - returning result:', result);
  return result;
};
