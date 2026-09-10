import { contentTypeForDatasetUpload } from './upload-dataset';

describe('contentTypeForDatasetUpload', () => {
  it('uses the browser MIME type when present', () => {
    expect(contentTypeForDatasetUpload('text/csv')).toBe('text/csv');
  });

  it('falls back when CSV has an empty type so S3 presign and PUT match', () => {
    expect(contentTypeForDatasetUpload('')).toBe('application/octet-stream');
    expect(contentTypeForDatasetUpload(undefined)).toBe('application/octet-stream');
    expect(contentTypeForDatasetUpload('   ')).toBe('application/octet-stream');
  });
});
