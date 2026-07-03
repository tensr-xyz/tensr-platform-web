import { tensrApiUrl } from '@/lib/tensr-api-url';
import { handleUnauthorizedResponse } from '@/lib/session-expired';

export type DatasetUploadResult = {
  dataset_id: string;
  [key: string]: unknown;
};

/** Presigned S3 upload when bucket is configured; direct POST for local dev only. */
export async function uploadDatasetFile(
  file: File,
  token: string,
  scope: 'personal' | 'team',
  onProgress?: (pct: number) => void
): Promise<DatasetUploadResult> {
  const fileName = file.name;
  onProgress?.(5);

  const uploadUrlRes = await fetch(tensrApiUrl(`/datasets/upload-url?scope=${scope}`), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      filename: fileName,
      content_type: file.type || 'application/octet-stream',
    }),
  });
  if (handleUnauthorizedResponse(uploadUrlRes)) {
    throw new Error('Session expired');
  }
  if (!uploadUrlRes.ok) {
    throw new Error(await uploadUrlRes.text());
  }

  const presign = (await uploadUrlRes.json()) as {
    mode?: string;
    dataset_id?: string;
    upload_url?: string;
    s3_key?: string;
  };

  if (presign.mode === 's3' && presign.upload_url && presign.dataset_id && presign.s3_key) {
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener('progress', event => {
        if (event.lengthComputable && onProgress) {
          onProgress(5 + Math.round((event.loaded / event.total) * 85));
        }
      });
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`S3 upload failed (${xhr.status})`));
      });
      xhr.addEventListener('error', () => reject(new Error('Network error during S3 upload')));
      xhr.open('PUT', presign.upload_url!);
      if (file.type) xhr.setRequestHeader('Content-Type', file.type);
      xhr.send(file);
    });

    onProgress?.(92);
    const completeRes = await fetch(
      tensrApiUrl(`/datasets/${presign.dataset_id}/complete-upload?scope=${scope}`),
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          s3_key: presign.s3_key,
          filename: fileName,
        }),
      }
    );
    if (handleUnauthorizedResponse(completeRes)) {
      throw new Error('Session expired');
    }
    if (!completeRes.ok) {
      throw new Error(await completeRes.text());
    }
    const body = (await completeRes.json()) as DatasetUploadResult;
    if (!body.dataset_id) {
      throw new Error('Upload succeeded but no dataset id returned');
    }
    onProgress?.(100);
    return body;
  }

  // Local dev without DATASET_BUCKET
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file);
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener('progress', event => {
      if (event.lengthComputable && onProgress) {
        onProgress(5 + Math.round((event.loaded / event.total) * 90));
      }
    });
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const body = JSON.parse(xhr.responseText || '{}') as DatasetUploadResult;
          if (!body.dataset_id) {
            reject(new Error('Upload succeeded but no dataset id returned'));
            return;
          }
          onProgress?.(100);
          resolve(body);
        } catch {
          reject(new Error('Invalid response from server'));
        }
      } else {
        reject(new Error(xhr.responseText || `Upload failed (${xhr.status})`));
      }
    });
    xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
    xhr.open('POST', tensrApiUrl(`/datasets/upload?scope=${scope}`));
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.send(formData);
  });
}
