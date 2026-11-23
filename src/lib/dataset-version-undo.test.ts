import { DATASET_VERSION_RESTORED_NOTE } from './dataset-version-undo';

describe('DATASET_VERSION_RESTORED_NOTE', () => {
  it('replaces the delete/save footer copy after Undo restores a version', () => {
    expect(DATASET_VERSION_RESTORED_NOTE).toBe('Restored the previous version.');
    expect(DATASET_VERSION_RESTORED_NOTE.toLowerCase()).not.toContain('deleted');
    expect(DATASET_VERSION_RESTORED_NOTE.toLowerCase()).not.toContain('saved as a new version');
  });
});
