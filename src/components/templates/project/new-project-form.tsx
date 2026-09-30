'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, Upload } from 'lucide-react';
import { useCallback, useState } from 'react';

import { Button } from '@/components/atoms/button';
import { useDatasetUpload } from '@/hooks/api/use-dataset-upload';
import { ACCEPTED_UPLOAD_ACCEPT, ACCEPTED_UPLOAD_HELP } from '@/lib/accepted-upload-types';
import posthog from 'posthog-js';

/** A dataset starts from a file: tensr-api has no endpoint for an empty one. */
export default function NewProjectForm() {
  const router = useRouter();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const openDataset = useCallback(
    (datasetId: string, fileName: string) => {
      router.push(`/workspace/dataset/${datasetId}?name=${encodeURIComponent(fileName)}`);
    },
    [router]
  );
  const { uploadFile, isLoading, error } = useDatasetUpload('workspace', openDataset);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedFile) return;
    posthog.capture('project_created', {
      source_type: 'file_upload',
      file_type: selectedFile.name.split('.').pop(),
    });
    try {
      await uploadFile(selectedFile);
    } catch (err) {
      posthog.captureException(err);
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-row items-center justify-between">
        <h1 className="text-2xl font-bold">New dataset</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="new-dataset-file" className="text-sm font-medium">
            Data file
          </label>
          <input
            id="new-dataset-file"
            type="file"
            accept={ACCEPTED_UPLOAD_ACCEPT}
            onChange={event => setSelectedFile(event.target.files?.[0] ?? null)}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          <p className="text-sm text-muted-foreground">{ACCEPTED_UPLOAD_HELP}</p>
          {selectedFile && (
            <p className="text-sm text-gray-600">
              Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
            </p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="pt-4 flex justify-between">
          <Button type="button" variant="outline" onClick={() => router.push('/dashboard')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button type="submit" disabled={!selectedFile || isLoading}>
            <Upload className="h-4 w-4 mr-2" />
            {isLoading ? 'Uploading...' : 'Upload and open'}
          </Button>
        </div>
      </form>
    </div>
  );
}
