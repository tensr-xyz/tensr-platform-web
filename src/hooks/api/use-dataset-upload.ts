import { useState, useCallback, useRef, useEffect } from 'react';
import { getStytchBearerForTensrApi } from '@/utils/auth';
import { uploadDatasetFile } from '@/lib/upload-dataset';

const ALLOWED = new Set(['csv', 'xlsx', 'xls']);

export function useDatasetUpload(
  scope: 'personal' | 'team' = 'personal',
  onUploadComplete?: (datasetId: string, fileName: string) => void
) {
  const cbRef = useRef(onUploadComplete);
  useEffect(() => {
    cbRef.current = onUploadComplete;
  }, [onUploadComplete]);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const uploadFile = useCallback(
    async (file: File): Promise<string | null> => {
      setIsLoading(true);
      setError(null);
      setUploadProgress(0);

      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!ext || !ALLOWED.has(ext)) {
        setError('Unsupported file type. Use CSV or Excel (.xlsx, .xls).');
        setIsLoading(false);
        return null;
      }

      const token = getStytchBearerForTensrApi();
      if (!token) {
        setError('Authentication required. Please log in again.');
        setIsLoading(false);
        return null;
      }

      try {
        const result = await uploadDatasetFile(file, token, scope, setUploadProgress);
        cbRef.current?.(result.dataset_id, file.name);
        return result.dataset_id;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Upload failed';
        setError(msg);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [scope]
  );

  return {
    uploadFile,
    isLoading,
    error,
    uploadProgress,
    clearError: () => setError(null),
  };
}
