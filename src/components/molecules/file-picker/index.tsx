import React, { ReactNode, useRef } from 'react';
import { LuFileSpreadsheet, LuUpload } from 'react-icons/lu';
import { useProject } from '@/contexts/project-context';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from '@/components/molecules/dialog';
import { Alert, AlertDescription } from '@/components/atoms/alert';
import { useFileHandler } from '@/hooks/api/use-file';
import { Progress } from '@/components/atoms/progress';

interface FilePickerWrapperProps {
    children: ReactNode;
    onUploadComplete?: (fileId: string) => void;
}

export const FilePickerWrapper = ({ children, onUploadComplete }: FilePickerWrapperProps) => {
    const [open, setOpen] = React.useState(false);
    const { dispatch } = useProject();
    console.log('FilePickerWrapper rendering, dispatch:', !!dispatch);

    const {
        handleFile,
        isLoading,
        error,
        setError,
        uploadProgress
    } = useFileHandler({
        allowedExtensions: ['.csv', '.xlsx', '.xls'],
        onUploadComplete: (fileId) => {
            console.log('Upload complete callback, fileId:', fileId);
            // Close dialog when upload is complete
            setOpen(false);
            if (onUploadComplete) {
                onUploadComplete(fileId);
            }
        }
    });

    return (
        <Dialog open={open} onOpenChange={(newOpen) => {
            console.log('Dialog open state changing to:', newOpen);
            setOpen(newOpen);
        }}>
            <DialogTrigger asChild>
                <div className="cursor-pointer" onClick={() => console.log('Dialog trigger clicked')}>
                    {children}
                </div>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Upload File</DialogTitle>
                </DialogHeader>
                <FilePicker
                    isLoading={isLoading}
                    error={error}
                    setError={setError}
                    uploadProgress={uploadProgress}
                    onFileSelect={(file) => {
                        console.log('File selected in FilePicker:', file.name);
                        return handleFile(file);
                    }}
                />
            </DialogContent>
        </Dialog>
    );
};

interface FilePickerProps {
    isLoading: boolean;
    error: string | null;
    setError: (error: string | null) => void;
    uploadProgress: number;
    onFileSelect: (file: File) => Promise<boolean>;
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
                                                          acceptedFileTypes = ".csv,.xlsx,.xls",
                                                          children
                                                      }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    console.log('FilePicker rendering, isLoading:', isLoading);

    const handleClick = () => {
        console.log('Select file button clicked');
        setError(null);
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        console.log('File input changed, files:', event.target.files?.length);
        const file = event.target.files?.[0];
        if (file) {
            console.log('Calling onFileSelect with file:', file.name);
            try {
                const result = await onFileSelect(file);
                console.log('onFileSelect result:', result);
            } catch (err) {
                console.error('Error in onFileSelect:', err);
            }
        } else {
            console.log('No file selected');
        }

        // Reset the input
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
                    uploadProgress
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
                        {uploadProgress < 100
                            ? "Uploading to secure storage"
                            : "Processing file contents"}
                    </p>
                </div>
            ) : (
                <div
                    className="flex flex-col items-center justify-center py-8 px-4 border-2 border-dashed rounded-lg border-muted-foreground/25 hover:border-muted-foreground/50 transition-colors"
                    onDragOver={(e) => {
                        e.preventDefault();
                        console.log('Drag over');
                    }}
                    onDrop={(e) => {
                        e.preventDefault();
                        console.log('File dropped');
                        const files = e.dataTransfer.files;
                        if (files?.length) {
                            onFileSelect(files[0]);
                        }
                    }}
                >
                    <LuUpload className="h-8 w-8 mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-medium mb-1">Upload a file</h3>
                    <p className="text-sm text-muted-foreground mb-4 text-center">
                        Drag and drop or click to select
                    </p>
                    <button
                        onClick={handleClick}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                    >
                        <LuFileSpreadsheet className="h-4 w-4" />
                        <span>Select File</span>
                    </button>
                    <p className="text-xs text-muted-foreground mt-4">
                        Supports CSV, Excel (.xlsx, .xls)
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
