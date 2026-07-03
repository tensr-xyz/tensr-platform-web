'use client';

import React, { useRef } from 'react';
import { FileSpreadsheet, Upload } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/atoms/alert';
import { Progress } from '@/components/atoms/progress';

export const MAX_FILE_SIZE = 100 * 1024 * 1024;

export interface FilePickerProps {
  isLoading: boolean;
  error: string | null;
  setError: () => void;
  uploadProgress: number;
  onFileSelect: (file: File) => Promise<string | null>;
  acceptedFileTypes?: string;
  children?: (props: {
    onClick: () => void;
    isLoading: boolean;
    error: string | null;
    uploadProgress: number;
  }) => React.ReactNode;
}

export const FilePicker: React.FC<FilePickerProps> = ({
  isLoading,
  error,
  setError,
  uploadProgress,
  onFileSelect,
  acceptedFileTypes = '.csv,.xlsx,.xls',
  children,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    setError();
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > MAX_FILE_SIZE) {
        setError();
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      }

      try {
        await onFileSelect(file);
      } catch (err) {
        console.error('Error in onFileSelect:', err);
      }
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (children) {
    return (
      <>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept={acceptedFileTypes}
          className="hidden"
        />
        {children({
          onClick: handleClick,
          isLoading,
          error,
          uploadProgress,
        })}
      </>
    );
  }

  return (
    <div className="space-y-4">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept={acceptedFileTypes}
        className="hidden"
      />

      {isLoading ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Uploading...</span>
            <span className="text-sm font-medium">{uploadProgress}%</span>
          </div>
          <Progress value={uploadProgress} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {uploadProgress < 100 ? 'Uploading to secure storage' : 'Processing file contents'}
          </p>
        </div>
      ) : (
        <div
          className="flex flex-col items-center justify-center py-8 px-4 border-2 border-dashed rounded-lg border-muted-foreground/25 hover:border-muted-foreground/50 transition-colors"
          onDragOver={e => {
            e.preventDefault();
          }}
          onDrop={e => {
            e.preventDefault();
            const files = e.dataTransfer.files;
            if (files?.length) {
              const file = files[0];

              if (file.size > MAX_FILE_SIZE) {
                setError();
                return;
              }

              onFileSelect(file);
            }
          }}
        >
          <Upload className="h-8 w-8 mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-1">Upload a file</h3>
          <p className="text-sm text-muted-foreground mb-4 text-center">
            Drag and drop or click to select
          </p>
          <button
            type="button"
            onClick={handleClick}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>Select File</span>
          </button>
          <p className="text-xs text-muted-foreground mt-4">
            Supports CSV, Excel (.xlsx, .xls) • Max size: 100MB
          </p>
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
};
