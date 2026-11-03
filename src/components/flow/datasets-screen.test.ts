import {
  exportFormatFor,
  fileKind,
  groupDatasets,
  lowerWhen,
  relativeWhen,
  visibleGroups,
} from './datasets-screen';

const rows = [
  { dataset_id: 'up1', original_filename: 'brand.sav', updated_at: '2026-11-01T10:00:00Z' },
  {
    dataset_id: 'v1',
    original_filename: 'brand stacked.sav',
    parent_dataset_id: 'up1',
    lineage_label: 'Stacked',
    updated_at: '2026-11-02T10:00:00Z',
  },
  {
    dataset_id: 'v2',
    original_filename: 'brand weighted.sav',
    parent_dataset_id: 'v1',
    lineage_label: 'Stacked, raked',
    updated_at: '2026-11-03T09:00:00Z',
  },
  { dataset_id: 'up2', original_filename: 'tariff.csv', updated_at: '2026-10-20T10:00:00Z' },
  {
    dataset_id: 'orphan',
    original_filename: 'churn coded.xlsx',
    parent_dataset_id: 'gone',
    updated_at: '2026-10-25T10:00:00Z',
  },
  { original_filename: 'no id' },
];

describe('datasets screen grouping', () => {
  it('puts every version under the upload its parent chain leads to', () => {
    const groups = groupDatasets(rows);
    expect(groups.map(group => group.root.dataset_id)).toEqual(['up1', 'orphan', 'up2']);
    expect(groups[0].versions.map(row => row.dataset_id)).toEqual(['v2', 'v1']);
    expect(groups[1].versions).toEqual([]);
  });

  it('survives a parent loop', () => {
    const groups = groupDatasets([
      { dataset_id: 'a', parent_dataset_id: 'b' },
      { dataset_id: 'b', parent_dataset_id: 'a' },
    ]);
    expect(groups.flatMap(group => [group.root, ...group.versions])).toHaveLength(2);
  });

  it('filters by view', () => {
    const groups = groupDatasets(rows);
    const all = () => true;
    expect(visibleGroups(groups, 'uploads', all).map(item => item.group.root.dataset_id)).toEqual([
      'up1',
      'up2',
    ]);
    expect(visibleGroups(groups, 'all', all)).toHaveLength(3);
    expect(visibleGroups(groups, 'versions', all).map(item => item.group.root.dataset_id)).toEqual([
      'v2',
      'v1',
      'orphan',
    ]);
    const weighted = visibleGroups(groups, 'uploads', row => row.dataset_id === 'v2');
    expect(weighted).toHaveLength(1);
    expect(weighted[0].rootMatches).toBe(false);
    expect(weighted[0].versions.map(row => row.dataset_id)).toEqual(['v2']);
  });
});

describe('datasets screen labels', () => {
  const now = new Date('2026-11-03T12:00:00');
  it('says when a file changed', () => {
    expect(relativeWhen('2026-11-03T11:48:00', now)).toBe('12 min ago');
    expect(relativeWhen('2026-11-03T11:59:40', now)).toBe('Just now');
    expect(relativeWhen('2026-11-03T08:30:00', now)).toBe('3 h ago');
    expect(relativeWhen('2026-11-02T20:00:00', now)).toBe('Yesterday');
    expect(relativeWhen('2026-10-20T20:00:00', now)).toBe('20 Oct');
    expect(relativeWhen('2025-10-20T20:00:00', now)).toBe('20 Oct 2025');
    expect(relativeWhen(undefined, now)).toBe('—');
    expect(lowerWhen('Yesterday')).toBe('yesterday');
    expect(lowerWhen('3 Nov')).toBe('3 Nov');
  });

  it('reads the file type and export format from the name', () => {
    expect(fileKind('a.sav')).toBe('SAV');
    expect(fileKind('noext')).toBe('FILE');
    expect(exportFormatFor('a.SAV')).toBe('sav');
    expect(exportFormatFor('a.xls')).toBe('xlsx');
    expect(exportFormatFor('a.dta')).toBe('dta');
    expect(exportFormatFor('a.parquet')).toBe('csv');
  });
});
