import { useState } from 'react';
import { getIdToken } from '@/utils/auth';
import { useProjectStore } from '@/stores/project-store';
import { useAuthStore } from '@/stores/auth-store';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

// Updated type definition to accept a function that returns Promise<void>
export const useFileOperations = (currentPath: string, onRefresh: () => Promise<void>) => {
  const [error, setError] = useState('');
  const { currentProject } = useProjectStore();
  const { tokens } = useAuthStore();

  const createFile = async (name: string): Promise<boolean> => {
    try {
      setError('');
      if (!currentProject?.id) {
        throw new Error('No active project');
      }

      const sanitizedName = name.trim();
      if (!sanitizedName) {
        throw new Error('Please enter a valid file name');
      }

      // Construct the file path relative to current directory
      const filePath = currentPath
        ? `${currentPath}${currentPath.endsWith('/') ? '' : '/'}${sanitizedName}`
        : sanitizedName;

      console.log(`Creating file: ${filePath} in project ${currentProject.projectId}`);

      // Call the project update API
      const response = await fetch(`${API_BASE_URL}/projects/${currentProject.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getIdToken()}`,
        },
        body: JSON.stringify({
          structureOperation: {
            type: 'createFile',
            path: filePath,
            content: '', // Empty file by default
          },
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create file');
      }

      console.log('File created successfully');

      // Refresh the file system after successful creation
      await onRefresh();
      return true;
    } catch (error: any) {
      console.error('Error creating file:', error);
      setError(error?.message || 'Failed to create file');
      return false;
    }
  };

  const createFolder = async (name: string): Promise<boolean> => {
    try {
      setError('');
      if (!currentProject?.id) {
        throw new Error('No active project');
      }

      const sanitizedName = name.trim();
      if (!sanitizedName) {
        throw new Error('Please enter a valid folder name');
      }

      // Construct the folder path relative to current directory
      const folderPath = currentPath
        ? `${currentPath}${currentPath.endsWith('/') ? '' : '/'}${sanitizedName}`
        : sanitizedName;

      console.log(`Creating folder: ${folderPath} in project ${currentProject.projectId}`);

      // Call the project update API
      const response = await fetch(`${API_BASE_URL}/projects/${currentProject.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getIdToken()}`,
        },
        body: JSON.stringify({
          structureOperation: {
            type: 'createFolder',
            path: folderPath,
          },
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create folder');
      }

      console.log('Folder created successfully');

      // Refresh the file system after successful creation
      await onRefresh();
      return true;
    } catch (error: any) {
      console.error('Error creating folder:', error);
      setError(error?.message || 'Failed to create folder');
      return false;
    }
  };

  return { createFile, createFolder, error };
};
