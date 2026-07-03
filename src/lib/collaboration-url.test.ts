import { buildCollaborateUrl, resolveCollaborationDatasetId } from './collaboration-url';

describe('collaboration-url', () => {
  it('buildCollaborateUrl includes session only when dataset omitted', () => {
    const path = buildCollaborateUrl({ sessionId: 'sess-1' });
    expect(path).toBe('/workspace/collaborate?session=sess-1');
    expect(path).not.toContain('datasetId');
  });

  it('buildCollaborateUrl includes session and optional dataset params', () => {
    const path = buildCollaborateUrl({
      sessionId: 'sess-1',
      datasetId: 'ds-1',
      datasetName: 'My data',
    });
    expect(path).toContain('/workspace/collaborate');
    expect(path).toContain('session=sess-1');
    expect(path).toContain('datasetId=ds-1');
    expect(path).toContain('name=My');
  });

  it('resolveCollaborationDatasetId prefers explicit id', () => {
    expect(
      resolveCollaborationDatasetId('explicit', { filePath: '/other', datasetId: 'from-session' })
    ).toBe('explicit');
  });

  it('resolveCollaborationDatasetId falls back to session fields', () => {
    expect(resolveCollaborationDatasetId(null, { datasetId: 'ds-2' })).toBe('ds-2');
    expect(resolveCollaborationDatasetId(undefined, { filePath: '/ds-3' })).toBe('ds-3');
  });

  it('resolveCollaborationDatasetId uses session datasetId without query param', () => {
    const datasetId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    expect(resolveCollaborationDatasetId(null, { datasetId })).toBe(datasetId);
  });
});
