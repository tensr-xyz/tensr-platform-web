'use client';

import React, { ReactNode, useState } from 'react';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/molecules/dialog';
import { useProjectFileUpload } from '@/hooks/api/use-project-file-upload';
import { FilePicker } from './file-picker';

interface FilePickerWrapperProps {
  children: ReactNode;
  onUploadComplete?: (projectId: string) => void;
}

export const FilePickerWrapper = ({ children, onUploadComplete }: FilePickerWrapperProps) => {
  const [open, setOpen] = useState(false);

  const { uploadFile, isLoading, error, clearError, uploadProgress } = useProjectFileUpload({
    allowedExtensions: ['.csv', '.xlsx', '.xls'],
    onUploadComplete: projectId => {
      setOpen(false);
      onUploadComplete?.(projectId);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <div className="cursor-pointer">{children}</div>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload File</DialogTitle>
        </DialogHeader>
        <FilePicker
          isLoading={isLoading}
          error={error}
          setError={clearError}
          uploadProgress={uploadProgress}
          onFileSelect={file => uploadFile(file)}
        />
      </DialogContent>
    </Dialog>
  );
};
