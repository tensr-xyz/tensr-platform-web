import { useState, useCallback } from 'react';
import { useAuth } from '@/hooks/api/use-auth';
import { useProjectStore } from '@/stores/project-store';
import { ProjectUpload } from '@/types/project';

interface UseProjectFileUploadProps {
  allowedExtensions?: string[];
  onUploadComplete?: (projectId: string) => void;
}

export const useProjectFileUpload = ({
  allowedExtensions = ['.csv', '.xlsx', '.xls'],
  onUploadComplete,
}: UseProjectFileUploadProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const { tokens } = useAuth();
  const { setProject } = useProjectStore();

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

  const getFileTypeFromExtension = (fileName: string): string => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'csv':
        return 'text/csv';
      case 'xlsx':
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      case 'xls':
        return 'application/vnd.ms-excel';
      case 'json':
        return 'application/json';
      default:
        return 'application/octet-stream';
    }
  };

  const uploadFileToS3 = async (
    uploadUrl: string,
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<Response> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', event => {
        if (event.lengthComputable) {
          const progress = (event.loaded / event.total) * 100;
          onProgress?.(progress);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(new Response(xhr.response, { status: xhr.status }));
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Upload failed'));
      });

      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.setRequestHeader('x-amz-server-side-encryption', 'AES256');
      xhr.send(file);
    });
  };

  const uploadFile = useCallback(
    async (file: File): Promise<string | null> => {
      console.log('uploadFile called with file:', file.name, file.size);
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
        const token = tokens?.accessToken;
        if (!token) {
          throw new Error('Authentication required. Please log in again.');
        }

        // Step 1: Create blank project first
        console.log('Creating blank project');
        setUploadProgress(5);

        const projectInfo = {
          projectName: file.name.replace(/\.[^/.]+$/, ''), // Remove extension for project name
          description: `Data file: ${file.name}`,
          sourceType: 'folder',
        };

        const createResponse = await fetch(`${API_BASE_URL}/projects/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(projectInfo),
        });

        if (!createResponse.ok) {
          const errorData = await createResponse.json();
          throw new Error(
            errorData.message || `Failed to create project: ${createResponse.statusText}`
          );
        }

        const projectData = await createResponse.json();
        const projectId = projectData.projectId;
        console.log('Created project with ID:', projectId);

        // Step 2: Get upload URL for the project
        console.log('Getting upload URL for project');
        setUploadProgress(10);

        const fileInfo = {
          files: [
            {
              fileName: file.name,
              fileType: file.type || getFileTypeFromExtension(file.name),
              fileSize: file.size,
            },
          ],
        };

        const uploadResponse = await fetch(`${API_BASE_URL}/projects/${projectId}/upload-url`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(fileInfo),
        });

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json();
          throw new Error(
            errorData.message || `Failed to get upload URL: ${uploadResponse.statusText}`
          );
        }

        const uploadDataArray = await uploadResponse.json();
        console.log('Got upload URL for project:', projectId);

        // Get the first (and only) upload URL from the array
        const uploadData = uploadDataArray[0];
        if (!uploadData || !uploadData.uploadUrl) {
          throw new Error('No upload URL received from server');
        }

        // Step 3: Upload file to S3
        setUploadProgress(15);
        try {
          const s3UploadResponse = await uploadFileToS3(uploadData.uploadUrl, file, progress => {
            // Scale progress to 15-70% range for the upload portion
            setUploadProgress(15 + Math.floor(progress * 0.55));
          });

          if (!s3UploadResponse.ok) {
            throw new Error('Failed to upload file to storage');
          }

          setUploadProgress(70);
          console.log('Upload to S3 successful');

          // Step 4: Confirm file upload (adds file to project)
          setUploadProgress(75);
          const confirmResponse = await fetch(
            `${API_BASE_URL}/projects/${projectId}/confirm-upload`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                fileId: uploadData.fileId,
                fileName: file.name,
                fileType: file.type || getFileTypeFromExtension(file.name),
                fileSize: file.size,
              }),
            }
          );

          if (!confirmResponse.ok) {
            throw new Error('Failed to confirm file upload');
          }

          console.log('File upload confirmed');

          // Step 5: Complete the project upload
          const completeResponse = await fetch(`${API_BASE_URL}/projects/${projectId}/complete`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({}), // No body needed - files already added via confirm-upload
          });

          if (!completeResponse.ok) {
            throw new Error('Failed to complete project upload');
          }

          setUploadProgress(85);
          console.log('Project creation and file upload completed successfully');

          // Update the project store with the new project
          const finalProjectData = await completeResponse.json();
          setProject(finalProjectData);

          // Step 6: Process the file to get schema and metadata
          setUploadProgress(90);
          console.log('Processing file to extract schema...');
          
          const RUST_API_URL = process.env.NEXT_PUBLIC_RUST_API_URL || 'https://api.dev.tensr.xyz';
          try {
            const processResponse = await fetch(
              `${RUST_API_URL}/projects/${projectId}/process`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                  file_index: 0, // Process first file
                }),
              }
            );

            if (processResponse.ok) {
              const processData = await processResponse.json();
              console.log('File processed successfully, schema extracted:', processData);
              
              // TODO: Update project file with schema from processData.column_summaries
              // This could be done via a new endpoint or by updating the project
            } else {
              console.warn('File processing failed, continuing without schema:', processResponse.statusText);
            }
          } catch (processError) {
            console.warn('Failed to process file for schema extraction:', processError);
            // Continue anyway - file is uploaded even if processing fails
          }

          setUploadProgress(100);
          
          // Call the completion callback
          onUploadComplete?.(projectId);

          return projectId;
        } catch (uploadError) {
          console.error('Upload error:', uploadError);
          throw uploadError;
        }
      } catch (error: any) {
        console.error('Error uploading file:', error);
        setError(error.message || 'Failed to upload file');
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [allowedExtensions, tokens, onUploadComplete, setProject]
  );

  return {
    uploadFile,
    isLoading,
    error,
    uploadProgress,
    clearError: () => setError(null),
  };
};
