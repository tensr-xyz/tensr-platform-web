'use client';

import React, { ReactNode, useState } from 'react';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/molecules/dialog';
import { FilePicker } from '@/components/molecules/file-picker/file-picker';
import { useDatasetUpload } from '@/hooks/api/use-dataset-upload';

interface DatasetFilePickerProps {
  children: ReactNode;
  /** Called after a successful tensr-api dataset upload */
  onUploaded?: (datasetId: string, fileName: string) => void;
  scope?: 'personal' | 'team';
}

export function DatasetFilePicker({
  children,
  onUploaded,
  scope = 'personal',
}: DatasetFilePickerProps) {
  const [open, setOpen] = useState(false);

  const { uploadFile, isLoading, error, clearError, uploadProgress } = useDatasetUpload(
    scope,
    (datasetId, fileName) => {
      setOpen(false);
      onUploaded?.(datasetId, fileName);
    }
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <div className="cursor-pointer">{children}</div>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload a file</DialogTitle>
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
}
