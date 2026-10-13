import { useState, useCallback, useRef, useEffect } from 'react';
import { getStytchBearerForTensrApi } from '@/utils/auth';
import { ACCEPTED_UPLOAD_EXTENSIONS, ACCEPTED_UPLOAD_HELP } from '@/lib/accepted-upload-types';
import { formatApiErrorMessage } from '@/lib/api-error';
import { uploadDatasetFile, type UploadScope } from '@/lib/upload-dataset';

export type WorkbookSheets = {
  file: File;
  sheets: string[];
  selected: string;
  datasetId: string;
};

const ALLOWED = new Set<string>(ACCEPTED_UPLOAD_EXTENSIONS);

export function useDatasetUpload(
  scope: UploadScope = 'workspace',
  onUploadComplete?: (datasetId: string, fileName: string) => void
) {
  const cbRef = useRef(onUploadComplete);
  useEffect(() => {
    cbRef.current = onUploadComplete;
  }, [onUploadComplete]);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [workbook, setWorkbook] = useState<WorkbookSheets | null>(null);

  const uploadFile = useCallback(
    async (file: File, sheet?: string): Promise<string | null> => {
      setIsLoading(true);
      setError(null);
      setUploadProgress(0);

      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!ext || !ALLOWED.has(ext)) {
        setError(`Unsupported file type. ${ACCEPTED_UPLOAD_HELP}`);
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
        const result = await uploadDatasetFile(file, token, scope, setUploadProgress, sheet);
        const sheets = Array.isArray(result.sheets)
          ? result.sheets.filter((name): name is string => typeof name === 'string')
          : [];
        if (sheets.length > 1 && !sheet) {
          setWorkbook({
            file,
            sheets,
            selected: String(result.selected_sheet || sheets[0]),
            datasetId: result.dataset_id,
          });
          return result.dataset_id;
        }
        setWorkbook(null);
        cbRef.current?.(result.dataset_id, file.name);
        return result.dataset_id;
      } catch (e) {
        setError(e instanceof Error ? formatApiErrorMessage(e) : 'Upload failed');
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
    workbook,
    clearWorkbook: () => setWorkbook(null),
    clearError: () => setError(null),
  };
}
