import { useQuery } from '@tanstack/react-query';
import { getIdToken } from '@/utils/auth';
import { tensrApiUrl } from '@/lib/tensr-api-url';

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

  const context = options.context || 'personal';

  const scope = context === 'organization' ? 'team' : context === 'personal' ? 'personal' : 'all';
  const url = tensrApiUrl(`/datasets/?scope=${scope}`);

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
  const rows = Array.isArray(data) ? data : [];
  const files: FileMetadata[] = rows.map((row: Record<string, unknown>) => {
    const updated = String(row.updated_at ?? '');
    return {
      fileId: String(row.dataset_id ?? ''),
      fileName: String(row.original_filename ?? 'dataset'),
      fileType: 'csv',
      size: 0,
      createdAt: updated,
      updatedAt: updated,
      uploadedAt: updated,
    };
  });

  return {
    files,
    context: {
      type: context === 'organization' ? 'organization' : 'personal',
      organizationId: options.organizationId,
      organizationRole: undefined,
    },
    total: files.length,
  };
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

  return result;
};
