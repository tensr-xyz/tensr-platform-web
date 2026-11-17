import {
  controlsForViewer,
  filterRefFromSelections,
  isAllSelection,
  normalizeControl,
  normalizeControls,
  normalizeSavedViews,
  optionLabel,
  publicControl,
  viewerControlChipText,
} from './share-viewer-controls';

describe('share viewer controls', () => {
  it('normalises combo box to dropdown with a custom All label', () => {
    const control = normalizeControl({
      type: 'combo_box',
      column: 'region',
      label: 'Region',
      all_label: 'Everywhere',
      values: ['N', 'S'],
      value_labels: { N: 'North' },
    });
    expect(control?.type).toBe('dropdown');
    expect(control?.allLabel).toBe('Everywhere');
    expect(optionLabel('N', control?.valueLabels)).toBe('North');
  });

  it('hides explore columns and hide_from_viewers controls', () => {
    const controls = normalizeControls([
      { id: 'a', type: 'dropdown', column: 'region', values: ['N'] },
      { id: 'b', type: 'listbox', column: 'segment', values: ['A'], hide_from_viewers: true },
      { id: 'c', type: 'dropdown', column: 'wave', values: ['1'] },
    ]);
    const visible = controlsForViewer(controls, {
      exploreMode: true,
      exploreHiddenColumns: ['wave'],
    });
    expect(visible.map(row => row.id)).toEqual(['a']);
  });

  it('builds filter_ref and treats All as no filter', () => {
    const controls = normalizeControls([
      {
        id: 'region',
        type: 'dropdown',
        column: 'region',
        all_label: '(All)',
        values: ['North', 'South'],
      },
      { id: 'seg', type: 'listbox', column: 'segment', values: ['A', 'B'] },
    ]);
    expect(isAllSelection(controls[0], '(All)')).toBe(true);
    expect(filterRefFromSelections(controls, { region: '(All)' })).toBeNull();
    expect(filterRefFromSelections(controls, { region: 'North', seg: ['A', 'B'] })).toEqual({
      combine: 'and',
      filters: [
        { column: 'region', op: 'equals', value: 'North' },
        { column: 'segment', op: 'in', value: ['A', 'B'] },
      ],
    });
  });

  it('exposes option labels on the public control payload', () => {
    const control = normalizeControl({
      id: 'r',
      type: 'dropdown',
      column: 'region',
      values: ['1', '2'],
      value_labels: { '1': 'North', '2': 'South' },
    });
    expect(control).not.toBeNull();
    expect(publicControl(control!).options[0]).toEqual({ value: '1', label: 'North' });
  });

  it('formats viewer chip text with labels, not codes', () => {
    const control = publicControl(
      normalizeControl({
        id: 'g',
        type: 'dropdown',
        column: 'gender',
        label: 'Gender',
        values: ['1', '2'],
        value_labels: { '1': 'Women', '2': 'Men' },
      })!
    );
    expect(viewerControlChipText(control, null)).toEqual({
      text: 'Gender: All',
      active: false,
    });
    expect(viewerControlChipText(control, '1')).toEqual({
      text: 'Gender: Women',
      active: true,
    });
  });

  it('normalises saved views for the filter bar', () => {
    expect(
      normalizeSavedViews([
        { id: 'v1', name: 'North view', values: { region: 'N' } },
        { id: '', name: 'bad' },
      ])
    ).toEqual([{ id: 'v1', name: 'North view', values: { region: 'N' } }]);
  });
});
