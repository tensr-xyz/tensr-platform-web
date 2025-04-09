import {useEffect, useState} from 'react';
import { useAuth } from '@/hooks/api/use-auth';
import { FileUpload, FileData } from '@/types/file';
import { ProjectActions } from "@/contexts/project-context/types";
import { useProject } from '@/contexts/project-context';

// API base URL - should be configured via environment variable
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://t8ioaf6fl9.execute-api.us-east-1.amazonaws.com';

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

// S3 file service interface
interface FileService {
    getUploadUrl: (userId: string, fileInfo: {
        fileName: string;
        fileType: string;
        fileSize: number
    }) => Promise<FileUpload>;
    completeUpload: (userId: string, fileId: string) => Promise<any>;
    getUserFiles: (userId: string) => Promise<FileMetadata[]>;
}

export const useFileHandler = ({
                                   allowedExtensions = ['.csv', '.xlsx', '.xls'],
                                   onUploadComplete
                               }: UseFileHandlerProps) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [files, setFiles] = useState<FileMetadata[]>([]);
    const auth = useAuth();
    const { user } = auth;
    const { state: projectState, dispatch } = useProject();

    // Add debugging effect to monitor context updates
    useEffect(() => {
        console.log('Project state changed:', {
            showImportWizard: projectState.showImportWizard,
            hasImportData: !!projectState.importData,
            currentProject: projectState.currentProject?.id
        });
    }, [projectState.showImportWizard, projectState.importData, projectState.currentProject]);

    // Helper function to get access token from auth context
    const getTokenFromAuth = (): string => {
        if (auth.tokens?.accessToken) {
            return auth.tokens.accessToken;
        }
        return '';
    };

    // S3 file service implementation
    const fileService: FileService = {
        getUploadUrl: async (userId, fileInfo) => {
            try {
                console.log('Getting upload URL for file:', fileInfo.fileName);
                const token = getTokenFromAuth();
                const response = await fetch(`${API_BASE_URL}/files/upload-url`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(fileInfo)
                });

                if (!response.ok) {
                    throw new Error(`Failed to get upload URL: ${response.statusText}`);
                }

                return response.json();
            } catch (error) {
                console.error('Error getting upload URL:', error);
                throw error;
            }
        },

        completeUpload: async (userId, fileId) => {
            try {
                console.log('Completing upload for fileId:', fileId);
                const token = getTokenFromAuth();
                const response = await fetch(`${API_BASE_URL}/files/${fileId}/complete`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!response.ok) {
                    throw new Error(`Failed to complete upload: ${response.statusText}`);
                }

                return response.json();
            } catch (error) {
                console.error('Error completing upload:', error);
                throw error;
            }
        },

        getUserFiles: async (userId) => {
            try {
                console.log('Fetching files for user:', userId);
                const token = getTokenFromAuth();
                const response = await fetch(`${API_BASE_URL}/files`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!response.ok) {
                    throw new Error(`Failed to get files: ${response.statusText}`);
                }

                const data = await response.json();
                return data.files;
            } catch (error) {
                console.error('Error getting user files:', error);
                throw error;
            }
        }
    };

    // Function to fetch user's files
    const fetchUserFiles = async (): Promise<FileMetadata[]> => {
        try {
            setIsLoading(true);
            setError(null);

            if (!user?.userId) {
                throw new Error('User not authenticated');
            }

            const userFiles = await fileService.getUserFiles(user.userId);
            setFiles(userFiles);
            return userFiles;
        } catch (err: any) {
            console.error('Error fetching files:', err);
            setError(err.message || 'Failed to fetch files');
            return [];
        } finally {
            setIsLoading(false);
        }
    };

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

            if (!fileExtension || !allowedExtensions?.map(ext => ext.replace('.', '')).includes(fileExtension)) {
                console.error('Unsupported file type:', fileExtension);
                throw new Error('Unsupported file type. Please select a CSV or Excel file.');
            }

            // Step 1: Get pre-signed URL for S3 upload
            console.log('Getting pre-signed URL for S3 upload');
            setUploadProgress(5);
            const fileInfo = {
                fileName: file.name,
                fileType: file.type || getFileTypeFromExtension(file.name),
                fileSize: file.size
            };

            const uploadData = await fileService.getUploadUrl(user.userId, fileInfo);
            console.log('Got presigned URL for fileId:', uploadData.fileId);

            // Step 2: Upload directly to S3 using presigned URL
            setUploadProgress(10);
            try {
                const uploadResponse = await uploadFileToS3(uploadData.uploadUrl, file, (progress) => {
                    // Scale progress to 0-60% range for the upload portion
                    setUploadProgress(10 + Math.floor(progress * 0.5));
                });

                if (!uploadResponse.ok) {
                    throw new Error('Failed to upload file to storage');
                }

                setUploadProgress(60);
                console.log('Upload to S3 successful');

                // Step 3: Mark upload as complete
                await fileService.completeUpload(user?.userId, uploadData.fileId);
                setUploadProgress(70);
                console.log('Marked upload as complete');
            } catch (uploadError) {
                console.error('S3 upload failed:', uploadError);
                throw new Error(`Failed to upload file: ${uploadError.message}`);
            }

            // Step 4: Process the file via backend service
            console.log('Processing file through Rust backend');
            const processUrl = `http://localhost:8080/api/files/${uploadData.fileId}/process`;
            console.log('Processing URL:', processUrl);

            try {
                const apiResponse = await fetch(processUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${getTokenFromAuth()}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        userId: user.userId,
                        fileName: fileName,
                        fileType: fileExtension,
                        token: getTokenFromAuth()  // Add this line
                    })
                });

                if (!apiResponse.ok) {
                    const errorText = await apiResponse.text();
                    console.error('Process API error:', errorText);
                    throw new Error(`Failed to process file: ${errorText || apiResponse.statusText}`);
                }

                setUploadProgress(90);
                console.log('File processed by backend');

                // Parse the response
                const data: FileData = await apiResponse.json();
                console.log('Received processed data:', {
                    columns: data.metadata?.column_names?.length,
                    rows: data.metadata?.rows
                });

                if (!data.metadata?.column_names?.length) {
                    throw new Error('No data found in file');
                }

                setUploadProgress(100);

                // Update project context
                console.log('Updating project context');
                updateProjectContext(fileName, data, uploadData.fileId);

                // Refresh the files list
                await fetchUserFiles();

                // Notify caller of completion
                if (onUploadComplete) {
                    console.log('Calling onUploadComplete with fileId:', uploadData.fileId);
                    onUploadComplete(uploadData.fileId);
                }
            } catch (processError) {
                console.error('Error processing file:', processError);
                throw new Error(`Failed to process file: ${processError.message}`);
            }

            return true;
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

            xhr.upload.addEventListener('progress', (event) => {
                if (event.lengthComputable && onProgress) {
                    const percentComplete = Math.round((event.loaded / event.total) * 100);
                    console.log('Upload progress:', percentComplete);
                    onProgress(percentComplete);
                }
            });

            xhr.addEventListener('load', () => {
                console.log('Upload completed with status:', xhr.status);
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve(new Response(null, {
                        status: xhr.status,
                        statusText: xhr.statusText,
                        headers: new Headers({
                            'ETag': xhr.getResponseHeader('ETag') || ''
                        })
                    }));
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

    // Helper function to update project context
    const updateProjectContext = (fileName: string, data: FileData, fileId: string) => {
        console.log('updateProjectContext called with:', { fileName, fileId });

        // Create base project
        const project = {
            id: fileId,
            name: fileName,
            path: fileName, // Using filename instead of path for web
            type: 'file' as const,
        };

        // Update project context
        console.log('Dispatching SET_PROJECT');
        dispatch({ type: ProjectActions.SET_PROJECT, payload: project });

        // Set import data
        const importData = {
            fileName,
            filePath: fileName,
            fileId,
            preview: data.metadata.preview,
            columnNames: data.metadata.column_names,
            totalRows: data.metadata.rows,
            totalColumns: data.metadata.columns,
            columnSummaries: data.column_summaries || null,
            detectedDelimiter: data.metadata.detected_delimiter || null, // Added this field
        };

        console.log('Dispatching SET_IMPORT_DATA with:', {
            columns: importData.columnNames.length,
            rows: importData.totalRows
        });

        dispatch({
            type: ProjectActions.SET_IMPORT_DATA,
            payload: importData,
        });

        console.log('Dispatching SET_SHOW_IMPORT_WIZARD');
        dispatch({
            type: ProjectActions.SET_SHOW_IMPORT_WIZARD,
            payload: true,
        });
    };

    // Utility functions
    const getFileExtension = (filename: string): string => {
        return filename.slice(((filename.lastIndexOf('.') - 1) >>> 0) + 2);
    };

    const getFileTypeFromExtension = (filename: string): string => {
        const extension = getFileExtension(filename).toLowerCase();
        const mimeTypes: Record<string, string> = {
            'csv': 'text/csv',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'xls': 'application/vnd.ms-excel'
        };

        return mimeTypes[extension] || 'application/octet-stream';
    };

    const openFile = async (fileId: string): Promise<boolean> => {
        console.log('openFile called with fileId:', fileId);
        setIsLoading(true);
        setError(null);

        try {
            // First, ensure we have the file metadata
            const fileList = await fetchUserFiles();
            const fileInfo = fileList.find(file => file.fileId === fileId);

            if (!fileInfo) {
                throw new Error(`File with ID ${fileId} not found`);
            }

            console.log('Found file in user files:', fileInfo.fileName);

            // Process the file through Rust backend directly (no more client-side download)
            console.log('Processing file through backend directly from S3');
            const processUrl = `http://localhost:8080/api/files/${fileId}/process`;

            const apiResponse = await fetch(processUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${getTokenFromAuth()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userId: user.userId,
                    fileName: fileInfo.fileName,
                    fileType: fileInfo.fileName.split('.').pop()?.toLowerCase(),
                    token: getTokenFromAuth()  // Add token for the Rust backend to use
                })
            });

            if (!apiResponse.ok) {
                const errorText = await apiResponse.text();
                throw new Error(`Backend processing failed: ${errorText || apiResponse.statusText}`);
            }

            const processResult = await apiResponse.json();
            console.log('File processed by backend');

            // Update project context with the result
            const importData = {
                fileName: fileInfo.fileName,
                filePath: fileInfo.fileName,
                fileId,
                preview: processResult.metadata.preview,
                columnNames: processResult.metadata.column_names,
                totalRows: processResult.metadata.rows,
                totalColumns: processResult.metadata.columns,
                columnSummaries: processResult.column_summaries || null,
                detectedDelimiter: processResult.metadata.detected_delimiter || ","
            };

            // Create base project
            const project = {
                id: fileId,
                name: fileInfo.fileName, // Use fileInfo.fileName
                path: fileInfo.fileName, // Use fileInfo.fileName
                type: 'file' as const,
            };

            // Update project context
            console.log('Dispatching SET_PROJECT');
            dispatch({ type: ProjectActions.SET_PROJECT, payload: project });

            console.log('Dispatching SET_IMPORT_DATA with:', {
                columns: importData.columnNames.length,
                rows: importData.totalRows
            });

            dispatch({
                type: ProjectActions.SET_IMPORT_DATA,
                payload: importData,
            });

            console.log('Dispatching SET_SHOW_IMPORT_WIZARD');
            dispatch({
                type: ProjectActions.SET_SHOW_IMPORT_WIZARD,
                payload: true,
            });

            return true;
        } catch (err: any) {
            console.error('Error opening file:', err);
            setError(err.message || 'Failed to open file');
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    // Load files when the component first mounts
    useEffect(() => {
        if (user?.userId) {
            fetchUserFiles().catch(err => {
                console.error('Failed to load initial files:', err);
            });
        }
    }, [user?.userId]);

    return {
        handleFile,
        fetchUserFiles,
        files,
        openFile,
        isLoading,
        error,
        setError,
        uploadProgress
    };
};
