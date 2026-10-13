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
import { ACCEPTED_UPLOAD_ACCEPT } from '@/lib/accepted-upload-types';
import type { UploadScope } from '@/lib/upload-dataset';

interface DatasetFilePickerProps {
  children?: ReactNode;
  /** Called after a successful tensr-api dataset upload */
  onUploaded?: (datasetId: string, fileName: string) => void;
  scope?: UploadScope;
  /** Controlled open state — use to open the picker from template buttons, etc. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function DatasetFilePicker({
  children,
  onUploaded,
  scope = 'workspace',
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

  const { uploadFile, isLoading, error, clearError, uploadProgress, workbook } = useDatasetUpload(
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
          acceptedFileTypes={ACCEPTED_UPLOAD_ACCEPT}
          onFileSelect={file => uploadFile(file)}
        />
        {workbook && workbook.sheets.length > 1 ? (
          <div className="space-y-2 text-sm">
            <p>
              Opened <span className="font-medium">{workbook.selected}</span>. This workbook has
              more than one sheet.
            </p>
            <div className="flex flex-wrap gap-2">
              {workbook.sheets.map(name => (
                <button
                  key={name}
                  type="button"
                  className="rounded-md border border-border px-2 py-1 text-xs hover:border-primary"
                  disabled={isLoading}
                  onClick={() => {
                    if (name === workbook.selected) {
                      setOpen(false);
                      onUploaded?.(workbook.datasetId, workbook.file.name);
                      return;
                    }
                    void uploadFile(workbook.file, name);
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
