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
  children?: ReactNode;
  /** Called after a successful tensr-api dataset upload */
  onUploaded?: (datasetId: string, fileName: string) => void;
  scope?: 'personal' | 'team';
  /** Controlled open state — use to open the picker from template buttons, etc. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function DatasetFilePicker({
  children,
  onUploaded,
  scope = 'personal',
  open: controlledOpen,
  onOpenChange,
}: DatasetFilePickerProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const setOpen = (next: boolean) => {
    if (!isControlled) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };

  const { uploadFile, isLoading, error, clearError, uploadProgress } = useDatasetUpload(
    scope,
    (datasetId, fileName) => {
      setOpen(false);
      onUploaded?.(datasetId, fileName);
    }
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children ? (
        <DialogTrigger asChild>
          <div className="cursor-pointer">{children}</div>
        </DialogTrigger>
      ) : null}
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
