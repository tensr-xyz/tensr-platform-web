import { useState } from 'react';

export const useFileOperations = (currentPath: string, onRefresh: () => void) => {
  const [error, setError] = useState('');

  const createFile = async (name: string) => {
    try {
      setError('');
      if (!currentPath) throw new Error('No current path selected');

      const sanitizedName = name.trim();
      if (!sanitizedName) throw new Error('Please enter a valid file name');

      const filePath = await path.join(currentPath, sanitizedName);
      if (!filePath) throw new Error('Invalid file path');

      // await invoke('create_file', { path: filePath });
      await onRefresh();
      return true;
    } catch (error: any) {
      setError(error?.message || 'Failed to create file');
      return false;
    }
  };

  const createFolder = async (name: string) => {
    try {
      setError('');
      if (!currentPath) throw new Error('No current path selected');

      const sanitizedName = name.trim();
      if (!sanitizedName) throw new Error('Please enter a valid folder name');

      const folderPath = await path.join(currentPath, sanitizedName);
      if (!folderPath) throw new Error('Invalid folder path');

      // await invoke('create_directory', { path: folderPath });
      await onRefresh();
      return true;
    } catch (error: any) {
      setError(error?.message || 'Failed to create folder');
      return false;
    }
  };

  return { createFile, createFolder, error };
};
