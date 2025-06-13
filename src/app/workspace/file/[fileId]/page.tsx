'use client';

import { useParams } from 'next/navigation';
import { useAuth } from '@/hooks/api/use-auth';
import { useFileHandler } from '@/hooks/api/use-file';
import Workspace, { WorkspaceResource } from '@/components/templates/workspace';
import { useCallback, useState, useEffect, useRef } from 'react';
import { ImportData } from '@/types/file';

export default function FileWorkspacePage() {
  const params = useParams();
  const fileId = params.fileId as string;
  const { user, tokens } = useAuth();
  const { fetchUserFiles } = useFileHandler({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debug, setDebug] = useState<string[]>([]);

  // Use a ref to prevent infinite re-renders
  const processingRef = useRef(false);

  // Log debug messages to both state and console - without creating dependency chains
  const logDebug = useCallback((message: string) => {
    console.log(`[DEBUG] ${message}`);
    // Use function form to avoid dependency on previous state
    setDebug(prev => [...prev, message]);
  }, []);

  useEffect(() => {
    logDebug(`Component mounted with fileId: ${fileId}`);
    // This will help confirm the component is mounting with the correct fileId
  }, [fileId, logDebug]);

  // Get token function that doesn't call logDebug (breaking the cycle)
  const getToken = useCallback((): string => {
    if (tokens?.accessToken) {
      return tokens.accessToken;
    }
    // Just log to console instead of using logDebug
    console.log('No access token available');
    return '';
  }, [tokens?.accessToken]);

  // Set up the resource
  const resource: WorkspaceResource = {
    id: fileId,
    name: '', // Will be populated from file info
    path: '', // Will be populated from file info
    type: 'file',
  };

  // Define the data processing function for files
  const processFileData = useCallback(
    async (resource: WorkspaceResource) => {
      // Prevent duplicate processing
      if (processingRef.current) {
        console.log('Already processing - skipping duplicate call');
        return { importData: null, showImportWizard: false };
      }

      logDebug(`processFileData called with resource id: ${resource.id}`);
      setIsProcessing(true);
      setError(null);
      processingRef.current = true;

      try {
        // Fetch file metadata
        logDebug('Fetching user files...');
        const files = await fetchUserFiles();
        logDebug(`Found ${files.length} files`);

        const fileInfo = files.find(file => file.fileId === resource.id);

        if (!fileInfo) {
          const errorMsg = `File with ID ${resource.id} not found`;
          logDebug(errorMsg);
          throw new Error(errorMsg);
        }

        logDebug(`Found file: ${fileInfo.fileName} (ID: ${fileInfo.fileId})`);

        // Update resource with file info
        resource.name = fileInfo.fileName;
        resource.path = fileInfo.fileName;

        // Process the file through backend
        const processUrl = `${process.env.NEXT_PUBLIC_FARGATE_API_URL}/api/files/${fileInfo.fileId}/process`;
        logDebug(`Making API request to: ${processUrl}`);

        const token = getToken();
        logDebug(`Token available: ${token ? 'Yes' : 'No'}`);

        const requestBody = {
          userId: user?.userId,
          fileName: fileInfo.fileName,
          fileType: fileInfo.fileName.split('.').pop()?.toLowerCase(),
          token: token,
        };

        logDebug(`Request body: ${JSON.stringify(requestBody)}`);

        const apiResponse = await fetch(processUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        logDebug(`API response status: ${apiResponse.status}`);

        if (!apiResponse.ok) {
          const errorText = await apiResponse.text();
          const errorMsg = `Backend processing failed: ${errorText || apiResponse.statusText}`;
          logDebug(errorMsg);
          throw new Error(errorMsg);
        }

        const processResult = await apiResponse.json();
        logDebug('Successfully received response from backend');

        // Log the structure of processResult to help debug
        logDebug(`Response structure: ${JSON.stringify(Object.keys(processResult))}`);
        if (processResult.metadata) {
          logDebug(`Metadata structure: ${JSON.stringify(Object.keys(processResult.metadata))}`);
        } else {
          logDebug('Warning: No metadata in response');
        }

        // Prepare import data that matches the format expected by ImportWizard
        const importData: ImportData = {
          fileName: fileInfo.fileName,
          filePath: fileInfo.fileId, // Use fileId as path for API requests
          fileId: fileInfo.fileId,
          preview: processResult.metadata?.preview || [],
          columnNames: processResult.metadata?.column_names || [],
          totalRows: processResult.metadata?.rows || 0,
          totalColumns: processResult.metadata?.columns || 0,
          columnSummaries: processResult.column_summaries || {},
        };

        logDebug(
          `Import data prepared: ${importData.columnNames.length} columns, ${importData.totalRows} rows`
        );

        return {
          importData,
          showImportWizard: true,
        };
      } catch (err: any) {
        const errorMsg = err.message || 'Failed to process file';
        console.error('Error processing file:', err);
        setError(errorMsg);
        logDebug(`Error: ${errorMsg}`);
        // Return a minimal object to prevent further errors
        return {
          importData: null,
          showImportWizard: false,
        };
      } finally {
        setIsProcessing(false);
        processingRef.current = false;
        logDebug('Processing completed');
      }
    },
    [fileId, fetchUserFiles, getToken, logDebug, user?.userId]
  );

  return <Workspace resource={resource} processData={processFileData} />;
}
