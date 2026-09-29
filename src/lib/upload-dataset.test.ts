import { contentTypeForDatasetUpload, resolveUploadTarget } from './upload-dataset';

describe('resolveUploadTarget', () => {
  it('uploads to the open team with its organisation id', () => {
    expect(resolveUploadTarget('workspace', 'prolific')).toEqual({
      scope: 'team',
      orgId: 'prolific',
    });
  });

  it('uploads to personal files from the personal workspace', () => {
    expect(resolveUploadTarget('workspace', 'PERSONAL_ACCOUNT')).toEqual({
      scope: 'personal',
      orgId: null,
    });
    expect(resolveUploadTarget('workspace', null)).toEqual({ scope: 'personal', orgId: null });
  });

  it('keeps an explicit personal upload personal while a team is open', () => {
    expect(resolveUploadTarget('personal', 'prolific')).toEqual({
      scope: 'personal',
      orgId: 'prolific',
    });
  });
});

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
