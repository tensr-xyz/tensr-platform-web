import { resolveWorkspaceDatasetId, getDatasetIdFromTab } from './workspace-dataset';
import type { Tab } from '@/stores/tabs-store';

describe('resolveWorkspaceDatasetId', () => {
  const datasetId = '11111111-1111-4111-8111-111111111111';
  const projectId = '22222222-2222-4222-8222-222222222222';

  const tab: Tab = {
    id: 'tab-1',
    name: 'data.csv',
    type: 'spreadsheet' as Tab['type'],
    content: '',
    isDirty: false,
    data: {
      filePath: projectId,
      fileId: datasetId,
      initialColumns: [{ id: 'Age', accessor: 'Age', header: 'Age', width: 80, type: 'numeric' }],
      initialData: [{ Age: 25 }],
    },
  };

  it('prefers explicit datasetId on tab data', () => {
    expect(
      getDatasetIdFromTab({
        ...tab,
        data: { ...tab.data, datasetId, fileId: '33333333-3333-4333-8333-333333333333' },
      })
    ).toBe(datasetId);
  });

  it('falls back to fileId when filePath is project id', () => {
    expect(getDatasetIdFromTab(tab)).toBe(datasetId);
    expect(
      resolveWorkspaceDatasetId({
        tab,
        projectId,
        fileSystem: [{ fileId: datasetId }],
      })
    ).toBe(datasetId);
  });
});
