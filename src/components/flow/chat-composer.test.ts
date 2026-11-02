import { insertColumnMention, readChatAttachments } from './chat-composer';

describe('chat composer', () => {
  it('inserts a column in place of the @', () => {
    expect(insertColumnMention('Compare @', 'region')).toBe('Compare region');
    expect(insertColumnMention('Compare', 'region')).toBe('Compare region');
    expect(insertColumnMention('', 'comments')).toBe('comments');
  });

  it('reads a csv attachment and rejects a type the upload path does not take', async () => {
    const csv = new File(['a,b\n1,2\n'], 'extra.csv', { type: 'text/csv' });
    const exe = new File(['no'], 'run.exe', { type: 'application/octet-stream' });
    const big = new File(['x'], 'big.csv', { type: 'text/csv' });
    Object.defineProperty(big, 'size', { value: 9 * 1024 * 1024 });
    const result = await readChatAttachments([csv, exe, big]);
    expect(result.accepted).toEqual([
      { filename: 'extra.csv', content_base64: btoa('a,b\n1,2\n') },
    ]);
    expect(result.rejected.join(' ')).toContain('run.exe');
    expect(result.rejected.join(' ')).toContain('larger than 8 MB');
  });
});
