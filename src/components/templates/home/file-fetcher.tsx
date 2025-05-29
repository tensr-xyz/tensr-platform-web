import { useQuery } from '@tanstack/react-query';
import { getAccessToken } from '@/utils/auth';

export interface FileMetadata {
  fileId: string;
  fileName: string;
  fileType: string;
  size: number;
  createdAt: string;
  updatedAt: string;
  uploadedAt: string;
}

async function fetchFiles(): Promise<FileMetadata[]> {
  const token = getAccessToken();

  if (!token) {
    console.error('No authentication token found');
    throw new Error('No authentication token found');
  }

  console.log('Fetching files from /api/files');
  const response = await fetch('/api/files', {
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
  return data.files || [];
}

export const useFiles = () => {
  const query = useQuery({
    queryKey: ['files'],
    queryFn: fetchFiles,
  });

  return {
    files: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
};
