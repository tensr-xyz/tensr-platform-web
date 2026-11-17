import {
  CODEFRAME_IMPORT_MODES,
  codeframeImportSummary,
  codesForImportMode,
  countCodeframeNets,
  matchImportedThemes,
  mergeCodeframeThemes,
  shouldUseImportFrameApply,
  textColumnFromCodeColumn,
} from './codeframe-import';

describe('codeframe import helpers', () => {
  it('derives the verbatim column from a coded column name', () => {
    expect(textColumnFromCodeColumn('comment_codes')).toBe('comment');
    expect(textColumnFromCodeColumn('Q22')).toBe('Q22');
  });

  it('counts matching and new themes against the current frame', () => {
    const current = [
      { id: 'price', label: 'Price' },
      { id: 'staff', label: 'Staff' },
    ];
    const imported = [
      { id: 'price', label: 'Price too high' },
      { id: 'quality', label: 'Quality' },
      { id: 'wait', label: 'Wait time' },
    ];
    expect(matchImportedThemes(imported, current)).toEqual({ matched: 1, newCount: 2 });
  });

  it('matches rail rows that only have labels', () => {
    const current = [{ id: 'Price', label: 'Price' }];
    const imported = [{ id: 'price', label: 'Price' }];
    expect(matchImportedThemes(imported, current).matched).toBe(1);
  });

  it('builds the Paper 9d summary with nets', () => {
    const summary = codeframeImportSummary(
      {
        codes: [
          { id: 'a', label: 'A', net: 'Value' },
          { id: 'b', label: 'B', net: 'Service' },
          { id: 'c', label: 'C', net: 'Service' },
        ],
        code_count: 3,
        net_count: 2,
      },
      [{ id: 'a', label: 'A' }]
    );
    expect(summary).toBe('3 codes, 2 nets. 1 match current themes, 2 are new.');
    expect(countCodeframeNets([{ id: 'a', label: 'A', net: 'Value' }])).toBe(1);
  });

  it('merges imported themes into the current frame', () => {
    const merged = mergeCodeframeThemes(
      [
        { id: 'price', label: 'Price', keywords: ['cost'] },
        { id: 'staff', label: 'Staff', keywords: ['staff'] },
      ],
      [
        { id: 'price', label: 'Price too high', keywords: ['expensive'] },
        { id: 'quality', label: 'Quality', keywords: ['build'] },
      ]
    );
    expect(merged.map(item => item.id)).toEqual(['price', 'staff', 'quality']);
    expect(merged[0].label).toBe('Price too high');
    expect(codesForImportMode('replace', merged, []).map(item => item.id)).toEqual([
      'price',
      'staff',
      'quality',
    ]);
    expect(shouldUseImportFrameApply('keep_precoded')).toBe(true);
    expect(shouldUseImportFrameApply('replace')).toBe(false);
    expect(CODEFRAME_IMPORT_MODES.map(item => item.label)).toEqual([
      'Use theirs, re-code answers',
      'Merge with current',
      'Keep pre-coded answers',
    ]);
  });
});
