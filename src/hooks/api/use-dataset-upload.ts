import { useState, useCallback, useRef, useEffect } from 'react';
import { getStytchBearerForTensrApi } from '@/utils/auth';
import { ACCEPTED_UPLOAD_EXTENSIONS, ACCEPTED_UPLOAD_HELP } from '@/lib/accepted-upload-types';
import { reportUploadFailure } from '@/lib/report-upload-failure';
import { uploadDatasetFile, type UploadScope } from '@/lib/upload-dataset';
import { captureProductEvent, errorClass } from '@/lib/product-analytics';

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

      const started = performance.now();
      try {
        const result = await uploadDatasetFile(file, token, scope, setUploadProgress, sheet);
        const sheets = Array.isArray(result.sheets) ? result.sheets : [];
        captureProductEvent('file_uploaded', {
          dataset_id: result.dataset_id,
          type: ext,
          rows: typeof result.n_rows === 'number' ? result.n_rows : null,
          cols: typeof result.n_cols === 'number' ? result.n_cols : null,
          sheet_count: sheets.length,
          parse_duration_ms: Math.round(performance.now() - started),
        });
        const namedSheets = sheets.filter((name): name is string => typeof name === 'string');
        if (namedSheets.length > 1 && !sheet) {
          setWorkbook({
            file,
            sheets: namedSheets,
            selected: String(result.selected_sheet || sheets[0]),
            datasetId: result.dataset_id,
          });
          return result.dataset_id;
        }
        setWorkbook(null);
        cbRef.current?.(result.dataset_id, file.name);
        return result.dataset_id;
      } catch (e) {
        captureProductEvent('file_upload_failed', {
          type: ext,
          error_class: errorClass(e),
          parse_duration_ms: Math.round(performance.now() - started),
        });
        setError(await reportUploadFailure(file, e));
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
