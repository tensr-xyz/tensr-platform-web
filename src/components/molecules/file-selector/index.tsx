'use client';

import React from 'react';
import { Button } from '@/components/atoms/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/molecules/dialog';

export interface ProjectFile {
  path: string;
  type: string;
  size: number;
}

export interface FileSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onFileSelect: (fileIndex: number) => void;
  projectName: string;
  files: ProjectFile[];
}

export const FileSelector: React.FC<FileSelectorProps> = ({
  isOpen,
  onClose,
  onFileSelect,
  projectName,
  files,
}) => {
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileType: string): string => {
    if (fileType.includes('csv') || fileType.includes('text/csv')) {
      return '📊';
    } else if (fileType.includes('excel') || fileType.includes('spreadsheet')) {
      return '📈';
    } else if (fileType.includes('json')) {
      return '📋';
    } else if (fileType.includes('xml')) {
      return '📄';
    } else {
      return '📁';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Select File to Import</DialogTitle>
          <p className="text-sm text-gray-600">
            Project: <span className="font-medium">{projectName}</span>
          </p>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            This project contains {files.length} file{files.length !== 1 ? 's' : ''}. Please select
            which file you'd like to import and analyze.
          </p>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {files.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => onFileSelect(index)}
              >
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{getFileIcon(file.type)}</span>
                  <div>
                    <p className="font-medium text-gray-900">{file.path}</p>
                    <p className="text-sm text-gray-500">
                      {file.type} • {formatFileSize(file.size)}
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm">
                  Select
                </Button>
              </div>
            ))}
          </div>

          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
