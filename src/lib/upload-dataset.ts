import { tensrApiUrl } from '@/lib/tensr-api-url';
import { handleUnauthorizedResponse } from '@/lib/session-expired';
import { PERSONAL_ACCOUNT_KEY } from '@/lib/active-organisation';
import { ApiRequestError, formatApiErrorMessage } from '@/lib/api-error';

export type UploadScope = 'personal' | 'team' | 'workspace';

/** Team scope and org header for the workspace the user has open. */
export function resolveUploadTarget(
  scope: UploadScope,
  savedOrgId: string | null
): { scope: 'personal' | 'team'; orgId: string | null } {
  const orgId = savedOrgId && savedOrgId !== PERSONAL_ACCOUNT_KEY ? savedOrgId : null;
  if (scope === 'workspace') {
    return orgId ? { scope: 'team', orgId } : { scope: 'personal', orgId: null };
  }
  return { scope, orgId };
}

function activeOrgIdFromStorage(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('activeOrganizationId');
}

export type DatasetUploadResult = {
  dataset_id: string;
  [key: string]: unknown;
};

/** Same Content-Type must be signed on the presign and sent on the S3 PUT. */
export function contentTypeForDatasetUpload(fileType?: string | null): string {
  const trimmed = (fileType || '').trim();
  return trimmed || 'application/octet-stream';
}

const GATEWAY_TIMEOUT = new Set([500, 502, 503, 504]);

/** The finish call can outlive the gateway. The file is often stored anyway. */
async function datasetIfStored(
  datasetId: string,
  token: string,
  orgHeader: Record<string, string>
): Promise<DatasetUploadResult | null> {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    const res = await fetch(tensrApiUrl(`/datasets/${datasetId}`), {
      headers: { Authorization: `Bearer ${token}`, ...orgHeader },
    }).catch(() => null);
    if (!res || !res.ok) continue;
    const body = (await res.json().catch(() => null)) as {
      dataset_id?: string;
      id?: string;
    } | null;
    const id = body?.dataset_id || body?.id;
    if (id) return { ...(body || {}), dataset_id: String(id) };
  }
  return null;
}

/** Presigned S3 upload when bucket is configured; direct POST for local dev only. */
export async function uploadDatasetFile(
  file: File,
  token: string,
  requestedScope: UploadScope,
  onProgress?: (pct: number) => void,
  sheet?: string
): Promise<DatasetUploadResult> {
  const fileName = file.name;
  const contentType = contentTypeForDatasetUpload(file.type);
  const { scope, orgId } = resolveUploadTarget(requestedScope, activeOrgIdFromStorage());
  const orgHeader: Record<string, string> = orgId ? { 'X-Organization-Id': orgId } : {};
  onProgress?.(5);

  const uploadUrlRes = await fetch(tensrApiUrl(`/datasets/upload-url?scope=${scope}`), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...orgHeader,
    },
    body: JSON.stringify({
      filename: fileName,
      content_type: contentType,
    }),
  }).catch(() => {
    throw new Error(
      'Could not reach Tensr to start the upload. Check your connection, then try again.'
    );
  });
  if (handleUnauthorizedResponse(uploadUrlRes)) {
    throw new Error('Session expired');
  }
  if (!uploadUrlRes.ok) {
    throw new Error(
      formatApiErrorMessage(new ApiRequestError(uploadUrlRes.status, await uploadUrlRes.text()))
    );
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
      xhr.addEventListener('error', () =>
        reject(
          new Error(
            'Could not reach storage to finish the upload. Check your connection and try again.'
          )
        )
      );
      xhr.open('PUT', presign.upload_url!);
      xhr.setRequestHeader('Content-Type', contentType);
      xhr.send(file);
    });

    onProgress?.(92);
    const sheetQuery = sheet ? `&sheet=${encodeURIComponent(sheet)}` : '';
    const completeRes = await fetch(
      tensrApiUrl(`/datasets/${presign.dataset_id}/complete-upload?scope=${scope}${sheetQuery}`),
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...orgHeader,
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
      const bodyText = await completeRes.text();
      if (GATEWAY_TIMEOUT.has(completeRes.status)) {
        const stored = await datasetIfStored(presign.dataset_id, token, orgHeader);
        if (stored) return stored;
      }
      throw new Error(formatApiErrorMessage(new ApiRequestError(completeRes.status, bodyText)));
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
        reject(
          new Error(formatApiErrorMessage(new ApiRequestError(xhr.status, xhr.responseText || '')))
        );
      }
    });
    xhr.addEventListener('error', () =>
      reject(
        new Error('Could not reach Tensr to upload the file. Check your connection and try again.')
      )
    );
    const sheetQuery = sheet ? `&sheet=${encodeURIComponent(sheet)}` : '';
    xhr.open('POST', tensrApiUrl(`/datasets/upload?scope=${scope}${sheetQuery}`));
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    if (orgId) xhr.setRequestHeader('X-Organization-Id', orgId);
    xhr.send(formData);
  });
}
