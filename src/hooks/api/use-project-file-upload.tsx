import { useState, useCallback } from 'react';
import { getStytchBearerForTensrApi } from '@/utils/auth';
import { uploadDatasetFile } from '@/lib/upload-dataset';
import { devLog } from '@/lib/dev-log';

interface UseProjectFileUploadProps {
  allowedExtensions?: string[];
  onUploadComplete?: (projectId: string) => void;
}

/**
 * tensr-api has no /projects/* endpoints — uploading a file creates a dataset
 * directly. The returned id is a dataset id; downstream consumers (workspace
 * page, useProject) already resolve ids against /datasets first.
 */
export const useProjectFileUpload = ({
  allowedExtensions = ['.csv', '.xlsx', '.xls'],
  onUploadComplete,
}: UseProjectFileUploadProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const uploadFile = useCallback(
    async (file: File): Promise<string | null> => {
      devLog('uploadFile called with file:', file.name, file.size);
      setIsLoading(true);
      setError(null);
      setUploadProgress(0);

      try {
        const fileExtension = file.name.split('.').pop()?.toLowerCase();
        if (
          !fileExtension ||
          !allowedExtensions?.map(ext => ext.replace('.', '')).includes(fileExtension)
        ) {
          throw new Error('Unsupported file type. Please select a CSV or Excel file.');
        }

        const token = getStytchBearerForTensrApi();
        if (!token) {
          throw new Error('Authentication required. Please log in again.');
        }

        const result = await uploadDatasetFile(file, token, 'personal', setUploadProgress);
        devLog('Dataset upload completed:', result.dataset_id);

        onUploadComplete?.(result.dataset_id);
        return result.dataset_id;
      } catch (error: any) {
        console.error('Error uploading file:', error);
        setError(error.message || 'Failed to upload file');
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [allowedExtensions, onUploadComplete]
  );

  return {
    uploadFile,
    isLoading,
    error,
    uploadProgress,
    clearError: () => setError(null),
  };
};
