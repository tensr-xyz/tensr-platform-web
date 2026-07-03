import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/api/use-auth';
import { devLog } from '@/lib/dev-log';

import { useProjectStore } from '@/stores/project-store';
import { getIdToken } from '@/utils/auth';
import { getTensrApiBaseUrl, tensrApiUrl } from '@/lib/tensr-api-url';

const apiBase = () => getTensrApiBaseUrl();

interface UseFileHandlerProps {
  allowedExtensions?: string[];
  onUploadComplete?: (fileId: string) => void;
}

// File metadata interface
export interface FileMetadata {
  fileId: string;
  fileName: string;
  fileType: string;
  size: number;
  createdAt: string;
  updatedAt: string;
  uploadedAt: string;
}

// File version interface
export interface FileVersion {
  versionId: string;
  lastModified: string;
  size: number;
  isLatest: boolean;
}

export const useFileHandler = ({
  allowedExtensions = ['.csv', '.xlsx', '.xls'],
  onUploadComplete,
}: UseFileHandlerProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null);
  const [fileVersions, setFileVersions] = useState<FileVersion[]>([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);

  const auth = useAuth();
  const { currentProject, setProject } = useProjectStore();

  // Use a ref to track if initial fetch has happened
  const initialFetchDoneRef = useRef(false);

  // Auto-save configuration
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Helper function to get access token
  const getToken = useCallback((): string => {
    // Get token directly from localStorage via helper function
    const token = getIdToken() || localStorage.getItem('access_token') || '';
    return token || '';
  }, []);

  // Helper function to get user ID from multiple sources
  const getUserId = useCallback((): string => {
    // First try user object from auth context
    if (auth.user?.userId) {
      return auth.user.userId;
    }

    if (auth.user?.userId) {
      return auth.user.userId;
    }

    // If no user in context, try to extract from token
    const idToken = getIdToken();
    if (idToken) {
      try {
        const payload = JSON.parse(atob(idToken.split('.')[1]));
        return payload.sub || payload.user_id || '';
      } catch (e) {
        console.error('Error extracting user ID from token:', e);
      }
    }

    return '';
  }, [auth.user]);

  // Function to fetch user's files
  const fetchUserFiles = useCallback(async (): Promise<FileMetadata[]> => {
    try {
      setIsLoading(true);
      setError(null);

      const token = getToken();
      if (!token) {
        setError('No authentication token available. Please log in again.');
        return [];
      }

      const userId = getUserId();
      if (!userId) {
        console.warn('Unable to determine user ID - will use token authorization only');
      }

      const response = await fetch(tensrApiUrl('/datasets/?scope=all'), {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get files: ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      const rows = Array.isArray(data) ? data : [];
      const userFiles: FileMetadata[] = rows.map((row: Record<string, unknown>) => {
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
      setFiles(userFiles);
      return userFiles;
    } catch (err: any) {
      console.error('Error fetching files:', err);
      setError(err.message || 'Failed to fetch files');
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [getToken, getUserId]); // Include dependencies to prevent stale closures

  // Main file handler function
  const handleFile = async (file: File): Promise<boolean> => {
    devLog('handleFile called with file:', file.name, file.size);
    setIsLoading(true);
    setError(null);
    setUploadProgress(0);

    try {
      const fileName = file.name;
      const fileExtension = fileName.split('.').pop()?.toLowerCase();
      devLog('File extension:', fileExtension);

      if (
        !fileExtension ||
        !allowedExtensions?.map(ext => ext.replace('.', '')).includes(fileExtension)
      ) {
        console.error('Unsupported file type:', fileExtension);
        throw new Error('Unsupported file type. Please select a CSV or Excel file.');
      }

      // Check token availability
      const token = getToken();
      if (!token) {
        throw new Error('Authentication required. Please log in again.');
      }

      devLog('Uploading dataset via tensr-api');
      setUploadProgress(10);

      try {
        const scope = 'personal';
        const uploadUrlRes = await fetch(tensrApiUrl(`/datasets/upload-url?scope=${scope}`), {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filename: fileName,
            content_type: file.type || 'application/octet-stream',
          }),
        });
        if (!uploadUrlRes.ok) {
          throw new Error(await uploadUrlRes.text());
        }
        const uploadUrlData = (await uploadUrlRes.json()) as {
          mode?: string;
          dataset_id?: string;
          upload_url?: string;
          s3_key?: string;
        };

        const uploadViaXhr = (
          method: string,
          url: string,
          body: FormData | File,
          withAuth: boolean
        ): Promise<{ dataset_id: string }> =>
          new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.upload.addEventListener('progress', event => {
              if (event.lengthComputable) {
                const pct = Math.round((event.loaded / event.total) * 90);
                setUploadProgress(10 + pct);
              }
            });
            xhr.addEventListener('load', () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                try {
                  resolve(JSON.parse(xhr.responseText || '{}'));
                } catch {
                  reject(new Error('Invalid upload response'));
                }
              } else {
                reject(new Error(xhr.responseText || `Upload failed (${xhr.status})`));
              }
            });
            xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
            xhr.open(method, url);
            if (withAuth) {
              xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            }
            if (body instanceof File && file.type) {
              xhr.setRequestHeader('Content-Type', file.type);
            }
            xhr.send(body);
          });

        let uploadData: { dataset_id: string };

        if (
          uploadUrlData.mode === 's3' &&
          uploadUrlData.upload_url &&
          uploadUrlData.dataset_id &&
          uploadUrlData.s3_key
        ) {
          await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.upload.addEventListener('progress', event => {
              if (event.lengthComputable) {
                const pct = Math.round((event.loaded / event.total) * 85);
                setUploadProgress(10 + pct);
              }
            });
            xhr.addEventListener('load', () => {
              if (xhr.status >= 200 && xhr.status < 300) resolve();
              else reject(new Error(`S3 upload failed (${xhr.status})`));
            });
            xhr.addEventListener('error', () =>
              reject(new Error('Network error during S3 upload'))
            );
            xhr.open('PUT', uploadUrlData.upload_url!);
            if (file.type) xhr.setRequestHeader('Content-Type', file.type);
            xhr.send(file);
          });
          setUploadProgress(96);
          const completeRes = await fetch(
            tensrApiUrl(`/datasets/${uploadUrlData.dataset_id}/complete-upload?scope=${scope}`),
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                s3_key: uploadUrlData.s3_key,
                filename: fileName,
              }),
            }
          );
          if (!completeRes.ok) {
            throw new Error(await completeRes.text());
          }
          uploadData = (await completeRes.json()) as { dataset_id: string };
        } else {
          const formData = new FormData();
          formData.append('file', file);
          uploadData = await uploadViaXhr(
            'POST',
            tensrApiUrl(`/datasets/upload?scope=${scope}`),
            formData,
            true
          );
        }
        const datasetId = uploadData.dataset_id;
        if (!datasetId) {
          throw new Error('Upload succeeded but no dataset_id was returned');
        }

        setUploadProgress(100);

        await fetchUserFiles();

        if (onUploadComplete) {
          onUploadComplete(datasetId);
        }

        return true;
      } catch (uploadError: unknown) {
        console.error('Dataset upload failed:', uploadError);
        throw new Error(
          uploadError instanceof Error ? uploadError.message : 'Failed to upload file'
        );
      }
    } catch (err: any) {
      console.error('File upload/processing error:', err);
      setError(err.message || 'Failed to upload file');
      return false;
    } finally {
      devLog('Setting isLoading to false');
      setIsLoading(false);
    }
  };

  // Helper function to upload file to S3 with progress tracking
  const uploadFileToS3 = async (
    presignedUrl: string,
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<Response> => {
    devLog('uploadFileToS3 called with AES256 encryption header');
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', event => {
        if (event.lengthComputable && onProgress) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          devLog('Upload progress:', percentComplete);
          onProgress(percentComplete);
        }
      });

      xhr.addEventListener('load', () => {
        devLog('Upload completed with status:', xhr.status);
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(
            new Response(null, {
              status: xhr.status,
              statusText: xhr.statusText,
              headers: new Headers({
                ETag: xhr.getResponseHeader('ETag') || '',
              }),
            })
          );
        } else {
          let errorText = '';
          try {
            errorText = xhr.responseText;
          } catch (e) {
            errorText = 'Could not read response text';
          }
          console.error(`Upload failed with status ${xhr.status}:`, errorText);
          reject(new Error(`Upload failed with status ${xhr.status}: ${errorText}`));
        }
      });

      xhr.addEventListener('error', () => {
        console.error('XHR upload error event fired');
        reject(new Error('Network error occurred during upload'));
      });

      xhr.addEventListener('abort', () => {
        console.warn('XHR upload aborted');
        reject(new Error('Upload aborted'));
      });

      try {
        // Open the request
        xhr.open('PUT', presignedUrl);

        // CRITICAL: Set the encryption header to AES256, matching
        // what was used to generate the presigned URL in the backend
        xhr.setRequestHeader('x-amz-server-side-encryption', 'AES256');

        // Don't set Content-Type or any other headers
        devLog('Starting S3 upload with AES256 encryption header');
        xhr.send(file);
      } catch (error) {
        console.error('Error preparing S3 upload:', error);
        reject(error);
      }
    });
  };

  // Utility functions
  const getFileExtension = (filename: string): string => {
    return filename.slice(((filename.lastIndexOf('.') - 1) >>> 0) + 2);
  };

  const getFileTypeFromExtension = (filename: string): string => {
    const extension = getFileExtension(filename).toLowerCase();
    const mimeTypes: Record<string, string> = {
      csv: 'text/csv',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      xls: 'application/vnd.ms-excel',
    };

    return mimeTypes[extension] || 'application/octet-stream';
  };

  const openFile = async (fileId: string): Promise<boolean> => {
    devLog('openFile called with fileId:', fileId);
    setIsLoading(true);
    setError(null);

    try {
      // Check token
      const token = getToken();
      if (!token) {
        throw new Error('Authentication required. Please log in again.');
      }

      // First, ensure we have the file metadata
      const fileList = await fetchUserFiles();
      const fileInfo = fileList.find(file => file.fileId === fileId);

      if (!fileInfo) {
        throw new Error(`File with ID ${fileId} not found`);
      }

      devLog('Found file in user files:', fileInfo.fileName);

      // Create minimal project context with the file info
      const project = {
        id: fileId,
        name: fileInfo.fileName,
        path: fileInfo.fileName,
        type: 'file' as const,
      };

      // Update project context
      devLog('Setting project in store');
      setProject(project);

      // Create minimal import data
      const importData = {
        fileName: fileInfo.fileName,
        filePath: fileInfo.fileName,
        fileId,
        columnNames: [],
        totalRows: 0,
        totalColumns: 0,
        columnSummaries: null,
        detectedDelimiter: ',',
      };

      // Update import data in store
      // Note: These actions need to be added to the store if needed
      // For now, we'll just set the project

      return true;
    } catch (err: any) {
      console.error('Error opening file:', err);
      setError(err.message || 'Failed to open file');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // ===== NEW FUNCTIONS FOR FILE SAVING AND VERSION MANAGEMENT =====

  // Save file content - creates a new version in S3
  const saveFile = async (fileId: string, content: any): Promise<boolean> => {
    devLog('saveFile called with fileId:', fileId);
    setIsSaving(true);
    setError(null);

    try {
      const token = getToken();
      if (!token) {
        throw new Error('Authentication required. Please log in again.');
      }

      // 1. Get a pre-signed URL for updating the file
      devLog('Getting pre-signed URL for file update');
      const fileSize = new Blob([JSON.stringify(content)]).size;

      const updateResponse = await fetch(`${apiBase()}/files/${fileId}/update-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ fileSize }),
      });

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        throw new Error(`Failed to get update URL: ${updateResponse.statusText} - ${errorText}`);
      }

      const updateData = await updateResponse.json();
      devLog('Got presigned URL for updating fileId:', fileId);

      // 2. Upload content to S3
      devLog('Uploading file content to S3');
      const uploadResponse = await fetch(updateData.uploadUrl, {
        method: 'PUT',
        body: JSON.stringify(content),
        headers: {
          'Content-Type': 'application/json',
          'x-amz-server-side-encryption': 'AES256', // Required for server-side encryption
        },
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file content to storage');
      }

      // 3. Mark the upload as complete
      devLog('Marking update as complete');
      const completeResponse = await fetch(`${apiBase()}/files/${fileId}/complete`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!completeResponse.ok) {
        throw new Error('Failed to complete file update');
      }

      // Update last saved time
      const now = new Date();
      setLastSavedTime(now);

      devLog('File saved successfully');
      return true;
    } catch (err: any) {
      console.error('Error saving file:', err);
      setError(err.message || 'Failed to save file');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  // Get file version history
  const getFileVersions = async (fileId: string): Promise<FileVersion[]> => {
    devLog('getFileVersions called with fileId:', fileId);
    setIsLoadingVersions(true);
    setError(null);

    try {
      const token = getToken();
      if (!token) {
        throw new Error('Authentication required. Please log in again.');
      }

      const response = await fetch(`${apiBase()}/files/${fileId}/versions`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get file versions: ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      const versions = data.versions || [];
      setFileVersions(versions);
      return versions;
    } catch (err: any) {
      console.error('Error fetching file versions:', err);
      setError(err.message || 'Failed to fetch file versions');
      return [];
    } finally {
      setIsLoadingVersions(false);
    }
  };

  // Get a specific version of a file
  const getFileVersion = async (
    fileId: string,
    versionId: string
  ): Promise<{ downloadUrl: string; fileName: string; expiresAt: string }> => {
    devLog('getFileVersion called with fileId:', fileId, 'versionId:', versionId);
    setIsLoading(true);
    setError(null);

    try {
      const token = getToken();
      if (!token) {
        throw new Error('Authentication required. Please log in again.');
      }

      const response = await fetch(`${apiBase()}/files/${fileId}/versions/${versionId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get file version: ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      return data;
    } catch (err: any) {
      console.error('Error fetching file version:', err);
      setError(err.message || 'Failed to fetch file version');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Revert to a specific version
  const revertToVersion = async (fileId: string, versionId: string): Promise<boolean> => {
    devLog('revertToVersion called with fileId:', fileId, 'versionId:', versionId);
    setIsLoading(true);
    setError(null);

    try {
      const token = getToken();
      if (!token) {
        throw new Error('Authentication required. Please log in again.');
      }

      const response = await fetch(`${apiBase()}/files/${fileId}/revert/${versionId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to revert to version: ${response.statusText} - ${errorText}`);
      }

      // Update last saved time
      const now = new Date();
      setLastSavedTime(now);

      // Refresh versions
      await getFileVersions(fileId);

      return true;
    } catch (err: any) {
      console.error('Error reverting to version:', err);
      setError(err.message || 'Failed to revert to version');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Set up auto-save functionality
  const setupAutoSave = (
    fileId: string,
    content: any,
    interval: number = 60000, // Default: 1 minute
    enabled: boolean = true
  ): (() => void) => {
    // Clear any existing auto-save timer
    if (autoSaveTimerRef.current) {
      clearInterval(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }

    if (!enabled) {
      devLog('Auto-save disabled');
      return () => {};
    }

    devLog(`Setting up auto-save every ${interval / 1000} seconds`);

    // Set up new auto-save timer
    autoSaveTimerRef.current = setInterval(() => {
      devLog('Auto-save triggered');
      saveFile(fileId, content)
        .then(success => {
          if (success) {
            devLog('Auto-save completed successfully');
          } else {
            console.error('Auto-save failed');
          }
        })
        .catch(err => {
          console.error('Auto-save error:', err);
          // Silent failure for auto-save
        });
    }, interval);

    // Return cleanup function
    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  };

  // Load files when token is available - FIXED TO PREVENT INFINITE LOOP
  useEffect(() => {
    // Only fetch files if we have a token and haven't already done the initial fetch
    const token = getToken();

    if (token && !initialFetchDoneRef.current) {
      initialFetchDoneRef.current = true; // Mark that we've done the initial fetch

      fetchUserFiles().catch(err => {
        console.error('Failed to load initial files:', err);
      });
    }
  }, [fetchUserFiles, getToken]); // Include fetchUserFiles in deps

  // Cleanup auto-save on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, []);

  return {
    // Original functions
    handleFile,
    fetchUserFiles,
    files,
    openFile,
    isLoading,
    error,
    setError,
    uploadProgress,

    // New save and version management functions
    saveFile,
    isSaving,
    lastSavedTime,
    getFileVersions,
    getFileVersion,
    revertToVersion,
    fileVersions,
    isLoadingVersions,
    setupAutoSave,
  };
};
