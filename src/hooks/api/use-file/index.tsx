import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/api/use-auth';

import { useProjectStore } from '@/stores/project-store';
import { getIdToken } from '@/utils/auth';

// API base URL - should be configured via environment variable
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

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
    // First try to get from auth context
    if (auth.tokens?.accessToken) {
      return auth.tokens.accessToken;
    }

    // Fallback to localStorage directly
    const token = localStorage.getItem('access_token');
    return token || '';
  }, [auth.tokens]);

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

      const response = await fetch(`${API_BASE_URL}/files`, {
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
      const userFiles = data.files || [];
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
    console.log('handleFile called with file:', file.name, file.size);
    setIsLoading(true);
    setError(null);
    setUploadProgress(0);

    try {
      const fileName = file.name;
      const fileExtension = fileName.split('.').pop()?.toLowerCase();
      console.log('File extension:', fileExtension);

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

      // Step 1: Get pre-signed URL for S3 upload
      console.log('Getting pre-signed URL for S3 upload');
      setUploadProgress(5);
      const fileInfo = {
        fileName: file.name,
        fileType: file.type || getFileTypeFromExtension(file.name),
        fileSize: file.size,
      };

      // Get upload URL
      const response = await fetch(`${API_BASE_URL}/files/upload-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(fileInfo),
      });

      if (!response.ok) {
        throw new Error(`Failed to get upload URL: ${response.statusText}`);
      }

      const uploadData = await response.json();
      console.log('Got presigned URL for fileId:', uploadData.fileId);

      // Step 2: Upload directly to S3 using presigned URL
      setUploadProgress(10);
      try {
        const uploadResponse = await uploadFileToS3(uploadData.uploadUrl, file, progress => {
          // Scale progress to 0-60% range for the upload portion
          setUploadProgress(10 + Math.floor(progress * 0.5));
        });

        if (!uploadResponse.ok) {
          throw new Error('Failed to upload file to storage');
        }

        setUploadProgress(60);
        console.log('Upload to S3 successful');

        // Step 3: Mark upload as complete
        const completeResponse = await fetch(
          `${API_BASE_URL}/files/${uploadData.fileId}/complete`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!completeResponse.ok) {
          throw new Error('Failed to complete upload');
        }

        setUploadProgress(100);
        console.log('Marked upload as complete');

        // Refresh the files list
        await fetchUserFiles();

        // Notify caller of completion
        if (onUploadComplete) {
          console.log('Calling onUploadComplete with fileId:', uploadData.fileId);
          onUploadComplete(uploadData.fileId);
        }

        return true;
      } catch (uploadError: any) {
        console.error('S3 upload failed:', uploadError);
        throw new Error(`Failed to upload file: ${uploadError.message}`);
      }
    } catch (err: any) {
      console.error('File upload/processing error:', err);
      setError(err.message || 'Failed to upload file');
      return false;
    } finally {
      console.log('Setting isLoading to false');
      setIsLoading(false);
    }
  };

  // Helper function to upload file to S3 with progress tracking
  const uploadFileToS3 = async (
    presignedUrl: string,
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<Response> => {
    console.log('uploadFileToS3 called with AES256 encryption header');
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', event => {
        if (event.lengthComputable && onProgress) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          console.log('Upload progress:', percentComplete);
          onProgress(percentComplete);
        }
      });

      xhr.addEventListener('load', () => {
        console.log('Upload completed with status:', xhr.status);
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
        console.log('Starting S3 upload with AES256 encryption header');
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
    console.log('openFile called with fileId:', fileId);
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

      console.log('Found file in user files:', fileInfo.fileName);

      // Create minimal project context with the file info
      const project = {
        id: fileId,
        name: fileInfo.fileName,
        path: fileInfo.fileName,
        type: 'file' as const,
      };

      // Update project context
      console.log('Setting project in store');
      setProject(project);

      // Create minimal import data
      const importData = {
        fileName: fileInfo.fileName,
        filePath: fileInfo.fileName,
        fileId,
        preview: [], // No preview without backend processing
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
    console.log('saveFile called with fileId:', fileId);
    setIsSaving(true);
    setError(null);

    try {
      const token = getToken();
      if (!token) {
        throw new Error('Authentication required. Please log in again.');
      }

      // 1. Get a pre-signed URL for updating the file
      console.log('Getting pre-signed URL for file update');
      const fileSize = new Blob([JSON.stringify(content)]).size;

      const updateResponse = await fetch(`${API_BASE_URL}/files/${fileId}/update-url`, {
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
      console.log('Got presigned URL for updating fileId:', fileId);

      // 2. Upload content to S3
      console.log('Uploading file content to S3');
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
      console.log('Marking update as complete');
      const completeResponse = await fetch(`${API_BASE_URL}/files/${fileId}/complete`, {
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

      console.log('File saved successfully');
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
    console.log('getFileVersions called with fileId:', fileId);
    setIsLoadingVersions(true);
    setError(null);

    try {
      const token = getToken();
      if (!token) {
        throw new Error('Authentication required. Please log in again.');
      }

      const response = await fetch(`${API_BASE_URL}/files/${fileId}/versions`, {
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
    console.log('getFileVersion called with fileId:', fileId, 'versionId:', versionId);
    setIsLoading(true);
    setError(null);

    try {
      const token = getToken();
      if (!token) {
        throw new Error('Authentication required. Please log in again.');
      }

      const response = await fetch(`${API_BASE_URL}/files/${fileId}/versions/${versionId}`, {
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
    console.log('revertToVersion called with fileId:', fileId, 'versionId:', versionId);
    setIsLoading(true);
    setError(null);

    try {
      const token = getToken();
      if (!token) {
        throw new Error('Authentication required. Please log in again.');
      }

      const response = await fetch(`${API_BASE_URL}/files/${fileId}/revert/${versionId}`, {
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
      console.log('Auto-save disabled');
      return () => {};
    }

    console.log(`Setting up auto-save every ${interval / 1000} seconds`);

    // Set up new auto-save timer
    autoSaveTimerRef.current = setInterval(() => {
      console.log('Auto-save triggered');
      saveFile(fileId, content)
        .then(success => {
          if (success) {
            console.log('Auto-save completed successfully');
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
