import {
  contentTypeForDatasetUpload,
  resolveUploadTarget,
  waitForFinishedUpload,
} from './upload-dataset';

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

describe('waitForFinishedUpload', () => {
  const messages = [
    'This file has more rows than the plan allows.',
    'The sheet could not be read.',
    'That file is empty.',
    'The columns could not be named.',
    'Storage did not accept the file.',
    'The archive is incomplete.',
    'A required field is missing.',
    'The table has no rows.',
    'The encoding could not be read.',
    'The workbook has no sheets.',
    'The header row is blank.',
    'The file is still locked.',
  ];

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('polls the finish status and returns the file id when it is ready', async () => {
    const urls: string[] = [];
    jest.spyOn(global, 'fetch').mockImplementation(async input => {
      const url = String(input);
      urls.push(url);
      const status = urls.length < 3 ? 'running' : 'ready';
      return { ok: true, json: async () => ({ status }) } as Response;
    });
    const result = await waitForFinishedUpload('file-9', 'token', {}, undefined, 5, 0);
    expect(result).toEqual({ dataset_id: 'file-9' });
    expect(urls.every(url => url.includes('/datasets/file-9/upload-status'))).toBe(true);
  });

  it.each(messages)('shows the job message when the finish failed: %s', async message => {
    const urls: string[] = [];
    jest.spyOn(global, 'fetch').mockImplementation(async input => {
      urls.push(String(input));
      return { ok: true, json: async () => ({ status: 'failed', message }) } as Response;
    });
    await expect(waitForFinishedUpload('file-9', 'token', {}, undefined, 3, 0)).rejects.toThrow(
      message
    );
    expect(urls.every(url => url.includes('/upload-status'))).toBe(true);
  });
});
